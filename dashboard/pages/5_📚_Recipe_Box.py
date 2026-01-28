"""Recipe Box Page - View saved recipes."""

import streamlit as st
import sys
from pathlib import Path
from typing import List, Dict

sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.api_client import get_api_client, require_auth

st.set_page_config(page_title="Recipe Box", page_icon="📚", layout="wide")

# Require authentication
require_auth()

st.title("📚 Recipe Box")
st.markdown("Your saved favorite recipes")
st.markdown("---")

api = get_api_client()

# Filters
col1, col2 = st.columns(2)
with col1:
    cuisine_filter = st.selectbox(
        "Filter by Cuisine",
        options=["All"] + ["Italian", "Mexican", "Asian", "American", "Mediterranean", "Indian", "French", "Thai", "Japanese", "Chinese"],
        help="Filter recipes by cuisine type"
    )
with col2:
    difficulty_filter = st.selectbox(
        "Filter by Difficulty",
        options=["All", "Easy", "Medium", "Hard"],
        help="Filter recipes by difficulty"
    )

# Get saved recipes
try:
    cuisine = None if cuisine_filter == "All" else cuisine_filter.lower()
    difficulty = None if difficulty_filter == "All" else difficulty_filter.lower()
    
    recipes = api.get_saved_recipes(cuisine=cuisine, difficulty=difficulty)
    
    if recipes:
        st.markdown(f"**Found {len(recipes)} saved recipes**")
        st.markdown("---")
        
        for recipe in recipes:
            with st.container():
                # Recipe Header
                col1, col2, col3 = st.columns([3, 2, 1])
                
                with col1:
                    st.subheader(recipe.get('name', 'Unnamed Recipe'))
                    if recipe.get('description'):
                        st.write(recipe['description'])
                
                with col2:
                    # Recipe metadata
                    difficulty_emoji = {
                        'easy': '🟢',
                        'medium': '🟡',
                        'hard': '🔴'
                    }.get(recipe.get('difficulty', 'medium') or 'medium', '🟡')
                    
                    rating_stars = "⭐" * (recipe.get('rating', 0) or 0)
                    
                    st.markdown(f"""
                    **{difficulty_emoji} {recipe.get('difficulty', 'Medium') or 'Medium'}**
                    
                    ⏱️ Prep: {recipe.get('prep_time', 0) or 0} min  
                    🔥 Cook: {recipe.get('cook_time', 0) or 0} min  
                    👥 Serves: {recipe.get('servings', 4) or 4}
                    {f'⭐ Rating: {rating_stars}' if recipe.get('rating') else ''}
                    """)
                
                with col3:
                    recipe_id = recipe.get('id')
                    if st.button("🗑️ Delete", key=f"delete_{recipe_id}", use_container_width=True):
                        try:
                            api.delete_saved_recipe(recipe_id)
                            st.success("Deleted!")
                            st.rerun()
                        except Exception as e:
                            st.error(f"Error: {e}")
                
                # Cuisine and tags
                if recipe.get('cuisine'):
                    st.caption(f"🌍 {recipe['cuisine'].title()} Cuisine")
                if recipe.get('tags'):
                    tags = recipe['tags'] if isinstance(recipe['tags'], list) else []
                    if tags:
                        tag_str = " ".join([f"🏷️ {tag}" for tag in tags])
                        st.caption(tag_str)
                
                st.markdown("---")
                
                # Ingredients
                st.markdown("### 📋 Ingredients")
                ingredients = recipe.get('ingredients', [])
                
                if ingredients:
                    for ing in ingredients:
                        if isinstance(ing, dict):
                            item = ing.get('item', ing.get('name', ''))
                            amount = ing.get('amount', '')
                            notes = ing.get('notes', '')
                            if amount:
                                st.write(f"- **{item}**: {amount}" + (f" ({notes})" if notes else ""))
                            else:
                                st.write(f"- **{item}**" + (f" ({notes})" if notes else ""))
                        else:
                            st.write(f"- {ing}")
                else:
                    st.write("No ingredients listed")
                
                st.markdown("---")
                
                # Instructions
                st.markdown("### 👨‍🍳 Instructions")
                instructions = recipe.get('instructions', [])
                
                if instructions:
                    for i, step in enumerate(instructions, 1):
                        st.write(f"**{i}.** {step}")
                else:
                    st.write("No instructions provided")
                
                # Notes
                if recipe.get('notes'):
                    st.markdown("---")
                    st.markdown("### 📝 Notes")
                    st.info(recipe['notes'])
                
                # Date saved
                if recipe.get('created_at'):
                    st.caption(f"💾 Saved on {recipe['created_at'][:10]}")
                
                st.markdown("---")
                st.markdown("")
    else:
        st.info("📚 Your recipe box is empty. Generate and save recipes from the Recipes page!")
        if st.button("Go to Recipes"):
            st.switch_page("pages/3_🍳_Recipes.py")

except Exception as e:
    st.error(f"Failed to load saved recipes: {e}")

