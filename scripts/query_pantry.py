"""
Query pantry database - Interactive CLI for database queries.

Usage:
    python scripts/query_pantry.py
    python -m scripts.query_pantry
"""

import sys
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_root))

from src.database import Product, InventoryItem
from src.db_service import PantryService


def main():
    """Interactive query interface."""
    print("=" * 70)
    print("🔍 PANTRY DATABASE QUERY")
    print("=" * 70)

    with PantryService() as service:
        while True:
            print("\n" + "=" * 70)
            print("Options:")
            print("  1. Show all products")
            print("  2. Show all inventory items")
            print("  3. Search products")
            print("  4. Items by location")
            print("  5. Expiring soon (7 days)")
            print("  6. Expired items")
            print("  7. Statistics")
            print("  8. Categories")
            print("  9. Brands")
            print("  0. Exit")
            print("=" * 70)

            choice = input("\nEnter choice: ").strip()

            if choice == "0":
                print("\n👋 Goodbye!")
                break

            elif choice == "1":
                products = service.session.query(Product).all()
                print(f"\n📦 Products ({len(products)}):")
                for p in products:
                    items_count = len([i for i in p.inventory_items if i.status == "in_stock"])
                    print(f"  [{p.id}] {p.product_name} ({p.brand}) - {p.category}")
                    print(f"       {items_count} items in stock")

            elif choice == "2":
                items = service.get_all_inventory()
                print(f"\n📦 Inventory Items ({len(items)}):")
                for item in items:
                    print(f"  [{item.id}] {item.product.product_name}")
                    print(f"       Quantity: {item.quantity} {item.unit}")
                    print(f"       Location: {item.storage_location}")
                    print(f"       Status: {item.status}")
                    if item.expiration_date:
                        days_left = item.days_until_expiration
                        print(f"       Expires: {item.expiration_date.date()} ({days_left} days)")

            elif choice == "3":
                query = input("Search query: ").strip()
                products = service.search_products(query)
                print(f"\n🔍 Search Results ({len(products)}):")
                for p in products:
                    print(f"  {p.product_name} ({p.brand}) - {p.category}")

            elif choice == "4":
                location = input("Location (pantry/fridge/freezer): ").strip()
                items = service.get_inventory_by_location(location)
                print(f"\n📍 Items in {location} ({len(items)}):")
                for item in items:
                    print(f"  {item.product.product_name}: {item.quantity} {item.unit}")

            elif choice == "5":
                items = service.get_expiring_items(7)
                print(f"\n⚠️  Expiring Soon ({len(items)}):")
                for item in items:
                    days_left = item.days_until_expiration
                    print(f"  {item.product.product_name}")
                    print(f"     Expires: {item.expiration_date.date()} ({days_left} days)")

            elif choice == "6":
                items = service.get_expired_items()
                print(f"\n❌ Expired Items ({len(items)}):")
                for item in items:
                    print(f"  {item.product.product_name}")
                    print(f"     Expired: {item.expiration_date.date()}")

            elif choice == "7":
                stats = service.get_statistics()
                print(f"\n📊 Statistics:")
                print(f"  Total Products: {stats['total_products']}")
                print(f"  Total Items: {stats['total_items']}")
                print(f"  Expiring Soon: {stats['expiring_soon']}")
                print(f"  Expired: {stats['expired']}")
                print(f"\n  By Category:")
                for cat, count in stats['by_category'].items():
                    print(f"    {cat:30s} {count:3d}")
                print(f"\n  By Location:")
                for loc, count in stats['by_location'].items():
                    print(f"    {loc:20s} {count:3d}")

            elif choice == "8":
                categories = service.get_all_categories()
                print(f"\n📂 Categories ({len(categories)}):")
                for cat in sorted(categories):
                    print(f"  - {cat}")

            elif choice == "9":
                brands = service.get_all_brands()
                print(f"\n🏷️  Brands ({len(brands)}):")
                for brand in sorted(brands):
                    print(f"  - {brand}")

            else:
                print("\n❌ Invalid choice")


if __name__ == "__main__":
    main()
