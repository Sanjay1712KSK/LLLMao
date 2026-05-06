# LLLMao

**Local Lightweight Language Model Assistant Orchestrator**

LLLMao is a lightweight local-first AI workspace for conversational AI, RAG workflows, semantic workspace indexing, and multimodal development assistance powered entirely by locally installed [Ollama](https://ollama.com?utm_source=chatgpt.com) models.

Designed primarily for:

* Linux power users
* robotics developers
* ROS2 workflows
* Isaac Sim workflows
* privacy-focused local AI environments

LLLMao provides a modern ChatGPT-style experience while remaining:

* fully offline
* GPU-vendor agnostic
* lightweight
* Linux-native
* modular and extensible

---

# Core Philosophy

LLLMao is **NOT**:

* a hosted AI platform
* a cloud inference service
* a model distributor
* a proprietary model provider

LLLMao is:

* a local AI workspace
* a UI/orchestration layer
* a developer-focused local AI environment

The application connects only to already-installed local Ollama models through the Ollama REST API.

---

# Features

## Conversational AI

* ChatGPT-style interface
* Streaming responses
* Multi-chat sessions
* Persistent chat history
* Markdown rendering
* Syntax-highlighted code blocks

---

## Local Model Integration

* Dynamic Ollama model detection
* Runtime model switching
* Offline-only inference
* Lightweight architecture

Supported local models include:

* `llama3:8b`
* `qwen2.5-coder:14b`
* `tinyllama`
* `llava`
* `nomic-embed-text`

---

## RAG Workflows

* PDF uploads
* Markdown/TXT/DOCX support
* Semantic chunking
* ChromaDB vector storage
* Context-aware retrieval
* Knowledge base management

---

## Workspace Intelligence

* ROS2 workspace indexing
* Semantic code chunking
* Recursive file indexing
* File watching and auto-reindexing
* Workspace-aware contextual chat
* Hybrid retrieval system

---

## Multimodal Support

* Image uploads
* Screenshot analysis
* Diagram interpretation
* Workspace-aware visual reasoning
* Isaac Sim screenshot workflows

---

## System Monitoring

* GPU usage monitoring
* VRAM monitoring
* CPU/RAM monitoring
* Active model tracking
* Ollama health monitoring

---

# Architecture

```text id="5s4mkn"
Frontend (React + Tailwind)
            ↓
      Tauri Desktop Layer
            ↓
      FastAPI Backend
            ↓
        Ollama API
            ↓
   Local Ollama Models
```

---

# Tech Stack

## Frontend

* React
* Vite
* Tailwind CSS
* Zustand

---

## Backend

* FastAPI
* SQLite
* ChromaDB

---

## Desktop Layer

* Tauri

---

## AI Runtime

* Ollama

---

# Design Goals

LLLMao is designed to:

* remain lightweight
* work fully offline
* avoid cloud dependencies
* remain GPU-vendor agnostic
* coexist with heavy robotics workloads
* support large workspaces efficiently
* feel native on Linux

---

# GPU Compatibility

LLLMao itself contains no vendor-specific inference logic.

Inference occurs exclusively through Ollama, enabling compatibility with:

* NVIDIA GPUs
* AMD GPUs
* CPU-only systems

---

# Supported Platforms

Primary target:

* Ubuntu Linux

Planned distribution targets:

* `.deb`
* Snap Store
* future Linux repository packaging

---

# Installation

## 1. Install Ollama

Visit:

[Ollama Installation Guide](https://ollama.com/download/linux?utm_source=chatgpt.com)

---

## 2. Pull Local Models

Example:

```bash id="9q4ltn"
ollama pull llama3:8b
ollama pull qwen2.5-coder:14b
ollama pull nomic-embed-text
ollama pull llava
```

---

## 3. Clone Repository

```bash id="x2m8qc"
git clone https://github.com/YOUR_USERNAME/lllmao.git
cd lllmao
```

---

## 4. Start Backend

```bash id="c7n4vw"
cd backend

python3 -m venv venv
source venv/bin/activate

pip install -r requirements.txt

uvicorn main:app --reload
```

---

## 5. Start Frontend

```bash id="f5k9pb"
cd frontend

npm install
npm run dev
```

---

# Project Structure

```text id="u8r3mx"
lllmao/
├── frontend/
├── backend/
├── database/
├── docs/
├── screenshots/
├── tauri/
├── README.md
└── LICENSE
```

---

# Current Development Status

Implemented:

* conversational chat
* streaming responses
* RAG foundation
* workspace indexing
* multimodal workflows
* semantic retrieval
* system monitoring

In progress:

* advanced memory systems
* IDE integrations
* packaging/distribution
* production hardening

---

# Roadmap

## Planned Features

* VS Code integration
* advanced retrieval memory
* Linux packaging
* Snap Store distribution
* plugin architecture
* retrieval inspection tools
* advanced prompt orchestration

---

# License

This project is licensed under the PolyForm Project Strict License 1.0.0.

Commercial use, redistribution, and derivative works are prohibited without explicit permission from the author.

See the `LICENSE` file for full details.

---

# Important Notes

LLLMao:

* does not distribute AI models
* does not perform remote inference
* does not include telemetry
* does not require cloud services

Users are responsible for installing and managing their own local Ollama models.

---

# Vision

LLLMao aims to become a professional local AI workspace optimized for:

* developers
* robotics engineers
* ROS2 workflows
* Isaac Sim workflows
* privacy-focused AI usage
* offline development environments

with a strong focus on:

* local inference
* semantic retrieval
* workspace awareness
* multimodal interaction
* Linux-native performance.
