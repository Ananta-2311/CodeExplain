"""
Integration test script for CodeMuse API.
Tests the full flow: parser, AI model, explanation, visualization, suggestions, and history.
"""
import requests
import json
import time

BASE_URL = "http://localhost:8000"

# Sample Python code for testing
TEST_CODE = """
def calculate_factorial(n):
    if n <= 1:
        return 1
    return n * calculate_factorial(n - 1)

class MathUtils:
    def __init__(self):
        self.pi = 3.14159
    
    def area_circle(self, radius):
        return self.pi * radius ** 2

if __name__ == "__main__":
    print(calculate_factorial(5))
    utils = MathUtils()
    print(utils.area_circle(10))
"""

def test_health():
    """Test health endpoint."""
    print("1. Testing /health endpoint...")
    response = requests.get(f"{BASE_URL}/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    print("   ✓ Health check passed\n")

def test_explain():
    """Test explanation endpoint."""
    print("2. Testing /explain endpoint...")
    response = requests.post(
        f"{BASE_URL}/explain",
        json={
            "code": TEST_CODE,
            "detail_level": "detailed",
            "organize_by_structure": True,
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data.get("ok") == True
    assert "overview" in data
    assert "explanations" in data
    print("   ✓ Explanation generated successfully")
    print(f"   - Overview: {data['overview'][:50]}...")
    print(f"   - Functions found: {len(data.get('explanations', {}))}\n")
    return data

def test_visualize():
    """Test visualization endpoint."""
    print("3. Testing /visualize endpoint...")
    response = requests.post(
        f"{BASE_URL}/visualize",
        json={"code": TEST_CODE}
    )
    assert response.status_code == 200
    data = response.json()
    assert data.get("ok") == True
    assert "graph" in data
    assert "nodes" in data["graph"]
    assert "links" in data["graph"]
    print(f"   ✓ Visualization generated successfully")
    print(f"   - Nodes: {len(data['graph']['nodes'])}")
    print(f"   - Links: {len(data['graph']['links'])}\n")
    return data

def test_suggestions():
    """Test suggestions endpoint."""
    print("4. Testing /suggestions endpoint...")
    response = requests.post(
        f"{BASE_URL}/suggestions",
        json={"code": TEST_CODE}
    )
    assert response.status_code == 200
    data = response.json()
    assert data.get("ok") == True
    assert "suggestions" in data
    print(f"   ✓ Suggestions generated successfully")
    print(f"   - Total suggestions: {data.get('total_count', 0)}\n")
    return data

def test_history():
    """Test history endpoints."""
    print("5. Testing /history endpoints...")
    
    # Save to history
    explain_response = requests.post(
        f"{BASE_URL}/explain",
        json={
            "code": TEST_CODE,
            "detail_level": "summary",
            "organize_by_structure": True,
        }
    )
    explain_data = explain_response.json()
    
    save_response = requests.post(
        f"{BASE_URL}/history",
        json={
            "code": TEST_CODE,
            "response": explain_data,
            "title": "Test Session",
        }
    )
    assert save_response.status_code == 200
    saved_item = save_response.json()
    history_id = saved_item["id"]
    print(f"   ✓ Saved to history (ID: {history_id})")
    
    # List history
    list_response = requests.get(f"{BASE_URL}/history")
    assert list_response.status_code == 200
    history_list = list_response.json()
    assert len(history_list) > 0
    print(f"   ✓ History list retrieved ({len(history_list)} items)")
    
    # Get specific history
    get_response = requests.get(f"{BASE_URL}/history/{history_id}")
    assert get_response.status_code == 200
    history_detail = get_response.json()
    assert history_detail["code"] == TEST_CODE
    print(f"   ✓ History detail retrieved\n")
    return history_id

def test_settings():
    """Test settings endpoints."""
    print("6. Testing /settings endpoints...")
    
    # Save settings
    save_response = requests.post(
        f"{BASE_URL}/settings",
        json={
            "user_id": "test_user",
            "theme": "dark",
            "fontSize": 16,
            "language": "python",
            "editorTheme": "vscDarkPlus",
        }
    )
    assert save_response.status_code == 200
    saved_settings = save_response.json()
    assert saved_settings["theme"] == "dark"
    assert saved_settings["fontSize"] == 16
    print("   ✓ Settings saved successfully")
    
    # Get settings
    get_response = requests.get(f"{BASE_URL}/settings/test_user")
    assert get_response.status_code == 200
    retrieved_settings = get_response.json()
    assert retrieved_settings["theme"] == "dark"
    print("   ✓ Settings retrieved successfully\n")

def main():
    """Run all integration tests."""
    print("=" * 60)
    print("CodeMuse API Integration Tests")
    print("=" * 60)
    print()
    
    try:
        test_health()
        explain_data = test_explain()
        visualize_data = test_visualize()
        suggestions_data = test_suggestions()
        history_id = test_history()
        test_settings()
        
        print("=" * 60)
        print("✅ All integration tests passed!")
        print("=" * 60)
        print("\nSummary:")
        print(f"- Explanation: {len(explain_data.get('explanations', {}))} functions/classes")
        print(f"- Visualization: {len(visualize_data['graph']['nodes'])} nodes, {len(visualize_data['graph']['links'])} links")
        print(f"- Suggestions: {suggestions_data.get('total_count', 0)} suggestions")
        print(f"- History: Session saved with ID {history_id}")
        
    except requests.exceptions.ConnectionError:
        print("❌ Error: Could not connect to backend server.")
        print("   Make sure the server is running on http://localhost:8000")
        print("   Run: cd backend && uvicorn main:app --reload")
    except AssertionError as e:
        print(f"❌ Test failed: {e}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

if __name__ == "__main__":
    main()

