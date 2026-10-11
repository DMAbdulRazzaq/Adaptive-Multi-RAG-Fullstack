from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException

from ..database import get_db, to_dict_with_id, to_object_id
from ..schemas import (
    ChatRequest,
    ChatResponse,
    ConversationDetailResponse,
    ConversationResponse,
)
from ..services.rag_service import rag_service
from .routes_auth import get_current_user


router = APIRouter(
    prefix="/api/chat",
    tags=["Chat"],
)


def utc_now():
    return datetime.now(timezone.utc)


def _get_owned_conversation(db, conversation_id: str, user_id: str) -> dict:
    obj_id = to_object_id(conversation_id)
    if not obj_id:
        raise HTTPException(status_code=404, detail="Conversation not found")

    conversation = db.conversations.find_one({"_id": obj_id, "user_id": user_id})
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return conversation


@router.post("", response_model=ChatResponse)
def chat(
    data: ChatRequest,
    db = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """
    Ask a question about one of the user's documents.
    Runs the Adaptive RAG pipeline and stores the exchange.
    """
    if not data.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    if not data.document_id:
        raise HTTPException(
            status_code=400,
            detail="document_id is required — pick a document to ask about",
        )

    doc_obj_id = to_object_id(data.document_id)
    if not doc_obj_id:
        raise HTTPException(status_code=404, detail="Document not found")

    document = db.documents.find_one({"_id": doc_obj_id, "user_id": user["id"]})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    file_path = document.get("file_path")
    if not file_path:
        raise HTTPException(
            status_code=400,
            detail="This document has no stored file to search",
        )

    now = utc_now()

    # Find or create the conversation this message belongs to.
    if data.conversation_id:
        conv_doc = _get_owned_conversation(db, data.conversation_id, user["id"])
        conversation_id = str(conv_doc["_id"])
        db.conversations.update_one(
            {"_id": conv_doc["_id"]},
            {"$set": {"updated_at": now}},
        )
    else:
        new_conv = {
            "user_id": user["id"],
            "title": data.question.strip()[:100],
            "created_at": now,
            "updated_at": now,
        }
        res = db.conversations.insert_one(new_conv)
        conversation_id = str(res.inserted_id)

    # Store user's message immediately
    user_msg = {
        "conversation_id": conversation_id,
        "user_id": user["id"],
        "role": "user",
        "content": data.question,
        "created_at": now,
    }
    db.messages.insert_one(user_msg)

    try:
        result = rag_service.query(
            question=data.question,
            document_path=file_path,
            backend=data.model or None,
            model=data.model_name or None,
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail="The stored file for this document is missing on disk",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        provider_status = getattr(exc, "code", None)
        if provider_status == 503:
            raise HTTPException(
                status_code=503,
                detail="Gemini is temporarily overloaded. Please retry in a minute.",
            )
        if provider_status == 429:
            raise HTTPException(
                status_code=429,
                detail="Gemini's request limit was reached. Please wait and retry.",
            )

        import traceback
        traceback.print_exc()

        raise HTTPException(
            status_code=502,
            detail=f"RAG pipeline error: {type(exc).__name__}: {exc}",
        )

    assistant_msg = {
        "conversation_id": conversation_id,
        "user_id": user["id"],
        "role": "assistant",
        "content": result["answer"],
        "query_type": result["query_type"],
        "model": result["model_used"],
        "latency_ms": result["latency_ms"],
        "chunks_used": result["chunks_used"],
        "confidence": result["confidence"],
        "created_at": utc_now(),
    }
    db.messages.insert_one(assistant_msg)

    analysis_doc = {
        "user_id": user["id"],
        "document_id": str(data.document_id),
        "query": data.question,
        "query_type": result["query_type"],
        "model": result["model_used"],
        "retrieval_steps": str(result.get("retrieval_steps")),
        "retrieved_chunks": result["chunks_used"],
        "context_tokens": result.get("context_tokens"),
        "confidence": result["confidence"],
        "latency_ms": result["latency_ms"],
        "created_at": utc_now(),
    }
    db.analysis.insert_one(analysis_doc)

    return ChatResponse(
        answer=result["answer"],
        query_type=result["query_type"],
        model_used=result["model_used"],
        latency_ms=result["latency_ms"],
        chunks_used=result["chunks_used"],
        confidence=result["confidence"],
        conversation_id=conversation_id,
    )


@router.get("/conversations", response_model=list[ConversationResponse])
def list_conversations(
    db = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    cursor = db.conversations.find({"user_id": user["id"]}).sort("updated_at", -1)
    return [to_dict_with_id(c) for c in cursor]


@router.get("/conversations/{conversation_id}", response_model=ConversationDetailResponse)
def get_conversation(
    conversation_id: str,
    db = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    conversation = _get_owned_conversation(db, conversation_id, user["id"])
    msg_cursor = db.messages.find({"conversation_id": conversation_id}).sort("created_at", 1)
    messages = [to_dict_with_id(m) for m in msg_cursor]

    detail = to_dict_with_id(conversation)
    detail["messages"] = messages
    return detail


@router.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: str,
    db = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    obj_id = to_object_id(conversation_id)
    if not obj_id:
        raise HTTPException(status_code=404, detail="Conversation not found")

    conversation = db.conversations.find_one({"_id": obj_id, "user_id": user["id"]})
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    db.conversations.delete_one({"_id": obj_id})
    db.messages.delete_many({"conversation_id": conversation_id})

    return {"message": "Conversation deleted", "conversation_id": conversation_id}


@router.get("/analysis")
def list_analysis(
    db = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Return historical analysis metrics for user queries."""
    cursor = db.analysis.find({"user_id": user["id"]}).sort("created_at", -1).limit(50)
    return [to_dict_with_id(a) for a in cursor]

