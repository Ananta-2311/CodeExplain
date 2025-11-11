# CodeMuse

AI-powered code explanation tool that analyzes code structure and provides explanations, visualizations, and suggestions. Built with FastAPI and React.

## Features

- Code explanations at different detail levels
- AST visualization with interactive graphs
- Code improvement suggestions
- History tracking and session sharing
- Admin dashboard for monitoring
- Supports Python, JavaScript, Java, and C++

## Requirements

- Python 3.8+
- Node.js 18+
- OpenAI API key ([get one here](https://platform.openai.com/api-keys))

## Setup

### Quick Start

Start both servers:
```bash
./start.sh
```

Or start them separately:
```bash
./start-backend.sh   # Backend only
./start-frontend.sh    # Frontend only
```

### Manual Setup

**Backend:**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

**Frontend:**
```bash
cd frontend
npm install
```

## Configuration

Create `backend/.env` file:

```env
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-4o-mini
DATABASE_URL=sqlite:///./codemuse.db
ADMIN_TOKEN=changeme
```

The `.env` file is already created with a template. Just add your OpenAI API key.

## Running

**Backend:**
```bash
cd backend
source .venv/bin/activate
uvicorn main:app --reload
```

**Frontend:**
```bash
cd frontend
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Testing

```bash
cd backend
source .venv/bin/activate
python test_ai_model.py
python test_integration.py  # Requires backend to be running
```

## Troubleshooting

**"proxies" error:**
```bash
cd backend
source .venv/bin/activate
pip install httpx==0.27.2
```

**Missing API key:**
- Make sure `backend/.env` exists with `OPENAI_API_KEY` set
- Restart the backend after creating/updating `.env`

**Port conflicts:**
- Backend: Change port in uvicorn command
- Frontend: Edit `vite.config.js` or use `npm run dev -- --port 5174`

## Project Structure

```
backend/
  controller/     # API routes
  model/          # Business logic, AI integration, parsers
  view/           # View templates
  main.py         # FastAPI app
  requirements.txt
  .env            # Environment variables

frontend/
  src/
    App.jsx
    view/         # React components
  package.json
```

## API Endpoints

Main endpoints:
- `POST /explain` - Code explanations
- `POST /visualize` - AST visualization
- `POST /suggestions` - Code suggestions
- `GET /history` - Session history
- `POST /share` - Create shareable link
- `GET /admin/stats` - Admin stats (requires `X-Admin-Token` header)

Full API docs at http://localhost:8000/docs

## Notes

- Don't commit `.env` file (already in `.gitignore`)
- Change `ADMIN_TOKEN` in production
- For production, use PostgreSQL instead of SQLite
- Configure CORS properly in `main.py` for production
