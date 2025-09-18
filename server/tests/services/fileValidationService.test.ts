import {
  FileValidationService,
  FileValidationConfig,
} from "../../src/services/fileValidationService";

describe("FileValidationService", () => {
  describe("validateFile", () => {
    it("should validate a valid image file", async () => {
      // Arrange
      const mockFile = {
        originalname: "test.jpg",
        mimetype: "image/jpeg",
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]), // Valid JPEG header
        size: 1024,
      } as Express.Multer.File;

      // Act
      const result = await FileValidationService.validateFile(mockFile);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.fileType).toBe("image");
      expect(result.mimeType).toBe("image/jpeg");
      expect(result.size).toBe(1024);
      expect(result.hash).toBeDefined();
    });

    it("should reject file with invalid MIME type", async () => {
      // Arrange
      const mockFile = {
        originalname: "test.exe",
        mimetype: "application/x-msdownload",
        buffer: Buffer.from("MZ"),
        size: 1024,
      } as Express.Multer.File;

      // Act
      const result = await FileValidationService.validateFile(mockFile);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "MIME type 'application/x-msdownload' is not allowed"
      );
    });

    it("should reject file with invalid extension", async () => {
      // Arrange
      const mockFile = {
        originalname: "test.exe",
        mimetype: "image/jpeg",
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
        size: 1024,
      } as Express.Multer.File;

      // Act
      const result = await FileValidationService.validateFile(mockFile);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("File extension '.exe' is not allowed");
    });

    it("should reject file that is too large", async () => {
      // Arrange
      const mockFile = {
        originalname: "test.jpg",
        mimetype: "image/jpeg",
        buffer: Buffer.alloc(101 * 1024 * 1024), // 101MB
        size: 101 * 1024 * 1024,
      } as Express.Multer.File;

      // Act
      const result = await FileValidationService.validateFile(mockFile);

      // Assert
      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((error) =>
          error.includes("exceeds maximum allowed size")
        )
      ).toBe(true);
    });

    it("should reject empty file", async () => {
      // Arrange
      const mockFile = {
        originalname: "test.jpg",
        mimetype: "image/jpeg",
        buffer: Buffer.alloc(0),
        size: 0,
      } as Express.Multer.File;

      // Act
      const result = await FileValidationService.validateFile(mockFile);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("File is empty");
    });

    it("should reject null file", async () => {
      // Act
      const result = await FileValidationService.validateFile(null as any);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("No file provided");
    });

    it("should validate file signature correctly", async () => {
      // Arrange
      const mockFile = {
        originalname: "test.jpg",
        mimetype: "image/jpeg",
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]), // Valid JPEG header
        size: 1024,
      } as Express.Multer.File;

      // Act
      const result = await FileValidationService.validateFile(mockFile);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject file with mismatched signature", async () => {
      // Arrange
      const mockFile = {
        originalname: "test.jpg",
        mimetype: "image/jpeg",
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]), // PNG header instead of JPEG
        size: 1024,
      } as Express.Multer.File;

      // Act
      const result = await FileValidationService.validateFile(mockFile);

      // Assert
      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((error) =>
          error.includes("File signature does not match MIME type")
        )
      ).toBe(true);
    });

    it("should detect suspicious patterns", async () => {
      // Arrange
      const mockFile = {
        originalname: "test.jpg",
        mimetype: "image/jpeg",
        buffer: Buffer.from('MZ<script>alert("xss")</script>'),
        size: 1024,
      } as Express.Multer.File;

      // Act
      const result = await FileValidationService.validateFile(mockFile);

      // Assert
      expect(result.warnings).toContain("File may contain executable content");
      expect(result.warnings).toContain("File may contain script content");
    });

    it("should detect suspicious filename", async () => {
      // Arrange
      const mockFile = {
        originalname: "test.exe.jpg",
        mimetype: "image/jpeg",
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
        size: 1024,
      } as Express.Multer.File;

      // Act
      const result = await FileValidationService.validateFile(mockFile);

      // Assert
      expect(result.warnings).toContain("Filename suggests executable content");
      expect(result.warnings).toContain(
        "File has multiple extensions - potential security risk"
      );
    });
  });

  describe("validateFiles", () => {
    it("should validate multiple files successfully", async () => {
      // Arrange
      const mockFiles = [
        {
          originalname: "test1.jpg",
          mimetype: "image/jpeg",
          buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
          size: 1024,
        },
        {
          originalname: "test2.wav",
          mimetype: "audio/wav",
          buffer: Buffer.from("RIFF"),
          size: 2048,
        },
      ] as Express.Multer.File[];

      // Act
      const results = await FileValidationService.validateFiles(mockFiles);

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(true);
    });

    it("should reject when too many files", async () => {
      // Arrange
      const mockFiles = Array(31)
        .fill(null)
        .map((_, i) => ({
          originalname: `test${i}.jpg`,
          mimetype: "image/jpeg",
          buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
          size: 1024,
        })) as Express.Multer.File[];

      // Act & Assert
      await expect(
        FileValidationService.validateFiles(mockFiles)
      ).rejects.toThrow("Too many files");
    });

    it("should detect duplicate files in batch", async () => {
      // Arrange
      const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      const mockFiles = [
        {
          originalname: "test1.jpg",
          mimetype: "image/jpeg",
          buffer: buffer,
          size: 1024,
        },
        {
          originalname: "test2.jpg",
          mimetype: "image/jpeg",
          buffer: buffer, // Same buffer = duplicate
          size: 1024,
        },
      ] as Express.Multer.File[];

      // Act
      const results = await FileValidationService.validateFiles(mockFiles);

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0].warnings).toContain(
        "Duplicate file detected in upload batch"
      );
      expect(results[1].warnings).toContain(
        "Duplicate file detected in upload batch"
      );
    });
  });

  describe("getVideoProcessingConfig", () => {
    it("should return appropriate config for video processing", () => {
      // Act
      const config = FileValidationService.getVideoProcessingConfig();

      // Assert
      expect(config.maxFileSize).toBe(50 * 1024 * 1024); // 50MB
      expect(config.maxFiles).toBe(30);
      expect(config.allowedMimeTypes).toContain("image/jpeg");
      expect(config.allowedMimeTypes).toContain("audio/wav");
      expect(config.allowedExtensions).toContain(".jpg");
      expect(config.allowedExtensions).toContain(".wav");
    });
  });

  describe("file type determination", () => {
    it("should determine file type from MIME type", async () => {
      // Arrange
      const testCases = [
        { mimeType: "image/jpeg", expectedType: "image" },
        { mimeType: "audio/wav", expectedType: "audio" },
        { mimeType: "video/mp4", expectedType: "video" },
        { mimeType: "application/pdf", expectedType: "pdf" },
        { mimeType: "text/plain", expectedType: "text" },
      ];

      for (const testCase of testCases) {
        const mockFile = {
          originalname: "test",
          mimetype: testCase.mimeType,
          buffer: Buffer.from("test"),
          size: 4,
        } as Express.Multer.File;

        // Act
        const result = await FileValidationService.validateFile(mockFile);

        // Assert
        expect(result.fileType).toBe(testCase.expectedType);
      }
    });
  });

  describe("error handling", () => {
    it("should handle validation errors gracefully", async () => {
      // Arrange
      const mockFile = {
        originalname: "test.exe",
        mimetype: "application/x-msdownload",
        buffer: Buffer.from("MZ"),
        size: 101 * 1024 * 1024, // Too large
      } as Express.Multer.File;

      // Act
      const result = await FileValidationService.validateFile(mockFile);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain(
        "MIME type 'application/x-msdownload' is not allowed"
      );
      expect(
        result.errors.some((error) =>
          error.includes("exceeds maximum allowed size")
        )
      ).toBe(true);
    });
  });
});
