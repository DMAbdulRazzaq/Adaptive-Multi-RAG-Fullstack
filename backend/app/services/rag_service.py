import os
import time
import hashlib
from pathlib import Path
from typing import Optional

from ..config import settings

from rag.ingestion.document_loader import DocumentLoader
from rag.chunking.semantic_chunker import SemanticChunker
from rag.embeddings.embedder import Embedder
from rag.generation.generator import LLMGenerator
from rag.query_router.classifier import QueryClassifier
from rag.retrieval.adaptive_retrieval import AdaptiveRetriever
from rag.retrieval.reranker import CrossEncoderReranker
from rag.retrieval.retriever import VectorRetriever
from rag.vector_store.faiss_store import FAISSVectorStore


class RAGService:
    """
    Application-level wrapper around the existing Adaptive RAG pipeline.

    The implementation inside rag/ is NOT modified.

    This service handles:
        - document indexing
        - FAISS index loading
        - query classification
        - adaptive retrieval
        - reranking
        - LLM generation
        - API-friendly response formatting
    """

    def __init__(
        self,
        backend: Optional[str] = None,
        model_name: Optional[str] = None,
    ):
        self.backend = backend or settings.llm_backend
        self.model_name = model_name or settings.llm_model

        self.embedder = None
        self.reranker = None
        self.classifier = None

    # ============================================================
    # SHARED COMPONENTS
    # ============================================================

    def _get_embedder(self):
        if self.embedder is None:
            print("[RAGService] Loading embedding model...")

            self.embedder = Embedder(
                model_name=settings.embedding_model
            )

        return self.embedder

    def _get_reranker(self):
        if self.reranker is None:
            print("[RAGService] Loading cross-encoder...")

            self.reranker = CrossEncoderReranker()

        return self.reranker

    def _get_classifier(self):
        if self.classifier is None:
            self.classifier = QueryClassifier()

        return self.classifier

    # ============================================================
    # DOCUMENT INDEX
    # ============================================================

    def _get_index_path(
        self,
        document_path: str,
    ) -> Path:
        """
        Create a deterministic index directory for a document.
        """

        absolute_path = os.path.abspath(
            document_path
        )

        document_hash = hashlib.md5(
            absolute_path.encode("utf-8")
        ).hexdigest()[:8]

        index_root = Path(
            settings.faiss_storage_path
        )

        index_path = (
            index_root /
            f"index_{document_hash}"
        )

        index_path.mkdir(
            parents=True,
            exist_ok=True,
        )

        return index_path

    def _build_or_load_index(
        self,
        document_path: str,
    ):
        """
        Load an existing FAISS index or create one
        using the existing RAG ingestion pipeline.
        """

        embedder = self._get_embedder()

        index_path = self._get_index_path(
            document_path
        )

        config_path = (
            index_path / "cfg.json"
        )

        vector_store = FAISSVectorStore(
            dim=embedder.embedding_dim,
            metric="cosine",
        )

        # --------------------------------------------------------
        # Existing index
        # --------------------------------------------------------

        if config_path.exists():

            print(
                f"[RAGService] Loading index: "
                f"{index_path}"
            )

            vector_store.load(
                str(index_path)
            )

            return vector_store

        # --------------------------------------------------------
        # Build new index
        # --------------------------------------------------------

        print(
            f"[RAGService] Building index for: "
            f"{document_path}"
        )

        loader = DocumentLoader()

        chunker = SemanticChunker(
            max_chunk_tokens=512
        )

        document = loader.load(
            document_path
        )

        chunks = chunker.chunk(
            document
        )

        if not chunks:
            raise ValueError(
                "No chunks were generated from the document."
            )

        print(
            f"[RAGService] Generated "
            f"{len(chunks)} chunks."
        )

        print(
            "[RAGService] Generating embeddings..."
        )

        _, embeddings = embedder.embed_chunks(
            chunks
        )

        vector_store.add_chunks(
            chunks,
            embeddings,
        )

        vector_store.save(
            str(index_path)
        )

        print(
            f"[RAGService] Index saved to "
            f"{index_path}"
        )

        return vector_store

    # ============================================================
    # QUERY
    # ============================================================

    def query(
        self,
        question: str,
        document_path: str,
        backend: Optional[str] = None,
        model: Optional[str] = None,
    ):
        """
        Execute one question against one document.
        """

        question = question.strip()

        if not question:
            raise ValueError(
                "Question cannot be empty."
            )

        if not os.path.exists(
            document_path
        ):
            raise FileNotFoundError(
                f"Document not found: "
                f"{document_path}"
            )

        start_time = time.perf_counter()

        # --------------------------------------------------------
        # Load/build document index
        # --------------------------------------------------------

        vector_store = (
            self._build_or_load_index(
                document_path
            )
        )

        embedder = self._get_embedder()
        classifier = self._get_classifier()
        reranker = self._get_reranker()

        # --------------------------------------------------------
        # Query classification
        # --------------------------------------------------------

        config = classifier.classify(
            question
        )

        # --------------------------------------------------------
        # Vector retrieval
        # --------------------------------------------------------

        retriever = VectorRetriever(
            vector_store=vector_store,
            embedder=embedder,
            default_top_k=config.top_k,
        )

        # --------------------------------------------------------
        # Adaptive retrieval
        # --------------------------------------------------------

        adaptive_retriever = AdaptiveRetriever(
            retriever=retriever,
            reranker=reranker,
            classifier=classifier,
        )

        # The index belongs to this document only,
        # so we can safely retrieve from it directly.
        retrieval_result = (
            adaptive_retriever.retrieve(
                question,
                config=config,
            )
        )

        # --------------------------------------------------------
        # Generator
        # --------------------------------------------------------

        selected_backend = (
            backend or self.backend
        )

        selected_model = (
            model or self.model_name
        )

        api_base = None

        if selected_backend == "ollama":
            api_base = (
                f"{settings.ollama_url.rstrip('/')}"
                "/api/generate"
            )

        generator = LLMGenerator(
            backend=selected_backend,
            model_name=selected_model,
            temperature=0.2,
            max_new_tokens=512,#settings.max_new_tokens
            api_base=api_base,
        )

        generation_result = (
            generator.generate(
                retrieval_result
            )
        )

        latency = (
            time.perf_counter()
            - start_time
        )

        # --------------------------------------------------------
        # Sources
        # --------------------------------------------------------

        sources = []

        chunks = getattr(
            retrieval_result,
            "chunks",
            [],
        )

        for index, chunk in enumerate(
            chunks,
            start=1,
        ):

            sources.append(
                {
                    "rank": index,
                    "score": None,
                    "text": getattr(
                        chunk,
                        "text",
                        "",
                    ),
                    "document_id": getattr(
                        chunk,
                        "document_id",
                        None,
                    ),
                    "section_title": getattr(
                        chunk,
                        "section_title",
                        None,
                    ),
                    "chunk_id": getattr(
                        chunk,
                        "chunk_id",
                        None,
                    ),
                }
            )

        # --------------------------------------------------------
        # Final response
        # --------------------------------------------------------

        return {
            "answer": generation_result.answer,

            "question": question,

            "query_type": generation_result.query_type,

            "model_used": generation_result.model_used,

            "confidence": float(
                generation_result.confidence
            ),

            "latency_seconds": round(
                latency,
                3,
            ),

            "latency_ms": round(
                latency * 1000,
                2,
            ),

            "chunks_used": len(chunks),

            "context_tokens": (
                retrieval_result.token_count
            ),

            "retrieval_steps": (
                retrieval_result.retrieval_steps
            ),

            "sources": sources,

            "token_usage": (
                generation_result.token_usage
                or {}
            ),
        }


# ================================================================
# SINGLE SERVICE INSTANCE
# ================================================================

rag_service = RAGService()