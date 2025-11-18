"""
Example usage of AI Analyzer for product information extraction.

This script demonstrates how to use the AI Analyzer to extract structured
product information from OCR text.

Run:
    python example_ai_usage.py
"""

import json
from pathlib import Path

from src.ai_analyzer import AIAnalyzer, AIConfig, create_ai_analyzer
from src.ocr_service import create_ocr_service


def example_1_basic_usage():
    """Example 1: Basic product analysis from OCR."""
    print("=" * 70)
    print("Example 1: Basic Product Analysis")
    print("=" * 70)
    
    # Create analyzer with default config (loads from .env)
    analyzer = create_ai_analyzer()
    
    # Simulate OCR result
    ocr_result = {
        "raw_text": """
        KOYO
        REDUCED SODIUM
        TOFU MISO RAMEN
        MADE WITH ORGANIC NOODLES
        HEIRLOOM GRAINS
        VEGAN
        EXP: 2021/12
        """,
        "confidence": 0.95
    }
    
    # Analyze product
    product = analyzer.analyze_product(ocr_result)
    
    # Display results
    print(f"\n✅ Product Analyzed:")
    print(f"   Name: {product.product_name}")
    print(f"   Brand: {product.brand}")
    print(f"   Category: {product.category}")
    print(f"   Expires: {product.expiration_date}")
    print(f"   Tags: {', '.join(product.dietary_tags)}")
    print(f"   Attributes: {', '.join(product.key_attributes)}")
    print(f"   Confidence: {product.confidence:.0%}")
    print(f"   Model: {product.model_used}")
    print(f"   Processing: {product.processing_time:.2f}s")


def example_2_custom_config():
    """Example 2: Custom configuration."""
    print("\n" + "=" * 70)
    print("Example 2: Custom Configuration")
    print("=" * 70)
    
    # Custom config
    config = AIConfig(
        provider="openai",
        model="gpt-4-turbo-preview",
        temperature=0.0,  # Deterministic
        min_confidence=0.8,
        use_few_shot=True,
        cache_enabled=True,
    )
    
    analyzer = AIAnalyzer(config)
    
    ocr_result = {
        "raw_text": "Bush's Butter Beans NET WT 15.8 OZ (448g)",
        "confidence": 0.92
    }
    
    product = analyzer.analyze_product(ocr_result)
    
    print(f"\n✅ Product: {product.product_name}")
    print(f"   Brand: {product.brand}")
    print(f"   Category: {product.category}")
    print(f"   Confidence: {product.confidence:.0%}")


def example_3_batch_processing():
    """Example 3: Batch processing multiple items."""
    print("\n" + "=" * 70)
    print("Example 3: Batch Processing")
    print("=" * 70)
    
    analyzer = create_ai_analyzer()
    
    # Simulate multiple OCR results
    ocr_results = [
        {"raw_text": "KOYO TOFU MISO RAMEN VEGAN", "confidence": 0.95},
        {"raw_text": "Bush's Butter Beans 15.8 oz", "confidence": 0.92},
        {"raw_text": "La Tourangelle Sesame Oil 16.9 fl oz", "confidence": 0.88},
    ]
    
    # Batch analyze
    products = analyzer.analyze_batch(ocr_results)
    
    print(f"\n✅ Analyzed {len(products)} products:")
    for i, product in enumerate(products, 1):
        print(f"   {i}. {product.product_name} ({product.brand}) - {product.category}")


