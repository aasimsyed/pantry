"""
Local embedding service for semantic recipe search.

Uses sentence-transformers (BAAI/bge-small-en-v1.5) to embed text into 384-dim vectors.
Model is loaded lazily on first use to avoid startup cost.

Best practices:
- Single responsibility: embed text only
- Lazy load: model loaded on first embed() call
- Thread-safe: one model instance reused
"""

import json
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)

# Lazy-loaded model (loaded on first embed call)
_model = None
_MODEL_NAME = "BAAI/bge-small-en-v1.5"
_EMBED_DIM = 384
# BGE retrieval: prefix user queries with this for better similarity (passages/recipes stay unprefixed)
_BGE_QUERY_PREFIX = "Represent this sentence for searching relevant passages: "


def _get_model():
    """Load sentence-transformers model on first use (lazy)."""
    global _model
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer
            _model = SentenceTransformer(_MODEL_NAME)
            logger.info("Loaded embedding model: %s", _MODEL_NAME)
        except ImportError as e:
            logger.error(
                "sentence_transformers not installed. pip install sentence-transformers"
            )
            raise RuntimeError(
                "Embedding service requires sentence-transformers. "
                "Install with: pip install sentence-transformers"
            ) from e
    return _model


def embed(text: str) -> List[float]:
    """
    Embed a single string into a 384-dim vector (for passages/recipes; no query prefix).

    Args:
        text: Input text (e.g. recipe description).

    Returns:
        List of 384 floats (normalized).
    """
    if not text or not str(text).strip():
        return [0.0] * _EMBED_DIM
    model = _get_model()
    vec = model.encode(str(text).strip(), normalize_embeddings=True)
    return vec.tolist()


def embed_query(text: str) -> List[float]:
    """
    Embed a search query with BGE's retrieval prefix for better similarity to passages.
    Use this for user search text; use embed() for recipe/passage text.
    """
    if not text or not str(text).strip():
        return [0.0] * _EMBED_DIM
    prefixed = _BGE_QUERY_PREFIX + str(text).strip()
    return embed(prefixed)


def embed_batch(texts: List[str]) -> List[List[float]]:
    """
    Embed multiple strings in one batch (faster than repeated embed()).

    Args:
        texts: List of input strings.

    Returns:
        List of 384-dim vectors.
    """
    if not texts:
        return []
    # Filter empty; fill with zero vector later if needed
    non_empty = [str(t).strip() if t else "" for t in texts]
    if all(not t for t in non_empty):
        return [[0.0] * _EMBED_DIM] * len(texts)
    model = _get_model()
    vecs = model.encode(non_empty, normalize_embeddings=True)
    return [v.tolist() for v in vecs]


def cosine_similarity(a: List[float], b: List[float]) -> float:
    """
    Cosine similarity between two vectors (assumed normalized).

    Returns value in [-1, 1]. For normalized vectors, dot product equals cosine.
    """
    if len(a) != len(b) or not a:
        return 0.0
    return float(sum(x * y for x, y in zip(a, b)))


def embedding_to_json(vec: List[float]) -> str:
    """Serialize embedding for DB storage (TEXT column)."""
    return json.dumps(vec)


def embedding_from_json(s: Optional[str]) -> List[float]:
    """Deserialize embedding from DB."""
    if not s:
        return []
    try:
        return json.loads(s)
    except (TypeError, ValueError):
        return []


def embed_dim() -> int:
    """Return embedding dimension (384 for BAAI/bge-small-en-v1.5)."""
    return _EMBED_DIM
