# LLLMao - Local Large Language Model Assistant Orchestrator

Linux-native Local AI Workstation Platform

LLLMao is a local-first AI workstation platform designed for Linux power users, developers, researchers, and workstation environments.

Built around Ollama and a native Tauri desktop runtime, LLLMao combines multimodal AI interaction, workspace-aware retrieval, telemetry, orchestration-aware runtime management, and offline-first workflows into a single desktop experience.

---

# Current Status

## v1Janus-Beta

⚠️ IMPORTANT

This version is currently:

* unstable
* under active development
* experimental
* intended for beta testing and workstation validation

You may encounter:

* runtime bugs
* packaging issues
* voice pipeline inconsistencies
* orchestration edge cases
* UI regressions
* Linux environment compatibility issues

This repository is evolving rapidly.

---

# Core Features

* Native Linux desktop application (Tauri)
* Ollama local model integration
* Workspace-aware Retrieval-Augmented Generation (RAG)
* Multimodal image support
* Voice interaction (STT + TTS)
* Runtime orchestration engine
* Live telemetry dashboard
* OLED-inspired workstation UI
* External SSD workspace indexing
* Offline-first AI workflows
* Local model execution
* Linux-native workflow optimization

---

# Architecture

LLLMao currently consists of:

* Frontend: React + Vite + Tauri
* Backend: FastAPI
* Runtime AI: Ollama
* Vector Storage: ChromaDB
* Voice Stack:

  * faster-whisper
  * Piper TTS
* Local orchestration + telemetry systems

---

# Installation

## Requirements

Recommended:

* Ubuntu 24.04+
* NVIDIA GPU
* Ollama installed locally
* 16GB+ RAM
* SSD storage for model/runtime workloads

---

## Install Ollama

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

Start Ollama:

```bash
ollama serve
```

Pull a model:

```bash
ollama pull qwen2.5-coder:7b
```

---

# Development

## Backend

```bash
cd backend

python3 -m venv venv

source venv/bin/activate

pip install -r requirements.txt

uvicorn app.main:app --reload
```

---

## Frontend

```bash
cd frontend

pnpm install

pnpm tauri dev
```

---

# Snap Package

LLLMao is being prepared for Snap distribution and Ubuntu App Center deployment.

Current builds are experimental beta builds.

---

# Planned Areas of Improvement

* Runtime stability
* Better onboarding
* Improved voice interaction reliability
* More resilient orchestration
* Expanded multimodal workflows
* AppImage + DEB packaging
* Advanced workspace tooling
* Multi-agent systems
* Better Linux environment compatibility
* Improved diagnostics and recovery tooling

---

# Philosophy

LLLMao is designed around:

* local-first AI
* Linux-native workflows
* developer-oriented ergonomics
* offline capability
* workstation-grade runtime visibility
* orchestration-aware resource management

The goal is not simply to provide a chat interface, but to evolve toward a full local AI workstation environment.

---

# Warning

This project is currently experimental.

Do not rely on it for:

* production-critical workflows
* sensitive enterprise deployments
* unattended runtime environments

Always validate outputs and maintain backups of important data.

---

# License

MIT License
