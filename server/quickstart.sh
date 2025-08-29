#!/bin/bash

# 🚀 RAG Starter Kit - Quick Start Script
# Get your RAG application running in minutes!

set -e

echo "🚀 Welcome to RAG Starter Kit!"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js is not installed. Please install Node.js 18+ first."
        echo "Visit: https://nodejs.org/"
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        echo "❌ Node.js version 18+ is required. Current version: $(node --version)"
        exit 1
    fi
    
    print_success "Node.js $(node --version) ✓"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        echo "❌ npm is not installed."
        exit 1
    fi
    
    print_success "npm $(npm --version) ✓"
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    if [ -f "package-lock.json" ]; then
        npm ci
    else
        npm install
    fi
    
    print_status "Installing client dependencies..."
    npm install --prefix client
    
    print_success "Dependencies installed successfully!"
}

# Setup environment
setup_environment() {
    print_status "Setting up environment..."
    
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_warning "Created .env file from .env.example"
            print_warning "Please edit .env and add your OpenAI API key"
        else
            print_warning "No .env.example found. Creating basic .env file..."
            cat > .env << EOF
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4

# Server Configuration
PORT=3000
NODE_ENV=development

# Vector Database
CHROMA_PERSIST_DIRECTORY=./chroma_db
EOF
        fi
    else
        print_success ".env file already exists"
    fi
    
    # Create necessary directories
    mkdir -p chroma_db uploads
    print_success "Directories created"
}

# Start application
start_application() {
    print_status "Starting RAG application..."
    
    # Start the application
    npm run dev:all &
    APP_PID=$!
    
    # Wait for application to start
    print_status "Waiting for application to start..."
    sleep 10
    
    # Check if application is running
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        print_success "RAG application is running on http://localhost:3000"
    else
        print_warning "Application may not be ready yet. Check the logs."
    fi
}

# Show next steps
show_next_steps() {
    echo ""
    echo "🎉 RAG Starter Kit is now running!"
    echo "=================================="
    echo ""
    echo "🌐 Access your application:"
    echo "   Frontend: http://localhost:5173/"
    echo "   Backend API: http://localhost:3000/api"
    echo "   Health Check: http://localhost:3000/health"
    echo ""
    echo "📚 Next steps:"
    echo "   1. Open http://localhost:3000 in your browser"
    echo "   2. Edit .env file and add your OpenAI API key"
    echo "   3. Upload a files and start chatting!"
    echo ""
    echo "🛠️  Useful commands:"
    echo "   View logs: npm run dev:all"
    echo "   Stop application: Ctrl+C"
    echo ""
    echo "📖 Documentation:"
    echo "   README.md - Project overview and setup"
    echo "   API.md - API reference"
    echo ""
    echo "🚀 Happy building!"
}

# Cleanup function
cleanup() {
    if [ ! -z "$APP_PID" ]; then
        print_status "Stopping application..."
        kill $APP_PID 2>/dev/null || true
    fi
}

# Set trap for cleanup
trap cleanup EXIT

# Main execution
main() {
    echo "🚀 Starting RAG Starter Kit setup..."
    echo ""
    
    check_prerequisites
    install_dependencies
    setup_environment
    start_application
    show_next_steps
    
    # Keep script running
    print_status "Press Ctrl+C to stop the application"
    wait
}

# Run main function
main "$@"
