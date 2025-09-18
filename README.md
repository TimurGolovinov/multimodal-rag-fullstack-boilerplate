# 🚀 Multimodal RAG Fullstack Boilerplate

A modern Retrieval-Augmented Generation (RAG) application with hybrid video processing, built with React, Node.js, PostgreSQL, and Docker.

## ✨ Features

- **🔍 Multimodal Document Processing**: PDF, Word, Images, Audio, Video
- **🎬 Hybrid Video Processing**: Client-side frame extraction + server-side AI analysis
- **🗄️ PostgreSQL Database**: Robust data storage with proper indexing
- **🐳 Docker Support**: Easy deployment and scaling
- **📁 File Storage**: Organized file management with cleanup
- **🔒 Security**: Rate limiting, CORS, security headers, file validation
- **📊 Monitoring**: Health checks, logging, metrics
- **🌐 Production Ready**: Nginx, HTTPS, clustering

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
   cd multimodal-rag-fullstack-boilerplate
   cp server/env.example .env
   # Edit .env with your configuration
   ```

2. **Start everything**:

   ```bash
   docker-compose up -d
   ```

3. **Access your app**:
   - Frontend: http://localhost:5173
   - API: http://localhost:3000
   - Health: http://localhost:3000/health

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
   cd server
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
   cd server
   npm run dev

   # Terminal 2: Start client
   cd client
   npm run dev
   ```

## 🗄️ Database Setup

### Schema Overview

- **`documents`**: Document metadata and content
- **`chat_messages`**: Conversation history
- **`document_embeddings`**: Vector embeddings for search
- **`file_storage`**: File tracking and cleanup

### Database Migration

The application includes automatic database migration on startup:

```bash
cd server
npm run migrate
```

This will:

- ✅ Create database tables and indexes
- ✅ Set up proper constraints and relationships
- ✅ Initialize default data if needed

## 🐳 Docker Commands

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs app
docker-compose logs postgres
docker-compose logs client

# Stop services
docker-compose down

# Rebuild and restart
docker-compose up -d --build

# View logs in real-time
docker-compose logs -f app
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
- **App**: Node.js application with clustering
- **Client**: React development server
- **Nginx**: Reverse proxy
- **Certbot**: SSL certificate management (optional)
- **Backup**: Automated database backups (optional)

## 📁 File Structure

```
multimodal-rag-fullstack-boilerplate/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── services/       # Client-side services
│   │   ├── hooks/          # Custom React hooks
│   │   └── types/          # TypeScript types
│   └── package.json        # Client dependencies
├── server/                 # Node.js backend
│   ├── src/
│   │   ├── controllers/    # API controllers
│   │   ├── services/       # Business logic
│   │   ├── database/       # Database layer
│   │   ├── middleware/     # Express middleware
│   │   ├── routes/         # API routes
│   │   └── types/          # TypeScript types
│   ├── tests/              # Test files
│   ├── Dockerfile          # Docker configuration
│   └── package.json        # Server dependencies
├── nginx/                  # Nginx configuration
├── docker-compose.yml      # Docker services
└── server/env.example      # Environment template
```

## 🔒 Security Features

- **Rate Limiting**: API and upload endpoints
- **CORS Protection**: Domain restrictions
- **Security Headers**: XSS, CSRF protection
- **File Validation**: MIME type, file signature, and content validation
- **Authentication**: JWT-based authentication with refresh tokens
- **Input Sanitization**: XSS and injection attack prevention

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
   cd multimodal-rag-fullstack-boilerplate
   cp server/env.example .env
   # Edit .env with production values
   docker-compose up -d
   ```

4. **Configure domain**:
   - Point DNS to EC2 public IP
   - Update `ALLOWED_DOMAINS` in `.env`
   - Restart services: `docker-compose restart`

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
   # Full build with tests (production)
   docker-compose up -d --build

   # Fast build without tests (development)
   docker-compose up -d --build --build-arg BUILD_COMMAND=build:fast
   ```

### Build Commands

- **`npm run build`**: Full build with tests (used in CI/CD)
- **`npm run build:fast`**: Fast build without tests (used in development)
- **`npm run test:ci`**: Run tests in CI mode (no watch, with coverage)

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

### Video Processing Endpoints

- `POST /api/video/process-frames` - Process video frames only
- `POST /api/video/process-hybrid` - Process video with frames and audio

### Chat Endpoints

- `POST /api/chat` - Send chat message
- `GET /api/chat/history` - Get chat history

### Authentication Endpoints

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/logout` - User logout

### Health & Monitoring

- `GET /health` - Application health status

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
   - Check logs: `docker-compose logs`
   - Verify `.env` configuration
   - Check port conflicts

### Logs and Debugging

```bash
# View application logs
docker-compose logs app

# View database logs
docker-compose logs postgres

# Check service status
docker-compose ps

# Access database directly
docker-compose exec postgres psql -U rag_user -d rag_app
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.
