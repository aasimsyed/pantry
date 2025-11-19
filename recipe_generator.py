"""
Recipe Generator - Generate recipes using available pantry items.

This script reads the pantry inventory from JSON reports and uses AI to generate
recipes that can be made using ONLY the available ingredients.

Features:
- Reads pantry data from JSON report
- Uses AI to generate creative recipes
- Ensures recipes only use available ingredients
- Generates multiple recipe variations
- Creates beautiful HTML recipe book
- Exports to JSON, Markdown, and HTML

Usage:
    python recipe_generator.py reports/pantry_products.json
    python recipe_generator.py reports/pantry_products.json --recipes 10
    python recipe_generator.py reports/pantry_products.json --cuisine italian
    python recipe_generator.py reports/pantry_products.json --difficulty easy

Run:
    python recipe_generator.py --help
"""

import argparse
import json
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterator, List, Optional, Union

from src.ai_analyzer import AIConfig, create_ai_analyzer


class RecipeGenerator:
    """Generate recipes from available pantry items."""
    
    # Flavor pairing database based on shared chemical compounds
    FLAVOR_PAIRINGS = {
        # Shared compounds: vanillin, eugenol
        "vanilla": ["chocolate", "coffee", "cinnamon", "nutmeg", "cloves", "strawberry", "banana"],
        "chocolate": ["vanilla", "coffee", "mint", "orange", "raspberry", "peanut", "caramel"],
        "coffee": ["chocolate", "vanilla", "cinnamon", "cardamom", "nutmeg", "caramel"],
        
        # Shared compounds: sulfur compounds
        "garlic": ["onion", "tomato", "basil", "parsley", "lemon", "olive oil", "mushroom"],
        "onion": ["garlic", "tomato", "bell pepper", "thyme", "rosemary", "butter"],
        "tomato": ["garlic", "onion", "basil", "oregano", "olive oil", "mozzarella", "parmesan"],
        
        # Shared compounds: esters (fruity notes)
        "lemon": ["garlic", "herbs", "olive oil", "fish", "chicken", "honey", "thyme"],
        "lime": ["cilantro", "chili", "coconut", "ginger", "mint", "fish"],
        "orange": ["chocolate", "cinnamon", "cloves", "vanilla", "cranberry"],
        
        # Shared compounds: aldehydes
        "cinnamon": ["apple", "pear", "vanilla", "nutmeg", "cloves", "chocolate", "coffee"],
        "nutmeg": ["cinnamon", "vanilla", "pumpkin", "sweet potato", "spinach", "cream"],
        "cloves": ["cinnamon", "nutmeg", "orange", "apple", "ham", "pork"],
        
        # Shared compounds: terpenes
        "basil": ["tomato", "garlic", "mozzarella", "olive oil", "pine nuts", "parmesan"],
        "mint": ["chocolate", "lamb", "peas", "cucumber", "lime", "yogurt"],
        "rosemary": ["chicken", "lamb", "potato", "onion", "garlic", "lemon"],
        "thyme": ["chicken", "mushroom", "lemon", "garlic", "onion", "tomato"],
        
        # Shared compounds: capsaicin
        "chili": ["lime", "cilantro", "garlic", "ginger", "cumin", "coriander", "tomato"],
        "ginger": ["chili", "garlic", "soy sauce", "sesame", "lime", "coconut"],
        
        # Shared compounds: umami (glutamates)
        "mushroom": ["garlic", "thyme", "butter", "cream", "parmesan", "wine"],
        "soy sauce": ["ginger", "garlic", "sesame", "honey", "rice vinegar"],
        "parmesan": ["tomato", "basil", "garlic", "olive oil", "mushroom", "pasta"],
        
        # Shared compounds: lactones (creamy, buttery)
        "butter": ["garlic", "herbs", "lemon", "onion", "mushroom", "bread"],
        "cream": ["vanilla", "chocolate", "coffee", "mushroom", "nutmeg", "cinnamon"],
        
        # Shared compounds: pyrazines (nutty, roasted)
        "peanut": ["chocolate", "soy sauce", "ginger", "lime", "cilantro", "chili"],
        "sesame": ["soy sauce", "ginger", "garlic", "honey", "rice vinegar"],
        
        # Shared compounds: aldehydes (green, fresh)
        "cilantro": ["lime", "chili", "ginger", "cumin", "coriander", "fish"],
        "cumin": ["chili", "coriander", "garlic", "onion", "tomato", "lamb"],
        "coriander": ["cumin", "chili", "cilantro", "lime", "garlic"],
    }
    
    def __init__(self, ai_analyzer):
        """Initialize recipe generator.
        
        Args:
            ai_analyzer: AI analyzer instance for recipe generation
        """
        self.analyzer = ai_analyzer
    
    def _identify_flavor_pairings(self, ingredients: List[str]) -> Dict[str, List[str]]:
        """Identify potential flavor pairings based on ingredient names.
        
        Args:
            ingredients: List of ingredient names (may include brand names)
            
        Returns:
            Dictionary mapping ingredients to their compatible pairings
        """
        pairings = {}
        ingredient_lower = [ing.lower() for ing in ingredients]
        
        for ingredient in ingredient_lower:
            # Extract base ingredient name (remove brand, common words)
            base_name = self._extract_base_ingredient(ingredient)
            
            # Find pairings for this ingredient
            compatible = []
            for key, values in self.FLAVOR_PAIRINGS.items():
                if key in base_name:
                    # Add all compatible pairings that are also in our ingredient list
                    for pairing in values:
                        pairing_lower = pairing.lower()
                        # Check if any ingredient contains this pairing
                        for ing in ingredient_lower:
                            if pairing_lower in ing and ing != ingredient:
                                compatible.append(pairing)
                    break
            
            if compatible:
                pairings[ingredient] = list(set(compatible))  # Remove duplicates
        
        return pairings
    
    def _extract_base_ingredient(self, ingredient: str) -> str:
        """Extract base ingredient name from full ingredient string.
        
        Args:
            ingredient: Full ingredient string (may include brand, etc.)
            
        Returns:
            Base ingredient name
        """
        # Remove common brand indicators and extra words
        words_to_remove = ['organic', 'natural', 'fresh', 'dried', 'ground', 'whole', 
                          'extra', 'virgin', 'pure', 'premium', 'classic', 'original']
        
        words = ingredient.lower().split()
        base_words = [w for w in words if w not in words_to_remove]
        
        # Return first few meaningful words (usually brand + ingredient)
        return ' '.join(base_words[-2:]) if len(base_words) > 2 else ' '.join(base_words)
    
    def load_pantry(self, json_file: Path) -> List[Dict]:
        """Load pantry items from JSON report.
        
        Args:
            json_file: Path to pantry JSON report
            
        Returns:
            List of pantry items
        """
        with open(json_file, 'r') as f:
            data = json.load(f)
        
        return data.get('products', [])
    
    def generate_recipes(
        self,
        pantry_items: List[Dict],
        num_recipes: int = 5,
        cuisine: Optional[str] = None,
        difficulty: Optional[str] = None,
        dietary_restrictions: Optional[List[str]] = None,
        required_ingredients: Optional[List[str]] = None,
        excluded_ingredients: Optional[List[str]] = None,
        allow_missing_ingredients: bool = False,
        stream: bool = False,
    ) -> Union[List[Dict], Iterator[Dict]]:
        """Generate recipes using available ingredients.
        
        Args:
            pantry_items: List of available pantry items
            num_recipes: Number of recipes to generate
            cuisine: Cuisine type (italian, mexican, asian, etc.)
            difficulty: Difficulty level (easy, medium, hard)
            dietary_restrictions: List of dietary restrictions
            required_ingredients: Ingredients that must be included in recipes
            excluded_ingredients: Ingredients that must NOT be included in recipes
            allow_missing_ingredients: If True, allow recipes to include 2-4 ingredients not in pantry
            
        Returns:
            List of generated recipes
        """
        # Extract ingredient list
        ingredients = []
        for item in pantry_items:
            product = item['product']
            name = product['product_name']
            brand = product.get('brand')
            
            # Create ingredient description
            if brand:
                ingredients.append(f"{brand} {name}")
            else:
                ingredients.append(name)
        
        print(f"\n{'='*70}")
        print(f"🍳 RECIPE GENERATOR")
        print(f"{'='*70}")
        print(f"📦 Available Ingredients: {len(ingredients)}")
        print(f"👨‍🍳 Recipes to Generate: {num_recipes}")
        if required_ingredients:
            print(f"✅ Required: {', '.join(required_ingredients)}")
        if excluded_ingredients:
            print(f"❌ Excluded: {', '.join(excluded_ingredients)}")
        if allow_missing_ingredients:
            print(f"✨ Missing ingredients allowed (2-4 items)")
        if cuisine:
            print(f"🌍 Cuisine: {cuisine}")
        if difficulty:
            print(f"📊 Difficulty: {difficulty}")
        if dietary_restrictions:
            print(f"🌱 Dietary: {', '.join(dietary_restrictions)}")
        print(f"{'='*70}\n")
        
        recipes = []
        import time
        start_time = time.time()
        
        # Adaptive timeout based on model speed
        # Claude models are slower, so reduce time limit when using Claude
        backend = self.analyzer._get_backend()
        is_claude = backend.__class__.__name__ != 'OpenAIBackend'
        
        # When streaming, no timeout limits - recipes are sent as they're generated
        if stream:
            max_time_seconds = float('inf')  # No timeout when streaming
        elif is_claude:
            # Claude is slower: allow ~40s for 3-4 recipes max
            max_time_seconds = 40
            # Also reduce max recipes for Claude to stay within timeout
            if num_recipes > 3:
                num_recipes = 3
                print(f"    ⚠️  Reduced to 3 recipes max for Claude (slower than GPT-4)")
        else:
            # GPT-4 is faster and can handle more recipes
            # Allow up to 55s (leaving 5s buffer) to maximize recipe generation
            # GPT-4 can generate 10 recipes in ~60-90s, so we're more lenient
            max_time_seconds = 55  # Leave 5 seconds buffer before Railway's 60s timeout
        
        for i in range(num_recipes):
            # Check if we're running out of time (skip if streaming)
            if not stream:
                elapsed = time.time() - start_time
                if elapsed > max_time_seconds:
                    print(f"    ⚠️  Time limit approaching ({elapsed:.1f}s), stopping generation")
                    print(f"    ✅ Generated {len(recipes)}/{num_recipes} recipes before timeout")
                    break
                
                # For GPT-4, be more lenient - only stop if we're very close to 60s
                if not is_claude and elapsed > 58:
                    print(f"    ⚠️  Very close to Railway timeout ({elapsed:.1f}s), stopping generation")
                    print(f"    ✅ Generated {len(recipes)}/{num_recipes} recipes")
                    break
            
            elapsed = time.time() - start_time if not stream else 0
            print(f"[{i+1}/{num_recipes}] Generating recipe... (elapsed: {elapsed:.1f}s)")
            
            try:
                recipe = self._generate_single_recipe(
                    ingredients,
                    cuisine=cuisine,
                    difficulty=difficulty,
                    dietary_restrictions=dietary_restrictions,
                    avoid_previous=[r.get('name') for r in recipes],
                    required_ingredients=required_ingredients,
                    excluded_ingredients=excluded_ingredients,
                    allow_missing_ingredients=allow_missing_ingredients
                )
                
                if recipe:
                    recipes.append(recipe)
                    print(f"    ✅ {recipe['name']}")
                    print(f"       Uses {len(recipe['ingredients'])} pantry items")
                    
                    # If streaming, yield the recipe immediately
                    if stream:
                        yield recipe
                
            except Exception as e:
                print(f"    ❌ Error: {e}")
                if stream:
                    yield {"error": str(e)}
                continue
        
        print(f"\n{'='*70}")
        print(f"✅ Generated {len(recipes)} recipes!")
        print(f"{'='*70}\n")
        
        # Return list if not streaming, otherwise recipes were already yielded
        if not stream:
            return recipes
    
    def _generate_single_recipe(
        self,
        ingredients: List[str],
        cuisine: Optional[str] = None,
        difficulty: Optional[str] = None,
        dietary_restrictions: Optional[List[str]] = None,
        avoid_previous: Optional[List[str]] = None,
        required_ingredients: Optional[List[str]] = None,
        excluded_ingredients: Optional[List[str]] = None,
        allow_missing_ingredients: bool = False,
    ) -> Dict:
        """Generate a single recipe using AI.
        
        Args:
            ingredients: Available ingredients
            cuisine: Cuisine type
            difficulty: Difficulty level
            dietary_restrictions: Dietary restrictions
            avoid_previous: Recipe names to avoid (for variety)
            required_ingredients: Ingredients that must be included in the recipe
            excluded_ingredients: Ingredients that must NOT be included in the recipe
            allow_missing_ingredients: If True, allow recipes to include 2-4 ingredients not in pantry
            
        Returns:
            Recipe dictionary
        """
        # Build prompt
        prompt = self._build_recipe_prompt(
            ingredients,
            cuisine,
            difficulty,
            dietary_restrictions,
            avoid_previous,
            required_ingredients,
            excluded_ingredients,
            allow_missing_ingredients
        )
        
        # Get backend and call directly
        backend = self.analyzer._get_backend()
        
        # Call AI model directly based on backend type
        # Use lower max_tokens for faster response to avoid Railway's 60s HTTP timeout
        # Recipes don't need 2000 tokens - 1500 is sufficient for quality recipes
        recipe_max_tokens = min(1500, backend.config.max_tokens)  # Cap at 1500 for speed
        
        model_used = None  # Track which model was actually used
        
        if backend.__class__.__name__ == 'OpenAIBackend':
            model_used = backend.config.model
            response = backend.client.chat.completions.create(
                model=backend.config.model,
                messages=[
                    {"role": "system", "content": "You are a creative chef. Return only valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,  # More creative for recipes
                max_tokens=recipe_max_tokens,
            )
            content = response.choices[0].message.content.strip()
        else:  # Claude
            # Optimize for speed: try user's model first, then only one fast fallback
            # Claude models are slower than GPT-4, so we minimize fallback attempts
            models_to_try = []
            
            # Add user's selected model first if specified
            if backend.config.model and "claude" in backend.config.model:
                models_to_try.append(backend.config.model)
            
            # Only add ONE fast fallback (Sonnet is faster than Opus)
            # Skip fallback if user explicitly selected a model to save time
            if not (backend.config.model and "claude" in backend.config.model):
                # Only add fallback if no user model specified
                models_to_try.append("claude-3-sonnet-20240229")  # Fast, reliable model
            
            last_error = None
            messages = [{"role": "user", "content": prompt}]
            
            for model_name in models_to_try:
                try:
                    self.analyzer.logger.info(f"Trying Claude model: {model_name}")
                    message = backend.client.messages.create(
                        model=model_name,
                        max_tokens=recipe_max_tokens,
                        temperature=0.7,  # More creative for recipes
                        messages=messages
                    )
                    content = message.content[0].text.strip()
                    model_used = model_name  # Track which model succeeded
                    self.analyzer.logger.info(f"Successfully used Claude model: {model_name}")
                    break  # Success, exit loop
                except Exception as e:
                    last_error = e
                    error_msg = str(e)
                    self.analyzer.logger.warning(f"Model {model_name} failed: {error_msg}")
                    # Only try one fallback to save time
                    if len(models_to_try) > 1:
                        continue  # Try next model
                    else:
                        # If user's model failed and no fallback, raise immediately
                        raise ValueError(f"Failed to generate recipe with Claude: {error_msg}") from e
            
            # If all models failed, raise error
            if 'content' not in locals() or not content:
                error_detail = f"Claude model failed. Last error: {str(last_error)}"
                raise ValueError(f"Failed to generate recipe with Claude: {error_detail}") from last_error
        
        # Remove markdown code blocks if present
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()
        
        # Parse JSON
        import json as json_module
        recipe = json_module.loads(content)
        
        # Add model metadata to recipe
        if model_used:
            recipe['ai_model'] = model_used
        
        return recipe
    
    def _build_recipe_prompt(
        self,
        ingredients: List[str],
        cuisine: Optional[str] = None,
        difficulty: Optional[str] = None,
        dietary_restrictions: Optional[List[str]] = None,
        avoid_previous: Optional[List[str]] = None,
        required_ingredients: Optional[List[str]] = None,
        excluded_ingredients: Optional[List[str]] = None,
        allow_missing_ingredients: bool = False,
    ) -> str:
        """Build prompt for recipe generation."""
        
        # Identify flavor pairings
        flavor_pairings = self._identify_flavor_pairings(ingredients)
        
        if allow_missing_ingredients:
            prompt = f"""You are a creative chef with deep expertise in flavor chemistry and taste science. Generate a delicious, creative recipe using ingredients from this pantry list. You may also suggest additional ingredients that are not in the pantry to complete the recipe.

AVAILABLE PANTRY INGREDIENTS:
{chr(10).join(f"- {ing}" for ing in ingredients)}

IMPORTANT: Prioritize using ingredients from the pantry list above. You may include a few additional ingredients (2-4 items) that are not in the pantry if they are essential for the recipe. Clearly mark which ingredients are from the pantry and which are missing.

"""
        else:
            prompt = f"""You are a creative chef with deep expertise in flavor chemistry and taste science. Generate a delicious, creative recipe using ONLY ingredients from this pantry list.

AVAILABLE PANTRY INGREDIENTS:
{chr(10).join(f"- {ing}" for ing in ingredients)}

"""

        # Add detailed chemistry-based flavor pairing information focused on taste and flavor
        prompt += "FLAVOR CHEMISTRY & TASTE SCIENCE PRINCIPLES:\n"
        prompt += """Understanding the chemical basis of flavor pairing will help you create exceptional recipes:

1. SHARED VOLATILE COMPOUNDS create harmonious flavor connections:
   - Vanillin (vanilla, chocolate, coffee, cinnamon) - creates warm, sweet harmony
   - Eugenol (cloves, cinnamon, nutmeg, basil) - provides spicy, aromatic depth
   - Terpenes (citrus, herbs, pine) - add bright, fresh complexity
   - Sulfur compounds (garlic, onion, cruciferous vegetables) - create savory, umami-rich layers
   - Esters (fruits, flowers) - contribute fruity, floral notes

2. UMAMI SYNERGY enhances savory depth:
   - Glutamates (tomatoes, mushrooms, soy, parmesan) amplify each other
   - Nucleotides (fish, meat, seaweed) create powerful umami combinations
   - Combining glutamate + nucleotide sources creates exponential umami enhancement

3. ACID-BASE BALANCE creates complexity:
   - Acids (citrus, vinegar, wine) brighten and cut through richness
   - They enhance other flavors by making them more perceptible
   - Balance fatty, rich ingredients with acidic components

4. COMPLEMENTARY CHEMICAL PROFILES:
   - Ingredients with similar volatile compounds naturally harmonize
   - Contrasting profiles (sweet + salty, fatty + acidic) create dynamic balance
   - Layering complementary compounds builds flavor depth

5. AROMATIC LAYERING:
   - Primary aromatics (garlic, onion, ginger) form the base
   - Secondary aromatics (herbs, spices) add complexity
   - Tertiary aromatics (citrus zest, finishing herbs) provide brightness

"""
        
        # Add specific flavor pairings if identified
        if flavor_pairings:
            prompt += "SPECIFIC FLAVOR PAIRINGS IDENTIFIED IN YOUR INGREDIENTS:\n"
            for ingredient, pairings in flavor_pairings.items():
                if pairings and ingredient:
                    # Safely handle None or empty values
                    ingredient_name = str(ingredient).title() if ingredient else "Unknown"
                    pairing_names = [str(p).title() for p in pairings[:6] if p]  # Show more pairings
                    if pairing_names:
                        prompt += f"- {ingredient_name}: Pairs beautifully with {', '.join(pairing_names)} due to shared volatile compounds and complementary flavor profiles\n"
            prompt += "\n"
        
        prompt += """CRITICAL: Use this flavor chemistry knowledge to create recipes where ingredients are chosen and combined based on their chemical compatibility and taste synergy. Focus on creating exceptional flavor experiences through scientifically-proven pairings, not on molecular gastronomy techniques.

"""
        
        if allow_missing_ingredients:
            prompt += "CONSTRAINTS: Prioritize pantry ingredients. May include 2-4 missing items if essential. Mark missing ingredients clearly.\n\n"
        else:
            prompt += "CONSTRAINTS: Use ONLY listed ingredients (assume water, salt, pepper). Create complete, detailed recipe.\n\n"
        
        if required_ingredients:
            prompt += f"REQUIRED INGREDIENTS (must include these, but can also use others):\n"
            prompt += f"{chr(10).join(f'- {ing}' for ing in required_ingredients)}\n\n"
        
        if excluded_ingredients:
            prompt += f"EXCLUDED INGREDIENTS (must NOT use these):\n"
            prompt += f"{chr(10).join(f'- {ing}' for ing in excluded_ingredients)}\n\n"
        
        if cuisine:
            prompt += f"- Cuisine style: {cuisine}\n"
        
        if difficulty:
            # Provide clear guidance on what each difficulty level means
            difficulty_guidance = {
                "easy": "Simple recipes with basic techniques, minimal steps, and common ingredients. Suitable for beginners. Prep time typically under 15 minutes.",
                "medium": "Moderate complexity with some advanced techniques, multiple steps, and may require some cooking experience. Prep time typically 15-30 minutes.",
                "hard": "Complex recipes requiring advanced techniques, multiple components, precise timing, and significant cooking experience. Prep time typically 30+ minutes with intricate steps."
            }
            guidance = difficulty_guidance.get(difficulty.lower(), "")
            prompt += f"- CRITICAL: Difficulty level MUST be exactly '{difficulty.lower()}'. {guidance}\n"
            prompt += f"  The recipe MUST match this difficulty level in complexity, techniques, and time required.\n"
        
        if dietary_restrictions:
            prompt += f"- Dietary requirements: {', '.join(dietary_restrictions)}\n"
        
        if avoid_previous:
            prompt += f"- DO NOT create these recipes (already made): {', '.join(avoid_previous)}\n"
        
        prompt += """Return ONLY valid JSON (no markdown, no code blocks) with this EXACT structure:

{
  "name": "Recipe Name",
  "description": "Brief, appetizing description",
  "cuisine": "cuisine type",
  "difficulty": "easy/medium/hard",
  "prep_time": "X minutes",
  "cook_time": "X minutes",
  "servings": 4,
  "ingredients": [
    {"item": "ingredient name", "amount": "quantity", "notes": "optional prep notes"}
  ],
  "instructions": [
    "Step 1 - detailed instruction",
    "Step 2 - detailed instruction"
  ],
  "flavor_pairings": [
    {
      "ingredients": ["ingredient1", "ingredient2"],
      "compounds": "specific shared chemical compounds (e.g., vanillin, eugenol, terpenes, glutamates, sulfur compounds)",
      "effect": "detailed explanation of how these flavors work together chemically and the taste experience they create"
    }
  ],
  "missing_ingredients": [],
  "tips": [],
  "dietary_tags": []
}

CRITICAL JSON STRUCTURE REQUIREMENTS:
- ingredients MUST be an array of objects with "item", "amount", and optionally "notes" keys
- flavor_pairings MUST be an array of objects with "ingredients", "compounds", and "effect" keys
- Do NOT return ingredients or flavor_pairings as strings
- flavor_pairings must explain the CHEMICAL BASIS (specific compounds) and TASTE EFFECT
- Be detailed and creative - focus on exceptional flavor experiences through chemistry-based pairings

Create a recipe that showcases the flavor chemistry principles above. Make it creative, delicious, and scientifically sound in its flavor combinations!"""
        
        return prompt
    
    def save_recipes(
        self,
        recipes: List[Dict],
        output_dir: Path,
        output_prefix: str,
        formats: List[str],
    ):
        """Save recipes to files.
        
        Args:
            recipes: List of recipe dictionaries
            output_dir: Output directory
            output_prefix: File name prefix
            formats: List of formats to generate
        """
        output_dir.mkdir(parents=True, exist_ok=True)
        
        if "all" in formats:
            formats = ["json", "markdown", "html"]
        
        for fmt in formats:
            if fmt == "json":
                self._save_json(recipes, output_dir, output_prefix)
            elif fmt == "markdown":
                self._save_markdown(recipes, output_dir, output_prefix)
            elif fmt == "html":
                self._save_html(recipes, output_dir, output_prefix)
    
    def _save_json(self, recipes: List[Dict], output_dir: Path, prefix: str):
        """Save recipes as JSON."""
        output_file = output_dir / f"{prefix}.json"
        
        output_data = {
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "total_recipes": len(recipes),
                "generator": "RecipeGenerator"
            },
            "recipes": recipes
        }
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2)
        
        print(f"✅ JSON: {output_file}")
    
    def _save_markdown(self, recipes: List[Dict], output_dir: Path, prefix: str):
        """Save recipes as Markdown."""
        output_file = output_dir / f"{prefix}.md"
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("# 🍳 Pantry Recipes\n\n")
            f.write(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"**Total Recipes:** {len(recipes)}\n\n")
            f.write("---\n\n")
            
            for i, recipe in enumerate(recipes, 1):
                f.write(f"## {i}. {recipe['name']}\n\n")
                f.write(f"*{recipe.get('description', '')}*\n\n")
                
                # Info
                f.write(f"- **Cuisine:** {recipe.get('cuisine', 'N/A')}\n")
                f.write(f"- **Difficulty:** {recipe.get('difficulty', 'N/A')}\n")
                f.write(f"- **Prep Time:** {recipe.get('prep_time', 'N/A')}\n")
                f.write(f"- **Cook Time:** {recipe.get('cook_time', 'N/A')}\n")
                f.write(f"- **Total Time:** {recipe.get('total_time', 'N/A')}\n")
                f.write(f"- **Servings:** {recipe.get('servings', 'N/A')}\n")
                
                if recipe.get('dietary_tags'):
                    f.write(f"- **Dietary:** {', '.join(recipe['dietary_tags'])}\n")
                
                f.write("\n### Ingredients\n\n")
                for ing in recipe.get('ingredients', []):
                    item = ing.get('item', '')
                    amount = ing.get('amount', '')
                    notes = ing.get('notes', '')
                    
                    line = f"- {amount} {item}"
                    if notes:
                        line += f" ({notes})"
                    f.write(line + "\n")
                
                f.write("\n### Instructions\n\n")
                for j, step in enumerate(recipe.get('instructions', []), 1):
                    f.write(f"{j}. {step}\n")
                
                if recipe.get('tips'):
                    f.write("\n### Tips\n\n")
                    for tip in recipe['tips']:
                        f.write(f"- {tip}\n")
                
                f.write("\n---\n\n")
        
        print(f"✅ Markdown: {output_file}")
    
    def _save_html(self, recipes: List[Dict], output_dir: Path, prefix: str):
        """Save recipes as beautiful HTML."""
        output_file = output_dir / f"{prefix}.html"
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🍳 Pantry Recipe Book</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            padding: 20px;
            min-height: 100vh;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }
        .header h1 { font-size: 2.5em; margin-bottom: 10px; }
        .header .subtitle { font-size: 1.1em; opacity: 0.9; }
        .recipe-grid {
            padding: 30px;
            display: grid;
            gap: 30px;
        }
        .recipe-card {
            background: white;
            border: 2px solid #e0e0e0;
            border-radius: 15px;
            padding: 30px;
            transition: all 0.3s ease;
        }
        .recipe-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 30px rgba(0,0,0,0.15);
            border-color: #f5576c;
        }
        .recipe-header {
            border-bottom: 3px solid #f5576c;
            padding-bottom: 15px;
            margin-bottom: 20px;
        }
        .recipe-name {
            font-size: 2em;
            color: #333;
            margin-bottom: 10px;
        }
        .recipe-description {
            font-size: 1.1em;
            color: #666;
            font-style: italic;
        }
        .recipe-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            margin: 20px 0;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 10px;
        }
        .meta-item {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        .meta-label {
            font-weight: 600;
            color: #f5576c;
        }
        .tags {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin: 15px 0;
        }
        .tag {
            background: #e3f2fd;
            color: #1976d2;
            padding: 5px 12px;
            border-radius: 15px;
            font-size: 0.85em;
        }
        .difficulty-easy { background: #c8e6c9; color: #2e7d32; }
        .difficulty-medium { background: #fff9c4; color: #f57f17; }
        .difficulty-hard { background: #ffcdd2; color: #c62828; }
        .section {
            margin: 25px 0;
        }
        .section-title {
            font-size: 1.5em;
            color: #333;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .ingredients {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
        }
        .ingredient-item {
            padding: 10px;
            border-bottom: 1px solid #e0e0e0;
            display: flex;
            gap: 10px;
        }
        .ingredient-item:last-child { border-bottom: none; }
        .ingredient-amount {
            font-weight: 600;
            color: #f5576c;
            min-width: 100px;
        }
        .instructions {
            list-style: none;
            counter-reset: step-counter;
        }
        .instruction-step {
            counter-increment: step-counter;
            padding: 15px;
            margin-bottom: 10px;
            background: #f8f9fa;
            border-radius: 10px;
            position: relative;
            padding-left: 60px;
        }
        .instruction-step::before {
            content: counter(step-counter);
            position: absolute;
            left: 15px;
            top: 15px;
            background: #f5576c;
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
        }
        .tips {
            background: #fff3e0;
            padding: 20px;
            border-radius: 10px;
            border-left: 4px solid #ff9800;
        }
        .tip-item {
            padding: 8px 0;
            color: #e65100;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🍳 Pantry Recipe Book</h1>
            <p class="subtitle">Delicious recipes using only what you have!</p>
            <p class="subtitle">Generated: """ + datetime.now().strftime('%B %d, %Y') + """</p>
        </div>
        
        <div class="recipe-grid">""")
            
            # Recipe cards
            for recipe in recipes:
                difficulty = recipe.get('difficulty', 'medium').lower()
                
                f.write(f"""
            <div class="recipe-card">
                <div class="recipe-header">
                    <div class="recipe-name">{recipe['name']}</div>
                    <div class="recipe-description">{recipe.get('description', '')}</div>
                </div>
                
                <div class="recipe-meta">
                    <div class="meta-item">
                        <span class="meta-label">🌍 Cuisine:</span>
                        <span>{recipe.get('cuisine', 'N/A')}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">⏱️ Total:</span>
                        <span>{recipe.get('total_time', 'N/A')}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">🍽️ Servings:</span>
                        <span>{recipe.get('servings', 'N/A')}</span>
                    </div>
                </div>
                
                <div class="tags">
                    <span class="tag difficulty-{difficulty}">{difficulty.title()}</span>""")
                
                for tag in recipe.get('dietary_tags', []):
                    f.write(f'<span class="tag">{tag}</span>')
                
                f.write("""
                </div>
                
                <div class="section">
                    <div class="section-title">📋 Ingredients</div>
                    <div class="ingredients">""")
                
                for ing in recipe.get('ingredients', []):
                    item = ing.get('item', '')
                    amount = ing.get('amount', '')
                    notes = ing.get('notes', '')
                    
                    f.write(f"""
                        <div class="ingredient-item">
                            <span class="ingredient-amount">{amount}</span>
                            <span>{item}{f' ({notes})' if notes else ''}</span>
                        </div>""")
                
                f.write("""
                    </div>
                </div>
                
                <div class="section">
                    <div class="section-title">👨‍🍳 Instructions</div>
                    <ol class="instructions">""")
                
                for step in recipe.get('instructions', []):
                    f.write(f'<li class="instruction-step">{step}</li>')
                
                f.write('</ol></div>')
                
                if recipe.get('tips'):
                    f.write("""
                <div class="section">
                    <div class="section-title">💡 Tips</div>
                    <div class="tips">""")
                    
                    for tip in recipe['tips']:
                        f.write(f'<div class="tip-item">• {tip}</div>')
                    
                    f.write('</div></div>')
                
                f.write('</div>')
            
            f.write("""
        </div>
    </div>
</body>
</html>""")
        
        print(f"✅ HTML: {output_file}")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Generate recipes from pantry inventory"
    )
    
    parser.add_argument(
        "pantry_json",
        type=str,
        help="Path to pantry JSON report (e.g., reports/pantry_products.json)"
    )
    
    parser.add_argument(
        "--recipes",
        type=int,
        default=5,
        help="Number of recipes to generate (default: 5)"
    )
    
    parser.add_argument(
        "--output",
        type=str,
        default="pantry_recipes",
        help="Output file prefix (default: pantry_recipes)"
    )
    
    parser.add_argument(
        "--output-dir",
        type=str,
        default="./reports",
        help="Output directory (default: ./reports)"
    )
    
    parser.add_argument(
        "--format",
        type=str,
        nargs="+",
        choices=["json", "markdown", "html", "all"],
        default=["all"],
        help="Report format(s) (default: all)"
    )
    
    parser.add_argument(
        "--cuisine",
        type=str,
        help="Cuisine type (italian, mexican, asian, etc.)"
    )
    
    parser.add_argument(
        "--difficulty",
        type=str,
        choices=["easy", "medium", "hard"],
        help="Recipe difficulty level"
    )
    
    parser.add_argument(
        "--dietary",
        type=str,
        nargs="+",
        help="Dietary restrictions (vegan, vegetarian, gluten-free, etc.)"
    )
    
    args = parser.parse_args()
    
    # Setup
    pantry_file = Path(args.pantry_json)
    output_dir = Path(args.output_dir)
    
    if not pantry_file.exists():
        print(f"❌ Error: Pantry file not found: {pantry_file}")
        return 1
    
    # Create AI analyzer
    print("🔧 Initializing AI...")
    from src.ai_analyzer import AIConfig
    ai_config = AIConfig.from_env()
    ai_analyzer = create_ai_analyzer(ai_config)
    
    # Create generator
    generator = RecipeGenerator(ai_analyzer)
    
    try:
        # Load pantry
        print(f"📦 Loading pantry from {pantry_file}...")
        pantry_items = generator.load_pantry(pantry_file)
        print(f"✅ Loaded {len(pantry_items)} pantry items\n")
        
        # Generate recipes
        recipes = generator.generate_recipes(
            pantry_items,
            num_recipes=args.recipes,
            cuisine=args.cuisine,
            difficulty=args.difficulty,
            dietary_restrictions=args.dietary
        )
        
        if not recipes:
            print("⚠️  No recipes generated")
            return 1
        
        # Save recipes
        print("📝 Saving recipes...")
        generator.save_recipes(recipes, output_dir, args.output, args.format)
        
        print(f"\n{'='*70}")
        print("🎉 SUCCESS! Recipe book generated!")
        print(f"{'='*70}")
        print(f"📁 Output directory: {output_dir}")
        print(f"📄 Files: {args.output}.[json|md|html]")
        print(f"{'='*70}\n")
        
        return 0
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit(main())

