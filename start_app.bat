@echo off
title AI NoteMaker Pro
cd /d "%~dp0"

echo ============================================================
echo               AI NoteMaker - Starting App...
echo ============================================================
echo.
echo Launching server and opening your browser at http://127.0.0.1:8000/
echo (Press Ctrl+C in this window anytime to stop the server)
echo.

:: Automatically open browser after 1.5 seconds
start /b powershell -Command "Start-Sleep -Milliseconds 1500; Start-Process 'http://127.0.0.1:8000/'"

:: Run the application
python run.py

if %ERRORLEVEL% neq 0 (
    echo.
    echo Application exited with an error.
    pause
)
