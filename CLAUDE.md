# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Docker Operations
```bash
# Start all services in development mode
docker-compose up --build

# Start services in background
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Complete cleanup (including volumes)
docker-compose down -v && docker system prune -a
```

### Service URLs
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000  
- **Vector Database (Qdrant)**: http://localhost:6333

### Testing API Endpoints
```bash
# Health check
curl http://localhost:8000/health

# Test chat functionality
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "こんにちは"}'

# Add knowledge manually
curl -X POST http://localhost:8000/api/add_knowledge \
  -H "Content-Type: application/json" \
  -d '{"title": "Test", "content": "Test content"}'
```

## Architecture Overview

### System Components
This is a RAG (Retrieval-Augmented Generation) chatbot with three main services:

1. **Frontend Service** (`front/`): Static HTML/CSS/JS served via Nginx
   - Main chat interface (`index.html`)
   - File upload interface (`upload.html`) 
   - Documentation interface (`docs.html`)
   - iframe embedding support (`iframe-embed.html`)

2. **Backend Service** (`server/`): Flask API server
   - **AI Engine**: Google Gemini API integration with custom AI Agent class
   - **Vector Search**: Qdrant vector database for semantic search
   - **File Processing**: Supports TXT, PDF, DOCX, MD, JSON file upload and text extraction
   - **Knowledge Management**: Manual input, file upload, and URL scraping capabilities

3. **Vector Database**: Qdrant running in Docker
   - Collection: "chat_context"
   - Embedding model: `all-MiniLM-L6-v2` (384-dimensional vectors)
   - Stores knowledge base, chat history, and uploaded documents

### Key Backend Architecture Patterns

#### AI Agent System
The `AIAgent` class in `server/app.py:163-202` implements a thinking-based response system:
- Uses system prompts to maintain consistent personality
- Performs context-aware responses using retrieved information
- Falls back gracefully when no relevant context is found

#### Vector Search Flow
1. User query → embedding vector (via SentenceTransformer)
2. Semantic search in Qdrant (top 5 results, score > 0.6)
3. Context aggregation and AI response generation
4. Chat history stored back to vector database

#### File Processing Pipeline
- Multi-format support with dedicated extraction functions
- Temporary file handling with automatic cleanup
- Vector encoding and storage in Qdrant
- Error handling for malformed/protected files

### Environment Configuration
Required environment variables (see `.env.example`):
- `GEMINI_API_KEY`: Google Gemini API key for AI responses
- `FLASK_ENV`: Development/production mode
- `FLASK_APP`: Entry point (app.py)

### Frontend-Backend Integration
- CORS enabled for local development
- API base URL auto-detection based on hostname
- iframe postMessage support for embedding scenarios
- File upload with progress tracking and drag-and-drop

### Database Schema
Qdrant stores points with these payload structures:
- **Knowledge**: `{text, title, timestamp, type: "knowledge"}`
- **Chat History**: `{text, query, response, timestamp, type: "chat"}`  
- **File Uploads**: `{text, title, source: "file_upload", file_type, timestamp}`
- **URL Content**: `{text, title, source: "url_fetch", url, timestamp}`

### Error Handling Patterns
- Graceful degradation when Qdrant is unavailable
- Retry logic for database connections (5 attempts with backoff)
- Comprehensive file validation and error messaging
- API error responses with descriptive messages in Japanese

このシステムは、Gemini APIを活用した高性能なRAGチャットボットであり、Dockerコンテナで完全に動作します。フロントエンドはNginxで静的ファイルを提供し、バックエンドはFlaskでAPIを提供します。Qdrantをベクトルデータベースとして使用し、知識ベースとチャット履歴の管理を行います。

index..htmlはiframeとして動かすことを想定しています。