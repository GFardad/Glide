"""Embedding pipeline for Todo Registry."""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Iterable, List, Optional

try:
    from sentence_transformers import SentenceTransformer
except Exception:  # pragma: no cover - optional dependency
    SentenceTransformer = None  # type: ignore

MODEL_NAME = "all-MiniLM-L6-v2"


class EmbeddingPipeline:
    def __init__(self, model_name: str = MODEL_NAME) -> None:
        self._model = None
        self.model_name = model_name
        self._cache: dict[str, list[float]] = {}

    @property
    def model(self):
        if self._model is None and SentenceTransformer is not None:
            self._model = SentenceTransformer(self.model_name)
        return self._model

    def embed(self, text: str) -> Optional[list[float]]:
        if text in self._cache:
            return self._cache[text]
        if self.model is None:
            return None
        vector = self.model.encode(text, normalize_embeddings=True).tolist()
        self._cache[text] = vector
        return vector

    def embed_many(self, texts: Iterable[str]) -> List[Optional[list[float]]]:
        return [self.embed(text) for text in texts]
