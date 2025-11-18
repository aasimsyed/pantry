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


def _display_recipe(recipe: Dict, idx: int, api) -> None:
    """Helper function to display a single recipe."""
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
        
        st.markdown("---")
        
        # Flavor Pairings
        flavor_pairings = recipe.get('flavor_pairings', [])
        if flavor_pairings:
            st.markdown("### 🧪 Flavor Chemistry")
            st.caption("Scientifically-proven flavor pairings based on shared chemical compounds")
            
            for pairing in flavor_pairings:
                if isinstance(pairing, dict):
                    ingredients = pairing.get('ingredients', [])
                    compounds = pairing.get('compounds', '')
                    effect = pairing.get('effect', '')
                    
                    if ingredients:
                        with st.expander(f"🔬 {' + '.join(ingredients[:2])}" + (f" + {len(ingredients)-2} more" if len(ingredients) > 2 else "")):
                            if compounds:
                                st.markdown(f"**Shared Compounds:** {compounds}")
                            if effect:
                                st.markdown(f"**Effect:** {effect}")
                else:
                    st.write(f"- {pairing}")
        
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
        
        # Display missing ingredients prominently
        if missing:
            st.markdown("---")
            st.markdown("### 🛒 Missing Ingredients (Shopping List)")
            st.caption("These ingredients are not in your pantry but are needed for this recipe:")
            for missing_item in missing:
                st.markdown(f"- **{missing_item}**")
            st.info("💡 Tip: Add these items to your shopping list or pantry to make this recipe!")
        
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
    
    # Required Ingredients Selection
    st.subheader("✅ Required Ingredients")
    st.caption("Must be included in recipes (but recipes can use other ingredients too)")
    
    required_ingredients = st.multiselect(
        "Required ingredients:",
        options=available_ingredients,
        default=[],
        help="Select ingredients that must be included. Recipes can also use other available ingredients."
    )
    
    st.markdown("---")
    
    # Excluded Ingredients Selection
    st.subheader("❌ Excluded Ingredients")
    st.caption("Must NOT be included in recipes")
    
    excluded_ingredients = st.multiselect(
        "Excluded ingredients:",
        options=available_ingredients,
        default=[],
        help="Select ingredients to exclude from recipes"
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
    
    # Allow Missing Ingredients
    allow_missing = st.checkbox(
        "✨ Allow Missing Ingredients",
        value=False,
        help="Allow recipes to include 2-4 ingredients not in your pantry. Missing items will be listed separately."
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
if generate_button or refresh_button:
    # Clear previous recipes if regenerating
    if refresh_button:
        st.session_state.recipes = []
        st.session_state.required_ingredients_used = None
        st.session_state.excluded_ingredients_used = None
    
    # Prepare request
    required_to_use = required_ingredients if required_ingredients else None
    excluded_to_use = excluded_ingredients if excluded_ingredients else None
    cuisine_to_use = cuisine if cuisine else None
    difficulty_to_use = difficulty.lower() if difficulty else None
    allow_missing_to_use = allow_missing
    
    # Initialize session state if needed
    if 'recipes' not in st.session_state:
        st.session_state.recipes = []
    if 'required_ingredients_used' not in st.session_state:
        st.session_state.required_ingredients_used = required_to_use
    if 'excluded_ingredients_used' not in st.session_state:
        st.session_state.excluded_ingredients_used = excluded_to_use
    
    # Generate recipes incrementally
    progress_bar = st.progress(0)
    status_text = st.empty()
    
    try:
        # Generate recipes one at a time
        for i in range(num_recipes):
            # Update progress
            progress = (i + 1) / num_recipes
            progress_bar.progress(progress)
            status_text.info(f"🍳 Generating recipe {i+1} of {num_recipes}...")
            
            # Get list of already generated recipe names to avoid duplicates
            avoid_names = [r.get('name') for r in st.session_state.recipes if r.get('name')]
            
            # Generate single recipe
            recipe = api.generate_single_recipe(
                required_ingredients=required_to_use,
                excluded_ingredients=excluded_to_use,
                cuisine=cuisine_to_use,
                difficulty=difficulty_to_use,
                dietary_restrictions=dietary_restrictions if dietary_restrictions else None,
                avoid_names=avoid_names,
                allow_missing_ingredients=allow_missing_to_use
            )
            
            # Add to session state
            st.session_state.recipes.append(recipe)
            
            # Display recipe immediately
            _display_recipe(recipe, len(st.session_state.recipes), api)
        
        # Clear progress indicators
        progress_bar.empty()
        status_text.success(f"✅ Generated {len(st.session_state.recipes)} recipes!")
        
    except Exception as e:
        progress_bar.empty()
        status_text.error(f"❌ Failed to generate recipes: {e}")
        st.info("💡 Make sure your OpenAI API key is configured in `.env`")
        st.stop()

# Display existing recipes (when not generating)
elif 'recipes' in st.session_state and st.session_state.recipes:
    # Show summary
    st.success(f"✅ {len(st.session_state.recipes)} recipes generated!")
    
    # Show ingredient constraints
    info_parts = []
    if st.session_state.get('required_ingredients_used'):
        info_parts.append(f"✅ Required: {', '.join(st.session_state.required_ingredients_used)}")
    if st.session_state.get('excluded_ingredients_used'):
        info_parts.append(f"❌ Excluded: {', '.join(st.session_state.excluded_ingredients_used)}")
    
    if info_parts:
        st.info(" | ".join(info_parts))
    else:
        st.info(f"📦 Using all {len(available_ingredients)} available ingredients")
    
    st.markdown("---")
    
    # Display all recipes
    for idx, recipe in enumerate(st.session_state.recipes, 1):
        _display_recipe(recipe, idx, api)

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
    1. **Required Ingredients** (optional): Select ingredients that must be included in recipes. Recipes can also use other available ingredients.
    2. **Excluded Ingredients** (optional): Select ingredients to exclude from recipes.
    3. **Allow Missing Ingredients** (optional): Enable to allow recipes with 2-4 ingredients not in your pantry. Missing items will be listed for shopping.
    4. **Set Options**: Choose cuisine type, difficulty, and dietary restrictions
    5. **Generate**: Click "Generate Recipes" to create AI-powered recipes
    6. **Regenerate**: Click "Regenerate" to get new recipe variations
    
    **Tips:**
    - Required ingredients ensure your recipes include specific items
    - Excluded ingredients help avoid allergens or unwanted items
    - Allow missing ingredients to get more recipe variety (great for meal planning!)
    - Leave both empty to use all available ingredients
    - Use dietary restrictions to filter recipes
    - Regenerate to get different recipe ideas
    - Recipes appear as they're generated - no need to wait for all!
    - Missing ingredients are clearly marked and can be added to your shopping list
    """)
