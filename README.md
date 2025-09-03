# 🚀 RAG Application - Advanced Multimodal RAG with PostgreSQL & Docker

A production-ready Retrieval-Augmented Generation (RAG) application that supports multiple file types, built with Node.js, PostgreSQL, and Docker.

## ✨ Features

- **🔍 Multimodal Document Processing**: PDF, Word, Images, Audio, Video
- **🗄️ PostgreSQL Database**: Robust data storage with proper indexing
- **🐳 Docker Support**: Easy deployment and scaling
- **📁 File Storage**: Organized file management with cleanup
- **🔒 Security**: Rate limiting, CORS, security headers
- **📊 Monitoring**: Health checks, logging, metrics
- **🔄 Migration**: Seamless transition from JSON to database
- **🌐 Production Ready**: Nginx, HTTPS, Let's Encrypt SSL, clustering

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Client  │    │   Nginx Proxy   │    │  Node.js App    │
│                 │◄──►│                 │◄──►│                 │
│   (HTTPS)       │    │   (Port 80/443) │    │   (Port 3000)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                ▼                       ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   PostgreSQL    │    │   File Storage  │
                       │   (Port 5432)   │    │   (Local/S3)    │
                       └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Docker** and Docker Compose
- **PostgreSQL** 15+ (if not using Docker)
- **Redis** 7+ (optional, for caching)

### Option 1: Docker (Recommended)

1. **Clone and setup**:

   ```bash
   git clone <your-repo>
   cd rag-application
   cp env.example .env
   # Edit .env with your configuration
   ```

2. **Start everything**:

   ```bash
   chmod +x deploy-docker.sh
   ./deploy-docker.sh start
   ```

3. **Access your app**:
   - Frontend: http://localhost
   - API: http://localhost/api
   - Health: http://localhost/health

### Option 2: Local Development

1. **Setup database**:

   ```bash
   # Install PostgreSQL locally or use Docker
   docker run -d --name postgres \
     -e POSTGRES_DB=rag_app \
     -e POSTGRES_USER=rag_user \
     -e POSTGRES_PASSWORD=your_password \
     -p 5432:5432 postgres:15
   ```

2. **Install dependencies**:

   ```bash
   cd server && npm install
   cd ../client && npm install
   ```

3. **Configure environment**:

   ```bash
   cd ..
   cp env.example .env
   # Edit .env with your database credentials
   ```

4. **Run migration**:

   ```bash
   cd server
   npm run migrate
   ```

5. **Start services**:

   ```bash
   # Terminal 1: Start server
   npm run dev

   # Terminal 2: Start client
   cd ../client
   npm run dev
   ```

## 🗄️ Database Setup

### Schema Overview

- **`documents`**: Document metadata and content
- **`chat_messages`**: Conversation history
- **`document_embeddings`**: Vector embeddings for search
- **`file_storage`**: File tracking and cleanup

### Migration from JSON

If you have existing data in `data/documents.json`:

```bash
cd server
npm run migrate
```

This will:

- ✅ Create backups of your data
- ✅ Migrate documents to PostgreSQL
- ✅ Organize files in new storage structure
- ✅ Verify migration success
- ✅ Clean up old files

## 🐳 Docker Commands

```bash
# Start all services
./deploy-docker.sh start

# Check status
./deploy-docker.sh status

# View logs
./deploy-docker.sh logs app
./deploy-docker.sh logs postgres

# Stop services
./deploy-docker.sh stop

# Update application
./deploy-docker.sh update

# Backup database
./deploy-docker.sh backup

# Cleanup resources
./deploy-docker.sh cleanup
```

## 🔧 Configuration

### Environment Variables

Key configuration options in `.env`:

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=rag_app
DB_USER=rag_user
DB_PASSWORD=your_secure_password

# OpenAI
OPENAI_API_KEY=your_api_key

# Security
ALLOWED_DOMAINS=localhost,127.0.0.1,yourdomain.com
API_KEY=your_secure_api_key

