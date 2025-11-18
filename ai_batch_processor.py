"""
AI Batch Processor - Process images with OCR + AI Analysis and generate reports.

This script processes a directory of images through the complete pipeline:
1. OCR extraction (Google Vision)
2. AI analysis (OpenAI/Claude)
3. Structured data extraction
4. Report generation (CSV, JSON, Markdown, HTML)

Usage:
    python ai_batch_processor.py ~/Pictures/Pantry --output pantry_products --format all
    python ai_batch_processor.py ~/Pictures/Pantry --format csv
    python ai_batch_processor.py ~/Pictures/Pantry --format html --confidence 0.8

Run:
    python ai_batch_processor.py --help
"""

import argparse
import json
import time
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from typing import Dict, List

from src.ai_analyzer import AIAnalyzer, AIConfig, ProductData
from src.ocr_service import OCRService, create_ocr_service


class AIBatchProcessor:
    """Process images through OCR + AI pipeline and generate reports."""
    
    def __init__(
        self,
        ocr_service: OCRService,
        ai_analyzer: AIAnalyzer,
        output_dir: Path,
    ):
        """Initialize batch processor.
        
        Args:
            ocr_service: OCR service instance
            ai_analyzer: AI analyzer instance
            output_dir: Directory for output reports
        """
        self.ocr = ocr_service
        self.analyzer = ai_analyzer
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def process_directory(
        self,
        image_dir: Path,
        min_confidence: float = 0.0,
    ) -> List[Dict]:
        """Process all images in directory.
        
        Args:
            image_dir: Directory containing images
            min_confidence: Minimum AI confidence threshold
            
        Returns:
            List of product data dictionaries
        """
        # Find all images
        image_files = list(image_dir.glob("*.jpg")) + list(image_dir.glob("*.jpeg"))
        image_files.sort()
        
        if not image_files:
            raise ValueError(f"No images found in {image_dir}")
        
        print(f"\n{'='*70}")
        print(f"🚀 AI BATCH PROCESSOR")
        print(f"{'='*70}")
        print(f"📁 Input Directory: {image_dir}")
        print(f"📸 Images Found: {len(image_files)}")
        print(f"🎯 Min Confidence: {min_confidence:.0%}")
        print(f"📂 Output Directory: {self.output_dir}")
        print(f"{'='*70}\n")
        
        results = []
        start_time = time.time()
        
        for i, image_path in enumerate(image_files, 1):
            print(f"[{i}/{len(image_files)}] Processing {image_path.name}...")
            
            try:
                # OCR
                print(f"    🔍 Running OCR...")
                ocr_result = self.ocr.extract_text(str(image_path))
                ocr_confidence = ocr_result.get("confidence", 0)
                ocr_chars = len(ocr_result.get("raw_text", ""))
                print(f"    ✅ OCR: {ocr_chars} chars, {ocr_confidence:.0%} confidence")
                
                # AI Analysis
                print(f"    🤖 Analyzing product...")
                product = self.analyzer.analyze_product(ocr_result)
                
                # Check confidence threshold
                if product.confidence < min_confidence:
                    print(f"    ⚠️  Low confidence ({product.confidence:.0%}), skipping")
                    continue
                
                print(f"    ✅ Product: {product.product_name}")
                print(f"       Brand: {product.brand}, Category: {product.category}")
                print(f"       Confidence: {product.confidence:.0%}")
                
                # Store result
                result = {
                    "image_file": image_path.name,
                    "product": product.to_dict(),
                    "ocr": {
                        "confidence": ocr_confidence,
                        "chars_extracted": ocr_chars,
                    }
                }
                results.append(result)
                
            except Exception as e:
                print(f"    ❌ Error: {e}")
                continue
        
        elapsed = time.time() - start_time
        
        print(f"\n{'='*70}")
        print(f"✅ PROCESSING COMPLETE")
        print(f"{'='*70}")
        print(f"⏱️  Total Time: {elapsed:.1f}s")
        print(f"📦 Products Extracted: {len(results)}/{len(image_files)}")
        print(f"⚡ Avg Time/Image: {elapsed/len(image_files):.1f}s")
        print(f"{'='*70}\n")
        
        return results
    
    def generate_reports(
        self,
        results: List[Dict],
        output_prefix: str,
        formats: List[str],
    ) -> Dict[str, Path]:
        """Generate reports in specified formats.
        
        Args:
            results: Processing results
            output_prefix: Prefix for output files
            formats: List of formats ('csv', 'json', 'markdown', 'html', 'all')
            
        Returns:
            Dictionary mapping format to file path
        """
        if "all" in formats:
            formats = ["csv", "json", "markdown", "html"]
        
        generated = {}
        
        for fmt in formats:
            if fmt == "csv":
                path = self._generate_csv(results, output_prefix)
                generated["csv"] = path
            elif fmt == "json":
                path = self._generate_json(results, output_prefix)
                generated["json"] = path
            elif fmt == "markdown":
                path = self._generate_markdown(results, output_prefix)
                generated["markdown"] = path
            elif fmt == "html":
                path = self._generate_html(results, output_prefix)
                generated["html"] = path
        
        return generated
    
    def _generate_csv(self, results: List[Dict], prefix: str) -> Path:
        """Generate CSV report."""
        import csv
        
        output_file = self.output_dir / f"{prefix}.csv"
        
        with open(output_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            
            # Header
            writer.writerow([
                "Image",
                "Product Name",
                "Brand",
                "Category",
                "Subcategory",
                "Expiration Date",
                "Dietary Tags",
                "Key Attributes",
                "Allergens",
                "AI Confidence",
                "OCR Confidence",
                "Model Used",
            ])
            
            # Data rows
            for result in results:
                product = result["product"]
                writer.writerow([
                    result["image_file"],
                    product["product_name"],
                    product["brand"] or "",
                    product["category"],
                    product["subcategory"] or "",
                    product["expiration_date"] or "",
                    ", ".join(product["dietary_tags"]),
                    ", ".join(product["key_attributes"]),
                    ", ".join(product["allergens"]),
                    f"{product['confidence']:.2f}",
                    f"{result['ocr']['confidence']:.2f}",
                    product["model_used"],
                ])
        
        print(f"✅ CSV report: {output_file}")
        return output_file
    
    def _generate_json(self, results: List[Dict], prefix: str) -> Path:
        """Generate JSON report."""
        output_file = self.output_dir / f"{prefix}.json"
        
        # Calculate statistics
        stats = self._calculate_statistics(results)
        
        output_data = {
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "total_products": len(results),
                "processor": "AIBatchProcessor",
            },
            "statistics": stats,
            "products": results,
        }
        
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(output_data, f, indent=2, default=str)
        
        print(f"✅ JSON report: {output_file}")
        return output_file
    
    def _generate_markdown(self, results: List[Dict], prefix: str) -> Path:
        """Generate Markdown report."""
        output_file = self.output_dir / f"{prefix}.md"
        
        stats = self._calculate_statistics(results)
        
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(f"# Pantry Products Analysis\n\n")
            f.write(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            
            # Statistics
            f.write(f"## 📊 Statistics\n\n")
            f.write(f"- **Total Products:** {len(results)}\n")
            f.write(f"- **Average AI Confidence:** {stats['avg_ai_confidence']:.0%}\n")
            f.write(f"- **Average OCR Confidence:** {stats['avg_ocr_confidence']:.0%}\n")
            f.write(f"- **Average Processing Time:** {stats['avg_processing_time']:.2f}s\n\n")
            
            # Categories
            f.write(f"### Categories\n\n")
            for category, count in stats['categories'].most_common():
                f.write(f"- **{category}:** {count} items\n")
            f.write("\n")
            
            # Dietary Tags
            if stats['dietary_tags']:
                f.write(f"### Dietary Tags\n\n")
                for tag, count in stats['dietary_tags'].most_common(10):
                    f.write(f"- **{tag}:** {count} items\n")
                f.write("\n")
            
            # Brands
            f.write(f"### Top Brands\n\n")
            for brand, count in stats['brands'].most_common(10):
                if brand:
                    f.write(f"- **{brand}:** {count} items\n")
            f.write("\n")
            
            # Products table
            f.write(f"## 📦 Products\n\n")
            f.write(f"| # | Product | Brand | Category | Tags | Confidence |\n")
            f.write(f"|---|---------|-------|----------|------|------------|\n")
            
            for i, result in enumerate(results, 1):
                product = result["product"]
                tags = ", ".join(product["dietary_tags"][:3])
                if len(product["dietary_tags"]) > 3:
                    tags += "..."
                
                f.write(
                    f"| {i} | {product['product_name']} | "
                    f"{product['brand'] or '-'} | "
                    f"{product['category']} | "
                    f"{tags or '-'} | "
                    f"{product['confidence']:.0%} |\n"
                )
        
        print(f"✅ Markdown report: {output_file}")
        return output_file
    
    def _generate_html(self, results: List[Dict], prefix: str) -> Path:
        """Generate HTML report."""
        output_file = self.output_dir / f"{prefix}.html"
        
        stats = self._calculate_statistics(results)
        
        with open(output_file, "w", encoding="utf-8") as f:
            f.write("""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pantry Products Analysis</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            min-height: 100vh;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }
        .header h1 { font-size: 2.5em; margin-bottom: 10px; }
        .header .subtitle { font-size: 1.1em; opacity: 0.9; }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            padding: 30px;
            background: #f8f9fa;
        }
        .stat-card {
            background: white;
            padding: 25px;
            border-radius: 15px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            text-align: center;
        }
        .stat-card .value {
            font-size: 2.5em;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 10px;
        }
        .stat-card .label {
            font-size: 0.9em;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .section {
            padding: 30px;
        }
        .section h2 {
            font-size: 1.8em;
            margin-bottom: 20px;
            color: #333;
            border-bottom: 3px solid #667eea;
            padding-bottom: 10px;
        }
        .products-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        .product-card {
            background: white;
            border: 2px solid #e0e0e0;
            border-radius: 15px;
            padding: 20px;
            transition: all 0.3s ease;
        }
        .product-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 8px 16px rgba(0,0,0,0.15);
            border-color: #667eea;
        }
        .product-card .name {
            font-size: 1.3em;
            font-weight: bold;
            color: #333;
            margin-bottom: 10px;
        }
        .product-card .brand {
            color: #667eea;
            font-weight: 600;
            margin-bottom: 10px;
        }
        .product-card .category {
            display: inline-block;
            background: #e3f2fd;
            color: #1976d2;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 0.85em;
            margin-bottom: 10px;
        }
        .product-card .tags {
            margin-top: 10px;
        }
        .tag {
            display: inline-block;
            background: #f3e5f5;
            color: #7b1fa2;
            padding: 4px 10px;
            border-radius: 15px;
            font-size: 0.8em;
            margin-right: 5px;
            margin-bottom: 5px;
        }
        .product-card .confidence {
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px solid #e0e0e0;
            font-size: 0.9em;
            color: #666;
        }
        .confidence-bar {
            height: 6px;
            background: #e0e0e0;
            border-radius: 3px;
            overflow: hidden;
            margin-top: 5px;
        }
        .confidence-fill {
            height: 100%;
            background: linear-gradient(90deg, #4caf50, #8bc34a);
            transition: width 0.3s ease;
        }
        .attributes {
            margin-top: 10px;
            font-size: 0.85em;
            color: #666;
            line-height: 1.5;
        }
        .expiration {
            color: #f44336;
            font-weight: 600;
            margin-top: 8px;
        }
        .chart-section {
            background: #f8f9fa;
        }
        .chart-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
        }
        .chart-card {
            background: white;
            padding: 20px;
            border-radius: 15px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .chart-card h3 {
            margin-bottom: 15px;
            color: #333;
        }
        .bar {
            margin-bottom: 10px;
        }
        .bar-label {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
            font-size: 0.9em;
        }
        .bar-fill {
            height: 8px;
            background: #e0e0e0;
            border-radius: 4px;
            overflow: hidden;
        }
        .bar-value {
            height: 100%;
            background: linear-gradient(90deg, #667eea, #764ba2);
            transition: width 0.5s ease;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🥫 Pantry Products Analysis</h1>
            <p class="subtitle">AI-Powered Product Extraction & Analysis</p>
            <p class="subtitle">Generated: """ + datetime.now().strftime('%B %d, %Y at %H:%M:%S') + """</p>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="value">""" + str(len(results)) + """</div>
                <div class="label">Total Products</div>
            </div>
            <div class="stat-card">
                <div class="value">""" + f"{stats['avg_ai_confidence']:.0%}" + """</div>
                <div class="label">Avg AI Confidence</div>
            </div>
            <div class="stat-card">
                <div class="value">""" + f"{stats['avg_ocr_confidence']:.0%}" + """</div>
                <div class="label">Avg OCR Confidence</div>
            </div>
            <div class="stat-card">
                <div class="value">""" + f"{stats['avg_processing_time']:.1f}s" + """</div>
                <div class="label">Avg Processing Time</div>
            </div>
        </div>
        
        <div class="section chart-section">
            <h2>📊 Analysis</h2>
            <div class="chart-grid">
                <div class="chart-card">
                    <h3>Categories</h3>""")
            
            # Categories chart
            max_cat_count = max([count for _, count in stats['categories'].most_common()], default=1)
            for category, count in stats['categories'].most_common(10):
                percentage = (count / max_cat_count) * 100
                f.write(f"""
                    <div class="bar">
                        <div class="bar-label">
                            <span>{category}</span>
                            <span>{count} items</span>
                        </div>
                        <div class="bar-fill">
                            <div class="bar-value" style="width: {percentage}%"></div>
                        </div>
                    </div>""")
            
            f.write("""
                </div>
                <div class="chart-card">
                    <h3>Top Brands</h3>""")
            
            # Brands chart
            max_brand_count = max([count for brand, count in stats['brands'].most_common() if brand], default=1)
            for brand, count in stats['brands'].most_common(10):
                if brand:
                    percentage = (count / max_brand_count) * 100
                    f.write(f"""
                    <div class="bar">
                        <div class="bar-label">
                            <span>{brand}</span>
                            <span>{count} items</span>
                        </div>
                        <div class="bar-fill">
                            <div class="bar-value" style="width: {percentage}%"></div>
                        </div>
                    </div>""")
            
            f.write("""
                </div>
            </div>
        </div>
        
        <div class="section">
            <h2>📦 Products</h2>
            <div class="products-grid">""")
            
            # Product cards
            for result in results:
                product = result["product"]
                confidence = product["confidence"] * 100
                
                f.write(f"""
                <div class="product-card">
                    <div class="name">{product['product_name']}</div>
                    {f'<div class="brand">{product["brand"]}</div>' if product['brand'] else ''}
                    <div class="category">{product['category']}</div>
                    """)
                
                # Tags
                if product['dietary_tags']:
                    f.write('<div class="tags">')
                    for tag in product['dietary_tags']:
                        f.write(f'<span class="tag">{tag}</span>')
                    f.write('</div>')
                
                # Attributes
                if product['key_attributes']:
                    f.write('<div class="attributes">')
                    f.write('<strong>Features:</strong> ')
                    f.write(', '.join(product['key_attributes'][:3]))
                    if len(product['key_attributes']) > 3:
                        f.write('...')
                    f.write('</div>')
                
                # Expiration
                if product['expiration_date']:
                    f.write(f'<div class="expiration">📅 Expires: {product["expiration_date"]}</div>')
                
                # Confidence
                f.write(f"""
                    <div class="confidence">
                        <div>AI Confidence: {confidence:.0f}%</div>
                        <div class="confidence-bar">
                            <div class="confidence-fill" style="width: {confidence}%"></div>
                        </div>
                    </div>
                </div>""")
            
            f.write("""
            </div>
        </div>
    </div>
</body>
</html>""")
        
        print(f"✅ HTML report: {output_file}")
        return output_file
    
    def _calculate_statistics(self, results: List[Dict]) -> Dict:
        """Calculate statistics from results."""
        categories = Counter()
        brands = Counter()
        dietary_tags = Counter()
        total_ai_confidence = 0
        total_ocr_confidence = 0
        total_processing_time = 0
        
        for result in results:
            product = result["product"]
            
            categories[product["category"]] += 1
            
            if product["brand"]:
                brands[product["brand"]] += 1
            
            for tag in product["dietary_tags"]:
                dietary_tags[tag] += 1
            
            total_ai_confidence += product["confidence"]
            total_ocr_confidence += result["ocr"]["confidence"]
            total_processing_time += product["processing_time"]
        
        n = len(results)
        
        return {
            "categories": categories,
            "brands": brands,
            "dietary_tags": dietary_tags,
            "avg_ai_confidence": total_ai_confidence / n if n > 0 else 0,
            "avg_ocr_confidence": total_ocr_confidence / n if n > 0 else 0,
            "avg_processing_time": total_processing_time / n if n > 0 else 0,
        }


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Process images with OCR + AI Analysis and generate reports"
    )
    
    parser.add_argument(
        "directory",
        type=str,
        help="Directory containing images to process"
    )
    
    parser.add_argument(
        "--output",
        type=str,
        default="pantry_products",
        help="Output file prefix (default: pantry_products)"
    )
    
    parser.add_argument(
        "--output-dir",
        type=str,
        default="./reports",
        help="Output directory for reports (default: ./reports)"
    )
    
    parser.add_argument(
        "--format",
        type=str,
        nargs="+",
        choices=["csv", "json", "markdown", "html", "all"],
        default=["all"],
        help="Report format(s) to generate (default: all)"
    )
    
    parser.add_argument(
        "--confidence",
        type=float,
        default=0.0,
        help="Minimum AI confidence threshold (default: 0.0)"
    )
    
    args = parser.parse_args()
    
    # Setup
    image_dir = Path(args.directory).expanduser()
    output_dir = Path(args.output_dir)
    
    if not image_dir.exists():
        print(f"❌ Error: Directory not found: {image_dir}")
        return 1
    
    # Create services
    print("🔧 Initializing services...")
    ocr_service = create_ocr_service()
    
    from src.ai_analyzer import AIConfig, create_ai_analyzer
    ai_config = AIConfig.from_env()
    ai_analyzer = create_ai_analyzer(ai_config)
    
    # Process
    processor = AIBatchProcessor(ocr_service, ai_analyzer, output_dir)
    
    try:
        results = processor.process_directory(image_dir, args.confidence)
        
        if not results:
            print("⚠️  No products extracted (all below confidence threshold or errors)")
            return 1
        
        # Generate reports
        print(f"\n📝 Generating reports...")
        generated = processor.generate_reports(results, args.output, args.format)
        
        print(f"\n{'='*70}")
        print(f"🎉 SUCCESS! Reports generated:")
        print(f"{'='*70}")
        for fmt, path in generated.items():
            print(f"   📄 {fmt.upper()}: {path}")
        print(f"{'='*70}\n")
        
        return 0
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit(main())

