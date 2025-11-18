#!/usr/bin/env python3
"""Quick test to verify OCR setup."""

import os
import sys
from pathlib import Path


def test_python_version():
    """Test Python version."""
    import sys
    version = f"{sys.version_info.major}.{sys.version_info.minor}"
    print(f"Python version: {version}")
    if sys.version_info >= (3, 10):
        print("✅ Python 3.10+ detected")
        return True
    else:
        print("❌ Python 3.10+ required")
        return False


def test_tesseract():
    """Test Tesseract installation."""
    print("\n" + "="*60)
    print("Testing Tesseract OCR...")
    print("="*60)
    try:
        import pytesseract
        from PIL import Image
        
        # Get tesseract version
        version = pytesseract.get_tesseract_version()
        print(f"✅ Tesseract {version} is installed")
        
        # Test if tesseract command works
        tesseract_cmd = os.getenv('TESSERACT_CMD', '/opt/homebrew/bin/tesseract')
        pytesseract.pytesseract.tesseract_cmd = tesseract_cmd
        print(f"✅ Tesseract path: {tesseract_cmd}")
        
        return True
    except Exception as e:
        print(f"❌ Tesseract test failed: {e}")
        print("   Install with: brew install tesseract")
        return False


def test_google_cloud_vision():
    """Test Google Cloud Vision API."""
    print("\n" + "="*60)
    print("Testing Google Cloud Vision API...")
    print("="*60)
    
    creds_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
    
    if not creds_path:
        print("⚠️  GOOGLE_APPLICATION_CREDENTIALS not set")
        print("   This is OPTIONAL - Tesseract will be used as fallback")
        print("   To enable Google Cloud Vision:")
        print("   1. Follow setup guide in .scratch/ocr_setup_guide.md")
        print("   2. Set GOOGLE_APPLICATION_CREDENTIALS in .env")
        return False
    
    if not Path(creds_path).exists():
        print(f"⚠️  Credentials file not found: {creds_path}")
        return False
    
    try:
        from google.cloud import vision
        import google.auth
        
        # Test authentication
        credentials, project = google.auth.default()
        print(f"✅ Google Cloud credentials loaded")
        print(f"   Project: {project}")
        print(f"   Credentials: {creds_path}")
        
        # Test API client initialization
        client = vision.ImageAnnotatorClient()
        print("✅ Google Cloud Vision client initialized")
        print("   Ready to process images!")
        return True
    except Exception as e:
        print(f"⚠️  Google Cloud Vision setup incomplete: {e}")
        print("   This is okay - Tesseract will be used as fallback")
        return False


def test_environment():
    """Test environment variables."""
    print("\n" + "="*60)
    print("Checking Environment Variables...")
    print("="*60)
    
    env_vars = {
        'GOOGLE_APPLICATION_CREDENTIALS': ('Optional', 'Google Cloud Vision credentials'),
        'TESSERACT_CMD': ('Recommended', 'Tesseract executable path'),
        'OCR_CONFIDENCE_THRESHOLD': ('Optional', 'OCR confidence threshold'),
    }
    
    found_any = False
    for var, (status, description) in env_vars.items():
        value = os.getenv(var)
        if value:
            print(f"✅ {var}")
            print(f"   Value: {value}")
            print(f"   {description}")
            found_any = True
        else:
            print(f"⚠️  {var} not set ({status})")
            print(f"   {description}")
    
    return found_any


def test_cache_directory():
    """Test cache directory creation."""
    print("\n" + "="*60)
    print("Testing Cache Setup...")
    print("="*60)
    
    cache_dir = Path("./cache/ocr")
    try:
        cache_dir.mkdir(parents=True, exist_ok=True)
        print(f"✅ Cache directory created: {cache_dir.absolute()}")
        return True
    except Exception as e:
        print(f"⚠️  Could not create cache directory: {e}")
        return False


def main():
    """Run all tests."""
    print("="*60)
    print("OCR SETUP VERIFICATION")
    print("="*60)
    print()
    
    # Load .env file if it exists
    env_file = Path(".env")
    if env_file.exists():
        try:
            from dotenv import load_dotenv
            load_dotenv()
            print("✅ Loaded .env file")
        except ImportError:
            print("⚠️  python-dotenv not available (already installed)")
    else:
        print("⚠️  No .env file found (create one for configuration)")
        print("   See .scratch/ocr_setup_guide.md for template\n")
    
    # Run tests
    python_ok = test_python_version()
    env_ok = test_environment()
    tesseract_ok = test_tesseract()
    google_ok = test_google_cloud_vision()
    cache_ok = test_cache_directory()
    
    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    
    results = []
    if python_ok:
        results.append(("Python 3.10+", "✅", "READY"))
    else:
        results.append(("Python 3.10+", "❌", "UPGRADE NEEDED"))
    
    if tesseract_ok:
        results.append(("Tesseract OCR", "✅", "READY (FREE)"))
    else:
        results.append(("Tesseract OCR", "❌", "INSTALL NEEDED"))
    
    if google_ok:
        results.append(("Google Cloud Vision", "✅", "READY (PAID)"))
    else:
        results.append(("Google Cloud Vision", "⚠️ ", "NOT CONFIGURED"))
    
    if cache_ok:
        results.append(("Cache Directory", "✅", "READY"))
    
    print()
    for name, status, desc in results:
        print(f"{status} {name:25} {desc}")
    
    print("\n" + "="*60)
    
    # Final verdict
    if tesseract_ok:
        print("🎉 SUCCESS! You can start building the OCR Service!")
        print()
        print("RECOMMENDATION:")
        if google_ok:
            print("  - Use Google Cloud Vision as PRIMARY (more accurate)")
            print("  - Use Tesseract as FALLBACK (free)")
        else:
            print("  - Using Tesseract ONLY (free, good accuracy)")
            print("  - Optionally set up Google Cloud Vision later")
            print("    (see .scratch/ocr_setup_guide.md)")
        print()
        print("NEXT STEPS:")
        print("  1. Review: .scratch/ocr_setup_guide.md (if needed)")
        print("  2. Implement OCRService class")
        print("  3. Test with your 64 pantry images")
        return 0
    else:
        print("❌ SETUP INCOMPLETE")
        print()
        print("FIX REQUIRED:")
        print("  1. Install Tesseract: brew install tesseract")
        print("  2. Run this test again: python test_ocr_setup.py")
        print()
        print("For detailed setup instructions:")
        print("  cat .scratch/ocr_setup_guide.md")
        return 1


if __name__ == "__main__":
    sys.exit(main())

