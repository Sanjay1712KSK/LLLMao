# LLLMao - Local Large Language Model Assistant Orchestrator (Currently in development)

**A lightweight Linux-native local AI workstation platform**

*Internal codename: Project-Tony-Stank*

---

## Quick Overview

LLLMao is a professional-grade, privacy-first AI assistant for developers, robotics engineers, and power users. It provides a ChatGPT-style interface while remaining entirely offline, GPU-vendor agnostic, and modular.

The application connects exclusively to locally-installed Ollama models through the Ollama REST API. No cloud services. No model downloads. No telemetry.

**Language Composition:** Python 64.4% | TypeScript 35.1% | Other 0.5%

---

## Core Philosophy

LLLMao is **NOT**:
- A hosted AI platform
- A cloud inference service  
- A model distributor
- A proprietary model provider

LLLMao **IS**:
- A local AI workspace
- A UI/orchestration layer
- A developer-focused workstation environment
- Fully offline and privacy-preserving

---

## Primary Use Cases

Designed for:
- Linux power users and developers
- Robotics developers and ROS2 workflows
- Isaac Sim simulation environments
- Privacy-focused local AI development
- Large workspace indexing and semantic search

---

## Key Features

### Conversational AI
- ChatGPT-style interface with streaming responses
- Multi-chat sessions with persistent history
- Markdown rendering with syntax-highlighted code blocks
- Context-aware conversation management

### Local Model Integration
- Dynamic Ollama model detection and runtime switching
- Offline-only inference (no cloud fallback)
- Lightweight architecture compatible with heavy workloads
- Support for models: `llama3:8b`, `qwen2.5-coder:14b`, `tinyllama`, `llava`, `nomic-embed-text`

### Semantic RAG (Retrieval-Augmented Generation)
- PDF, Markdown, TXT, and DOCX document uploads
- Semantic document chunking
- ChromaDB vector storage and retrieval
- Context-aware knowledge base management
- Hybrid retrieval system

### Workspace Intelligence
- ROS2 workspace semantic indexing
- Recursive file indexing with workspace awareness
- File watching and automatic re-indexing
- Workspace-aware contextual chat
- Semantic code chunking for large codebases

### Multimodal Support
- Image uploads and analysis
- Screenshot processing
- Diagram interpretation
- Workspace-aware visual reasoning
- Isaac Sim screenshot workflows

### System Monitoring
- GPU and VRAM usage tracking
- CPU and RAM monitoring
- Active model and Ollama health tracking
- Real-time performance metrics

### Developer Tools
- Git integration workflows
- Embedded terminal
- Runtime orchestration
- Coexistence mode support for heavy workloads

### Audio Processing
- Speech-to-text (Faster-Whisper)
- Text-to-speech (Piper TTS)
- Audio file support with waveform visualization

---

## Tech Stack

**Frontend:**
- React 18 with TypeScript
- Vite (fast build tool)
- Tailwind CSS (styling)
- Zustand (state management)
- React Markdown with syntax highlighting
- Lucide React (icons)

**Backend:**
- FastAPI 0.115+ (API framework)
- SQLAlchemy 2.0+ (ORM)
- Pydantic 2.12+ (data validation)
- ChromaDB 1.3+ (vector database)
- SQLite (persistent storage)

**Desktop Layer:**
- Tauri (lightweight, secure desktop framework)
- Rust-based with sandboxed JavaScript

**AI Runtime:**
- Ollama (local inference engine)
- GPU acceleration (NVIDIA/AMD/CPU)

**Additional Libraries:**
- PyPDF, python-docx (document processing)
- Watchdog (file monitoring)
- Psutil, pynvml (system monitoring)
- Faster-Whisper (speech recognition)
- Piper TTS (text-to-speech)
- Pillow (image processing)

---

## Architecture

```
Frontend (React + TypeScript + Tailwind)
              |
         Tauri Desktop Layer (Rust)
              |
         FastAPI Backend
              |
          Ollama API
              |
    Local Ollama Models
```

---

## Project Structure

