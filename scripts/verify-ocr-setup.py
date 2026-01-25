#!/usr/bin/env python3
"""Verify OCR setup (Tesseract, Google Vision, env). Run from project root: python scripts/verify-ocr-setup.py."""

import os
import sys
from pathlib import Path

# Load .env from project root
_root = Path(__file__).resolve().parent.parent
_env = _root / ".env"
if _env.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(dotenv_path=_env)
    except ImportError:
        pass


def test_python_version():
    v = f"{sys.version_info.major}.{sys.version_info.minor}"
    print(f"Python version: {v}")
    if sys.version_info >= (3, 10):
        print("✅ Python 3.10+ detected")
        return True
    print("❌ Python 3.10+ required")
    return False


def test_tesseract():
    print("\n" + "=" * 60)
    print("Testing Tesseract OCR...")
    print("=" * 60)
    try:
        import pytesseract
        version = pytesseract.get_tesseract_version()
        print(f"✅ Tesseract {version} is installed")
        tesseract_cmd = os.getenv("TESSERACT_CMD", "/opt/homebrew/bin/tesseract")
        pytesseract.pytesseract.tesseract_cmd = tesseract_cmd
        print(f"✅ Tesseract path: {tesseract_cmd}")
        return True
    except Exception as e:
        print(f"❌ Tesseract test failed: {e}")
        print("   Install with: brew install tesseract")
        return False


def test_google_cloud_vision():
    print("\n" + "=" * 60)
    print("Testing Google Cloud Vision API...")
    print("=" * 60)
    creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if not creds_path:
        print("⚠️  GOOGLE_APPLICATION_CREDENTIALS not set")
        print("   Optional – Tesseract used as fallback. Set in .env to enable Vision.")
        return False
    if not Path(creds_path).expanduser().exists():
        print(f"⚠️  Credentials file not found: {creds_path}")
        return False
    try:
        from google.cloud import vision
        import google.auth
        _, project = google.auth.default()
        print(f"✅ Google Cloud credentials loaded (project: {project})")
        vision.ImageAnnotatorClient()
        print("✅ Google Cloud Vision client initialized")
        return True
    except Exception as e:
        print(f"⚠️  Google Cloud Vision setup incomplete: {e}")
        print("   Tesseract will be used as fallback.")
        return False


def test_environment():
    print("\n" + "=" * 60)
    print("Checking Environment Variables...")
    print("=" * 60)
    for var, (status, desc) in [
        ("GOOGLE_APPLICATION_CREDENTIALS", ("Optional", "Google Cloud Vision credentials")),
        ("TESSERACT_CMD", ("Recommended", "Tesseract executable path")),
        ("OCR_CONFIDENCE_THRESHOLD", ("Optional", "OCR confidence threshold")),
    ]:
        val = os.getenv(var)
        if val:
            print(f"✅ {var}: {val} – {desc}")
        else:
            print(f"⚠️  {var} not set ({status}) – {desc}")
    return True


def test_cache_directory():
    print("\n" + "=" * 60)
    print("Testing Cache Setup...")
    print("=" * 60)
    cache_dir = _root / "cache" / "ocr"
    try:
        cache_dir.mkdir(parents=True, exist_ok=True)
        print(f"✅ Cache directory: {cache_dir}")
        return True
    except Exception as e:
        print(f"⚠️  Could not create cache: {e}")
        return False


def main():
    print("=" * 60)
    print("OCR SETUP VERIFICATION")
    print("=" * 60)

    env_file = _root / ".env"
    if env_file.exists():
        print("✅ Loaded .env")
    else:
        print("⚠️  No .env – create from .env.example")

    python_ok = test_python_version()
    test_environment()
    tesseract_ok = test_tesseract()
    google_ok = test_google_cloud_vision()
    cache_ok = test_cache_directory()

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print("✅ Python 3.10+" if python_ok else "❌ Python 3.10+")
    print("✅ Tesseract OCR" if tesseract_ok else "❌ Tesseract OCR")
    print("✅ Google Cloud Vision" if google_ok else "⚠️  Google Cloud Vision (optional)")
    if cache_ok:
        print("✅ Cache directory")

    if tesseract_ok:
        print("\n🎉 OCR setup ready! Tesseract primary; Vision optional.")
        return 0
    print("\n❌ Setup incomplete. Install Tesseract: brew install tesseract")
    print("   Then run: python scripts/verify-ocr-setup.py")
    return 1


if __name__ == "__main__":
    sys.exit(main())
