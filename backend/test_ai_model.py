#!/usr/bin/env python3
"""Test script for AI model - generates one-line code summary."""

import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from model.parser_model import ParserModel
from model.ai_model import AIModel


def test_one_line_summary():
    """Test generating a one-line code summary."""
    # Check for API key
    if not os.getenv("OPENAI_API_KEY"):
        print("⚠️  OPENAI_API_KEY not set. Set it in .env file or environment.")
        print("   Example: export OPENAI_API_KEY='your-key-here'")
        return False

    # Simple test code
    test_code = "def add(a, b):\n    return a + b\n"

    print("Testing AI Model with one-line summary...")
    print(f"\nTest code:\n{test_code}")

    # Parse the code
    parser = ParserModel()
    parsed = parser.parse(test_code)

    if not parsed.get("ok"):
        print(f"❌ Parsing failed: {parsed}")
        return False

    print("\n✓ AST parsing successful")

    # Generate explanation
    try:
        ai_model = AIModel()
        result = ai_model.explain_code(
            ast_data=parsed,
            source_code=test_code,
            detail_level="summary",
        )

        if result.get("ok"):
            print(f"\n✅ One-line summary generated:")
            print(f"   {result['explanation']}")
            return True
        else:
            print(f"❌ Explanation failed: {result}")
            return False

    except Exception as e:
        print(f"❌ Error: {e}")
        return False


if __name__ == "__main__":
    success = test_one_line_summary()
    sys.exit(0 if success else 1)

