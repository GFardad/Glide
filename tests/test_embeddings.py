"""Tests for runtime embedding pipeline."""

from __future__ import annotations

import pytest

from runtime.registry.embeddings import EmbeddingPipeline


def test_embed_returns_none_without_model():
    pipeline = EmbeddingPipeline(model_name="nonexistent-model")
    assert pipeline.embed("hello") is None


def test_embed_caches_result():
    pipeline = EmbeddingPipeline()
    pipeline._model = object()
    pipeline._cache["hello"] = [1, 0]
    assert pipeline.embed("hello") == [1, 0]


def test_embed_many_returns_list():
    pipeline = EmbeddingPipeline()
    pipeline._cache["a"] = [1, 0]
    pipeline._cache["b"] = [0, 1]
    results = pipeline.embed_many(["a", "b"])
    assert results == [[1, 0], [0, 1]]
