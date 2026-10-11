from datetime import datetime, timezone
from ..database import to_dict_with_id
from ..security import hash_password, verify_password, create_access_token


def utc_now():
    return datetime.now(timezone.utc)


def register_user(
    db,
    email: str,
    password: str,
    full_name: str | None = None,
):
    clean_email = email.lower().strip()
    existing_user = db.users.find_one({"email": clean_email})

    if existing_user:
        raise ValueError("Email is already registered")

    user_doc = {
        "email": clean_email,
        "password_hash": hash_password(password),
        "full_name": full_name,
        "is_active": True,
        "created_at": utc_now(),
    }

    result = db.users.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id

    return to_dict_with_id(user_doc)


def login_user(
    db,
    email: str,
    password: str,
):
    clean_email = email.lower().strip()
    user_doc = db.users.find_one({"email": clean_email})

    if not user_doc:
        return None

    if not verify_password(password, user_doc["password_hash"]):
        return None

    user = to_dict_with_id(user_doc)
    token = create_access_token(user["id"])

    return token, user