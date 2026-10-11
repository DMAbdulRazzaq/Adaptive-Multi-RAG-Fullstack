"""
embedder.py — Dual-Mode Embedder (SentenceTransformers with Gemini Fallback)
Includes robust rate-limit handling for large books and documents.
"""
import os
import time
import numpy as np

_MODEL_CACHE = {}


class Embedder:
    """Class-based wrapper with automatic Gemini API fallback."""

    def __init__(self, model_name="sentence-transformers/all-MiniLM-L6-v2",
                 batch_size=64, normalize=True, device=None, cache_dir=None):
        self.model_name = model_name
        self.batch_size = batch_size
        self.normalize  = normalize
        self._model     = None
        self._use_gemini = False
        self._gemini_client = None

    def _init_gemini(self):
        if self._gemini_client is None:
            from google import genai
            api_key = os.environ.get("GEMINI_API_KEY")
            if not api_key:
                raise RuntimeError("GEMINI_API_KEY is required for embedding fallback.")
            self._gemini_client = genai.Client(api_key=api_key)
            self._use_gemini = True
            print("[Embedder] Using Google Gemini Embedding API (gemini-embedding-001).")

    def _get(self):
        if self._use_gemini:
            return None

        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer
                print(f"[Embedder] Loading: {self.model_name}")
                self._model = SentenceTransformer(self.model_name)
            except Exception as exc:
                print(f"[Embedder] Local PyTorch model blocked/unavailable ({exc}). Switching to Gemini API.")
                self._init_gemini()
        return self._model

    @property
    def embedding_dim(self) -> int:
        model = self._get()
        if self._use_gemini:
            return 3072  # gemini-embedding-001 dimension
        return model.get_sentence_embedding_dimension()

    def embed_texts(self, texts: list) -> np.ndarray:
        if not texts:
            return np.empty((0, self.embedding_dim), dtype="float32")

        self._get()

        if self._use_gemini:
            all_vectors = []
            chunk_size = 32  # Balanced chunk size for Gemini API

            for i in range(0, len(texts), chunk_size):
                batch = texts[i:i + chunk_size]
                batch_num = (i // chunk_size) + 1
                total_batches = (len(texts) + chunk_size - 1) // chunk_size

                # Retry loop with 20s backoff for free-tier rate limits
                max_retries = 6
                for attempt in range(max_retries):
                    try:
                        res = self._gemini_client.models.embed_content(
                            model="gemini-embedding-001",
                            contents=batch,
                        )
                        for emb in res.embeddings:
                            vec = np.array(emb.values, dtype="float32")
                            if self.normalize:
                                norm = np.linalg.norm(vec)
                                if norm > 0:
                                    vec = vec / norm
                            all_vectors.append(vec)
                        break
                    except Exception as e:
                        if "429" in str(e) and attempt < max_retries - 1:
                            wait_time = 20 * (attempt + 1)
                            print(f"[Embedder] Rate limit hit on batch {batch_num}/{total_batches}. Waiting {wait_time}s for Google quota window to reset...")
                            time.sleep(wait_time)
                        else:
                            raise e

                # Polite delay between batches
                if i + chunk_size < len(texts):
                    time.sleep(1.5)

            return np.array(all_vectors, dtype="float32")

        # Standard local sentence_transformers execution
        return self._model.encode(
            texts,
            batch_size=self.batch_size,
            normalize_embeddings=self.normalize,
            convert_to_numpy=True,
            show_progress_bar=False,
        ).astype("float32")

    def embed_query(self, query: str) -> np.ndarray:
        return self.embed_texts([query])[0]

    def embed_chunks(self, chunks: list):
        """Returns (chunks, embeddings_matrix)."""
        texts = [c.text for c in chunks]
        embs  = self.embed_texts(texts)
        return chunks, embs
