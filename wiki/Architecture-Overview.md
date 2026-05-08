# Architecture Overview

Technical deep-dive into LLLMao's architecture.

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Frontend (React)                       │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Components: Chat, RAG, Workspace, Multimodal, etc  │ │
│  │ State: Zustand store                               │ │
│  │ Styling: Tailwind CSS                              │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────────┘
                       │ REST/WebSocket
        ┌──────────────┴──────────────┐
        │                             │
┌───────▼──────────────┐   ┌──────────▼──────────────┐
│   Tauri Desktop      │   │   Browser (Dev)        │
│   (Production)       │   │   (Development)        │
└───────┬──────────────┘   └──────────┬──────────────┘
        │                             │
        └──────────────┬──────────────┘
                       │ HTTP:8000
┌──────────────────────▼──────────────────────────────────┐
│              FastAPI Backend (Python)                    │
│ ┌────────────────────────────────────────────────────┐ │
│ │ Routers:                                           │ │
│ │  - Chat API            - RAG API                   │ │
│ │  - Workspace API       - Multimodal API           │ │
│ │  - Audio API           - System Monitor API       │ │
│ │  - Settings API        - Developer Tools API      │ │
│ └────────────────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────────────────┐ │
│ │ Services Layer:                                    │ │
│ │  - Chat Management     - RAG Pipeline             │ │
│ │  - Workspace Indexing  - Multimodal Processing    │ │
│ │  - Memory Systems      - Orchestration            │ │
│ │  - Audio Processing    - Runtime Management       │ │
│ └────────────────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────────────────┐ │
│ │ Data Layer:                                        │ │
│ │  - SQLAlchemy ORM      - Schemas & Models         │ │
│ │  - ChromaDB Interface  - Cache Layers             │ │
│ └────────────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────────┘
                       │ localhost:11434
        ┌──────────────┴──────────────┐
        │                             │
┌───────▼──────────┐     ┌────────────▼─────────┐
│  Ollama API      │     │  ChromaDB Vector DB  │
└───────┬──────────┘     └──────────┬───────────┘
        │                          │
┌───────▼──────────────────────────▼───────────┐
│   Local Models (GGUF Format)                 │
│  - llama3:8b                                 │
│  - qwen2.5-coder:14b                         │
│  - llava (vision)                            │
│  - nomic-embed-text (embeddings)             │
│  - Custom models via Ollama                  │
└────────────────────────────────────────────┘
```

---

## Backend Module Structure

### 1. `routers/` - API Endpoints

FastAPI route handlers for HTTP endpoints.

**Files:**
- `chat_router.py` - Chat message handling
- `rag_router.py` - Document upload and retrieval
- `workspace_router.py` - Workspace indexing
- `multimodal_router.py` - Image processing
- `audio_router.py` - Speech and TTS
- `system_router.py` - Monitoring
- `developer_router.py` - Developer tools
- `settings_router.py` - Configuration

### 2. `services/` - Business Logic

Core service implementations.

**Files:**
- `chat_service.py` - Conversation management
- `rag_service.py` - Document retrieval pipeline
- `workspace_service.py` - Workspace analysis
- `multimodal_service.py` - Image reasoning
- `audio_service.py` - Audio processing (Whisper, Piper)
- `ollama_service.py` - Ollama integration
- `monitoring_service.py` - System metrics
- `orchestration_service.py` - Runtime management

### 3. `models/` - Database Models

SQLAlchemy ORM models.

**Files:**
- `chat_models.py` - Chat and message tables
- `document_models.py` - RAG document metadata
- `workspace_models.py` - Workspace index data
- `settings_models.py` - User settings storage
- `memory_models.py` - Persistent memory

### 4. `rag/` - Retrieval-Augmented Generation

Document processing and semantic search.

**Components:**
- `document_processor.py` - PDF, DOCX parsing
- `chunker.py` - Semantic text chunking
- `embedder.py` - ChromaDB integration
- `retriever.py` - Similarity search
- `indexer.py` - Workspace indexing

**Pipeline:**
```
Document → Parse → Chunk → Embed → Store (ChromaDB) → Retrieve → Augment
```

### 5. `workspace/` - Workspace Intelligence

Codebase semantic analysis.

**Components:**
- `scanner.py` - Recursive file crawling
- `analyzer.py` - Code parsing and semantics
- `indexer.py` - Vector indexing
- `watcher.py` - File change monitoring
- `retriever.py` - Workspace-aware search

### 6. `orchestration/` - Runtime Management

Manages model loading, VRAM, and coexistence.

**Components:**
- `orchestrator.py` - Model switching
- `vram_monitor.py` - Memory tracking
- `scheduler.py` - Workload distribution
- `coexistence.py` - Heavy workload handling

### 7. `multimodal/` - Vision Processing

Image and screenshot analysis.

**Components:**
- `image_handler.py` - Image upload/processing
- `vision_service.py` - llava integration
- `diagram_analyzer.py` - Diagram interpretation

### 8. `audio/` - Speech Processing

Speech-to-text and text-to-speech.

**Components:**
- `whisper_service.py` - Speech recognition
- `piper_service.py` - Text-to-speech synthesis
- `audio_processor.py` - Audio file handling

### 9. `memory/` - Persistent Memory

Long-term conversation memory.

**Components:**
- `memory_manager.py` - Memory storage
- `retrieval_manager.py` - Memory retrieval
- `summarizer.py` - Summary generation

### 10. `database/` - Data Persistence

ORM and database management.

**Components:**
- `session.py` - SQLAlchemy session management
- `base.py` - Base model class
- `migrations/` - Schema migrations

### 11. `schemas/` - Data Validation

Pydantic request/response schemas.

**Files:**
- `chat_schemas.py`
- `rag_schemas.py`
- `workspace_schemas.py`
- `multimodal_schemas.py`

### 12. `developer_tools/` - Developer Integration

Git and terminal integration.

**Components:**
- `git_integration.py` - Git operations
- `terminal_service.py` - Command execution
- `project_analyzer.py` - Project structure

---

## Frontend Architecture

```
src/
├── components/
│   ├── Chat/              # Chat interface
│   ├── RAG/               # Document management
│   ├── Workspace/         # Workspace indexing UI
│   ├── Multimodal/        # Image upload
│   ├── Audio/             # Audio controls
│   ├── System/            # Monitoring display
│   └── Settings/          # Configuration UI
├── store/                 # Zustand state management
├── api/                   # API client
├── hooks/                 # Custom React hooks
├── utils/                 # Utility functions
├── styles/                # Tailwind configuration
└── types/                 # TypeScript types
```

---

## Data Flow

### Chat Message Flow

```
User Input
    ↓
