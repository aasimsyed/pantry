"""
Initialize and populate pantry database.

This script initializes the database schema and optionally imports
data from JSON reports.

Usage:
    # Initialize database only
    python init_database.py
    
    # Initialize and import from report
    python init_database.py --import reports/pantry_products.json
    
    # Specify storage location
    python init_database.py --import reports/pantry_products.json --location fridge
    
    # Show statistics
    python init_database.py --stats
"""

import argparse
from pathlib import Path

from src.database import init_database
from src.db_service import PantryService


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Initialize and populate pantry database"
    )
    
    parser.add_argument(
        "--import",
        dest="import_file",
        type=str,
        help="Import data from JSON report"
    )
    
    parser.add_argument(
        "--location",
        type=str,
        default="pantry",
        choices=["pantry", "fridge", "freezer"],
        help="Default storage location for imported items"
    )
    
    parser.add_argument(
        "--stats",
        action="store_true",
        help="Show database statistics"
    )
    
    args = parser.parse_args()
    
    print("=" * 70)
    print("🗄️  PANTRY DATABASE INITIALIZATION")
    print("=" * 70)
    
    # Initialize database
    print("\n📋 Creating database schema...")
    init_database()
    
    # Import data if specified
    if args.import_file:
        import_path = Path(args.import_file)
        
        if not import_path.exists():
            print(f"\n❌ Error: File not found: {import_path}")
            return 1
        
        print(f"\n📥 Importing data from {import_path}...")
        print(f"   Storage location: {args.location}")
        
        with PantryService() as service:
            stats = service.import_from_json_report(
                import_path,
                storage_location=args.location
            )
            
            print(f"\n✅ Import complete!")
            print(f"   Products created: {stats['products_created']}")
            print(f"   Items created: {stats['items_created']}")
            print(f"   Logs created: {stats['logs_created']}")
            if stats['errors'] > 0:
                print(f"   ⚠️  Errors: {stats['errors']}")
    
    # Show statistics
    if args.stats or args.import_file:
        print(f"\n📊 Database Statistics:")
        print("=" * 70)
        
        with PantryService() as service:
            stats = service.get_statistics()
            
            print(f"\n🏢 Overall:")
            print(f"   Total Products: {stats['total_products']}")
            print(f"   Total Items: {stats['total_items']}")
            print(f"   Expiring Soon: {stats['expiring_soon']}")
            print(f"   Expired: {stats['expired']}")
            
            if stats['by_category']:
                print(f"\n📂 By Category:")
                for category, count in sorted(
                    stats['by_category'].items(),
                    key=lambda x: x[1],
                    reverse=True
                ):
                    print(f"   {category:30s} {count:3d} items")
            
            if stats['by_location']:
                print(f"\n📍 By Location:")
                for location, count in stats['by_location'].items():
                    print(f"   {location:20s} {count:3d} items")
    
    print("\n" + "=" * 70)
    print("✅ Database initialized successfully!")
    print("=" * 70)
    print("\nDatabase: see DATABASE_URL in .env (Postgres or SQLite)")
    print("\nNext steps:")
    print("  - Query database: python query_pantry.py")
    print("  - Start API: ./start-backend-local.sh")
    print("  - Update inventory: Use PantryService or the API")
    print("=" * 70)
    
    return 0


if __name__ == "__main__":
    exit(main())

