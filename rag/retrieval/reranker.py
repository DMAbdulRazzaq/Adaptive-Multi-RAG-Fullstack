"""Stage 3.2 - Cross-Encoder Re-Ranking with safe Windows DLL fallback"""


class CrossEncoderReranker:

    DEFAULT_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"

    def __init__(self, model_name=DEFAULT_MODEL, batch_size=16, device=None):
        self.model_name = model_name

        if device is None:
            try:
                import torch
                device = "cuda" if torch.cuda.is_available() else "cpu"
            except Exception:
                # Catch ImportError, OSError (WinError 4551), and any Windows DLL blocks
                device = "cpu"

        self.device = device
        self.batch_size = batch_size
        self._m = None

    def rerank(self, query, results):
        if not results:
            return results
        m = self._get()
        if m is None:
            print("[Reranker] PyTorch/CrossEncoder unavailable — using vector search ranking.")
            return results
        pairs = [(query, r.chunk.text) for r in results]
        scores = []
        for i in range(0, len(pairs), self.batch_size):
            bs = m.predict(pairs[i:i + self.batch_size], show_progress_bar=False)
            scores.extend(bs.tolist() if hasattr(bs, "tolist") else bs)
        for r, s in zip(results, scores):
            r.score = float(s)
        ranked = sorted(results, key=lambda r: r.score, reverse=True)
        for i, r in enumerate(ranked, 1):
            r.rank = i
        return ranked

    def _get(self):
        if self._m is None:
            try:
                from sentence_transformers import CrossEncoder
                self._m = CrossEncoder(self.model_name, device=self.device or "cpu")
            except Exception as exc:
                print(f"[Reranker] CrossEncoder blocked ({exc}) — falling back to vector similarity.")
                self._m = False
        return self._m if self._m is not False else None
