"""
Integration tests for FAISS-backed semantic recipe search.

Tests faiss_service (get_or_build_index, add, remove, search) with mocked
embed_dim so the real embedding model is never loaded. Uses small (4-d) vectors
for speed. Clears in-memory index state between tests.

Run:
    pytest tests/test_faiss_service.py -v
    pytest tests/test_faiss_service.py -v -m integration
"""

import pytest

pytest.importorskip("faiss", reason="faiss-cpu not installed")

from unittest.mock import patch

import sys
from pathlib import Path

# Project root on path for src imports
if str(Path(__file__).resolve().parent.parent) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import src.faiss_service as faiss_service

# Fixed dim for tests (avoids loading sentence-transformers)
TEST_DIM = 4


def _unit_vec(i: int) -> list:
    """Return 4-d unit vector with 1 at index i."""
    v = [0.0] * TEST_DIM
    v[i] = 1.0
    return v


@pytest.fixture(autouse=True)
def patch_embed_dim_and_clear_index():
    """Patch embed_dim to TEST_DIM and clear FAISS index cache so tests are isolated."""
    with patch("src.faiss_service._dim", return_value=TEST_DIM):
        faiss_service._user_indexes.clear()
        yield
    faiss_service._user_indexes.clear()


@pytest.mark.integration
def test_faiss_get_or_build_index_and_search():
    """Build index from rows, search returns (recipe_id, score) ordered by cosine similarity."""
    uid = 100
    rows = [
        (1, _unit_vec(0)),   # recipe 1 ~ query (axis 0)
        (2, _unit_vec(1)),
        (3, _unit_vec(2)),
    ]
    query = _unit_vec(0)
    result = faiss_service.search(uid, query, rows, k=5, min_score=0.0)
    assert len(result) == 3
    # Best match is recipe 1 (cosine=1 with query on axis 0)
    assert result[0][0] == 1 and result[0][1] == pytest.approx(1.0, abs=1e-5)
    # Recipes 2 and 3 have score 0 (orthogonal); order may vary
    ids_and_scores = {(r[0], round(r[1], 5)) for r in result}
    assert ids_and_scores == {(1, 1.0), (2, 0.0), (3, 0.0)}


@pytest.mark.integration
def test_faiss_add_appears_in_search():
    """After add(user_id, recipe_id, embedding), next search includes that recipe."""
    uid = 101
    rows = [(1, _unit_vec(0)), (2, _unit_vec(1))]
    query = _unit_vec(0)
    faiss_service.search(uid, query, rows, k=5, min_score=0.0)
    faiss_service.add(uid, 99, _unit_vec(2))
    result = faiss_service.search(uid, query, rows, k=5, min_score=0.0)
    recipe_ids = [r[0] for r in result]
    assert 99 in recipe_ids
    assert len(result) == 3


@pytest.mark.integration
def test_faiss_remove_invalidates_index():
    """remove(user_id, recipe_id) invalidates cache; next search with fewer rows omits that recipe."""
    uid = 102
    rows_full = [(1, _unit_vec(0)), (2, _unit_vec(1)), (3, _unit_vec(2))]
    query = _unit_vec(0)
    faiss_service.search(uid, query, rows_full, k=5, min_score=0.0)
    faiss_service.remove(uid, 1)
    rows_without_1 = [(2, _unit_vec(1)), (3, _unit_vec(2))]
    result = faiss_service.search(uid, query, rows_without_1, k=5, min_score=0.0)
    recipe_ids = [r[0] for r in result]
    assert 1 not in recipe_ids
    assert len(result) == 2


@pytest.mark.integration
def test_faiss_search_min_score_filtering():
    """Only results with score >= min_score are returned."""
    uid = 103
    rows = [(1, _unit_vec(0)), (2, _unit_vec(1))]
    query = _unit_vec(0)
    result_high = faiss_service.search(uid, query, rows, k=5, min_score=0.99)
    result_all = faiss_service.search(uid, query, rows, k=5, min_score=0.0)
    assert len(result_high) == 1 and result_high[0][0] == 1
    assert len(result_all) == 2


@pytest.mark.integration
def test_faiss_empty_rows_returns_empty():
    """search with empty rows returns [] and get_or_build_index with empty rows returns None."""
    uid = 104
    query = _unit_vec(0)
    idx = faiss_service.get_or_build_index(uid, [])
    result = faiss_service.search(uid, query, [], k=5, min_score=0.0)
    assert idx is None
    assert result == []
