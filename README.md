# Adaptive Multi-Stage RAG Platform

An enterprise-grade, fullstack **Adaptive Multi-Stage Retrieval-Augmented Generation (RAG)** platform designed for deep reasoning, grounded document research, and real-time pipeline telemetry.

Built with **FastAPI**, **MongoDB Atlas**, **React (Vite)**, **FAISS**, **Recharts**, and multi-model intelligence powered by **Google Gemini 3.5 Flash** & **OpenAI GPT-4o-mini**.

---

## Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │          React 18 + Vite (SPA)         │
                      │  Modern Dark UI · Markdown · Recharts  │
                      └───────────────────┬────────────────────┘
                                          │ REST API / JWT
                                          ▼
                      ┌────────────────────────────────────────┐
                      │          FastAPI Async Backend         │
                      │  Auth · Document Store · Chat Pipeline │
                      └──────────┬──────────────────┬──────────┘
                                 │                  │
                ┌────────────────┴─────┐            └────────────────┐
                ▼                      ▼                             ▼
       ┌──────────────────┐   ┌──────────────────┐          ┌──────────────────┐
       │  MongoDB Atlas   │   │  Adaptive Router │          │   Vector Store   │
       │  Cloud Cluster   │   │  Classifier (k)  │          │   FAISS / NumPy  │
       │ Users, Chats,    │   └────────┬─────────┘          │ Pre-indexed docs │
       │ Documents & Logs │            │                    └────────┬─────────┘
       └──────────────────┘            │ Evidence                    │
                                       ▼ Retrieval                   ▼
                              ┌────────────────────────────────────────┐
                              │           RAG Pipeline Engine          │
                              │  Gemini Embeddings · Cross-Encoder     │
                              │  Context Compression · Grounding Check │
                              └──────────────────┬─────────────────────┘
                                                 │
                                                 ▼
                              ┌────────────────────────────────────────┐
                              │        Multi-LLM Synthesis Core        │
                              │  Gemini 3.5 Flash  ·  GPT-4o-mini      │
                              └────────────────────────────────────────┘
