"""Stage 6 — LLM Generation Layer"""
import os
from dataclasses import dataclass, field
from typing import Optional
import time
import logging
from google.genai import errors as gemini_errors

@dataclass
class GenerationResult:
    query: str; answer: str; confidence: float
    context_used: str; query_type: str; model_used: str
    token_usage: dict = field(default_factory=dict)


class LLMGenerator:
    SYSTEM_PROMPT = """You are a precise research assistant.
Answer the question using ONLY the provided context.
If context lacks information, say so. Do not fabricate information."""

    def __init__(
        self,
        backend="ollama",
        model_name="llama3.2",
        temperature=0.2,
        max_new_tokens=512,
        api_base=None,
        fallback_backend="ollama",
        fallback_model="llama3.2",
        max_retries=3,
    ):
        self.backend = backend
        self.model_name = model_name
        self.temperature = temperature
        self.max_new_tokens = max_new_tokens
        self.api_base = api_base

        self.fallback_backend = fallback_backend
        self.fallback_model = fallback_model
        self.max_retries = max_retries

        self._pipeline = None
        self.logger = logging.getLogger(__name__)

    def _generate_backend(self, backend, model, prompt):
        """Run the selected backend."""
        original_backend = self.backend
        original_model = self.model_name

        try:
            self.backend = backend
            self.model_name = model

            if backend == "openai":
                return self._openai(prompt)
            elif backend == "gemini":
                return self._gemini(prompt)
            elif backend == "openrouter":
                return self._openrouter(prompt)
            elif backend == "huggingface":
                return self._hf(prompt)
            elif backend == "ollama":
                return self._ollama(prompt)
            else:
                raise ValueError(
                    f"Unsupported backend: {backend}")
        finally:
            self.backend = original_backend
            self.model_name = original_model

    def _generate_gemini_with_retry(self, prompt):
        """Retry temporary Gemini errors."""
        for attempt in range(self.max_retries):
            try:
                return self._gemini(prompt)

            except Exception as exc:
                if not self._is_transient_error(exc):
                    raise

                if attempt == self.max_retries - 1:
                    raise

                delay = 2 ** (attempt + 1)

                self.logger.warning(
                    "Gemini error: %s. Retrying in %s seconds.",
                    exc,
                    delay,
                )

                time.sleep(delay)

    def _is_transient_error(self, exc):
        """Check whether an error may be temporary."""
        status = getattr(exc, "code", None)

        if status is None:
            status = getattr(exc, "status_code", None)

        return status in (408, 429, 500, 502, 503, 504)
    
    def generate(self, context) -> GenerationResult:
        prompt = self._prompt(context)

        answer = ""
        usage = {}
        actual_backend = self.backend
        actual_model = self.model_name

        try:
            if self.backend == "gemini":
                answer, usage = self._generate_gemini_with_retry(prompt)

            else:
                answer, usage = self._generate_backend(
                    self.backend, self.model_name, prompt
                )

        except Exception as exc:
            self.logger.exception(
                "Primary generation failed: %s", exc
            )

            # Fallback only for temporary Gemini service failures.
            if (
                self.backend == "gemini"
                and self.fallback_backend
                and self._is_transient_error(exc)
            ):
                self.logger.warning(
                    "Gemini unavailable. Switching to %s.",
                    self.fallback_backend,
                )

                try:
                    answer, usage = self._generate_backend(
                        self.fallback_backend,
                        self.fallback_model,
                        prompt,
                    )
                    actual_backend = self.fallback_backend
                    actual_model = self.fallback_model

                except Exception as fallback_exc:
                    self.logger.exception(
                        "Fallback generation failed: %s",
                        fallback_exc,
                    )
                    answer, usage = self._mock(
                        context,
                        warning=str(fallback_exc),
                    )
                    actual_backend = "mock"
                    actual_model = "mock"
            else:
                answer, usage = self._mock(
                    context,
                    warning=str(exc),
                )
                actual_backend = "mock"
                actual_model = "mock"

        confidence = self._confidence(
            answer, context.context_text
        )

        return GenerationResult(
            query=context.query,
            answer=answer,
            confidence=confidence,
            context_used=context.context_text,
            query_type=context.query_type,
            model_used=f"{actual_backend}/{actual_model}",
            token_usage=usage,
        )

    def _prompt(self, ctx) -> str:
        p = f"### Question\n{ctx.query}\n\n### Context\n{ctx.context_text}\n\n"
        p += {"summarization": "Provide a comprehensive summary.\n",
              "reasoning": "Answer directly and organize the requested facts clearly.\n",
              "multi_hop": "Synthesize information from multiple sections.\n",
              }.get(ctx.query_type, "Give a direct, concise factual answer.\n")
        p += (
            "Answer every part of the question using the context. For requests "
            "to describe or compare multiple entities by attributes, use a "
            "table with one row per entity and one column per requested "
            "attribute. Write 'Not stated in the retrieved context' for "
            "unsupported attributes. Do not imply the list is complete unless "
            "the context supports a complete list.\n"
        )
        return p + "\n### Answer\n"

    # ============================================================
    # OPENAI
    # ============================================================

    def _openai(self, prompt):
        try:
            from openai import OpenAI
        except ImportError:
            raise ImportError("pip install openai")
        kw = {}
        if self.api_base: kw["base_url"] = self.api_base
        if not os.environ.get("OPENAI_API_KEY"): kw["api_key"] = "EMPTY"
        client = OpenAI(**kw)
        resp = client.chat.completions.create(
            model=self.model_name,
            messages=[{"role":"system","content":self.SYSTEM_PROMPT},
                      {"role":"user","content":prompt}],
            temperature=self.temperature, max_tokens=self.max_new_tokens,
        )
        ans = resp.choices[0].message.content.strip()
        usage = {"prompt_tokens":resp.usage.prompt_tokens,
                 "completion_tokens":resp.usage.completion_tokens,
                 "total_tokens":resp.usage.total_tokens}
        return ans, usage

    # ============================================================
    # GEMINI
    # ============================================================

    def _gemini(self, prompt):
            try:
                from google import genai
            except ImportError:
                raise ImportError(
                    "Gemini backend requires: "
                    "pip install google-genai"
                )

            api_key = os.environ.get("GEMINI_API_KEY")

            if not api_key:
                raise RuntimeError(
                    "GEMINI_API_KEY is not configured."
                )

            client = genai.Client(api_key=api_key)

            response = client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config={
                    "system_instruction": self.SYSTEM_PROMPT,
                    "temperature": self.temperature,
                    "max_output_tokens": self.max_new_tokens,
                },
            )

            answer = (response.text or "").strip()

            usage = {}

            if getattr(response, "usage_metadata", None):
                metadata = response.usage_metadata

                usage = {
                    "prompt_tokens":
                        getattr(metadata, "prompt_token_count", 0),

                    "completion_tokens":
                        getattr(metadata, "candidates_token_count", 0),

                    "total_tokens":
                        getattr(metadata, "total_token_count", 0),
                }

            return answer, usage

    # ============================================================
    # OPENROUTER
    # ============================================================

    def _openrouter(self, prompt):
        try:
            from openai import OpenAI
        except ImportError:
            raise ImportError(
                "OpenRouter backend requires: pip install openai"
            )

        api_key = os.environ.get("OPENROUTER_API_KEY")

        if not api_key:
            raise RuntimeError(
                "OPENROUTER_API_KEY is not configured."
            )

        client = OpenAI(
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1",
        )

        resp = client.chat.completions.create(
            model=self.model_name,
            messages=[
                {
                    "role": "system",
                    "content": self.SYSTEM_PROMPT
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=self.temperature,
            max_tokens=self.max_new_tokens,
        )

        answer = resp.choices[0].message.content.strip()

        usage = {}

        if resp.usage:
            usage = {
                "prompt_tokens":
                    getattr(resp.usage, "prompt_tokens", 0),

                "completion_tokens":
                    getattr(resp.usage, "completion_tokens", 0),

                "total_tokens":
                    getattr(resp.usage, "total_tokens", 0),
            }

        return answer, usage


    # ============================================================
    # HUGGINGFACE
    # ============================================================

    def _hf(self, prompt):
        if self._pipeline is None:
            from transformers import pipeline
            self._pipeline = pipeline("text-generation", model=self.model_name,
                                       device_map="auto", max_new_tokens=self.max_new_tokens)
        full = f"[INST] {self.SYSTEM_PROMPT}\n\n{prompt} [/INST]"
        out = self._pipeline(full)[0]["generated_text"]
        return out[len(full):].strip(), {"model": self.model_name}

    # ============================================================
    # OLLAMA
    # ============================================================

    def _ollama(self, prompt):
        import urllib.request
        import json
        
        api_url = self.api_base or "http://localhost:11434/api/generate"
        payload = {
            "model": self.model_name,
            "prompt": f"{self.SYSTEM_PROMPT}\n\n{prompt}",
            "stream": False,
            "options": {
                "temperature": self.temperature,
                "num_predict": self.max_new_tokens
            }
        }
        
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(api_url, data=data, headers={"Content-Type": "application/json"})
        
        try:
            with urllib.request.urlopen(req, timeout=120) as response:
                result = json.loads(response.read().decode("utf-8"))
                ans = result.get("response", "").strip()
                usage = {
                    "prompt_tokens": result.get("prompt_eval_count", 0),
                    "completion_tokens": result.get("eval_count", 0),
                    "total_tokens": result.get("prompt_eval_count", 0) + result.get("eval_count", 0)
                }
                return ans, usage
        except Exception as e:
            raise RuntimeError(
                f"Error connecting to Ollama: {e}"
            ) from e

    # ============================================================
    # MOCK
    # ============================================================

    def _mock(self, ctx, warning=None):
        first = ctx.chunks[0].text[:200] if getattr(ctx, "chunks", None) else "No context."
        parts = [
            "[MOCK — configure backend for real answers]",
            f"Type:{getattr(ctx, 'query_type', 'unknown')} | Chunks:{len(getattr(ctx, 'chunks', []) or [])} | Hops:{getattr(ctx, 'retrieval_steps', 0)}",
        ]
        if warning:
            parts.append(f"Warning: {warning}")
        parts.append(f"Key passage: \"{first[:150]}...\"")
        answer = "\n".join(parts)
        return answer, {"model": "mock"}

    def _confidence(self, answer, context):
        LOW = ["does not contain","insufficient","unclear","cannot determine","no information"]
        penalty = sum(0.3 for p in LOW if p in answer.lower())
        wc = len(answer.split())
        if wc < 10: penalty += 0.4
        elif wc < 20: penalty += 0.2
        cw = set(context.lower().split())
        aw = set(answer.lower().split())
        if cw and len(aw & cw)/max(len(aw),1) < 0.05:
            penalty += 0.25
        return max(0.0, min(1.0, 1.0-penalty))
