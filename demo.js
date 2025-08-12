#!/usr/bin/env node

/**
 * Simple demo script to test the RAG server
 * Run this after starting the server with: npm run dev
 */

const axios = require("axios");

const BASE_URL = "http://localhost:3000";

async function testServer() {
  console.log("🚀 Testing RAG Demo Server...\n");

  try {
    // Test health check
    console.log("1. Testing health check...");
    const health = await axios.get(`${BASE_URL}/health`);
    console.log("✅ Health check passed:", health.data.status);

    // Test root endpoint
    console.log("\n2. Testing root endpoint...");
    const root = await axios.get(BASE_URL);
    console.log("✅ Root endpoint working:", root.data.message);

    // Test document listing (should be empty initially)
    console.log("\n3. Testing document listing...");
    const docs = await axios.get(`${BASE_URL}/api/documents`);
    console.log(
      "✅ Documents endpoint working. Total documents:",
      docs.data.total
    );

    // Test chat endpoint with empty message (should fail)
    console.log("\n4. Testing chat validation...");
    try {
      await axios.post(`${BASE_URL}/api/chat/chat`, { message: "" });
    } catch (error) {
      if (error.response?.status === 400) {
        console.log("✅ Chat validation working (rejected empty message)");
      } else {
        throw error;
      }
    }

    console.log("\n🎉 All basic tests passed!");
    console.log("\nNext steps:");
    console.log("1. Upload a document: POST /api/documents/upload");
    console.log("2. Chat about it: POST /api/chat/chat");
    console.log("3. Check the README.md for more examples");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    if (error.code === "ECONNREFUSED") {
      console.log("\n💡 Make sure the server is running with: npm run dev");
    }
    process.exit(1);
  }
}

// Run demo if this file is executed directly
if (require.main === module) {
  testServer();
}

module.exports = { testServer };
