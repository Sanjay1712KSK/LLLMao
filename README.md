# MyOwnRTXChat

A lightweight Linux-native local AI workspace for already-installed Ollama models.

Phase 1 provides a ChatGPT-style desktop-ready foundation with React, Vite, Tailwind CSS, Zustand, FastAPI, SQLite, and a Tauri-ready shell.

## Product Boundary

This application is only a local UI/workspace layer for Ollama.

It does not:

- install models
- download models
- bundle model weights
- redistribute models
- manage model files
- perform cloud inference

It does:

- connect to locally running Ollama through `http://localhost:11434`
- detect already-installed local models
- provide persistent local chat sessions
- operate offline

## Project Structure

```text
.
├── backend/       FastAPI API, Ollama integration, SQLite persistence
├── database/      Runtime SQLite location for development
├── docs/          Architecture and packaging notes
├── frontend/      React, Vite, Tailwind CSS, Zustand UI
├── screenshots/   Placeholder for future release screenshots
├── tauri/         Tauri desktop shell configuration
├── LICENSE
└── README.md
```

## Run Locally

Start Ollama separately and make sure it is serving at `http://localhost:11434`.

Backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:1420`.

Tauri shell, after frontend dependencies are installed:

```bash
cd tauri
npm install
npm run dev
```

## API

- `GET /health`: verifies local Ollama availability
- `GET /models`: returns installed Ollama models
- `GET /chats`: returns saved chats
- `POST /chats`: creates a chat
- `PATCH /chats/{chat_id}`: renames a chat
- `DELETE /chats/{chat_id}`: deletes a chat
- `GET /messages/{chat_id}`: returns messages for a chat
- `POST /chat`: streams a response from the selected local model

## License

This project is licensed under the PolyForm Strict License 1.0.0. See [LICENSE](LICENSE).
