"""
In-memory FAISS index for fast semantic recipe search per user.

Uses IndexFlatIP with L2-normalized vectors so inner product = cosine similarity.
One index per user_id; rebuilt from DB when missing. No disk persistence.

Best practices:
- Single responsibility: index and search only
- Caller supplies rows (DB layer stays in db_service)
- Invalidate on remove (FAISS flat index has no delete)
"""

import logging
from typing import List, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)

# Lazy import so faiss is optional until first use
_faiss = None

def _get_faiss():
    global _faiss
    if _faiss is None:
        try:
            import faiss
            _faiss = faiss
        except ImportError as e:
            logger.error("faiss not installed. pip install faiss-cpu")
            raise RuntimeError(
                "FAISS service requires faiss-cpu. Install with: pip install faiss-cpu"
            ) from e
    return _faiss


def _dim() -> int:
    from src.embedding_service import embed_dim
    return embed_dim()


# user_id -> (faiss.IndexIDMap wrapping IndexFlatIP, dimension)
_user_indexes: dict = {}


def get_or_build_index(
    user_id: int,
    rows: List[Tuple[int, List[float]]],
) -> Optional["faiss.IndexIDMap"]:
    """
    Return cached index for user, or build from rows and cache.
    rows: [(recipe_id, embedding), ...]. Embeddings must be same dim as embed_dim().
    """
    if not rows:
        _user_indexes.pop(user_id, None)
        return None
    faiss = _get_faiss()
    dim = _dim()
    if user_id in _user_indexes:
        idx, _ = _user_indexes[user_id]
        return idx
    ids = np.array([r[0] for r in rows], dtype=np.int64)
    vecs = np.array([r[1] for r in rows], dtype=np.float32)
    if vecs.shape[1] != dim:
        logger.warning("FAISS: embedding dim %s != %s, skipping index build", vecs.shape[1], dim)
        return None
    faiss.normalize_L2(vecs)
    index = faiss.IndexIDMap(faiss.IndexFlatIP(dim))
    index.add_with_ids(vecs, ids)
    _user_indexes[user_id] = (index, dim)
    logger.debug("FAISS: built index for user_id=%s with %s vectors", user_id, len(rows))
    return index


def add(user_id: int, recipe_id: int, embedding: List[float]) -> None:
    """Add one vector to user's index. No-op if index not built yet (next search will rebuild)."""
    if user_id not in _user_indexes:
        return
    faiss = _get_faiss()
    index, dim = _user_indexes[user_id]
    vec = np.array([embedding], dtype=np.float32)
    if vec.shape[1] != dim:
        return
    faiss.normalize_L2(vec)
    index.add_with_ids(vec, np.array([recipe_id], dtype=np.int64))


def remove(user_id: int, _recipe_id: int) -> None:
    """Invalidate user's index (FAISS flat index has no delete). Next search rebuilds from DB."""
    _user_indexes.pop(user_id, None)


def search(
    user_id: int,
    query_embedding: List[float],
    rows: List[Tuple[int, List[float]]],
    k: int = 50,
    min_score: float = 0.0,
) -> List[Tuple[int, float]]:
    """
    k-NN search. Returns [(recipe_id, score), ...] with score >= min_score, descending.
    score is cosine similarity (inner product of normalized vectors).
    """
    index = get_or_build_index(user_id, rows)
    if index is None:
        return []
    faiss = _get_faiss()
    dim = _dim()
    q = np.array([query_embedding], dtype=np.float32)
    if q.shape[1] != dim:
        return []
    faiss.normalize_L2(q)
    k = min(k, index.ntotal)
    if k <= 0:
        return []
    scores, ids = index.search(q, k)
    out = []
    for i in range(k):
        if ids[0][i] == -1:
            break
        sc = float(scores[0][i])
        if sc >= min_score:
            out.append((int(ids[0][i]), sc))
    return out