# File Upload
MAX_FILE_SIZE=10485760  # 10MB
UPLOAD_DIR=./uploads
```

### Docker Configuration

The `docker-compose.yml` includes:

- **PostgreSQL**: Database with health checks
- **Redis**: Caching and sessions
- **App**: Node.js application
- **Nginx**: Reverse proxy
- **Backup**: Automated database backups

## 📁 File Structure

```
rag-application/
├── client/                 # React frontend
├── server/                 # Node.js backend
│   ├── src/
│   │   ├── controllers/    # API controllers
│   │   ├── services/       # Business logic
│   │   ├── database/       # Database layer
│   │   │   ├── config.ts   # Database connection
│   │   │   ├── schema.sql  # Database schema
│   │   │   └── migration/  # Migration scripts
│   │   └── types/          # TypeScript types
│   ├── Dockerfile          # Docker configuration
│   └── package.json        # Dependencies
├── nginx/                  # Nginx configuration
├── docker-compose.yml      # Docker services
├── deploy-docker.sh        # Deployment script
└── env.example            # Environment template
```

## 🔒 Security Features

- **Rate Limiting**: API and upload endpoints
- **CORS Protection**: Domain restrictions
- **Security Headers**: XSS, CSRF protection
- **Input Validation**: File type and size limits
- **Authentication**: API key validation (configurable)

## 📊 Monitoring & Health

- **Health Checks**: `/health` endpoint with detailed metrics
- **Logging**: Structured logging with Winston
- **Metrics**: Memory usage, CPU, connection stats
- **Docker Health**: Container health monitoring

## 🚀 Production Deployment

### EC2 with Docker

1. **Launch EC2 instance**
2. **Install Docker**:

   ```bash
   sudo yum update -y
   sudo yum install -y docker
   sudo systemctl start docker
   sudo systemctl enable docker
   sudo usermod -a -G docker ec2-user
   ```

3. **Deploy application**:

   ```bash
   git clone <your-repo>
   cd rag-application
   cp env.example .env
   # Edit .env with production values
   ./deploy-docker.sh start
   ```

4. **Configure domain**:
   - Point DNS to EC2 public IP
   - Update `ALLOWED_DOMAINS` in `.env`
   - Restart services: `./deploy-docker.sh restart`

### SSL Setup

1. **Generate self-signed certificate**:

   ```bash
   mkdir -p ssl
   openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
     -keyout ssl/private.key -out ssl/certificate.crt
   ```

2. **Or use Let's Encrypt**:
   ```bash
   sudo certbot --nginx -d yourdomain.com
   ```

## 🔄 Development Workflow

1. **Make changes** to source code
2. **Test locally** with `npm run dev`
3. **Build and deploy**:
   ```bash
   ./deploy-docker.sh update
   ```

## 🧪 Testing

```bash
# Run tests
cd server
npm test

# Watch mode
npm run test:watch

# Linting
npm run lint
npm run lint:fix
```

## 📚 API Documentation

### Document Endpoints

- `POST /api/documents/upload` - Upload document
- `GET /api/documents` - List documents
- `GET /api/documents/:id` - Get document
- `DELETE /api/documents/:id` - Delete document
- `GET /api/documents/search?q=query` - Search documents

### Chat Endpoints

- `POST /api/chat` - Send chat message
- `GET /api/chat/history` - Get chat history

### Health & Monitoring

- `GET /health` - Application health status
- `GET /metrics` - Performance metrics

## 🐛 Troubleshooting

### Common Issues

1. **Database connection failed**:

   - Check PostgreSQL is running
   - Verify credentials in `.env`
   - Check firewall/security groups

2. **File upload fails**:

   - Verify `UPLOAD_DIR` exists and is writable
   - Check file size limits
   - Ensure proper MIME types

3. **Docker services won't start**:
   - Check logs: `./deploy-docker.sh logs`
   - Verify `.env` configuration
   - Check port conflicts

### Logs and Debugging

```bash
# View application logs
./deploy-docker.sh logs app

# View database logs
./deploy-docker.sh logs postgres

# Check service status
./deploy-docker.sh status

# Access database directly
docker compose exec postgres psql -U rag_user -d rag_app
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.
