"""
Check recipes in the database - both recent and saved recipes.

Usage:
    python scripts/check_recipes.py
    python scripts/check_recipes.py --user-email your@email.com
"""

import sys
import argparse
from pathlib import Path
from datetime import datetime, timezone

_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_root))

from src.database import get_db_session, User, SavedRecipe, RecentRecipe


def main():
    """Check recipes in database."""
    parser = argparse.ArgumentParser(description='Check recipes in database')
    parser.add_argument('--user-email', help='Filter by user email')
    args = parser.parse_args()

    print("=" * 80)
    print("🍳 RECIPE DATABASE CHECK")
    print("=" * 80)

    session = get_db_session()
    try:
        # Get user if email provided
        user = None
        if args.user_email:
            user = session.query(User).filter(User.email == args.user_email).first()
            if not user:
                print(f"\n❌ User not found: {args.user_email}")
                return
            print(f"\n👤 User: {user.email} (ID: {user.id})")
            print(f"   Name: {user.full_name or 'Not set'}")
        
        # Check recent recipes
        print("\n" + "=" * 80)
        print("📝 RECENT RECIPES")
        print("=" * 80)
        
        recent_query = session.query(RecentRecipe)
        if user:
            recent_query = recent_query.filter(RecentRecipe.user_id == user.id)
        
        recent_recipes = recent_query.order_by(RecentRecipe.generated_at.desc()).all()
        
        if not recent_recipes:
            print("\n❌ No recent recipes found")
        else:
            print(f"\n✅ Found {len(recent_recipes)} recent recipe(s):\n")
            for i, recipe in enumerate(recent_recipes, 1):
                recipe_user = session.query(User).filter(User.id == recipe.user_id).first()
                print(f"  [{i}] {recipe.name}")
                print(f"      ID: {recipe.id}")
                print(f"      User: {recipe_user.email if recipe_user else f'ID {recipe.user_id}'}")
                print(f"      Generated: {recipe.generated_at}")
                print(f"      Cuisine: {recipe.cuisine or 'Not specified'}")
                print(f"      Difficulty: {recipe.difficulty or 'Not specified'}")
                print(f"      Time: {recipe.prep_time or 0} min prep + {recipe.cook_time or 0} min cook")
                print(f"      Servings: {recipe.servings or 'Not specified'}")
                print(f"      AI Model: {recipe.ai_model or 'Not specified'}")
                
                # Parse ingredients and show count
                ingredients = recipe.ingredients.split('\n') if recipe.ingredients else []
                print(f"      Ingredients: {len(ingredients)} items")
                
                # Parse instructions and show count
                instructions = recipe.instructions.split('\n') if recipe.instructions else []
                print(f"      Instructions: {len(instructions)} steps")
                print()
        
        # Check saved recipes
        print("\n" + "=" * 80)
        print("💾 SAVED RECIPES")
        print("=" * 80)
        
        saved_query = session.query(SavedRecipe)
        if user:
            saved_query = saved_query.filter(SavedRecipe.user_id == user.id)
        
        saved_recipes = saved_query.order_by(SavedRecipe.created_at.desc()).all()
        
        if not saved_recipes:
            print("\n❌ No saved recipes found")
        else:
            print(f"\n✅ Found {len(saved_recipes)} saved recipe(s):\n")
            for i, recipe in enumerate(saved_recipes, 1):
                recipe_user = session.query(User).filter(User.id == recipe.user_id).first()
                print(f"  [{i}] {recipe.name}")
                print(f"      ID: {recipe.id}")
                print(f"      User: {recipe_user.email if recipe_user else f'ID {recipe.user_id}'}")
                print(f"      Saved: {recipe.created_at}")
                print(f"      Cuisine: {recipe.cuisine or 'Not specified'}")
                print(f"      Difficulty: {recipe.difficulty or 'Not specified'}")
                print(f"      Time: {recipe.prep_time or 0} min prep + {recipe.cook_time or 0} min cook")
                print(f"      Servings: {recipe.servings or 'Not specified'}")
                
                # Parse ingredients and show count
                ingredients = recipe.ingredients.split('\n') if recipe.ingredients else []
                print(f"      Ingredients: {len(ingredients)} items")
                
                # Parse instructions and show count
                instructions = recipe.instructions.split('\n') if recipe.instructions else []
                print(f"      Instructions: {len(instructions)} steps")
                
                if recipe.notes:
                    print(f"      Notes: {recipe.notes[:50]}..." if len(recipe.notes) > 50 else f"      Notes: {recipe.notes}")
                print()
        
        # Summary
        print("\n" + "=" * 80)
        print("📊 SUMMARY")
        print("=" * 80)
        if user:
            print(f"\nUser: {user.email}")
        else:
            print(f"\nAll users")
        print(f"Recent recipes: {len(recent_recipes)}")
        print(f"Saved recipes: {len(saved_recipes)}")
        print(f"Total recipes: {len(recent_recipes) + len(saved_recipes)}")
        
        # Show all users with recipes
        if not user:
            print("\n" + "=" * 80)
            print("👥 USERS WITH RECIPES")
            print("=" * 80)
            users_with_recent = session.query(User).join(RecentRecipe).distinct().all()
            users_with_saved = session.query(User).join(SavedRecipe).distinct().all()
            all_users = set(users_with_recent + users_with_saved)
            
            if all_users:
                print()
                for user in all_users:
                    recent_count = session.query(RecentRecipe).filter(RecentRecipe.user_id == user.id).count()
                    saved_count = session.query(SavedRecipe).filter(SavedRecipe.user_id == user.id).count()
                    print(f"  {user.email}")
                    print(f"    Recent: {recent_count}, Saved: {saved_count}")
            else:
                print("\n❌ No users have any recipes")
        
        print("\n" + "=" * 80)
        
    finally:
        session.close()


if __name__ == "__main__":
    main()
