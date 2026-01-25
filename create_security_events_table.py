#!/usr/bin/env python3
"""
Create security_events table in Cloud SQL database.
This script should be run inside Cloud Run where it has direct database access.
"""
import sys
from src.database import Base, create_database_engine, SecurityEvent

def main():
    print("🔧 Creating security_events table...")
    engine = create_database_engine()
    
    try:
        # Create the security_events table
        SecurityEvent.__table__.create(engine, checkfirst=True)
        print("✅ security_events table created successfully!")
        return 0
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
