# 🚀 **RAG Starter Kit**

**A simple, powerful RAG (Retrieval-Augmented Generation) application that supports Documents, Video and Audio formats**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://reactjs.org/)

## 🛠️ **Tech Stack**

- **Backend**: Node.js + Express + TypeScript
- **Frontend**: React 19 + Vite
- **AI**: OpenAI GPT models + Whisper
- **Vector DB**: OpenAI Vector Store (managed)
- **File Processing**: Multi-modal support

---

## ✨ **What This Does**

Upload any document (PDF, Word, images, audio, video) and chat with an AI about its content. The AI will:

- **Understand** your documents using advanced AI
- **Answer questions** based on the document content
- **Find relevant information** across multiple documents
- **Provide context** from your uploaded files

## **Purpose**

- Boilerplate for quick prototyping and experimentation
- Understanding the core architecture of RAG systems
- Building upon for your own projects (The backend has a solid foundation but needs significant improvements in security, error handling, production readiness, and code quality before it's suitable for public release)

## 🚀 **Quick Start**

### **1. Clone and Setup**

```bash
git clone https://github.com/yourusername/rag-starter-kit.git
cd rag-starter-kit
npm install
npm install --prefix client
```

### **2. Configure Environment**

```bash
cp env.example .env
# IMPORTANT: Edit .env and add your OpenAI API key
```

### **3. Start the Application**

```bash
# Start all services
npm run dev:all

# Or use the quick start script
./quickstart.sh
```

**That's it!** Your RAG application will be running at `http://localhost:3000` (BE) and `http://localhost:5173/` (FE) 🎉

## 🏗️ **How It Works**

1. **Upload** your documents
2. **AI processes** and understands the content using OpenAI's managed vector store
3. **Documents are automatically chunked** and embedded for optimal retrieval
4. **Ask questions** about your documents
5. **Get intelligent answers** with semantic search and source references

## 🔍 **Vector Store Implementation**

This project uses **OpenAI's official Vector Store API** for production-ready document storage and retrieval:

- **Managed Infrastructure**: No need to manage your own vector database
- **Automatic Chunking**: Documents are intelligently split into searchable chunks
- **Semantic Search**: Uses OpenAI's latest embedding models for context-aware retrieval
- **Scalable**: Handles millions of documents with automatic indexing
- **Cost-Effective**: Pay only for storage used (first 1GB free)

## 📚 **API Reference**

### **Core Endpoints**

```http
POST /api/documents/upload    # Upload any file type
GET  /api/documents          # List all documents
POST /api/chat/chat          # Chat with AI about documents
GET  /health                 # Health check
```

See [API.md](API.md) for complete documentation.

## 🔧 **Development**

```bash
# Start development server and client
npm run dev:all
```

## 📁 **Project Structure**

```

```
