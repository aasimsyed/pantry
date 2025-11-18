"""Recipes Page (Placeholder for future AI recipe generation)."""

import streamlit as st
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.api_client import get_api_client

st.set_page_config(page_title="Recipes", page_icon="🍳", layout="wide")

st.title("🍳 Recipe Suggestions")
st.markdown("AI-powered recipe suggestions based on your pantry items")
st.markdown("---")

api = get_api_client()

st.info("🚧 This feature is coming soon!")

st.markdown("""
### Future Features:

- **AI Recipe Generation**: Generate recipes using only items in your pantry
- **Dietary Filters**: Vegetarian, vegan, gluten-free, etc.
- **Cuisine Preferences**: Italian, Mexican, Asian, etc.
- **Difficulty Levels**: Easy, medium, hard
- **Missing Ingredients**: Show what you need to buy
- **Recipe Ratings**: Rate and save your favorites
- **Shopping List**: Generate list for missing ingredients

### How it will work:

1. Select your dietary preferences
2. Choose cuisine type and difficulty
3. Click "Generate Recipes"
4. Browse AI-generated recipes
5. Mark ingredients as used
6. Rate and save favorites

---

*This feature integrates with the existing `recipe_generator.py` module 
and will leverage OpenAI/Claude APIs for recipe generation.*
""")

# Show available ingredients
try:
    items = api.get_inventory(status="in_stock")
    
    if items:
        st.subheader("📦 Available Ingredients")
        st.write(f"You have {len(items)} items in stock:")
        
        ingredients = [item.get('product_name', 'Unknown') for item in items[:20]]
        st.write(", ".join(ingredients))
        
        if len(items) > 20:
            st.write(f"...and {len(items) - 20} more items")
    else:
        st.warning("Add items to your pantry to get recipe suggestions!")

except Exception as e:
    st.error(f"Failed to load inventory: {e}")

