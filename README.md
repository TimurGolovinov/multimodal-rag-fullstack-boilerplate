# RAG Demo Server

A lightweight TypeScript Node.js server that demonstrates Retrieval-Augmented Generation (RAG) capabilities. This server allows you to upload documents, create vector embeddings, and chat with an LLM about the uploaded content.

## Features

- 📄 **Document Upload**: Support for text, PDF, and Word documents
- 🔍 **Vector Search**: ChromaDB integration for semantic document search
- 🤖 **LLM Chat**: OpenAI integration for intelligent document Q&A
- 🚀 **Lightweight**: Built with Express.js and TypeScript
- 📚 **RAG Pipeline**: Complete retrieval-augmented generation workflow

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Vector Database**: ChromaDB (in-memory)
- **LLM**: OpenAI GPT models
- **Document Processing**: LangChain.js, pdf-parse, mammoth
- **File Upload**: Multer

## Prerequisites

- Node.js 18+
- npm or yarn
- OpenAI API key

## Installation

1. **Clone and install dependencies:**

   ```bash
   npm install
   ```

2. **Set up environment variables:**

   ```bash
   cp env.example .env
   ```

   Edit `.env` and add your OpenAI API key:

   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   OPENAI_MODEL=gpt-3.5-turbo
   PORT=3000
   NODE_ENV=development
   CHROMA_PERSIST_DIRECTORY=./chroma_db
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```

## Usage

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

The server will start on `http://localhost:3000` (or your configured PORT).

## API Endpoints

### Documents

#### Upload Document

```http
POST /api/documents/upload
Content-Type: multipart/form-data

document: [file]
```

**Supported file types**: `.txt`, `.pdf`, `.docx`

#### List Documents

```http
GET /api/documents
```

#### Get Document

```http
GET /api/documents/:id
```

### Chat

#### Chat with LLM

```http
POST /api/chat/chat
Content-Type: application/json

{
  "message": "What is this document about?",
  "documentIds": ["optional-specific-document-ids"]
}
```

### Health Check

```http
GET /health
```

## Example Usage

### 1. Upload a Document

```bash
curl -X POST http://localhost:3000/api/documents/upload \
  -F "document=@/path/to/your/document.pdf"
```

### 2. Chat About Documents

```bash
curl -X POST http://localhost:3000/api/chat/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Summarize the main points from the uploaded documents"}'
```

### 3. List All Documents

```bash
curl http://localhost:3000/api/documents
```

## Project Structure

```
src/
├── controllers/          # HTTP request handlers
│   ├── documentController.ts
│   └── chatController.ts
├── services/            # Business logic
│   ├── documentService.ts
│   └── chatService.ts
├── routes/              # API route definitions
│   ├── documentRoutes.ts
│   └── chatRoutes.ts
├── types/               # TypeScript type definitions
│   └── index.ts
└── index.ts             # Main server file
```

## How RAG Works

1. **Document Upload**: Documents are processed and text is extracted
2. **Embedding Generation**: OpenAI embeddings are created for document content
3. **Vector Storage**: Embeddings are stored in ChromaDB for similarity search
4. **Query Processing**: User questions are converted to embeddings
5. **Retrieval**: Most relevant documents are found using vector similarity
6. **Generation**: LLM generates answers using retrieved document context

## Configuration

- **File Size Limit**: 10MB per document
- **Supported Formats**: Text, PDF, Word documents
- **Vector Search**: Top 3 most relevant documents used for context
- **LLM Model**: Configurable via environment variables

## Development

### Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm test` - Run tests

### Adding New Features

- Controllers handle HTTP requests
- Services contain business logic
- Routes define API endpoints
- Types ensure type safety

## Troubleshooting

### Common Issues

1. **ChromaDB Connection Error**: Ensure the `CHROMA_PERSIST_DIRECTORY` exists and is writable
2. **OpenAI API Errors**: Verify your API key and billing status
3. **File Upload Issues**: Check file size limits and supported formats
4. **Memory Issues**: Large documents may consume significant memory during processing

### Logs

Check console output for detailed error messages and debugging information.

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

---

Built with ❤️ for RAG demonstrations and learning purposes.
