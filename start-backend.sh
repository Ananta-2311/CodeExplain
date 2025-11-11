#!/bin/bash

# Start Backend Server Only

echo "Starting Backend (FastAPI)..."

cd backend

# Check if virtual environment exists
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
else
    source .venv/bin/activate
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "Warning: .env file not found. Please create it with your OPENAI_API_KEY."
fi

# Start uvicorn
uvicorn main:app --reload --host 0.0.0.0 --port 8000

