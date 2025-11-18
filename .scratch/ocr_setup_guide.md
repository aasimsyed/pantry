# OCR Service Setup Guide

## Step-by-Step Setup Process

### Phase 1: Check Current System (5 minutes)

#### 1.1 Check Python Version
```bash
python3 --version  # Should be 3.10+
```

#### 1.2 Check if Tesseract is Already Installed
```bash
which tesseract
tesseract --version
```

If not installed, we'll install it in Phase 2.

---

### Phase 2: Install Tesseract OCR (10 minutes)

Tesseract is FREE and runs locally - no API keys needed!

#### Option A: macOS (using Homebrew)
```bash
# Install Homebrew if you don't have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Tesseract
brew install tesseract

# Verify installation
tesseract --version
which tesseract  # Note this path for .env file
```

#### Option B: Ubuntu/Debian
```bash
sudo apt update
sudo apt install tesseract-ocr
```

#### Option C: Windows
Download installer from: https://github.com/UB-Mannheim/tesseract/wiki

#### Install Additional Language Data (Optional)
```bash
# For better multi-language support
brew install tesseract-lang  # macOS
# or
sudo apt install tesseract-ocr-all  # Ubuntu
```

---

### Phase 3: Set Up Google Cloud Vision (15-20 minutes)

Google Cloud Vision is MORE ACCURATE but costs money. We'll set it up as PRIMARY, with Tesseract as FREE fallback.

#### 3.1 Create Google Cloud Account
1. Go to: https://console.cloud.google.com/
2. Sign in with your Google account
3. **Free Tier**: Google gives you $300 credit for 90 days + always-free tier
4. You'll need a credit card (won't be charged during free trial)

#### 3.2 Create a New Project
1. Click "Select a Project" dropdown (top left)
2. Click "New Project"
3. Name it: `pantry-inventory` or similar
4. Click "Create"

#### 3.3 Enable Cloud Vision API
1. Go to: https://console.cloud.google.com/apis/library
2. Search for "Cloud Vision API"
3. Click on "Cloud Vision API"
4. Click "Enable"
5. Wait 1-2 minutes for activation

#### 3.4 Create Service Account & Credentials
1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts
2. Click "Create Service Account"
3. Name: `pantry-ocr-service`
4. Description: "OCR service for pantry inventory"
5. Click "Create and Continue"
6. Role: Select "Cloud Vision > Cloud Vision API User"
7. Click "Continue" then "Done"

#### 3.5 Download Credentials JSON
1. Click on the service account you just created
2. Go to "Keys" tab
3. Click "Add Key" > "Create new key"
4. Choose "JSON" format
5. Click "Create"
6. **IMPORTANT**: A JSON file will download - save it securely!
7. Move it to your project:
```bash
# Create credentials directory
mkdir -p ~/src/pantry/credentials

# Move the downloaded file (replace with your actual filename)
mv ~/Downloads/pantry-inventory-*.json ~/src/pantry/credentials/google-cloud-vision.json

# Secure the file
chmod 600 ~/src/pantry/credentials/google-cloud-vision.json
```

---

### Phase 4: Install Python Dependencies (5 minutes)

```bash
cd ~/src/pantry

# Activate your virtual environment
source .venv/bin/activate

# Install OCR-related packages
pip install google-cloud-vision==2.13.0
pip install pytesseract==0.3.10
pip install diskcache==5.6.3  # For caching
pip install aiohttp==3.9.1     # For async operations

# Update requirements.txt (we'll do this automatically)
```

---

### Phase 5: Configure Environment Variables (5 minutes)

Create `.env` file in project root:

```bash
# At: ~/src/pantry/.env

# Google Cloud Vision
GOOGLE_CLOUD_VISION_CREDENTIALS=/Users/aasim/src/pantry/credentials/google-cloud-vision.json
GOOGLE_CLOUD_VISION_PROJECT_ID=pantry-inventory  # Replace with your project ID

# Tesseract (update path based on 'which tesseract' output)
TESSERACT_CMD=/opt/homebrew/bin/tesseract  # macOS Homebrew (Apple Silicon)
# TESSERACT_CMD=/usr/local/bin/tesseract   # macOS Homebrew (Intel)
# TESSERACT_CMD=/usr/bin/tesseract         # Linux
TESSERACT_LANG=eng

# OCR Settings
OCR_PRIMARY_BACKEND=google_vision  # Options: google_vision, tesseract
OCR_FALLBACK_ENABLED=true
OCR_CONFIDENCE_THRESHOLD=0.85
OCR_CACHE_ENABLED=true
OCR_CACHE_DIR=./cache/ocr
OCR_MAX_RETRIES=3
OCR_RETRY_DELAY=1.0

# Rate Limiting (for API)
OCR_RATE_LIMIT_REQUESTS=60
OCR_RATE_LIMIT_PERIOD=60  # seconds
```

---

### Phase 6: Test Your Setup (10 minutes)

We'll create a simple test script to verify everything works.