```
lllmao/
├── backend/
│   ├── app/
│   │   ├── audio/              # Speech recognition & TTS
│   │   ├── database/           # ORM models & migrations
│   │   ├── developer_tools/    # Git & terminal integration
│   │   ├── memory/             # Persistent memory systems
│   │   ├── models/             # Pydantic data models
│   │   ├── multimodal/         # Image & video processing
│   │   ├── orchestration/      # Runtime orchestration
│   │   ├── rag/                # Retrieval-augmented generation
│   │   ├── routers/            # API endpoints
│   │   ├── schemas/            # Request/response schemas
│   │   ├── services/           # Business logic
│   │   ├── workspace/          # Workspace indexing
│   │   ├── config.py           # Configuration
│   │   └── main.py             # FastAPI app entry
│   ├── requirements.txt        # Python dependencies
│   ├── test_upload.py          # Upload testing
│   └── README.md
├── frontend/
│   ├── src/                    # React components & logic
│   ├── package.json            # Node dependencies
│   ├── vite.config.ts          # Vite configuration
│   ├── tailwind.config.js      # Tailwind styling
│   └── tsconfig.json           # TypeScript configuration
├── tauri/
│   ├── src/                    # Rust Tauri code
│   ├── Cargo.toml              # Rust dependencies
│   ├── tauri.conf.json         # Tauri configuration
│   └── build.rs
├── database/                   # SQLite runtime files
├── docs/                       # Documentation
├── images/                     # Screenshots & assets
├── snap/                       # Snap package configuration
├── LICENSE                     # PolyForm Strict License
└── README.md
```

---

## Development Status

### Implemented (Phases 1-9)
- Conversational chat with streaming
- Persistent chat history
- RAG foundation with ChromaDB
- Semantic workspace indexing
- Multimodal workflows
- System monitoring dashboard
- Developer tooling integration
- Runtime orchestration & coexistence modes
- Linux packaging preparation

### Currently in Progress (Phase 10)
- Production hardening and stability
- Crash recovery system
- Database migration framework
- Comprehensive diagnostics
- Settings system
- Onboarding wizard
- Production logging
- Test suite implementation
- Performance profiling

---

## Versioning & Release

### Current Version: 0.x (Development)

### Upcoming: Janus Version (v1.0)

**Why "Janus"?**

Janus is the Roman god of beginnings and endings, transitions and time. He looks both backward to the past and forward to the future—traditionally depicted with two faces.

LLLMao with local model inference embodies this duality:
- **Looking to the Past:** Workspace indexing, semantic search, and context retrieval from existing codebases and documents
- **Looking to the Future:** Real-time AI-powered predictions, recommendations, and forward-thinking code generation

The Janus release represents the transition of LLLMao from experimental prototype to production-ready workstation tool.

**Release Target:** v1.0 Janus
- Planned distribution: Snap packages (snapd)
- Platform: Linux (Ubuntu, Fedora, Debian, Arch-compatible)
- Status: Coming soon
- Channel: Stable release

---

## Installation

### Prerequisites

