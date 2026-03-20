@echo off
echo ============================================
echo   Interactive LP UI - Local Setup
echo ============================================
echo.

:: Check for Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed or not on PATH.
    echo Install Python 3.10+ from https://www.python.org/downloads/
    pause
    exit /b 1
)

:: Check for Node
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not on PATH.
    echo Install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)

:: Create Python venv if it doesn't exist
if not exist ".venv" (
    echo Creating Python virtual environment...
    python -m venv .venv
)

:: Install Python dependencies
echo Installing Python dependencies...
call .venv\Scripts\activate
pip install -q -r backend\requirements.txt

:: Install Node dependencies
if not exist "node_modules" (
    echo Installing Node dependencies...
    call npm install
)

echo.
echo Starting backend on http://localhost:8000 ...
start "LP Backend" cmd /k ".venv\Scripts\activate && python -m uvicorn backend.main:app --reload --port 8000"

:: Brief pause so backend starts before frontend
timeout /t 2 /nobreak >nul

echo Starting frontend on http://localhost:5173 ...
start "LP Frontend" cmd /k "npm run dev"

echo.
echo ============================================
echo   App running at http://localhost:5173
echo   Close both terminal windows to stop.
echo ============================================
pause
