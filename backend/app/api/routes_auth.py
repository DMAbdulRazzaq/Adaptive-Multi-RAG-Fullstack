from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)

from ..database import get_db, to_dict_with_id, to_object_id
from ..schemas import (
    TokenResponse,
    UserCreate,
    UserLogin,
    UserResponse,
)
from ..security import (
    create_access_token,
    decode_access_token,
)
from ..services.auth_service import (
    login_user,
    register_user,
)


router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
)


security = HTTPBearer()


@router.post(
    "/register",
    response_model=TokenResponse,
)
def register(
    data: UserCreate,
    db = Depends(get_db),
):
    try:
        user = register_user(
            db,
            data.email,
            data.password,
            data.full_name,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    token = create_access_token(user["id"])

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user,
    }


@router.post(
    "/login",
    response_model=TokenResponse,
)
def login(
    data: UserLogin,
    db = Depends(get_db),
):
    result = login_user(
        db,
        data.email,
        data.password,
    )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token, user = result

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user,
    }


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db = Depends(get_db),
):
    try:
        user_id = decode_access_token(credentials.credentials)
    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
        )

    obj_id = to_object_id(user_id)
    if not obj_id:
        raise HTTPException(
            status_code=401,
            detail="Invalid user token identifier",
        )

    user_doc = db.users.find_one({"_id": obj_id})
    if not user_doc:
        raise HTTPException(
            status_code=401,
            detail="User not found",
        )

    return to_dict_with_id(user_doc)


@router.get(
    "/me",
    response_model=UserResponse,
)
def me(
    user: dict = Depends(get_current_user),
):
    return user