```

---

## Key Features & Capabilities

- **Adaptive Query Routing**: Classifies queries (*Reasoning*, *Summarization*, *Fact Retrieval*, *Multi-Hop*) to dynamically calibrate retrieval depth ($k$) and context compression.
- **Resilient Dual-Mode Embeddings**: Automatically falls back to Google's high-dimensional `gemini-embedding-001` API if local C++ / PyTorch `.dll` files are restricted by operating system security policies.
- **Interactive Live Telemetry & Analytics**:
  - **Latency Timeline**: Real-time response time tracking via Recharts Area graphs.
  - **Intent Classification Donut**: Breakdown of query complexity and routing choices.
  - **Retrieval Groundedness**: Dual-axis analysis correlating retrieved chunks against answer confidence.
  - **Query Tracing**: Step-by-step visibility into Routing $\rightarrow$ Retrieval $\rightarrow$ Context $\rightarrow$ LLM.
- **Enterprise Document Processing**: Supports PDF, DOCX, TXT, and Markdown with recursive semantic chunking.
- **Persistent Cloud Database**: MongoDB Atlas integration managing users, document catalogs, conversations, and granular analytical telemetry.
- **Modern Research UI**:
  - Full Markdown rendering with syntax highlighting and structured bullet lists.
  - Integrated copy-to-clipboard on AI responses.
  - Clean vector iconography powered by Lucide Icons.
  - Granular chat management (clear active conversation or delete past chats).

---

## Project Structure

```
Adaptive_Multi_RAG_Reactjs/
├── backend/
│   └── app/
│       ├── api/
│       │   ├── routes_auth.py       # User registration, login, JWT verification
│       │   ├── routes_chat.py       # RAG execution, conversations, analysis telemetry
│       │   └── routes_documents.py  # File upload, chunking, library management
│       ├── config.py                # Pydantic environment configuration
│       ├── database.py              # MongoDB Atlas client & index initialization
│       ├── main.py                  # FastAPI application entry point & CORS
│       ├── schemas.py               # Request/Response schemas with ObjectId mapping
│       ├── security.py              # Password hashing & JWT token management
│       └── services/
│           ├── auth_service.py      # Authentication business logic
│           └── rag_service.py       # Full-cycle RAG execution & index caching
├── rag/
│   ├── chunking/                    # Semantic chunker with token limits
│   ├── embeddings/                  # SentenceTransformers with Gemini API fallback
│   ├── generation/                  # Multi-provider LLM generators (Gemini / OpenAI)
│   ├── ingestion/                   # Multi-format document loader (PDF, DOCX, TXT)
│   ├── query_router/                # Query classifier for dynamic routing
│   ├── retrieval/                   # Adaptive retrieval, budget constraints & reranker
│   └── vector_store/                # FAISS indexing with NumPy similarity fallback
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AuthScreen.jsx       # User authentication interface
│   │   │   ├── ChatPanel.jsx        # Research chat, Markdown rendering & telemetry pills
│   │   │   ├── DocumentsPanel.jsx   # Document library management & upload zone
│   │   │   ├── LiveAnalysisPanel.jsx# Recharts analytics graphs & pipeline visualizer
│   │   │   └── Sidebar.jsx          # Workspace navigation & conversation history
│   │   ├── services/
│   │   │   └── api.js               # Centralized client for FastAPI endpoints
│   │   ├── App.jsx                  # Main application shell & router
│   │   └── index.css                # Dark theme design system
│   └── package.json
├── requirements.txt                 # Backend Python dependencies
├── .env.example                     # Environment template
└── README.md
```

---

## Getting Started Locally

### 1. Prerequisites
- Python 3.10+
- Node.js 18+ and npm
- A [MongoDB Atlas](https://cloud.mongodb.com/) account (or local MongoDB)
- A [Google AI Studio](https://aistudio.google.com/) API Key

---

### 2. Backend Setup

1. **Create and activate a virtual environment:**
   ```powershell
   python -m venv .venv
   .venv\Scripts\Activate.ps1   # On Windows
   # source .venv/bin/activate   # On Linux/macOS
   ```

2. **Install dependencies:**
   ```powershell
   pip install -r requirements.txt
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory:
   ```env
   # Database (MongoDB Atlas)
   MONGODB_URL="mongodb+srv://<username>:<password>@<cluster-url>/?retryWrites=true&w=majority"
   MONGODB_DB_NAME="adaptive_rag"

   # Security
   JWT_SECRET="generate-a-random-secure-secret-key"
   JWT_ALGORITHM="HS256"
   ACCESS_TOKEN_EXPIRE_MINUTES=1440

   # LLM Backend
   LLM_BACKEND="gemini"
   LLM_MODEL="gemini-3.5-flash-lite"
   GEMINI_API_KEY="your-google-ai-studio-key"

   # Storage
   FAISS_STORAGE_PATH="./index_cache"
   UPLOAD_STORAGE_PATH="./data/uploads"

   # CORS
   CORS_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173"]
   ```

4. **Start the FastAPI server:**
   ```powershell
   .venv\Scripts\python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
   ```
   Interactive API docs will be available at: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

### 3. Frontend Setup

1. **Navigate to the frontend directory:**
   ```powershell
   cd frontend
   ```

2. **Install dependencies:**
   ```powershell
   npm install
   ```

3. **Start the Vite development server:**
   ```powershell
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Production Deployment Guide

### Deploy Backend to Render (or Railway)
1. Push your repository to GitHub.
2. Create a new **Web Service** on [Render.com](https://render.com).
3. Connect your repository:
   - **Environment**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`
4. Add your `.env` variables (`MONGODB_URL`, `GEMINI_API_KEY`, `JWT_SECRET`, etc.).
5. Ensure `0.0.0.0/0` is allowed in MongoDB Atlas Network Access.

### Deploy Frontend to Vercel
1. Create a new project on [Vercel.com](https://vercel.com).
2. Select your repository and set the **Root Directory** to `frontend`.
3. Add the environment variable:
   - `VITE_API_URL` = `https://your-backend-service.onrender.com`
4. Click **Deploy**.

---

## License

This project is licensed under the MIT License.
