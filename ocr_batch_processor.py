"""
Batch OCR processor with report generation.

Processes multiple images and generates structured output in various formats:
- CSV for spreadsheets
- JSON for programmatic access
- Markdown for readable reports
- HTML for web viewing

Usage:
    python ocr_batch_processor.py ~/Pictures/Pantry --output reports/ocr_results
"""

import argparse
import csv
import json
import time
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any

from src.ocr_service import create_ocr_service, OCRConfig


class OCRBatchProcessor:
    """
    Batch process images with OCR and generate structured reports.
    
    Features:
    - Process entire directories
    - Generate multiple output formats
    - Progress tracking
    - Error handling
    - Summary statistics
    """
    
    def __init__(self, config: OCRConfig = None):
        """Initialize batch processor."""
        self.service = create_ocr_service(config)
        self.results: List[Dict[str, Any]] = []
        self.errors: List[Dict[str, Any]] = []
    
    def process_directory(
        self,
        directory: Path,
        extensions: List[str] = None
    ) -> None:
        """
        Process all images in a directory.
        
        Args:
            directory: Path to directory containing images
            extensions: List of file extensions to process (default: jpg, jpeg, png)
        """
        if extensions is None:
            extensions = ['.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG']
        
        # Find all image files
        image_files = []
        for ext in extensions:
            image_files.extend(directory.glob(f'*{ext}'))
        
        image_files = sorted(image_files)
        
        if not image_files:
            print(f"⚠️  No images found in {directory}")
            return
        
        print(f"📦 Found {len(image_files)} images to process\n")
        
        # Process each image
        start_time = time.time()
        
        for i, image_path in enumerate(image_files, 1):
            print(f"[{i}/{len(image_files)}] Processing {image_path.name}...", end=' ')
            
            try:
                result = self.service.extract_text(str(image_path))
                
                # Store result with metadata
                self.results.append({
                    'filename': image_path.name,
                    'filepath': str(image_path),
                    'text': result['raw_text'],
                    'confidence': result['confidence'],
                    'backend': result['backend_used'],
                    'processing_time': result['processing_time'],
                    'cached': result['cached'],
                    'languages': ', '.join(result['detected_languages']),
                    'regions': len(result['bounding_boxes']),
                    'characters': len(result['raw_text']),
                    'timestamp': datetime.now().isoformat(),
                    'bounding_boxes': result['bounding_boxes']
                })
                
                print(f"✅ {result['confidence']:.0%} confidence ({len(result['raw_text'])} chars)")
                
            except Exception as e:
                print(f"❌ Error: {e}")
                self.errors.append({
                    'filename': image_path.name,
                    'filepath': str(image_path),
                    'error': str(e),
                    'timestamp': datetime.now().isoformat()
                })
        
        total_time = time.time() - start_time
        
        # Print summary
        print(f"\n{'='*70}")
        print(f"📊 PROCESSING SUMMARY")
        print(f"{'='*70}")
        print(f"Total Images: {len(image_files)}")
        print(f"Successful: {len(self.results)}")
        print(f"Failed: {len(self.errors)}")
        print(f"Total Time: {total_time:.2f}s")
        print(f"Average Time: {total_time/len(image_files):.2f}s per image")
        
        if self.results:
            avg_conf = sum(r['confidence'] for r in self.results) / len(self.results)
            total_chars = sum(r['characters'] for r in self.results)
            cached_count = sum(1 for r in self.results if r['cached'])
            
            print(f"Average Confidence: {avg_conf:.2%}")
            print(f"Total Characters Extracted: {total_chars:,}")
            print(f"Cache Hit Rate: {cached_count}/{len(self.results)} ({cached_count/len(self.results):.0%})")
        
        print(f"{'='*70}\n")
    
    def save_csv(self, output_path: Path) -> None:
        """
        Save results to CSV file.
        
        Args:
            output_path: Path to output CSV file
        """
        if not self.results:
            print("⚠️  No results to save")
            return
        
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w', newline='', encoding='utf-8') as f:
            # Define columns (exclude complex data like bounding_boxes)
            fieldnames = [
                'filename', 'confidence', 'backend', 'processing_time',
                'cached', 'languages', 'regions', 'characters', 'text'
            ]
            
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for result in self.results:
                # Create row without bounding boxes
                row = {k: result[k] for k in fieldnames}
                # Clean text for CSV (replace newlines)
                row['text'] = row['text'].replace('\n', ' | ')
                writer.writerow(row)
        
        print(f"✅ CSV saved to: {output_path}")
    
    def save_json(self, output_path: Path) -> None:
        """
        Save results to JSON file.
        
        Args:
            output_path: Path to output JSON file
        """
        if not self.results:
            print("⚠️  No results to save")
            return
        
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        data = {
            'metadata': {
                'total_images': len(self.results) + len(self.errors),
                'successful': len(self.results),
                'failed': len(self.errors),
                'generated_at': datetime.now().isoformat()
            },
            'results': self.results,
            'errors': self.errors
        }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        print(f"✅ JSON saved to: {output_path}")
    
    def save_markdown(self, output_path: Path) -> None:
        """
        Save results to Markdown table.
        
        Args:
            output_path: Path to output Markdown file
        """
        if not self.results:
            print("⚠️  No results to save")
            return
        
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            # Write header
            f.write("# OCR Results Report\n\n")
            f.write(f"**Generated**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            
            # Summary statistics
            f.write("## Summary\n\n")
            f.write(f"- **Total Images**: {len(self.results) + len(self.errors)}\n")
            f.write(f"- **Successful**: {len(self.results)}\n")
            f.write(f"- **Failed**: {len(self.errors)}\n")
            
            if self.results:
                avg_conf = sum(r['confidence'] for r in self.results) / len(self.results)
                total_chars = sum(r['characters'] for r in self.results)
                f.write(f"- **Average Confidence**: {avg_conf:.2%}\n")
                f.write(f"- **Total Characters**: {total_chars:,}\n")
            
            f.write("\n## Results Table\n\n")
            
            # Write table header
            f.write("| Filename | Confidence | Backend | Characters | Regions | Extracted Text Preview |\n")
            f.write("|----------|-----------|---------|------------|---------|----------------------|\n")
            
            # Write table rows
            for result in self.results:
                text_preview = result['text'].replace('\n', ' ')[:50]
                if len(result['text']) > 50:
                    text_preview += "..."
                
                f.write(f"| {result['filename']} | ")
                f.write(f"{result['confidence']:.0%} | ")
                f.write(f"{result['backend']} | ")
                f.write(f"{result['characters']} | ")
                f.write(f"{result['regions']} | ")
                f.write(f"{text_preview} |\n")
            
            # Detailed results
            f.write("\n## Detailed Results\n\n")
            
            for i, result in enumerate(self.results, 1):
                f.write(f"### {i}. {result['filename']}\n\n")
                f.write(f"- **Confidence**: {result['confidence']:.2%}\n")
                f.write(f"- **Backend**: {result['backend']}\n")
                f.write(f"- **Processing Time**: {result['processing_time']:.2f}s\n")
                f.write(f"- **Languages**: {result['languages']}\n")
                f.write(f"- **Regions**: {result['regions']}\n")
                f.write(f"- **Cached**: {'Yes' if result['cached'] else 'No'}\n")
                f.write(f"\n**Extracted Text**:\n\n```\n{result['text']}\n```\n\n")
                
                if result['bounding_boxes']:
                    f.write(f"**Text Regions** (showing first 10):\n\n")
                    for j, bbox in enumerate(result['bounding_boxes'][:10], 1):
                        f.write(f"{j}. \"{bbox['text']}\" at ({bbox['x']}, {bbox['y']}) - {bbox['confidence']:.0%} confidence\n")
                    f.write("\n")
            
            # Errors section
            if self.errors:
                f.write("\n## Errors\n\n")
                for error in self.errors:
                    f.write(f"- **{error['filename']}**: {error['error']}\n")
        
        print(f"✅ Markdown saved to: {output_path}")
    
    def save_html(self, output_path: Path) -> None:
        """
        Save results to HTML file.
        
        Args:
            output_path: Path to output HTML file
        """
        if not self.results:
            print("⚠️  No results to save")
            return
        
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Calculate statistics
        avg_conf = sum(r['confidence'] for r in self.results) / len(self.results)
        total_chars = sum(r['characters'] for r in self.results)
        cached_count = sum(1 for r in self.results if r['cached'])
        
        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OCR Results Report</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }}
        h1 {{
            color: #333;
            border-bottom: 3px solid #007bff;
            padding-bottom: 10px;
        }}
        .summary {{
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        .summary-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }}
        .stat {{
            text-align: center;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 5px;
        }}
        .stat-value {{
            font-size: 2em;
            font-weight: bold;
            color: #007bff;
        }}
        .stat-label {{
            color: #666;
            margin-top: 5px;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            background: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin: 20px 0;
        }}
        th, td {{
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }}
        th {{
            background: #007bff;
            color: white;
            font-weight: 600;
        }}
        tr:hover {{
            background: #f8f9fa;
        }}
        .confidence {{
            font-weight: bold;
        }}
        .confidence-high {{ color: #28a745; }}
        .confidence-medium {{ color: #ffc107; }}
        .confidence-low {{ color: #dc3545; }}
        .result-card {{
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        .result-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e9ecef;
        }}
        .result-title {{
            font-size: 1.2em;
            font-weight: bold;
            color: #333;
        }}
        .badge {{
            padding: 5px 10px;
            border-radius: 15px;
            font-size: 0.85em;
            font-weight: 600;
        }}
        .badge-success {{ background: #d4edda; color: #155724; }}
        .badge-info {{ background: #d1ecf1; color: #0c5460; }}
        .text-content {{
            background: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            white-space: pre-wrap;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
        }}
        .metadata {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 10px;
            margin: 15px 0;
        }}
        .meta-item {{
            font-size: 0.9em;
        }}
        .meta-label {{
            color: #666;
            font-weight: 600;
        }}
    </style>
</head>
<body>
    <h1>🔍 OCR Results Report</h1>
    
    <div class="summary">
        <h2>Summary Statistics</h2>
        <div class="summary-grid">
            <div class="stat">
                <div class="stat-value">{len(self.results) + len(self.errors)}</div>
                <div class="stat-label">Total Images</div>
            </div>
            <div class="stat">
                <div class="stat-value">{len(self.results)}</div>
                <div class="stat-label">Successful</div>
            </div>
            <div class="stat">
                <div class="stat-value">{avg_conf:.0%}</div>
                <div class="stat-label">Avg Confidence</div>
            </div>
            <div class="stat">
                <div class="stat-value">{total_chars:,}</div>
                <div class="stat-label">Total Characters</div>
            </div>
            <div class="stat">
                <div class="stat-value">{cached_count}/{len(self.results)}</div>
                <div class="stat-label">Cache Hits</div>
            </div>
        </div>
    </div>
    
    <h2>Results Table</h2>
    <table>
        <thead>
            <tr>
                <th>Filename</th>
                <th>Confidence</th>
                <th>Backend</th>
                <th>Characters</th>
                <th>Regions</th>
                <th>Preview</th>
            </tr>
        </thead>
        <tbody>
"""
        
        for result in self.results:
            conf_class = 'confidence-high' if result['confidence'] > 0.8 else 'confidence-medium' if result['confidence'] > 0.5 else 'confidence-low'
            text_preview = result['text'].replace('\n', ' ')[:60]
            if len(result['text']) > 60:
                text_preview += "..."
            
            html += f"""            <tr>
                <td><strong>{result['filename']}</strong></td>
                <td><span class="confidence {conf_class}">{result['confidence']:.0%}</span></td>
                <td>{result['backend']}</td>
                <td>{result['characters']}</td>
                <td>{result['regions']}</td>
                <td>{text_preview}</td>
            </tr>
"""
        
        html += """        </tbody>
    </table>
    
    <h2>Detailed Results</h2>
"""
        
        for i, result in enumerate(self.results, 1):
            conf_class = 'confidence-high' if result['confidence'] > 0.8 else 'confidence-medium' if result['confidence'] > 0.5 else 'confidence-low'
            
            html += f"""    <div class="result-card">
        <div class="result-header">
            <div class="result-title">{i}. {result['filename']}</div>
            <span class="badge {'badge-success' if result['confidence'] > 0.8 else 'badge-info'}">
                {result['confidence']:.0%} Confidence
            </span>
        </div>
        
        <div class="metadata">
            <div class="meta-item">
                <span class="meta-label">Backend:</span> {result['backend']}
            </div>
            <div class="meta-item">
                <span class="meta-label">Processing:</span> {result['processing_time']:.2f}s
            </div>
            <div class="meta-item">
                <span class="meta-label">Languages:</span> {result['languages']}
            </div>
            <div class="meta-item">
                <span class="meta-label">Regions:</span> {result['regions']}
            </div>
            <div class="meta-item">
                <span class="meta-label">Cached:</span> {'Yes' if result['cached'] else 'No'}
            </div>
        </div>
        
        <h4>Extracted Text:</h4>
        <div class="text-content">{result['text']}</div>
    </div>
"""
        
        html += """</body>
</html>"""
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html)
        
        print(f"✅ HTML saved to: {output_path}")
    
    def save_all(self, base_path: Path) -> None:
        """
        Save results in all formats.
        
        Args:
            base_path: Base path for output files (without extension)
        """
        self.save_csv(base_path.with_suffix('.csv'))
        self.save_json(base_path.with_suffix('.json'))
        self.save_markdown(base_path.with_suffix('.md'))
        self.save_html(base_path.with_suffix('.html'))


def main():
    """Command-line interface."""
    parser = argparse.ArgumentParser(
        description='Batch OCR processor with report generation'
    )
    parser.add_argument(
        'directory',
        type=Path,
        help='Directory containing images to process'
    )
    parser.add_argument(
        '--output',
        type=Path,
        default=Path('ocr_results'),
        help='Base path for output files (default: ocr_results)'
    )
    parser.add_argument(
        '--format',
        choices=['csv', 'json', 'markdown', 'html', 'all'],
        default='all',
        help='Output format (default: all)'
    )
    parser.add_argument(
        '--confidence-threshold',
        type=float,
        default=0.85,
        help='Minimum confidence threshold (default: 0.85)'
    )
    parser.add_argument(
        '--preferred-backend',
        choices=['google', 'tesseract'],
        default='google',
        help='Preferred OCR backend (default: google)'
    )
    
    args = parser.parse_args()
    
    # Validate directory
    if not args.directory.exists():
        print(f"❌ Error: Directory not found: {args.directory}")
        return 1
    
    # Create configuration from environment first, then override with args
    base_config = OCRConfig.from_env()
    config = OCRConfig(
        google_credentials_path=base_config.google_credentials_path,
        tesseract_cmd=base_config.tesseract_cmd,
        confidence_threshold=args.confidence_threshold,
        cache_enabled=base_config.cache_enabled,
        cache_dir=base_config.cache_dir,
        cache_ttl=base_config.cache_ttl,
        max_retries=base_config.max_retries,
        retry_delay=base_config.retry_delay,
        rate_limit_requests=base_config.rate_limit_requests,
        rate_limit_period=base_config.rate_limit_period,
        preferred_backend=args.preferred_backend
    )
    
    # Process images
    processor = OCRBatchProcessor(config)
    processor.process_directory(args.directory)
    
    if not processor.results:
        print("⚠️  No results to save")
        return 0
    
    # Save results
    print(f"\n📄 Generating reports...")
    
    if args.format == 'all':
        processor.save_all(args.output)
    elif args.format == 'csv':
        processor.save_csv(args.output.with_suffix('.csv'))
    elif args.format == 'json':
        processor.save_json(args.output.with_suffix('.json'))
    elif args.format == 'markdown':
        processor.save_markdown(args.output.with_suffix('.md'))
    elif args.format == 'html':
        processor.save_html(args.output.with_suffix('.html'))
    
    print("\n✅ Done!")
    return 0


if __name__ == '__main__':
    import sys
    sys.exit(main())