1. **Ollama installed and running**
   - Download: [Ollama for Linux](https://ollama.com/download/linux)
   - Verify: `curl http://localhost:11434/api/tags`

2. **Node.js 18+**
   - Check: `node --version`

3. **Python 3.10+**
   - Check: `python3 --version`

### Quick Start (Development)

#### 1. Clone Repository

```bash
git clone https://github.com/Sanjay1712KSK/LLLMao.git
cd LLLMao
```

#### 2. Pull Local Models

```bash
ollama pull llama3:8b
ollama pull nomic-embed-text
ollama pull qwen2.5-coder:14b
ollama pull llava
```

#### 3. Start Backend

```bash
cd backend

python3 -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt

uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Backend will be available at `http://127.0.0.1:8000`

#### 4. Start Frontend (in new terminal)

```bash
cd frontend

npm install

npm run dev
```

Frontend will be available at `http://127.0.0.1:1420`

---

## Platform Support

### Current (Development)
- Ubuntu Linux (20.04 LTS, 22.04 LTS, 24.04 LTS)

### Planned (Janus v1.0)
- Fedora Linux
- Debian Linux
- Arch Linux (AUR)
- Snap packages (primary distribution)

### GPU Support
LLLMao itself contains no vendor-specific inference code. Inference occurs entirely through Ollama:
- NVIDIA GPUs (CUDA optimized)
- AMD GPUs (ROCm compatible)
- CPU-only systems (universal fallback)

---

## Design Goals

LLLMao is architected to:
- Remain lightweight and responsive
- Work fully offline without internet
- Avoid all cloud dependencies
- Maintain GPU-vendor agnosticism
- Coexist with heavy robotics workloads
- Support large workspaces efficiently
- Feel native on Linux
- Preserve user privacy
- Remain modular and extensible

---

## Privacy & Security

LLLMao is designed with privacy as a core principle:

- **Offline-first:** All processing occurs locally. No data leaves your machine.
- **Telemetry-free:** No analytics, tracking, or remote telemetry by default.
- **No cloud dependencies:** Works without internet connection.
- **Local-only inference:** Connects only to your local Ollama instance.
- **No automatic updates:** You control all model and software updates.
- **Transparent data:** All indexed data stored locally in SQLite and ChromaDB.

---

## License

Licensed under the **PolyForm Strict License 1.0.0**

This license permits:
- Non-commercial use
- Personal research, experimentation, and testing
- Use by charitable, educational, and research organizations
- Non-commercial modifications

This license prohibits:
- Commercial use without permission
- Redistribution of the software
- Derivative works for commercial purposes

See the `LICENSE` file for complete details.

---

## Future Enhancements

Coming in future releases:

---

## Contributing

LLLMao welcomes contributions from the community, particularly:
- Bug fixes and stability improvements
- Documentation and user guides
- Testing and stress testing
- Linux packaging improvements
- Backend optimizations

Before contributing, please:
1. Review the Phase 10 documentation in `phase10.txt`
2. Ensure changes maintain offline-first principles
3. Avoid cloud dependencies
4. Test locally with Ollama

---

## Troubleshooting

### Ollama Not Detected
```bash
# Verify Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama if needed
ollama serve
```

### Backend Connection Issues
```bash
# Check backend is running
curl http://127.0.0.1:8000/api/health

# Verify backend logs for errors
# Backend runs on http://127.0.0.1:8000
```

### Frontend Not Loading
```bash
# Ensure frontend dev server is running
# Frontend runs on http://127.0.0.1:1420
# Check browser console for errors
```

### Model Performance Issues
- Check GPU utilization: `nvidia-smi` (NVIDIA) or `rocm-smi` (AMD)
- Verify VRAM availability
- Consider using smaller models (`tinyllama`, `neural-chat`)
- Check system load with `top` or `htop`

---

## Support & Contact

For issues, questions, or feedback:
- GitHub Issues: [LLLMao Issues](https://github.com/Sanjay1712KSK/LLLMao/issues)
- Repository: [github.com/Sanjay1712KSK/LLLMao](https://github.com/Sanjay1712KSK/LLLMao)

---

## Acknowledgments

LLLMao is built with:
- [Ollama](https://ollama.com) - Local inference engine
- [FastAPI](https://fastapi.tiangolo.com) - Modern Python backend framework
- [React](https://react.dev) - Frontend library
- [Tauri](https://tauri.app) - Lightweight desktop framework
- [ChromaDB](https://www.trychroma.com) - Vector database
- [Whisper](https://openai.com/research/whisper) - Speech recognition
- [Piper](https://github.com/rhasspy/piper) - Text-to-speech

---

## Vision

LLLMao aspires to become the go-to professional local AI workspace for:
- Developers building AI-enhanced tools
- Robotics engineers working with ROS2
- Researchers requiring offline, privacy-preserving AI
- Organizations prioritizing data sovereignty
- Linux power users seeking intelligent workspace integration

With deep focus on:
- Local inference and privacy
- Semantic retrieval and indexing
- Workspace awareness and context
- Multimodal interaction
- Linux-native performance and usability
- Long-term stability and maintainability