def example_4_with_real_images():
    """Example 4: Full pipeline with real images."""
    print("\n" + "=" * 70)
    print("Example 4: Full Pipeline (OCR → AI Analysis)")
    print("=" * 70)
    
    # Path to test images
    test_images_dir = Path.home() / "Pictures" / "Pantry"
    
    if not test_images_dir.exists():
        print(f"\n⚠️  Test images directory not found: {test_images_dir}")
        print("   Skipping this example.")
        return
    
    # Get first few images
    images = (
        list(test_images_dir.glob("*.jpg"))[:3] +
        list(test_images_dir.glob("*.jpeg"))[:3]
    )[:3]  # Max 3 images for demo
    
    if not images:
        print(f"\n⚠️  No images found in {test_images_dir}")
        return
    
    print(f"\n📸 Processing {len(images)} images...")
    
    # Create services
    ocr_service = create_ocr_service()
    analyzer = create_ai_analyzer()
    
    products = []
    
    for i, image_path in enumerate(images, 1):
        print(f"\n{i}. Processing {image_path.name}...")
        
        try:
            # OCR
            print(f"   🔍 Running OCR...")
            ocr_result = ocr_service.extract_text(str(image_path))
            print(f"   ✅ OCR: {len(ocr_result['raw_text'])} chars, {ocr_result['confidence']:.0%} confidence")
            
            # AI Analysis
            print(f"   🤖 Analyzing product...")
            product = analyzer.analyze_product(ocr_result)
            products.append(product)
            
            print(f"   ✅ Product: {product.product_name}")
            print(f"      Brand: {product.brand}")
            print(f"      Category: {product.category}")
            print(f"      Confidence: {product.confidence:.0%}")
            
        except Exception as e:
            print(f"   ❌ Error: {e}")
    
    # Summary
    print("\n" + "=" * 70)
    print("📊 Summary")
    print("=" * 70)
    print(f"   Total processed: {len(products)}")
    print(f"   Avg confidence: {sum(p.confidence for p in products) / len(products):.0%}")
    
    # Show categories
    categories = {}
    for p in products:
        categories[p.category] = categories.get(p.category, 0) + 1
    
    print(f"\n   Categories:")
    for category, count in categories.items():
        print(f"      {category}: {count}")


def example_5_caching_performance():
    """Example 5: Demonstrate caching performance."""
    print("\n" + "=" * 70)
    print("Example 5: Caching Performance")
    print("=" * 70)
    
    analyzer = create_ai_analyzer()
    
    ocr_result = {
        "raw_text": "Nature's Charm Coconut Whipping Cream 400ml",
        "confidence": 0.93
    }
    
    # First call (no cache)
    print("\n🔄 First call (no cache)...")
    product1 = analyzer.analyze_product(ocr_result)
    time1 = product1.processing_time
    print(f"   ✅ Time: {time1:.3f}s")
    
    # Second call (cached)
    print("\n🔄 Second call (cached)...")
    product2 = analyzer.analyze_product(ocr_result)
    time2 = product2.processing_time
    print(f"   ✅ Time: {time2:.3f}s")
    
    # Compare
    print(f"\n📊 Performance:")
    print(f"   First call: {time1:.3f}s")
    print(f"   Cached call: {time2:.3f}s")
    print(f"   Speedup: {time1/time2 if time2 > 0 else float('inf'):.1f}x faster")


def example_6_export_to_json():
    """Example 6: Export product data to JSON."""
    print("\n" + "=" * 70)
    print("Example 6: Export to JSON")
    print("=" * 70)
    
    analyzer = create_ai_analyzer()
    
    ocr_result = {
        "raw_text": "Farmer's Market Organic Pumpkin Puree 15oz",
        "confidence": 0.91
    }
    
    product = analyzer.analyze_product(ocr_result)
    
    # Convert to dict
    product_dict = product.to_dict()
    
    # Pretty print JSON
    print("\n📄 Product as JSON:")
    print(json.dumps(product_dict, indent=2, default=str))
    
    # Save to file (optional)
    output_file = Path("product_example.json")
    with open(output_file, "w") as f:
        json.dump(product_dict, f, indent=2, default=str)
    
    print(f"\n✅ Saved to {output_file}")


def main():
    """Run all examples."""
    print("\n" + "🤖 AI ANALYZER USAGE EXAMPLES " + "\n")
    
    try:
        # Basic examples
        example_1_basic_usage()
        example_2_custom_config()
        example_3_batch_processing()
        
        # Performance
        example_5_caching_performance()
        
        # Export
        example_6_export_to_json()
        
        # Real images (might not have test data)
        example_4_with_real_images()
        
        print("\n" + "=" * 70)
        print("✅ All examples completed!")
        print("=" * 70)
        
    except Exception as e:
        print(f"\n❌ Error running examples: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()

