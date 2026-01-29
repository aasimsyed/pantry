#!/usr/bin/env python3
"""
Backfill recipe_embeddings for existing saved recipes.

Run once after enabling semantic search, or when you have many recipes
and want to avoid slow first-search (lazy backfill). Requires:
  pip install sentence-transformers

Usage:
  python scripts/backfill_recipe_embeddings.py
  cd /path/to/pantry && python scripts/backfill_recipe_embeddings.py
"""
import logging
import sys
from pathlib import Path

# Project root on path so "from src. ..." works when run from any cwd
_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_root))

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


def main() -> int:
    from src.database import get_db_session, init_database
    from src.db_service import PantryService
    from src.migrations import add_recipe_embeddings_table

    init_database()
    add_recipe_embeddings_table()
    service = PantryService(get_db_session())
    try:
        from src.database import SavedRecipe
        recipes = service.session.query(SavedRecipe).order_by(SavedRecipe.id).all()
        total = len(recipes)
        if total == 0:
            logger.info("No saved recipes to backfill")
            return 0
        logger.info("Backfilling embeddings for %d recipes...", total)
        for i, recipe in enumerate(recipes, 1):
            try:
                service._upsert_recipe_embedding(recipe)
                if i % 10 == 0 or i == total:
                    logger.info("  %d / %d", i, total)
            except Exception as e:
                logger.warning("  Skip recipe id=%s: %s", recipe.id, e)
        logger.info("Done. %d recipes have embeddings.", total)
        return 0
    except ImportError as e:
        logger.error("sentence-transformers not installed: %s", e)
        logger.info("Install with: pip install sentence-transformers")
        return 1
    finally:
        service.close()


if __name__ == "__main__":
    sys.exit(main())
