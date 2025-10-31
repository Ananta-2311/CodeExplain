CodeExplain / CodeMuse – Monorepo Scaffold

Structure

- backend/
  - controller/
  - model/
  - view/
  - main.py
  - requirements.txt
- frontend/
  - index.html
  - package.json
  - vite.config.js
  - src/
    - main.jsx
    - App.jsx

Getting Started

Backend

1. cd backend
2. python3 -m venv .venv && source .venv/bin/activate
3. pip install -r requirements.txt
4. Create a `.env` file with your OpenAI API key:
   ```
   OPENAI_API_KEY=your_api_key_here
   OPENAI_MODEL=gpt-4o-mini
   ```
5. uvicorn main:app --reload

Testing the AI Model

Run the test script to verify OpenAI integration:
```bash
cd backend
source .venv/bin/activate
export OPENAI_API_KEY='your-key-here'  # or set in .env file
python test_ai_model.py
```

Frontend

1. cd frontend
2. npm install
3. npm run dev
