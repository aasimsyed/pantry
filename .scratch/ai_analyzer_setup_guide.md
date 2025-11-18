# AI Analyzer Setup Guide

## Overview

The AI Analyzer module uses AI language models (Claude or GPT-4) to extract structured product information from OCR text. It identifies product names, brands, ingredients, expiration dates, and categorizes items.

---

## 🎯 What AI Services Are Available?

You can use **either** (or both):

### Option 1: Anthropic Claude (Recommended) ⭐
- **Model**: Claude 3.5 Sonnet
- **Pros**: 
  - Excellent at structured data extraction
  - Better at following complex instructions
  - More reliable JSON output
  - Great for food/ingredient analysis
- **Cost**: $3 per million input tokens, $15 per million output tokens
- **Your use case**: ~$0.01-0.02 per 64 items (very affordable!)

### Option 2: OpenAI GPT-4
- **Model**: GPT-4 or GPT-4 Turbo
- **Pros**:
  - Very popular, well-documented
  - Good at structured extraction
  - JSON mode available
- **Cost**: Similar to Claude
- **Your use case**: ~$0.01-0.02 per 64 items

### Recommendation
**Use Claude 3.5 Sonnet** - it's specifically excellent at structured data extraction and following complex instructions, which is exactly what we need for parsing product information.

---

## 📋 Setup Steps

### Step 1: Get Anthropic Claude API Key

1. **Go to**: https://console.anthropic.com/

2. **Sign up or log in**
   - Use your email
   - Verify your account

3. **Add payment method** (Required for API access)
   - Go to Settings → Billing
   - Add credit card
   - Set usage limits (optional but recommended)
   - Suggested limit: $10/month (more than enough for household use)

4. **Create API key**
   - Go to Settings → API Keys
   - Click "Create Key"
   - Give it a name: "Smart Pantry"
   - Copy the key (starts with `sk-ant-`)
   - **Save it securely** - you can't see it again!

5. **Set environment variable**
   ```bash
   export ANTHROPIC_API_KEY="sk-ant-api03-..."
   ```

   Or add to your `.zshrc` or `.bash_profile`:
   ```bash
   echo 'export ANTHROPIC_API_KEY="sk-ant-api03-..."' >> ~/.zshrc
   source ~/.zshrc
   ```

---

### Step 2 (Optional): Get OpenAI API Key

If you want to use GPT-4 as a fallback:

1. **Go to**: https://platform.openai.com/

2. **Sign up or log in**

3. **Add payment method**
   - Go to Billing → Payment methods
   - Add credit card

4. **Create API key**
   - Go to API keys
   - Click "Create new secret key"
   - Copy the key (starts with `sk-`)
   - Save it securely

5. **Set environment variable**
   ```bash
   export OPENAI_API_KEY="sk-..."
   ```

---

### Step 3: Install Python Dependencies

The AI Analyzer needs these packages:

```bash
cd /Users/aasim/src/pantry
pip install anthropic openai pydantic
```

**Packages**:
- `anthropic>=0.7.0` - Claude API client
- `openai>=1.3.0` - OpenAI API client (already in requirements.txt)
- `pydantic>=2.5.0` - Data validation (already in requirements.txt)

---

### Step 4: Create Environment File

Create a `.env` file in your project root:

```bash
cd /Users/aasim/src/pantry
cat > .env << 'EOF'
# Google Cloud Vision (already configured)
GOOGLE_APPLICATION_CREDENTIALS=/Users/aasim/.google/pantry-manager-416004-d72756e8daaa.json

# Anthropic Claude API
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here

# OpenAI GPT-4 (optional, for fallback)
OPENAI_API_KEY=sk-your-key-here

# AI Analyzer Settings
AI_MODEL=claude-3-5-sonnet-20241022
AI_TEMPERATURE=0.0
AI_MAX_TOKENS=2000
AI_TIMEOUT=30

# Confidence thresholds
AI_MIN_CONFIDENCE=0.7
EOF
```

**Update the file with your actual API keys!**

---

### Step 5: Test AI Setup

Let me create a test script to verify everything works:

