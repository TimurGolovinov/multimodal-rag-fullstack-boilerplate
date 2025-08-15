# 🚀 **RAG Starter Kit** - AI Document Intelligence

> **A simple, powerful RAG (Retrieval-Augmented Generation) application for chatting with your documents**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://reactjs.org/)

## 🛠️ **Tech Stack**

- **Backend**: Node.js + Express + TypeScript
- **Frontend**: React 19 + Vite
- **AI**: OpenAI GPT models + Whisper
- **Vector DB**: ChromaDB
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

## 🎯 **Features**

- **📄 Multi-Format Support**: PDF, Word, Text, Images, Audio, Video
- **🤖 AI-Powered Chat**: Ask questions about your documents
- **🔍 Smart Search**: Find information by meaning, not just keywords
- **📱 Beautiful UI**: Modern, responsive interface
- **⚡ Fast**: Built with TypeScript and React 19

## 🏗️ **How It Works**

1. **Upload** your documents
2. **AI processes** and understands the content
3. **Ask questions** about your documents
4. **Get intelligent answers** with source references

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
src/
├── controllers/          # API endpoints
├── services/            # Business logic
├── routes/              # Route definitions
└── types/               # TypeScript types

client/
└── src/                 # React frontend
```

## How RAG Works

1. **Document Upload**: Documents are processed and text is extracted
2. **Embedding Generation**: OpenAI embeddings are created for document content
3. **Vector Storage**: Embeddings are stored in ChromaDB for similarity search
4. **Query Processing**: User questions are converted to embeddings
5. **Retrieval**: Most relevant documents are found using vector similarity
6. **Generation**: LLM generates answers using retrieved document context

## 📋 **Processing Details**

- **Video & Audio**: Videos are processed by extracting N key frames and audio transcript, then analyzed with GPT-4o and Whisper APIs
- **Documents & Images**: PDFs/Word docs use text extraction, while images are analyzed with GPT-4o for OCR and visual content understanding

## Configuration

- **File Size Limit**: 10MB per document
- **Supported Formats**: Text, PDF, Word documents
- **Vector Search**: Top 3 most relevant documents used for context
- **LLM Model**: Configurable via environment variables

## 📄 **License**

MIT License - see [LICENSE](LICENSE) file for details.
