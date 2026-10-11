from pathlib import Path
import shutil
from datetime import datetime, timezone

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
)

from ..config import settings
from ..database import get_db, to_dict_with_id, to_object_id
from ..schemas import DocumentResponse
from .routes_auth import get_current_user


router = APIRouter(
    prefix="/api/documents",
    tags=["Documents"],
)


SUPPORTED_EXTENSIONS = {
    ".pdf",
    ".txt",
    ".docx",
    ".md",
}


def utc_now():
    return datetime.now(timezone.utc)


@router.post(
    "/upload",
    response_model=DocumentResponse,
)
def upload_document(
    file: UploadFile = File(...),
    db = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """
    Upload a document for the currently authenticated user.
    """
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No filename provided",
        )

    extension = Path(file.filename).suffix.lower()

    if extension not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported file type. "
                "Allowed: PDF, TXT, DOCX, MD"
            ),
        )

    # Create a separate folder for each user.
    user_directory = (
        Path(settings.upload_storage_path)
        / str(user["id"])
    )

    user_directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    # Prevent path traversal by using only the filename.
    safe_filename = Path(file.filename).name
    file_path = user_directory / safe_filename

    # Avoid accidentally overwriting an existing file.
    if file_path.exists():
        stem = file_path.stem
        suffix = file_path.suffix
        counter = 1
        while file_path.exists():
            file_path = (
                user_directory
                / f"{stem}_{counter}{suffix}"
            )
            counter += 1

    # Save file to disk.
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(
            file.file,
            buffer,
        )

    # Store metadata in MongoDB.
    doc_data = {
        "user_id": user["id"],
        "filename": file_path.name,
        "file_type": extension,
        "file_path": str(file_path),
        "status": "uploaded",
        "created_at": utc_now(),
    }

    result = db.documents.insert_one(doc_data)
    doc_data["_id"] = result.inserted_id

    return to_dict_with_id(doc_data)


@router.get(
    "",
    response_model=list[DocumentResponse],
)
def list_documents(
    db = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """
    Return only documents belonging to the logged-in user.
    """
    cursor = db.documents.find({"user_id": user["id"]}).sort("created_at", -1)
    return [to_dict_with_id(doc) for doc in cursor]


@router.get(
    "/{document_id}",
    response_model=DocumentResponse,
)
def get_document(
    document_id: str,
    db = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """
    Get one document belonging to the logged-in user.
    """
    obj_id = to_object_id(document_id)
    if not obj_id:
        raise HTTPException(status_code=404, detail="Document not found")

    document = db.documents.find_one({"_id": obj_id, "user_id": user["id"]})

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Document not found",
        )

    return to_dict_with_id(document)


@router.delete(
    "/{document_id}",
)
def delete_document(
    document_id: str,
    db = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """
    Delete a document belonging to the logged-in user.
    """
    obj_id = to_object_id(document_id)
    if not obj_id:
        raise HTTPException(status_code=404, detail="Document not found")

    document = db.documents.find_one({"_id": obj_id, "user_id": user["id"]})

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Document not found",
        )

    # Delete physical file.
    file_path_str = document.get("file_path")
    if file_path_str:
        file_path = Path(file_path_str)
        if file_path.exists():
            file_path.unlink()

    # Delete database record.
    db.documents.delete_one({"_id": obj_id})

    # Also clean up related analyses for this document.
    db.analysis.delete_many({"document_id": document_id})

    return {
        "message": "Document deleted successfully",
        "document_id": document_id,
    }