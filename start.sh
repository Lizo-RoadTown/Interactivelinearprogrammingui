#!/usr/bin/env bash
set -e

echo "============================================"
echo "  Interactive LP UI - Local Setup"
echo "============================================"
echo

# Check for Python
if ! command -v python3 &>/dev/null; then
    echo "ERROR: Python 3 is not installed."
    echo "Install Python 3.10+ from https://www.python.org/downloads/"
    exit 1
fi

# Check for Node
if ! command -v node &>/dev/null; then
    echo "ERROR: Node.js is not installed."
    echo "Install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

# Create Python venv if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv .venv
fi

# Install Python dependencies
echo "Installing Python dependencies..."
source .venv/bin/activate
pip install -q -r backend/requirements.txt

# Install Node dependencies
if [ ! -d "node_modules" ]; then
    echo "Installing Node dependencies..."
    npm install
fi

echo
echo "Starting backend on http://localhost:8000 ..."
python -m uvicorn backend.main:app --reload --port 8000 &
BACKEND_PID=$!

sleep 2

echo "Starting frontend on http://localhost:5173 ..."
npm run dev &
FRONTEND_PID=$!

echo
echo "============================================"
echo "  App running at http://localhost:5173"
echo "  Press Ctrl+C to stop both servers."
echo "============================================"

# Trap Ctrl+C to kill both processes
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
