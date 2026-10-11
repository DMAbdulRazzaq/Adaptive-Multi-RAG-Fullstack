"""Stage 3.3 + 4 + 5 - Adaptive Retrieval Pipeline"""

import re
import uuid
from dataclasses import dataclass, field


@dataclass
class RetrievedContext:
    query: str
    query_type: str
    chunks: list
    context_text: str
    token_count: int
    retrieval_steps: int = 1
    metadata: dict = field(default_factory=dict)


class AdaptiveRetriever:

    def __init__(self, retriever, reranker, classifier, max_hops=3):
        self.retriever = retriever
        self.reranker = reranker
        self.classifier = classifier
        self.max_hops = max_hops

    def retrieve(self, query, config=None, filter_doc_id=None):

        if config is None:
            config = self.classifier.classify(query)

        if config.iterative:
            return self._mhop(query, config, filter_doc_id)

        return self._single(query, config, filter_doc_id)

    # ---------------------------------------------------------
    # SINGLE-STAGE RETRIEVAL
    # ---------------------------------------------------------

    def _single(self, query, config, fid):

        from rag.query_router.classifier import QueryType

        mode = (
            "hierarchical"
            if config.query_type == QueryType.SUMMARIZATION
            else "flat"
        )

        results = self.retriever.retrieve(
            query,
            top_k=config.top_k,
            mode=mode,
            filter_doc_id=fid,
        )

        if config.rerank and results:
            results = self.reranker.rerank(query, results)

        chunks = [r.chunk for r in results]

        chunks = self._compress(
            chunks,
            query,
            config.context_budget,
        )

        context = self._asm(chunks)

        return RetrievedContext(
            query=query,
            query_type=config.query_type,
            chunks=chunks,
            context_text=context,
            token_count=self._tok(context),
            retrieval_steps=1,
            metadata={
                "retrieved": len(results),
                "used": len(chunks),
                "mode": mode,
            },
        )

    # ---------------------------------------------------------
    # MULTI-HOP RETRIEVAL
    # ---------------------------------------------------------

    def _mhop(self, query, config, fid):

        all_chunks = []
        seen = set()
        search_query = query
        steps = 0

        for _ in range(self.max_hops):

            steps += 1

            results = self.retriever.retrieve(
                search_query,
                top_k=config.top_k,
                filter_doc_id=fid,
            )

            if config.rerank and results:
                results = self.reranker.rerank(
                    search_query,
                    results,
                )

            new_chunks = [
                r.chunk
                for r in results
                if r.chunk.chunk_id not in seen
            ]

            for chunk in new_chunks:
                seen.add(chunk.chunk_id)

            all_chunks.extend(new_chunks)

            current_tokens = sum(
                c.token_count for c in all_chunks
            )

            if current_tokens >= config.context_budget:
                break

            follow_up = self._fu(
                query,
                all_chunks,
            )

            if not follow_up or follow_up == search_query:
                break

            search_query = follow_up

        chunks = self._compress(
            all_chunks,
            query,
            config.context_budget,
        )

        context = self._asm(chunks)

        return RetrievedContext(
            query=query,
            query_type=config.query_type,
            chunks=chunks,
            context_text=context,
            token_count=self._tok(context),
            retrieval_steps=steps,
            metadata={
                "retrieved": len(all_chunks),
                "used": len(chunks),
            },
        )

    # ---------------------------------------------------------
    # CONTEXT COMPRESSION
    # ---------------------------------------------------------

    def _compress(self, chunks, query, budget):

        if not chunks:
            return []

        # Remove near-duplicates
        chunks = self._dedup(chunks)

        # IMPORTANT:
        # Do NOT throw away chunks simply because they do not
        # contain exact query keywords.
        #
        # Semantic retrieval + CrossEncoder already ranked them.

        # Merge adjacent chunks where useful
        chunks = self._merge(chunks, budget)

        # Keep as many ranked chunks as fit
        chunks = self._trim(chunks, budget)

        return chunks

    # ---------------------------------------------------------
    # DEDUPLICATION
    # ---------------------------------------------------------

    def _dedup(self, chunks, threshold=0.85):

        kept = []
        token_sets = []

        for chunk in chunks:

            tokens = set(
                chunk.text.lower().split()
            )

            duplicate = False

            for existing in token_sets:

                overlap = len(tokens & existing) / max(
                    len(tokens | existing),
                    1,
                )

                if overlap >= threshold:
                    duplicate = True
                    break

            if not duplicate:

                kept.append(chunk)
                token_sets.append(tokens)

        return kept

    # ---------------------------------------------------------
    # MERGING
    # ---------------------------------------------------------

    def _merge(self, chunks, budget):

        if len(chunks) <= 1:
            return chunks

        from rag.chunking.semantic_chunker import Chunk

        merged = [chunks[0]]

        for chunk in chunks[1:]:

            last = merged[-1]

            can_merge = (
                last.section_title == chunk.section_title
                and last.document_id == chunk.document_id
                and abs(
                    chunk.chunk_index -
                    last.chunk_index
                ) <= 2
                and (
                    last.token_count +
                    chunk.token_count
                    <= budget // 2
                )
            )

            if can_merge:

                merged[-1] = Chunk(
                    chunk_id=str(uuid.uuid4())[:8],
                    document_id=last.document_id,
                    text=last.text + " " + chunk.text,
                    section_title=last.section_title,
                    token_count=(
                        last.token_count +
                        chunk.token_count
                    ),
                    chunk_index=last.chunk_index,
                    start_char=last.start_char,
                    end_char=chunk.end_char,
                    metadata=last.metadata,
                )

            else:
                merged.append(chunk)

        return merged

    # ---------------------------------------------------------
    # TOKEN BUDGET
    # ---------------------------------------------------------

    def _trim(self, chunks, budget):

        kept = []
        used = 0

        for chunk in chunks:

            if used + chunk.token_count > budget:
                continue

            kept.append(chunk)
            used += chunk.token_count

        # Always return at least one chunk
        if not kept and chunks:
            return chunks[:1]

        return kept

    # ---------------------------------------------------------
    # CONTEXT ASSEMBLY
    # ---------------------------------------------------------

    @staticmethod
    def _asm(chunks):

        return "\n---\n".join(
            (
                f"[Section: {chunk.section_title}]\n"
                f"{chunk.text}"
                if chunk.section_title
                else
                f"[Document]\n{chunk.text}"
            )
            for chunk in chunks
        )

    # ---------------------------------------------------------
    # MULTI-HOP FOLLOW-UP
    # ---------------------------------------------------------

    @staticmethod
    def _fu(query, chunks):

        if not chunks:
            return query

        original = set(
            query.lower().split()
        )

        context = " ".join(
            chunk.text
            for chunk in chunks[:3]
        )

        entities = re.findall(
            r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b",
            context,
        )

        new_entities = [
            entity
            for entity in entities
            if entity.lower() not in original
        ]

        if new_entities:

            return (
                f"{query} specifically regarding "
                f"{new_entities[0]}"
            )

        return query

    # ---------------------------------------------------------
    # TOKEN ESTIMATION
    # ---------------------------------------------------------

    @staticmethod
    def _tok(text):

        return max(
            1,
            int(len(text.split()) * 4 / 3),
        )