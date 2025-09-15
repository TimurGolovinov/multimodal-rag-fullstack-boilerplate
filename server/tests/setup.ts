import dotenv from "dotenv";

// Load test environment variables
dotenv.config({ path: ".env.test" });

// Mock console methods in tests to reduce noise
const originalConsole = console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-key-for-testing-only";
process.env.REFRESH_TOKEN_SECRET = "test-refresh-secret-key-for-testing-only";
process.env.OPENAI_API_KEY = "test-openai-key";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test_rag_app";

// Mock external services
jest.mock("openai", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: "Test response" } }],
          }),
        },
      },
      files: {
        create: jest.fn().mockResolvedValue({ id: "test-file-id" }),
      },
      vectorStores: {
        files: {
          create: jest.fn().mockResolvedValue({ id: "test-vector-file-id" }),
          list: jest.fn().mockResolvedValue({ data: [] }),
        },
      },
    })),
  };
});

// Mock database connection
jest.mock("../src/database/config", () => ({
  dbConnection: {
    connect: jest.fn().mockResolvedValue(undefined),
    getPool: jest.fn().mockReturnValue({
      query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      connect: jest.fn().mockResolvedValue(undefined),
      end: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

// Global test timeout
jest.setTimeout(10000);
