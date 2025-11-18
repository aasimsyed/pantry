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
from typing import Dict, List, Optional

from src.ai_analyzer import AIConfig, create_ai_analyzer


class RecipeGenerator:
    """Generate recipes from available pantry items."""
    
    def __init__(self, ai_analyzer):
        """Initialize recipe generator.
        
        Args:
            ai_analyzer: AI analyzer instance for recipe generation
        """
        self.analyzer = ai_analyzer
    
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
    ) -> List[Dict]:
        """Generate recipes using available ingredients.
        
        Args:
            pantry_items: List of available pantry items
            num_recipes: Number of recipes to generate
            cuisine: Cuisine type (italian, mexican, asian, etc.)
            difficulty: Difficulty level (easy, medium, hard)
            dietary_restrictions: List of dietary restrictions
            
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
        if cuisine:
            print(f"🌍 Cuisine: {cuisine}")
        if difficulty:
            print(f"📊 Difficulty: {difficulty}")
        if dietary_restrictions:
            print(f"🌱 Dietary: {', '.join(dietary_restrictions)}")
        print(f"{'='*70}\n")
        
        recipes = []
        
        for i in range(num_recipes):
            print(f"[{i+1}/{num_recipes}] Generating recipe...")
            
            try:
                recipe = self._generate_single_recipe(
                    ingredients,
                    cuisine=cuisine,
                    difficulty=difficulty,
                    dietary_restrictions=dietary_restrictions,
                    avoid_previous=[r.get('name') for r in recipes]
                )
                
                if recipe:
                    recipes.append(recipe)
                    print(f"    ✅ {recipe['name']}")
                    print(f"       Uses {len(recipe['ingredients'])} pantry items")
                
            except Exception as e:
                print(f"    ❌ Error: {e}")
                continue
        
        print(f"\n{'='*70}")
        print(f"✅ Generated {len(recipes)} recipes!")
        print(f"{'='*70}\n")
        
        return recipes
    
    def _generate_single_recipe(
        self,
        ingredients: List[str],
        cuisine: Optional[str] = None,
        difficulty: Optional[str] = None,
        dietary_restrictions: Optional[List[str]] = None,
        avoid_previous: Optional[List[str]] = None,
    ) -> Dict:
        """Generate a single recipe using AI.
        
        Args:
            ingredients: Available ingredients
            cuisine: Cuisine type
            difficulty: Difficulty level
            dietary_restrictions: Dietary restrictions
            avoid_previous: Recipe names to avoid (for variety)
            
        Returns:
            Recipe dictionary
        """
        # Build prompt
        prompt = self._build_recipe_prompt(
            ingredients,
            cuisine,
            difficulty,
            dietary_restrictions,
            avoid_previous
        )
        
        # Get backend and call directly
        backend = self.analyzer._get_backend()
        
        # Call AI model directly based on backend type
        if backend.__class__.__name__ == 'OpenAIBackend':
            response = backend.client.chat.completions.create(
                model=backend.config.model,
                messages=[
                    {"role": "system", "content": "You are a creative chef. Return only valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,  # More creative for recipes
                max_tokens=backend.config.max_tokens,
            )
            content = response.choices[0].message.content.strip()
        else:  # Claude
            message = backend.client.messages.create(
                model=backend.config.model if "claude" in backend.config.model else "claude-3-5-sonnet-20241022",
                max_tokens=backend.config.max_tokens,
                temperature=0.7,  # More creative for recipes
                messages=[{"role": "user", "content": prompt}]
            )
            content = message.content[0].text.strip()
        
        # Remove markdown code blocks if present
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()
        
        # Parse JSON
        import json as json_module
        recipe = json_module.loads(content)
        
        return recipe
    
    def _build_recipe_prompt(
        self,
        ingredients: List[str],
        cuisine: Optional[str] = None,
        difficulty: Optional[str] = None,
        dietary_restrictions: Optional[List[str]] = None,
        avoid_previous: Optional[List[str]] = None,
    ) -> str:
        """Build prompt for recipe generation."""
        
        prompt = f"""You are a creative chef. Generate a delicious recipe using ONLY ingredients from this pantry list.

AVAILABLE PANTRY INGREDIENTS:
{chr(10).join(f"- {ing}" for ing in ingredients)}

CONSTRAINTS:
- Use ONLY ingredients from the list above
- You can assume basic staples: water, salt, pepper (if not in list)
- DO NOT use any ingredients not listed above
- Create a complete, detailed recipe

"""
        
        if cuisine:
            prompt += f"- Cuisine style: {cuisine}\n"
        
        if difficulty:
            prompt += f"- Difficulty level: {difficulty}\n"
        
        if dietary_restrictions:
            prompt += f"- Dietary requirements: {', '.join(dietary_restrictions)}\n"
        
        if avoid_previous:
            prompt += f"- DO NOT create these recipes (already made): {', '.join(avoid_previous)}\n"
        
        prompt += """
Return ONLY valid JSON (no markdown, no code blocks) with this structure:

{
  "name": "Recipe Name",
  "description": "Brief appetizing description",
  "cuisine": "cuisine type",
  "difficulty": "easy/medium/hard",
  "prep_time": "X minutes",
  "cook_time": "X minutes",
  "total_time": "X minutes",
  "servings": 4,
  "ingredients": [
    {"item": "ingredient from pantry", "amount": "quantity", "notes": "optional prep notes"}
  ],
  "instructions": [
    "Step 1 description",
    "Step 2 description"
  ],
  "tips": ["Helpful tip 1", "Helpful tip 2"],
  "dietary_tags": ["vegetarian", "vegan", "gluten-free", etc]
}

Be creative and make it delicious! Focus on flavor combinations that work well together.
"""
        
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

