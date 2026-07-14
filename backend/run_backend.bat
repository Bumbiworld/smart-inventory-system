@echo off
cd /d "%~dp0"

if not exist env\Scripts\activate (
    echo Dang tao moi truong ao...
    python -m venv env
)

call env\Scripts\activate

pip install -r requirements.txt >nul 2>&1

python init_db.py

uvicorn app.main:app --host 0.0.0.0 --port 8000