#!/bin/bash

# Start Frontend Server Only

echo "Starting Frontend (Vite)..."

cd frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Start vite dev server
npm run dev