#### Test Script: `test_ocr_setup.py`
```python
#!/usr/bin/env python3
"""Quick test to verify OCR setup."""

import os
from pathlib import Path

def test_tesseract():
    """Test Tesseract installation."""
    print("Testing Tesseract OCR...")
    try:
        import pytesseract
        from PIL import Image
        
        # Get tesseract version
        version = pytesseract.get_tesseract_version()
        print(f"✅ Tesseract {version} is installed")
        return True
    except Exception as e:
        print(f"❌ Tesseract test failed: {e}")
        return False

def test_google_cloud_vision():
    """Test Google Cloud Vision API."""
    print("\nTesting Google Cloud Vision API...")
    try:
        from google.cloud import vision
        import google.auth
        
        # Test authentication
        credentials, project = google.auth.default()
        print(f"✅ Google Cloud credentials loaded")
        print(f"   Project: {project}")
        
        # Test API connection
        client = vision.ImageAnnotatorClient()
        print("✅ Google Cloud Vision client initialized")
        return True
    except Exception as e:
        print(f"❌ Google Cloud Vision test failed: {e}")
        print("   This is okay - we'll use Tesseract as fallback")
        return False

def test_environment():
    """Test environment variables."""
    print("\nChecking Environment Variables...")
    
    required = {
        'GOOGLE_CLOUD_VISION_CREDENTIALS': 'Optional - for Google Cloud Vision',
        'TESSERACT_CMD': 'Required - Tesseract executable path'
    }
    
    for var, description in required.items():
        value = os.getenv(var)
        if value:
            print(f"✅ {var}: {value}")
        else:
            print(f"⚠️  {var} not set ({description})")

if __name__ == "__main__":
    print("="*60)
    print("OCR Setup Verification")
    print("="*60)
    
    # Load .env file
    try:
        from dotenv import load_dotenv
        load_dotenv()
        print("✅ Loaded .env file\n")
    except ImportError:
        print("⚠️  python-dotenv not installed (pip install python-dotenv)\n")
    
    test_environment()
    tesseract_ok = test_tesseract()
    google_ok = test_google_cloud_vision()
    
    print("\n" + "="*60)
    print("Summary:")
    print("="*60)
    if tesseract_ok:
        print("✅ Tesseract OCR: READY")
    if google_ok:
        print("✅ Google Cloud Vision: READY")
    
    if tesseract_ok or google_ok:
        print("\n🎉 You're ready to implement the OCR Service!")
    else:
        print("\n❌ Please fix the issues above before continuing.")
```

Run the test:
```bash
python test_ocr_setup.py
```

---

### Phase 7: Cost Considerations

#### Tesseract (FREE)
- ✅ Completely free
- ✅ Runs locally, no API calls
- ⚠️ Lower accuracy (~85-90% on good images)
- ⚠️ Slower processing

#### Google Cloud Vision (PAID)
- **Free Tier**: 1,000 images/month FREE
- **After free tier**: $1.50 per 1,000 images
- ✅ Higher accuracy (~95%+)
- ✅ Faster processing
- ✅ Better with poor quality images

**Recommendation**: Use Google Cloud Vision as primary (free for 1,000/month), Tesseract as fallback.

**For 64 test images**: Will use only 64 of your 1,000 free images/month. ✅

---

### Phase 8: Security Best Practices

#### Add credentials directory to .gitignore
Already handled - your `.gitignore` includes:
```
credentials.json
*_credentials.json
```

#### Secure the credentials file
```bash
chmod 600 ~/src/pantry/credentials/google-cloud-vision.json
```

#### Never commit .env file
Already handled - `.env` is in `.gitignore`

---

## Quick Reference

### Check Installation Status
```bash
# Tesseract
tesseract --version

# Google Cloud Vision (in Python)
python -c "from google.cloud import vision; print('✅ Installed')"

# Verify credentials
echo $GOOGLE_APPLICATION_CREDENTIALS
```

### Useful Commands
```bash
# Test Tesseract on an image
tesseract image.jpg output.txt

# View Tesseract supported languages
tesseract --list-langs
```

### Troubleshooting

**Problem**: Tesseract not found
**Solution**: 
```bash
# macOS
brew install tesseract
# Then update TESSERACT_CMD in .env with output from: which tesseract
```

**Problem**: Google Cloud Vision authentication error
**Solution**:
```bash
# Set environment variable
export GOOGLE_APPLICATION_CREDENTIALS=/Users/aasim/src/pantry/credentials/google-cloud-vision.json

# Or add to your .env file
```

**Problem**: "Permission denied" on credentials file
**Solution**:
```bash
chmod 600 ~/src/pantry/credentials/google-cloud-vision.json
```

---

## Next Steps After Setup

Once setup is complete:
1. ✅ Run `test_ocr_setup.py` to verify
2. ✅ Implement OCRService class
3. ✅ Test with your 64 pantry images
4. ✅ Monitor API usage in Google Cloud Console

---

## Estimated Total Time: 45-60 minutes
- Tesseract install: 10 min
- Google Cloud setup: 20 min  
- Python packages: 5 min
- Configuration: 10 min
- Testing: 10 min

