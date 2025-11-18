"""Recipes Page - AI-powered recipe generation."""

import streamlit as st
import sys
from pathlib import Path
from typing import List, Dict

sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.api_client import get_api_client

st.set_page_config(page_title="Recipes", page_icon="🍳", layout="wide")

st.title("🍳 Recipe Suggestions")
st.markdown("AI-powered recipe suggestions based on your pantry items")
st.markdown("---")

api = get_api_client()

# Get available ingredients
try:
    items = api.get_inventory(status="in_stock", limit=1000)
    
    if not items:
        st.warning("⚠️ No items in stock. Add items to your pantry first!")
        if st.button("Go to Inventory"):
            st.switch_page("pages/1_📦_Inventory.py")
        st.stop()
    
    # Extract unique product names
    available_ingredients = []
    seen = set()
    for item in items:
        product_name = item.get('product_name')
        if product_name and product_name not in seen:
            available_ingredients.append(product_name)
            seen.add(product_name)
    
    available_ingredients.sort()
    
except Exception as e:
    st.error(f"Failed to load ingredients: {e}")
    st.stop()

# Sidebar - Recipe Options
with st.sidebar:
    st.header("⚙️ Recipe Options")
    
    # Ingredient Selection
    st.subheader("📦 Select Ingredients")
    st.caption("Leave empty to use all available ingredients")
    
    selected_ingredients = st.multiselect(
        "Choose ingredients:",
        options=available_ingredients,
        default=[],
        help="Select specific ingredients, or leave empty to use all"
    )
    
    st.markdown("---")
    
    # Recipe Count
    num_recipes = st.slider(
        "Number of recipes",
        min_value=1,
        max_value=10,
        value=5,
        help="How many recipes to generate"
    )
    
    # Cuisine
    cuisine = st.selectbox(
        "Cuisine Type (Optional)",
        options=["", "Italian", "Mexican", "Asian", "American", "Mediterranean", "Indian", "French", "Thai", "Japanese", "Chinese"],
        help="Preferred cuisine style"
    )
    
    # Difficulty
    difficulty = st.selectbox(
        "Difficulty (Optional)",
        options=["", "Easy", "Medium", "Hard"],
        help="Recipe difficulty level"
    )
    
    # Dietary Restrictions
    dietary_options = [
        "Vegetarian",
        "Vegan",
        "Gluten-Free",
        "Dairy-Free",
        "Nut-Free",
        "Keto",
        "Paleo"
    ]
    
    dietary_restrictions = st.multiselect(
        "Dietary Restrictions (Optional)",
        options=dietary_options,
        default=[],
        help="Select dietary requirements"
    )
    
    st.markdown("---")
    
    # Generate Button
    generate_button = st.button(
        "🍳 Generate Recipes",
        type="primary",
        use_container_width=True
    )
    
    # Refresh Button (only show if recipes exist)
    if 'recipes' in st.session_state and st.session_state.recipes:
        refresh_button = st.button(
        "🔄 Regenerate",
        use_container_width=True,
        help="Generate new recipes with same settings"
    )
    else:
        refresh_button = False

