# 📚 **API Documentation**

> **Simple API reference for the RAG Starter Kit**

## 🔗 **Base URL**

```
Development: http://localhost:3000
```

## 📊 **Response Format**

All API responses follow this format:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {},
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 📄 **Document Management**

### **Upload Document**

Upload any supported file type for AI analysis.

```http
POST /api/documents/upload
Content-Type: multipart/form-data
```

**Parameters:**

- `document` (file, required): The file to upload

**Supported Formats:**

- **Text**: `.txt`, `.md`
- **Documents**: `.pdf`, `.doc`, `.docx`
- **Images**: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.svg`
- **Audio**: `.mp3`, `.wav`, `.m4a`, `.ogg`, `.flac`, `.aac`
- **Video**: `.mp4`, `.mov`, `.avi`, `.webm`, `.mkv`, `.flv`

**Example Request:**

```bash
curl -X POST http://localhost:3000/api/documents/upload \
  -F "document=@/path/to/your/document.pdf"
```

**Example Response:**

```json
{
  "success": true,
  "message": "Document uploaded successfully",
  "data": {
    "id": "uuid-123",
    "filename": "document.pdf",
    "type": "pdf",
    "uploadedAt": "2024-01-01T00:00:00.000Z",
    "size": 1024000,
    "metadata": {
      "pages": 5,
      "extractedText": "Sample document content..."
    }
  }
}
```

### **List Documents**

Retrieve all uploaded documents.

```http
GET /api/documents
```

**Example Response:**

```json
{
  "success": true,
  "message": "Documents retrieved successfully",
  "data": {
    "documents": [
      {
        "id": "uuid-123",
        "filename": "document.pdf",
        "type": "pdf",
        "uploadedAt": "2024-01-01T00:00:00.000Z",
        "size": 1024000
      }
    ],
    "total": 1
  }
}
```

### **Delete Document**

Remove a document and its embeddings.

```http
DELETE /api/documents/:id
```

**Path Parameters:**

- `id` (string, required): Document UUID

**Example Request:**

```bash
curl -X DELETE http://localhost:3000/api/documents/uuid-123
```

## 💬 **Chat Interface**

### **Chat with AI**

Ask questions about your uploaded documents.

```http
POST /api/chat/chat
Content-Type: application/json
```

**Request Body:**

```json
{
  "message": "What is this document about?",
  "documentIds": ["uuid-123", "uuid-456"]
}
```

**Parameters:**

- `message` (string, required): Your question
- `documentIds` (array, optional): Specific documents to search in

**Example Request:**

```bash
curl -X POST http://localhost:3000/api/chat/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Summarize the main points"}'
```

**Example Response:**

```json
{
  "success": true,
  "message": "Based on the uploaded documents, here are the main points...",
  "data": {
    "sources": [
      {
        "id": "uuid-123",
        "filename": "document.pdf",
        "relevance": 0.95
      }
    ]
  }
}
```

## 🏥 **Health Check**

### **Health Status**

Check application health.

```http
GET /health
```

**Example Response:**

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0"
}
```

## 🚨 **Error Codes**

| Code                | Description                   | HTTP Status |
| ------------------- | ----------------------------- | ----------- |
| `INVALID_FILE_TYPE` | Unsupported file format       | 400         |
| `FILE_TOO_LARGE`    | File exceeds size limit       | 400         |
| `UPLOAD_FAILED`     | File upload processing failed | 500         |
| `NO_DOCUMENTS`      | No documents found for search | 404         |
| `AI_SERVICE_ERROR`  | AI service unavailable        | 503         |

## 📖 **Complete Workflow Example**

1. **Upload a Document**

```bash
curl -X POST http://localhost:3000/api/documents/upload \
  -F "document=@/path/to/your/document.pdf"
```

2. **Chat About Document**

```bash
curl -X POST http://localhost:3000/api/chat/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What are the key findings?"}'
```

3. **List All Documents**

```bash
curl http://localhost:3000/api/documents
```

---

**Need help?** Check our [GitHub repository](https://github.com/yourusername/rag-starter-kit) or [open an issue](https://github.com/yourusername/rag-starter-kit/issues)!
