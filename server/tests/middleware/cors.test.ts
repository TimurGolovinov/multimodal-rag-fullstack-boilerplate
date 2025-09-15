import cors from "cors";

// Mock environment variables
const originalEnv = process.env;

describe("CORS Configuration Tests", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("CORS origin validation", () => {
    let corsOptions: any;

    beforeEach(() => {
      // Set up test environment
      process.env.NODE_ENV = "test";
      process.env.ALLOWED_DOMAINS = "localhost,example.com,*.test.com";
      process.env.ALLOW_NO_ORIGIN = "false";

      // Import the CORS configuration from the main server file
      const { setupMiddleware } = require("../../src/index");
      const app = require("express")();
      setupMiddleware(app);

      // Extract CORS options from the app
      corsOptions = app._router.stack.find(
        (layer: any) => layer.name === "corsMiddleware"
      )?.handle?.options;
    });

    it("should reject requests without origin by default", (done) => {
      corsOptions.origin(undefined, (err: Error | null, allow?: boolean) => {
        expect(err).toBeInstanceOf(Error);
        expect(err?.message).toBe("CORS: Origin header required for security");
        expect(allow).toBe(false);
        done();
      });
    });

    it("should allow requests without origin when ALLOW_NO_ORIGIN is true in development", (done) => {
      process.env.NODE_ENV = "development";
      process.env.ALLOW_NO_ORIGIN = "true";

      // Re-import to get updated CORS options
      jest.resetModules();
      const { setupMiddleware } = require("../../src/index");
      const app = require("express")();
      setupMiddleware(app);

      const corsOptions = app._router.stack.find(
        (layer: any) => layer.name === "corsMiddleware"
      )?.handle?.options;

      corsOptions.origin(undefined, (err: Error | null, allow?: boolean) => {
        expect(err).toBeNull();
        expect(allow).toBe(true);
        done();
      });
    });

    it("should reject requests without origin in production even with ALLOW_NO_ORIGIN=true", (done) => {
      process.env.NODE_ENV = "production";
      process.env.ALLOW_NO_ORIGIN = "true";

      // Re-import to get updated CORS options
      jest.resetModules();
      const { setupMiddleware } = require("../../src/index");
      const app = require("express")();
      setupMiddleware(app);

      const corsOptions = app._router.stack.find(
        (layer: any) => layer.name === "corsMiddleware"
      )?.handle?.options;

      corsOptions.origin(undefined, (err: Error | null, allow?: boolean) => {
        expect(err).toBeInstanceOf(Error);
        expect(err?.message).toBe("CORS: Origin header required for security");
        expect(allow).toBe(false);
        done();
      });
    });

    it("should allow exact domain matches", (done) => {
      corsOptions.origin(
        "https://example.com",
        (err: Error | null, allow?: boolean) => {
          expect(err).toBeNull();
          expect(allow).toBe(true);
          done();
        }
      );
    });

    it("should allow localhost in development", (done) => {
      corsOptions.origin(
        "http://localhost:3000",
        (err: Error | null, allow?: boolean) => {
          expect(err).toBeNull();
          expect(allow).toBe(true);
          done();
        }
      );
    });

    it("should allow HTTPS versions of domains", (done) => {
      corsOptions.origin(
        "https://example.com",
        (err: Error | null, allow?: boolean) => {
          expect(err).toBeNull();
          expect(allow).toBe(true);
          done();
        }
      );
    });

    it("should reject HTTP in production", (done) => {
      process.env.NODE_ENV = "production";
      process.env.ALLOWED_DOMAINS = "example.com";

      // Re-import to get updated CORS options
      jest.resetModules();
      const { setupMiddleware } = require("../../src/index");
      const app = require("express")();
      setupMiddleware(app);

      const corsOptions = app._router.stack.find(
        (layer: any) => layer.name === "corsMiddleware"
      )?.handle?.options;

      corsOptions.origin(
        "http://example.com",
        (err: Error | null, allow?: boolean) => {
          expect(err).toBeInstanceOf(Error);
          expect(err?.message).toContain("not allowed");
          expect(allow).toBe(false);
          done();
        }
      );
    });

    it("should handle wildcard domains correctly", (done) => {
      corsOptions.origin(
        "https://api.test.com",
        (err: Error | null, allow?: boolean) => {
          expect(err).toBeNull();
          expect(allow).toBe(true);
          done();
        }
      );
    });

    it("should handle wildcard domains with subdomains", (done) => {
      corsOptions.origin(
        "https://subdomain.test.com",
        (err: Error | null, allow?: boolean) => {
          expect(err).toBeNull();
          expect(allow).toBe(true);
          done();
        }
      );
    });

    it("should reject domains not in allowed list", (done) => {
      corsOptions.origin(
        "https://malicious.com",
        (err: Error | null, allow?: boolean) => {
          expect(err).toBeInstanceOf(Error);
          expect(err?.message).toContain("not allowed");
          expect(allow).toBe(false);
          done();
        }
      );
    });

    it("should reject requests when no domains are configured", (done) => {
      process.env.ALLOWED_DOMAINS = "";

      // Re-import to get updated CORS options
      jest.resetModules();
      const { setupMiddleware } = require("../../src/index");
      const app = require("express")();
      setupMiddleware(app);

      const corsOptions = app._router.stack.find(
        (layer: any) => layer.name === "corsMiddleware"
      )?.handle?.options;

      corsOptions.origin(
        "https://example.com",
        (err: Error | null, allow?: boolean) => {
          expect(err).toBeInstanceOf(Error);
          expect(err?.message).toBe("CORS: No allowed domains configured");
          expect(allow).toBe(false);
          done();
        }
      );
    });

    it("should handle special regex characters in domain names", (done) => {
      process.env.ALLOWED_DOMAINS = "example.com,test+domain.com";

      // Re-import to get updated CORS options
      jest.resetModules();
      const { setupMiddleware } = require("../../src/index");
      const app = require("express")();
      setupMiddleware(app);

      const corsOptions = app._router.stack.find(
        (layer: any) => layer.name === "corsMiddleware"
      )?.handle?.options;

      corsOptions.origin(
        "https://test+domain.com",
        (err: Error | null, allow?: boolean) => {
          expect(err).toBeNull();
          expect(allow).toBe(true);
          done();
        }
      );
    });

    it("should handle malformed wildcard patterns", (done) => {
      process.env.ALLOWED_DOMAINS = "*.example.com,malformed.*.com";

      // Re-import to get updated CORS options
      jest.resetModules();
      const { setupMiddleware } = require("../../src/index");
      const app = require("express")();
      setupMiddleware(app);

      const corsOptions = app._router.stack.find(
        (layer: any) => layer.name === "corsMiddleware"
      )?.handle?.options;

      // Valid wildcard should work
      corsOptions.origin(
        "https://api.example.com",
        (err: Error | null, allow?: boolean) => {
          expect(err).toBeNull();
          expect(allow).toBe(true);
        }
      );

      // Malformed wildcard should not match
      corsOptions.origin(
        "https://test.malformed.api.com",
        (err: Error | null, allow?: boolean) => {
          expect(err).toBeInstanceOf(Error);
          expect(allow).toBe(false);
          done();
        }
      );
    });
  });

  describe("CORS configuration properties", () => {
    it("should have correct CORS settings", () => {
      process.env.NODE_ENV = "test";
      process.env.ALLOWED_DOMAINS = "localhost,example.com";

      // Re-import to get updated CORS options
      jest.resetModules();
      const { setupMiddleware } = require("../../src/index");
      const app = require("express")();
      setupMiddleware(app);

      const corsOptions = app._router.stack.find(
        (layer: any) => layer.name === "corsMiddleware"
      )?.handle?.options;

      expect(corsOptions.credentials).toBe(true);
      expect(corsOptions.optionsSuccessStatus).toBe(200);
      expect(corsOptions.methods).toEqual([
        "GET",
        "POST",
        "PUT",
        "DELETE",
        "OPTIONS",
      ]);
      expect(corsOptions.allowedHeaders).toEqual([
        "Content-Type",
        "Authorization",
        "x-csrf-token",
        "x-access-token",
      ]);
      expect(corsOptions.exposedHeaders).toEqual(["x-csrf-token"]);
      expect(corsOptions.maxAge).toBe(86400);
    });
  });
});
