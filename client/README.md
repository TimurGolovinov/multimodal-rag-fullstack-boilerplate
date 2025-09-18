# React Client - Multimodal RAG Frontend

A modern React frontend for the Multimodal RAG application, built with Vite, TypeScript, and featuring hybrid video processing capabilities.

## ✨ Features

- **🎬 Hybrid Video Processing**: Client-side frame extraction and audio segmentation
- **📁 Document Upload**: Support for multiple file types (PDF, Word, Images, Audio, Video)
- **💬 Chat Interface**: Real-time chat with document context
- **🔐 Authentication**: JWT-based user authentication
- **📱 Responsive Design**: Mobile-friendly interface
- **⚡ Fast Development**: Vite with HMR and TypeScript

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in UI mode
npm run test:ui
```

## 🏗️ Architecture

The client is built with:

- **React 19**: Latest React with concurrent features
- **TypeScript**: Type-safe development
- **Vite**: Fast build tool and dev server
- **React Router**: Client-side routing
- **Custom Hooks**: Reusable state logic
- **Service Layer**: API communication and business logic

## 📁 Project Structure

```
src/
├── components/          # React components
│   ├── auth/           # Authentication components
│   ├── ChatPanel.tsx   # Chat interface
│   ├── KnowledgeHub.tsx # Document management
│   └── UserProfile.tsx # User profile
├── services/           # API services
│   ├── authService.ts  # Authentication service
│   ├── videoProcessor.ts # Video processing
│   └── enhancedVideoProcessor.ts # Enhanced video processing with FFmpeg.wasm
├── hooks/              # Custom React hooks
│   ├── useAuth.ts      # Authentication hook
│   └── useStreamingChat.ts # Chat functionality
├── contexts/           # React contexts
│   └── AuthContext.tsx # Authentication context
├── types/              # TypeScript type definitions
└── constants/          # Application constants
```

## 🎬 Video Processing

The client features advanced video processing capabilities:

- **Frame Extraction**: Uses Canvas API to extract video frames
- **Audio Segmentation**: Web Audio API for audio processing
- **Hybrid Processing**: Combines visual and audio analysis
- **Progress Tracking**: Real-time upload and processing progress
- **Error Handling**: Comprehensive error recovery with retry logic

## 🔧 Configuration

Environment variables (configured via Vite):

```bash
VITE_API_BASE=http://localhost:3000
```

## 🧪 Testing

The project uses Vitest for testing:

- **Unit Tests**: Component and service testing
- **Integration Tests**: API integration testing
- **Coverage Reports**: Comprehensive test coverage
- **Mocking**: Service and API mocking

## 📦 Build & Deployment

### Development Build

```bash
npm run dev
```

### Production Build

```bash
npm run build
```

The build output is in the `dist/` directory and can be served by any static file server.

### Docker

The client is containerized and can be run with Docker:

```bash
# Development
docker-compose up client

# Production
docker build -t rag-client .
```

## 🔒 Security

- **Input Validation**: Client-side validation for all inputs
- **XSS Protection**: Sanitized content rendering
- **CSRF Protection**: Token-based CSRF protection
- **File Validation**: Client-side file type and size validation

## 🐛 Troubleshooting

### Common Issues

1. **Build fails**: Check Node.js version (18+ required)
2. **API connection fails**: Verify `VITE_API_BASE` configuration
3. **Video processing fails**: Check browser compatibility for Web APIs

### Debug Mode

```bash
# Enable debug logging
DEBUG=true npm run dev
```
