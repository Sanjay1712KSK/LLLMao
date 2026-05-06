# Backend

FastAPI service for the local desktop workspace.

The backend only talks to a locally running Ollama instance at `http://localhost:11434`.
It does not install, download, bundle, or manage model files.

## Development

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The SQLite database defaults to `../database/workspace.sqlite3`.
