#!/bin/bash

echo "🚀 RAG Demo Server - Quick Start"
echo "=================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if .env exists, if not create from example
if [ ! -f .env ]; then
    echo "🔑 Creating .env file from template..."
    cp env.example .env
    echo "⚠️  Please edit .env file and add your OpenAI API key!"
    echo "   OPENAI_API_KEY=your_actual_api_key_here"
    echo ""
    read -p "Press Enter after you've updated the .env file..."
fi

# Build the project
echo "🔨 Building project..."
npm run build

echo ""
echo "🎉 Setup complete! You can now:"
echo ""
echo "1. Start the development server:"
echo "   npm run dev"
echo ""
echo "2. Or start production server:"
echo "   npm start"
echo ""
echo "3. Test the server:"
echo "   node demo.js"
echo ""
echo "4. Run tests:"
echo "   npm test"
echo ""
echo "📚 Check README.md for detailed usage instructions"
