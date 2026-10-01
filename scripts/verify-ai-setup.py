#!/usr/bin/env python3
"""
Verify AI Analyzer setup (env, Anthropic, OpenAI, extraction).

Run from project root: python scripts/verify-ai-setup.py
"""

import os
import sys
from pathlib import Path

# Load .env from project root (parent of scripts/)
_root = Path(__file__).resolve().parent.parent
_env = _root / ".env"
try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=_env)
except ImportError:
    pass


def test_environment():
    """Check environment variables."""
    print("\n1️⃣  Checking Environment Variables...")
    print("-" * 70)

    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")

    if anthropic_key:
        masked = anthropic_key[:20] + "..." if len(anthropic_key) > 20 else anthropic_key
        print(f"   ✅ ANTHROPIC_API_KEY: {masked}")
    else:
        print("   ❌ ANTHROPIC_API_KEY not set")
        print("      Set it: export ANTHROPIC_API_KEY='sk-ant-...'")
        return False

    if openai_key:
        masked = openai_key[:15] + "..." if len(openai_key) > 15 else openai_key
        print(f"   ✅ OPENAI_API_KEY: {masked}")
    else:
        print("   ⚠️  OPENAI_API_KEY not set (optional)")

    return True


def test_anthropic():
    """Test Anthropic Claude API."""
    print("\n2️⃣  Testing Anthropic Claude API...")
    print("-" * 70)

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print("   ⚠️  Skipping (no API key)")
        return False

    try:
        from anthropic import Anthropic
        print("   ✅ anthropic package installed")
    except ImportError:
        print("   ❌ anthropic package not installed")
        print("      Install it: pip install anthropic")
        return False

    try:
        client = Anthropic(api_key=api_key)
        print("   🔄 Sending test request to Claude...")
        message = client.messages.create(
            model="claude-sonnet-5-5",
            max_tokens=100,
            messages=[{"role": "user", "content": "Say 'Hello from Claude!' and nothing else."}],
        )
        response = "".join(b.text for b in message.content if b.type == "text")
        print(f"   ✅ Claude API working!")
        print(f"   📝 Response: \"{response}\"")
        print(f"   📊 Model: {message.model}")
        print(f"   🎫 Tokens used: {message.usage.input_tokens} in, {message.usage.output_tokens} out")
        return True
    except Exception as e:
        print(f"   ❌ Claude API error: {e}")
        print("\n   Troubleshooting:")
        print("   - Check API key is correct")
        print("   - Verify billing: https://console.anthropic.com/settings/billing")
        return False


def test_openai():
    """Test OpenAI API (optional)."""
    print("\n3️⃣  Testing OpenAI API (Optional)...")
    print("-" * 70)

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("   ⚠️  Skipping (no API key)")
        return None

    try:
        from openai import OpenAI
        print("   ✅ openai package installed")
    except ImportError:
        print("   ❌ openai package not installed")
        print("      Install it: pip install openai")
        return False

    try:
        client = OpenAI(api_key=api_key)
        print("   🔄 Sending test request to GPT...")
        response = client.chat.completions.create(
            model="gpt-6-luna",
            max_completion_tokens=100,
            reasoning_effort="none",
            messages=[{"role": "user", "content": "Say 'Hello from GPT!' and nothing else."}],
        )
        print(f"   ✅ OpenAI API working!")
        print(f"   📝 Response: \"{response.choices[0].message.content}\"")
        return True
    except Exception as e:
        print(f"   ❌ OpenAI API error: {e}")
        return False


def test_structured_extraction():
    """Test structured data extraction with Claude."""
    print("\n4️⃣  Testing Structured Data Extraction...")
    print("-" * 70)

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print("   ⚠️  Skipping (no Anthropic API key)")
        return False

    try:
        import json
        from anthropic import Anthropic

        sample_ocr = """
        REDUCED SODIUM KOYO TOFU MISO REDUCED RAMEN 2021/12
        SODIUM 25% LESS SODIUM THAN REGULAR MADE WITH ORGANIC NOODLES
        VEGAN
        """
        client = Anthropic(api_key=api_key)
        print("   🔄 Extracting structured data from sample OCR text...")
        prompt = f"""Extract product information from this OCR text and return ONLY valid JSON:

OCR Text:
{sample_ocr}

Return JSON with: product_name, brand, category, expiration_date, key_attributes, dietary_tags, confidence.
Return ONLY the JSON, no other text."""

        message = client.messages.create(
            model="claude-sonnet-5-5",
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}],
        )
        response_text = "".join(b.text for b in message.content if b.type == "text").strip()
        if response_text.startswith("```"):
            parts = response_text.split("```")
            response_text = parts[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
            response_text = response_text.strip()
        data = json.loads(response_text)
        print("   ✅ Structured extraction working!")
        print(f"      Product: {data.get('product_name', 'N/A')}")
        print(f"      Confidence: {data.get('confidence', 0):.0%}")
        return True
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False


def main():
    print("=" * 70)
    print("🔬 AI ANALYZER SETUP VERIFICATION")
    print("=" * 70)

    results = {
        "environment": test_environment(),
        "anthropic": test_anthropic(),
        "openai": test_openai(),
        "extraction": test_structured_extraction(),
    }

    print("\n" + "=" * 70)
    print("📊 SUMMARY")
    print("=" * 70)

    if results["environment"] and results["anthropic"]:
        print("\n✅ SUCCESS! Your AI Analyzer setup is ready!")
        return 0
    print("\n❌ SETUP INCOMPLETE")
    if not results["environment"]:
        print("   - Set ANTHROPIC_API_KEY (see .env.example)")
    if not results["anthropic"]:
        print("   - Fix Anthropic API connection (see above)")
    return 1


if __name__ == "__main__":
    sys.exit(main())
