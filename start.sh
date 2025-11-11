#!/bin/bash

# CodeExplain / CodeMuse Startup Script
# This script starts both the backend and frontend servers

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting CodeExplain / CodeMuse...${NC}\n"

# Check if .env file exists
if [ ! -f "backend/.env" ]; then
    echo -e "${YELLOW}Warning: backend/.env file not found. Please create it with your OPENAI_API_KEY.${NC}"
fi

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Shutting down servers...${NC}"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit
}

trap cleanup SIGINT SIGTERM

# Start Backend
echo -e "${GREEN}Starting Backend (FastAPI)...${NC}"
cd backend
if [ ! -d ".venv" ]; then
    echo -e "${YELLOW}Virtual environment not found. Creating one...${NC}"
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
else
    source .venv/bin/activate
fi

# Check if uvicorn is installed
if ! python -c "import uvicorn" 2>/dev/null; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    pip install -r requirements.txt
fi

uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 2

# Start Frontend
echo -e "${GREEN}Starting Frontend (Vite)...${NC}"
cd frontend
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Node modules not found. Installing dependencies...${NC}"
    npm install
fi

npm run dev &
FRONTEND_PID=$!
cd ..

echo -e "\n${GREEN}✓ Backend running at: http://localhost:8000${NC}"
echo -e "${GREEN}✓ Frontend running at: http://localhost:5173 (or check terminal output)${NC}"
echo -e "${BLUE}Press Ctrl+C to stop both servers${NC}\n"

# Wait for both processes
wait

