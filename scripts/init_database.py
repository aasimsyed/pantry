"""
Initialize and populate pantry database.

Usage:
    python scripts/init_database.py
    python scripts/init_database.py --import reports/pantry_products.json
    python scripts/init_database.py --stats
"""

import argparse
import sys
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_root))

from src.database import init_database
from src.db_service import PantryService


def main():
    parser = argparse.ArgumentParser(description="Initialize and populate pantry database")
    parser.add_argument("--import", dest="import_file", type=str, help="Import from JSON report")
    parser.add_argument("--location", type=str, default="pantry", choices=["pantry", "fridge", "freezer"])
    parser.add_argument("--stats", action="store_true", help="Show database statistics")
    args = parser.parse_args()

    print("=" * 70)
    print("PANTRY DATABASE INITIALIZATION")
    print("=" * 70)
    print("\nCreating database schema...")
    init_database()

    if args.import_file:
        p = Path(args.import_file)
        if not p.exists():
            print("Error: File not found:", p)
            return 1
        print("Importing from", p, "location:", args.location)
        with PantryService() as svc:
            st = svc.import_from_json_report(p, storage_location=args.location)
            print("Import complete. Products:", st["products_created"], "Items:", st["items_created"])

    if args.stats or args.import_file:
        with PantryService() as svc:
            st = svc.get_statistics()
            print("Total products:", st["total_products"], "Total items:", st["total_items"])

    print("Database initialized. Next: python scripts/query_pantry.py")
    return 0


if __name__ == "__main__":
    exit(main())
