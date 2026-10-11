from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str | None = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    full_name: str | None = None
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class ChatRequest(BaseModel):
    question: str
    conversation_id: str | None = None
    model: str | None = None         # backend identifier: "gemini", "openai", "mock"
    model_name: str | None = None    # specific model name: "gemini-3.5-flash-lite", etc.
    document_id: str | None = None


class ChatResponse(BaseModel):
    answer: str
    query_type: str
    model_used: str
    latency_ms: float
    chunks_used: int
    confidence: float
    conversation_id: str


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    filename: str
    file_type: str
    status: str
    created_at: datetime


class AnalysisResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    document_id: str | None = None
    query: str
    query_type: str | None = None
    model: str | None = None
    retrieved_chunks: int | None = None
    context_tokens: int | None = None
    confidence: float | None = None
    latency_ms: float | None = None
    created_at: datetime


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    role: str
    content: str
    query_type: str | None = None
    model: str | None = None
    latency_ms: float | None = None
    chunks_used: int | None = None
    confidence: float | None = None
    created_at: datetime


class ConversationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str | None = None
    created_at: datetime
    updated_at: datetime


class ConversationDetailResponse(ConversationResponse):
    messages: list[MessageResponse] = []