Frontend Validation
    ↓
POST /api/chat/message
    ↓
ChatService.handle_message()
    ↓
Ollama Inference (streaming)
    ↓
WebSocket Stream to Frontend
    ↓
Save to Database
    ↓
Update UI
```

### RAG Retrieval Flow

```
User Query + Document
    ↓
RAG Router validates
    ↓
Split into chunks
    ↓
Embed query with nomic-embed-text
    ↓
ChromaDB similarity search
    ↓
Retrieve top-K chunks
    ↓
Augment LLM prompt
    ↓
Send to Ollama
    ↓
Stream response
```

### Workspace Indexing Flow

```
User selects workspace directory
    ↓
WorkspaceScanner recursively crawls
    ↓
Analyzer parses code semantics
    ↓
Chunker creates semantic chunks
    ↓
Embedder vectors via nomic-embed-text
    ↓
ChromaDB stores with metadata
    ↓
Watcher monitors file changes
    ↓
Auto-reindex on detection
```

---

## Storage Architecture

### Database (SQLite)

**Tables:**
- `chats` - Chat sessions
- `messages` - Chat messages
- `documents` - RAG documents metadata
- `chunks` - Document chunks
- `workspace_entries` - Indexed files
- `settings` - User configuration
- `memory_entries` - Long-term memory

**Location:** `database/workspace.sqlite3`

### Vector Database (ChromaDB)

**Collections:**
- `documents` - RAG embeddings
- `workspace` - Workspace code embeddings
- `memory` - Memory embeddings

**Engine:** Chromadb (in-process)

### File Storage

- `backend/uploads/` - Uploaded documents
- `backend/app/audio/cache/` - Audio files
- User's workspace directory - Indexed code

---

## API Endpoints

### Chat API

```
POST   /api/chat/message          # Send message
GET    /api/chat/history/{id}     # Get chat history
POST   /api/chat/new              # Create new chat
DELETE /api/chat/{id}             # Delete chat
```

### RAG API

```
POST   /api/rag/upload            # Upload document
GET    /api/rag/documents         # List documents
POST   /api/rag/search            # Semantic search
DELETE /api/rag/{doc_id}          # Delete document
```

### Workspace API

```
POST   /api/workspace/index       # Start indexing
GET    /api/workspace/status      # Indexing status
GET    /api/workspace/search      # Search indexed code
POST   /api/workspace/settings    # Configure
```

### System API

```
GET    /api/system/status         # Overall status
GET    /api/system/gpu            # GPU metrics
GET    /api/system/memory         # Memory usage
GET    /api/system/ollama         # Ollama health
```

---

## Technology Stack Details

### Backend
- **Framework**: FastAPI 0.115+
- **ORM**: SQLAlchemy 2.0+
- **Database**: SQLite 3
- **Vector DB**: ChromaDB 1.3+
- **Web Server**: Uvicorn
- **Validation**: Pydantic 2.12+
- **File Upload**: python-multipart

### Frontend
- **Framework**: React 18
- **State**: Zustand 5.0+
- **Styling**: Tailwind CSS 3.4+
- **Build**: Vite 6.0+
- **Markdown**: react-markdown 9.0+
- **Syntax Highlight**: highlight.js 11.11+
- **Icons**: Lucide React 0.468+

### Desktop
- **Framework**: Tauri (Rust)
- **Web View**: WebKit
- **IPC**: Tauri commands
- **Packaging**: Snap

---

## Deployment Architecture

### Development

```
Terminal 1: ollama serve (port 11434)
Terminal 2: uvicorn app.main:app --reload (port 8000)
Terminal 3: npm run dev (port 1420)
Browser: http://127.0.0.1:1420
```

### Production (Janus v1.0)

```
Snap Package
├── Python Runtime
├── Node.js Runtime
├── FastAPI Server
├── React Build (static)
├── Tauri Binary
└── Data Directory (~/.local/share/lllmao/)

Launch: snap run lllmao
```

---

## Scalability Considerations

### Current Constraints
- Single-machine only (no distributed setup)
- Limited by local VRAM
- Workspace size limited by embedding capacity
- Chat history in single SQLite file

### Future Scaling
- Multi-model orchestration
- Distributed indexing
- Archive older chats
- Database sharding options

---

## Security Architecture

- **IPC**: Local-only (no network)
- **Inference**: Local Ollama only
- **Storage**: Local filesystem
- **Permissions**: User-level access control
- **Terminal**: Whitelist-based command execution
- **Uploads**: Size and type validation

---

## Performance Optimization

- **Vector DB**: In-process ChromaDB (no network)
- **Caching**: Query results cached
- **Chunking**: Optimized chunk size
- **Streaming**: Response streaming to frontend
- **Workers**: Async background tasks
- **File Watching**: Efficient change detection

---

**Last Updated**: 2026-05-08
