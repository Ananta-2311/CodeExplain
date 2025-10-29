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
4. uvicorn main:app --reload

Frontend

1. cd frontend
2. npm install
3. npm run dev