```python
# test_ai_setup.py
import os
from anthropic import Anthropic

print("🔬 Testing AI Analyzer Setup\n")
print("=" * 70)

# Check environment variables
print("\n1. Checking Environment Variables...")
anthropic_key = os.getenv("ANTHROPIC_API_KEY")
openai_key = os.getenv("OPENAI_API_KEY")

if anthropic_key:
    print(f"   ✅ ANTHROPIC_API_KEY: {anthropic_key[:20]}...")
else:
    print("   ❌ ANTHROPIC_API_KEY not set")

if openai_key:
    print(f"   ✅ OPENAI_API_KEY: {openai_key[:20]}...")
else:
    print("   ⚠️  OPENAI_API_KEY not set (optional)")

# Test Claude API
print("\n2. Testing Claude API Connection...")
if anthropic_key:
    try:
        client = Anthropic(api_key=anthropic_key)
        
        # Simple test message
        message = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=100,
            messages=[{
                "role": "user",
                "content": "Say 'Hello from Claude!' and nothing else."
            }]
        )
        
        response = message.content[0].text
        print(f"   ✅ Claude API working!")
        print(f"   Response: {response}")
        
    except Exception as e:
        print(f"   ❌ Claude API error: {e}")
else:
    print("   ⚠️  Skipping (no API key)")

# Test OpenAI API (optional)
print("\n3. Testing OpenAI API Connection...")
if openai_key:
    try:
        from openai import OpenAI
        client = OpenAI(api_key=openai_key)
        
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            max_tokens=100,
            messages=[{
                "role": "user",
                "content": "Say 'Hello from GPT!' and nothing else."
            }]
        )
        
        print(f"   ✅ OpenAI API working!")
        print(f"   Response: {response.choices[0].message.content}")
        
    except Exception as e:
        print(f"   ❌ OpenAI API error: {e}")
else:
    print("   ⚠️  Skipping (no API key)")

print("\n" + "=" * 70)
print("✅ Setup verification complete!")
print("\nYou're ready to build the AI Analyzer!")
```

Run it:
```bash
python test_ai_setup.py
```

---

## 🎯 What the AI Analyzer Will Do

### Input
OCR text from your pantry items:
```
"REDUCED SODIUM
KOYO TOFU MISO REDUCED RAMEN 2021/12
SODIUM 25% LESS SODIUM THAN REGULAR
MADE WITH ORGANIC NOODLES
HEIRLOOM GRAINS VEGAN"
```

### Output
Structured JSON:
```json
{
  "product_name": "Koyo Tofu Miso Reduced Sodium Ramen",
  "brand": "Koyo",
  "category": "Noodles & Pasta",
  "subcategory": "Instant Ramen",
  "expiration_date": "2021-12",
  "key_attributes": [
    "Reduced Sodium",
    "25% Less Sodium",
    "Organic Noodles",
    "Vegan",
    "Heirloom Grains"
  ],
  "dietary_tags": ["vegan", "organic"],
  "confidence": 0.95,
  "raw_text": "..."
}
```

---

## 💰 Cost Estimate

### For Your 64 Pantry Items

**Claude 3.5 Sonnet**:
- Input: ~150 tokens per item × 64 items = 9,600 tokens
- Output: ~200 tokens per item × 64 items = 12,800 tokens
- Cost: (9,600 × $3/1M) + (12,800 × $15/1M) = $0.03 + $0.19 = **~$0.22**

**Very affordable!** Even with re-processing and testing, you'll spend less than $1 for your entire pantry.

**Monthly estimate**: If you scan 10-20 new items per month:
- Cost: **$0.05-0.10/month**
- Well within any reasonable budget!

---

## 🔒 Security Best Practices

1. **Never commit API keys to Git**
   - Already in `.gitignore`: `.env`
   - Keys should only be in environment variables

2. **Set usage limits**
   - Anthropic Console → Settings → Usage limits
   - Recommended: $10/month limit

3. **Rotate keys periodically**
   - Every 3-6 months
   - Immediately if compromised

4. **Use separate keys for dev/prod**
   - Create different keys for testing vs production

---

## 🐛 Troubleshooting

### "Invalid API key"
- Check key is copied correctly (no extra spaces)
- Verify billing is enabled in console
- Try creating a new key

### "Rate limit exceeded"
- Default limit: 50 requests/minute (plenty for us)
- Add delays between requests if needed
- Our batch processor will handle this automatically

### "Insufficient credits"
- Add payment method in console
- Check billing status
- Our processor will show clear error messages

---

## ✅ Next Steps

Once setup is complete:

1. ✅ **Verify**: Run `python test_ai_setup.py`
2. ✅ **Implement**: Build AI Analyzer module
3. ✅ **Test**: Process a few sample items
4. ✅ **Run**: Process all 64 pantry items
5. ✅ **Store**: Save structured data to database

---

## 📚 API Documentation

**Claude API**: https://docs.anthropic.com/claude/reference/getting-started
**OpenAI API**: https://platform.openai.com/docs/api-reference

---

## 🎯 Ready?

After you've:
1. ✅ Created Anthropic account
2. ✅ Added payment method
3. ✅ Generated API key
4. ✅ Set `ANTHROPIC_API_KEY` environment variable
5. ✅ Installed dependencies (`pip install anthropic`)
6. ✅ Tested with `test_ai_setup.py`

**You're ready to build the AI Analyzer!** 🚀

