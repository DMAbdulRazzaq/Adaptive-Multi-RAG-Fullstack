from pymongo import MongoClient
from bson import ObjectId
import certifi
from .config import settings

client: MongoClient | None = None


def get_client() -> MongoClient:
    global client
    if client is None:
        client = MongoClient(
            settings.mongodb_url,
            tlsCAFile=certifi.where(),
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            socketTimeoutMS=10000,
        )
    return client


def get_db():
    cli = get_client()
    return cli[settings.mongodb_db_name]


def init_db():
    """Ensure essential indexes exist in MongoDB."""
    db = get_db()
    # Users collection
    db.users.create_index("email", unique=True)
    # Documents collection
    db.documents.create_index([("user_id", 1), ("created_at", -1)])
    # Conversations collection
    db.conversations.create_index([("user_id", 1), ("updated_at", -1)])
    # Messages collection
    db.messages.create_index([("conversation_id", 1), ("created_at", 1)])
    # Analysis collection
    db.analysis.create_index([("user_id", 1), ("created_at", -1)])


def to_dict_with_id(doc: dict | None) -> dict | None:
    """Helper to convert MongoDB `_id` ObjectId to a string `id` field."""
    if not doc:
        return None
    d = dict(doc)
    if "_id" in d:
        d["id"] = str(d.pop("_id"))
    # Also handle foreign key ObjectIds if any
    for k in ["user_id", "document_id", "conversation_id"]:
        if k in d and isinstance(d[k], ObjectId):
            d[k] = str(d[k])
    return d


def to_object_id(val: str | None) -> ObjectId | None:
    if not val:
        return None
    try:
        return ObjectId(val)
    except Exception:
        return None