# Main Content
if generate_button or refresh_button or ('recipes' in st.session_state and st.session_state.recipes):
    # Prepare request
    ingredients_to_use = selected_ingredients if selected_ingredients else None
    cuisine_to_use = cuisine if cuisine else None
    difficulty_to_use = difficulty.lower() if difficulty else None
    
    # Show loading
    with st.spinner("🍳 Generating delicious recipes... This may take a minute."):
        try:
            # Call API
            recipes = api.generate_recipes(
                ingredients=ingredients_to_use,
                max_recipes=num_recipes,
                cuisine=cuisine_to_use,
                difficulty=difficulty_to_use,
                dietary_restrictions=dietary_restrictions if dietary_restrictions else None
            )
            
            # Store in session state
            st.session_state.recipes = recipes
            st.session_state.ingredients_used = ingredients_to_use if ingredients_to_use else "All available"
            
        except Exception as e:
            st.error(f"❌ Failed to generate recipes: {e}")
            st.info("💡 Make sure your OpenAI API key is configured in `.env`")
            st.stop()
    
    # Display recipes
    if st.session_state.recipes:
        st.success(f"✅ Generated {len(st.session_state.recipes)} recipes!")
        
        if ingredients_to_use:
            st.info(f"📦 Using selected ingredients: {', '.join(ingredients_to_use)}")
        else:
            st.info(f"📦 Using all {len(available_ingredients)} available ingredients")
        
        st.markdown("---")
        
        # Display each recipe
        for idx, recipe in enumerate(st.session_state.recipes, 1):
            with st.container():
                # Recipe Header
                col1, col2 = st.columns([3, 1])
                
                with col1:
                    st.subheader(f"{idx}. {recipe.get('name', 'Unnamed Recipe')}")
                    if recipe.get('description'):
                        st.write(recipe['description'])
                
                with col2:
                    # Recipe metadata
                    difficulty_emoji = {
                        'easy': '🟢',
                        'medium': '🟡',
                        'hard': '🔴'
                    }.get(recipe.get('difficulty', 'medium').lower(), '🟡')
                    
                    st.markdown(f"""
                    **{difficulty_emoji} {recipe.get('difficulty', 'Medium').title()}**
                    
                    ⏱️ Prep: {recipe.get('prep_time', 0)} min  
                    🔥 Cook: {recipe.get('cook_time', 0)} min  
                    👥 Serves: {recipe.get('servings', 4)}
                    """)
                
                # Cuisine badge
                if recipe.get('cuisine'):
                    st.caption(f"🌍 {recipe['cuisine'].title()} Cuisine")
                
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
                
                # Available vs Missing ingredients
                available = recipe.get('available_ingredients', [])
                missing = recipe.get('missing_ingredients', [])
                
                if available or missing:
                    col1, col2 = st.columns(2)
                    with col1:
                        if available:
                            st.success(f"✅ Uses {len(available)} pantry items")
                    with col2:
                        if missing:
                            st.warning(f"⚠️ Needs {len(missing)} additional items")
                
                # Save Recipe Button
                col1, col2, col3 = st.columns([2, 2, 1])
                with col3:
                    if st.button("💾 Save Recipe", key=f"save_{idx}", use_container_width=True):
                        try:
                            # Prepare recipe data for saving
                            save_data = {
                                "name": recipe.get('name', 'Unnamed Recipe'),
                                "description": recipe.get('description', ''),
                                "cuisine": recipe.get('cuisine', ''),
                                "difficulty": recipe.get('difficulty', 'medium'),
                                "prep_time": recipe.get('prep_time', 0),
                                "cook_time": recipe.get('cook_time', 0),
                                "servings": recipe.get('servings', 4),
                                "ingredients": recipe.get('ingredients', []),
                                "instructions": recipe.get('instructions', [])
                            }
                            
                            api.save_recipe(save_data)
                            st.success(f"✅ Saved '{recipe.get('name')}' to recipe box!")
                            st.rerun()
                        except Exception as e:
                            st.error(f"Failed to save recipe: {e}")
                
                st.markdown("---")
                st.markdown("")

else:
    # Initial state - show instructions
    st.info("👆 Use the sidebar to configure recipe options and click 'Generate Recipes'")
    
    # Show available ingredients
    st.subheader("📦 Available Ingredients")
    st.write(f"You have **{len(available_ingredients)}** unique products in stock:")
    
    # Display in columns for better layout
    num_cols = 3
    cols = st.columns(num_cols)
    
    for idx, ingredient in enumerate(available_ingredients):
        col_idx = idx % num_cols
        with cols[col_idx]:
            st.write(f"• {ingredient}")
    
    st.markdown("---")
    
    # Instructions
    st.subheader("📖 How to Use")
    st.markdown("""
    1. **Select Ingredients** (optional): Choose specific ingredients from the sidebar, or leave empty to use all
    2. **Set Options**: Choose cuisine type, difficulty, and dietary restrictions
    3. **Generate**: Click "Generate Recipes" to create AI-powered recipes
    4. **Regenerate**: Click "Regenerate" to get new recipe variations
    
    **Tips:**
    - More ingredients = more recipe options
    - Select specific ingredients for focused recipes
    - Use dietary restrictions to filter recipes
    - Regenerate to get different recipe ideas
    """)
