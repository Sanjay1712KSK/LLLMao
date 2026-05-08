# FAQ - Frequently Asked Questions

Common questions about LLLMao.

## General Questions

### What is LLLMao?
LLLMao (Local Large Language Model Assistant Orchestrator) is a privacy-first, offline AI workstation for Linux. It connects to local Ollama models and provides a ChatGPT-like interface with semantic search, workspace indexing, and multimodal capabilities.

### What does the internal name "Project-Tony-Stank" mean?
Project-Tony-Stank was the internal development codename for LLLMao during early development phases.

### Is LLLMao free?
Yes, LLLMao is open-source under the PolyForm Strict License. It's free for non-commercial use, personal projects, and organizational use by non-profits and educational institutions.

### Can I use LLLMao commercially?
Commercial use requires explicit permission from the author. See the LICENSE file for details.

### What is "Janus v1.0"?
Janus is the Roman god of beginnings and endings, and looking both past and future. Janus v1.0 is the upcoming production-ready release that will be distributed via snap packages. It represents looking back at workspace history and forward with AI predictions.

---

## Installation & Setup

### Do I need an internet connection?
No. LLLMao works completely offline. Ollama serves models locally on `localhost:11434`.

### Do I need a GPU?
No, but a GPU (NVIDIA or AMD) significantly speeds up inference. CPU-only mode is supported but slower.

### Which Linux distributions are supported?
Currently: Ubuntu 20.04, 22.04, 24.04
Planned: Fedora, Debian, Arch, and snap packages

### How much disk space does LLLMao need?
- LLLMao itself: ~200MB
- Each model: 4-50GB (varies by model)
- Workspace indexing: Depends on workspace size
- Total: Start with 20GB free space

### Can I run LLLMao on Windows or macOS?
LLLMao is Linux-native. Windows/macOS support is not planned.

---

## Models & Inference

### What models can I use?
Any model available through Ollama:
- `llama3:8b` - General purpose (recommended start)
- `qwen2.5-coder:14b` - Code focused
- `llava` - Vision/multimodal
- `tinyllama` - Lightweight
- `mistral`, `neural-chat`, etc.

Visit [Ollama library](https://ollama.ai/library) for full list.

### Can I use models from Hugging Face?
Not directly. You need to convert them to Ollama format or have them available as GGUF files, then import through Ollama.

### How long does model inference take?
Depends on:
- Model size
- GPU availability
- Input length
- System load

Typical: 5-30 tokens/second on GPU, 1-5 tokens/second on CPU

### Can I run multiple models simultaneously?
Yes, but they'll share VRAM. LLLMao orchestrates this through coexistence modes to prevent OOM errors.

### How do I improve response quality?
- Use larger models if VRAM allows
- Provide better context/prompts
- Use RAG to augment with relevant documents
- Fine-tune prompts for your use case

---

## RAG & Document Management

### What document formats are supported?
- PDF (.pdf)
- Markdown (.md)
- Plain text (.txt)
- Word (.docx)

### How large can documents be?
Depends on available VRAM. Typical limit is 100MB per document before indexing.

### How does semantic search work?
Documents are split into chunks, embedded using `nomic-embed-text`, stored in ChromaDB, and retrieved based on semantic similarity to your query.

### Can I delete indexed documents?
Yes, in the UI. Click the document and select "Delete". It removes from ChromaDB and metadata.

### How accurate is RAG?
Accuracy depends on:
- Document quality and clarity
- Chunk size and overlap
- Query formulation
- Model quality

Generally very good for specific information retrieval.

---

## Workspace Indexing

### What is workspace indexing?
LLLMao scans your directory (ROS2 workspace, project folder, etc.), analyzes code semantics, and makes it searchable for context-aware chat.

### Does indexing affect performance?
Initial indexing can be CPU-intensive. It uses background workers to minimize impact. Subsequent re-indexing is incremental.

### Can I exclude certain directories?
Yes, create a `.lllmaoignore` file in your workspace root, similar to `.gitignore`.

### Does LLLMao modify my files?
No. It only reads and analyzes. Your files remain untouched.

---

## Multimodal & Audio

### Which multimodal models are supported?
- `llava` - Image understanding
- `llava-phi` - Lightweight vision

Add others as long as Ollama supports them.

### Can I analyze screenshots?
Yes. Upload or drag-drop screenshot images. LLLMao with llava can analyze diagrams, UI, code screenshots, etc.

### Does audio processing require internet?
No. Whisper (speech-to-text) and Piper (text-to-speech) both run locally.

### What languages does speech recognition support?
Whisper supports 99+ languages. Configure in settings.

---

## Performance & Optimization

### Why is LLLMao slow?
Check:
- GPU is being used (check with `nvidia-smi`)
- Model size appropriate for your hardware
- System resources available
- Background processes consuming resources

### How do I check resource usage?
LLLMao shows live metrics in the system monitor widget. Also check:
```bash
nvidia-smi          # GPU usage
top / htop          # CPU/Memory
ollama list         # Active models
```

### Can I reduce memory usage?
- Use smaller models
- Reduce context window size
- Enable CPU-only mode
- Reduce concurrent workloads

---

## Developer Tools

### Can I access a terminal in LLLMao?
Yes, developer tools include an embedded terminal for Git operations and command execution (configurable whitelist).

### Is terminal command execution safe?
Terminal commands run as your user. LLLMao enforces a whitelist of allowed commands for safety.

### Can I integrate custom tools?
Yes, developer tools are modular. See development guide for extending.

---

## Troubleshooting

### LLLMao won't connect to Ollama
```bash
# Check Ollama running
curl http://localhost:11434/api/tags

# Check port 11434 is listening
netstat -tuln | grep 11434

# Restart Ollama
ollama serve
```

### Chat is very slow
- Check GPU utilization
- Try smaller model
- Check system load
- Verify network latency (curl tests)

### Indexed documents not showing in search
- Verify upload successful (check database)
- Try re-indexing
- Check ChromaDB is initialized
- Verify embedding model is running

### Frontend won't load
- Check backend running (`curl http://127.0.0.1:8000/docs`)
- Check frontend dev server running
- Clear browser cache
- Try different browser

### Backend crashes on startup
- Check Python version (3.10+)
- Verify dependencies installed
- Check database file not corrupted
- Review logs for errors

---

## Roadmap & Future

### When is Janus v1.0 coming?
Coming soon. Snap packages will enable one-click installation.

### What features are planned?
See the [Janus v1.0 Roadmap](./Janus-v1.0-Roadmap) for details.

### Can I contribute?
Yes! See [Contributing Guide](./Contributing-Guide) for guidelines.

### Will LLLMao support Windows/macOS?
No plans currently. Focus is Linux-native.

### Will there be cloud features?
No. LLLMao is offline-first by design. No plans for cloud services.

---

## Getting Help

### Something isn't working
1. Check the [Troubleshooting](./Troubleshooting) guide
2. Review logs for error messages
3. Open a [GitHub Issue](https://github.com/Sanjay1712KSK/LLLMao/issues)
4. Ask in [Discussions](https://github.com/Sanjay1712KSK/LLLMao/discussions)

### I have a feature request
Open a [GitHub Discussion](https://github.com/Sanjay1712KSK/LLLMao/discussions) or [Issue](https://github.com/Sanjay1712KSK/LLLMao/issues).

### How do I report a bug?
File a [GitHub Issue](https://github.com/Sanjay1712KSK/LLLMao/issues) with:
- What you were trying to do
- What happened
- Expected behavior
- System info (OS, GPU, model, etc.)
- Error logs

---

**Last Updated:** 2026-05-08
