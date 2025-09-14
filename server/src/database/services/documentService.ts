import { Pool, PoolClient } from "pg";
import { dbConnection } from "../config";
import { Document, DocumentType, ProcessingStatus } from "../../types";

export interface DocumentCreateData {
  filename: string;
  originalFilename: string;
  content: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  documentType: DocumentType;
  thumbnailPath?: string;
  metadata?: Record<string, any>;
  userId: string;
}

export interface DocumentUpdateData {
  content?: string;
  thumbnailPath?: string;
  processingStatus?: ProcessingStatus;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface DocumentQueryOptions {
  limit?: number;
  offset?: number;
  documentType?: DocumentType;
  processingStatus?: ProcessingStatus;
  searchQuery?: string;
  sortBy?: "uploaded_at" | "filename" | "file_size";
  sortOrder?: "ASC" | "DESC";
  userId: string; // Required for user isolation
}

export class DocumentDatabaseService {
  private pool?: Pool;

  private getPool(): Pool {
    if (!this.pool) {
      this.pool = dbConnection.getPool();
    }
    return this.pool;
  }

  /**
   * Create a new document in the database
   */
  async createDocument(data: DocumentCreateData): Promise<Document> {
    const client = await this.getPool().connect();

    try {
      await client.query("BEGIN");

      const query = `
        INSERT INTO documents (
          filename, original_filename, content, file_path, file_size, 
          mime_type, document_type, thumbnail_path, metadata, user_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;

      const values = [
        data.filename,
        data.originalFilename,
        data.content,
        data.filePath,
        data.fileSize,
        data.mimeType,
        data.documentType,
        data.thumbnailPath || null,
        data.metadata ? JSON.stringify(data.metadata) : "{}",
        data.userId,
      ];

      const result = await client.query(query, values);

      // Also track the file in file_storage table
      await this.trackFileInStorage(
        client,
        data.filePath,
        "document",
        data.fileSize,
        data.userId
      );

      await client.query("COMMIT");

      return this.mapRowToDocument(result.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      throw new Error(
        `Failed to create document: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get a document by ID
   */
  async getDocument(id: string, userId: string): Promise<Document | null> {
    const client = await this.getPool().connect();

    try {
      const query = "SELECT * FROM documents WHERE id = $1 AND user_id = $2";
      const values = [id, userId];

      const result = await client.query(query, values);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToDocument(result.rows[0]);
    } catch (error) {
      throw new Error(
        `Failed to get document: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      client.release();
    }
  }

  /**
   * Update a document
   */
  async updateDocument(
    id: string,
    data: DocumentUpdateData
  ): Promise<Document> {
    const client = await this.getPool().connect();

    try {
      const updateFields: string[] = [];
      const values: any[] = [id];
      let valueIndex = 2;

      if (data.content !== undefined) {
        updateFields.push(`content = $${valueIndex++}`);
        values.push(data.content);
      }

      if (data.thumbnailPath !== undefined) {
        updateFields.push(`thumbnail_path = $${valueIndex++}`);
        values.push(data.thumbnailPath);
      }

      if (data.processingStatus !== undefined) {
        updateFields.push(`processing_status = $${valueIndex++}`);
        values.push(data.processingStatus);
      }

      if (data.errorMessage !== undefined) {
        updateFields.push(`error_message = $${valueIndex++}`);
        values.push(data.errorMessage);
      }

      if (data.metadata !== undefined) {
        updateFields.push(`metadata = $${valueIndex++}`);
        values.push(JSON.stringify(data.metadata));
      }

      if (updateFields.length === 0) {
        throw new Error("No fields to update");
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

      const query = `
        UPDATE documents 
        SET ${updateFields.join(", ")}
        WHERE id = $1
        RETURNING *
      `;

      const result = await client.query(query, values);

      if (result.rows.length === 0) {
        throw new Error("Document not found");
      }

      return this.mapRowToDocument(result.rows[0]);
    } catch (error) {
      throw new Error(
        `Failed to update document: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      client.release();
    }
  }

  /**
   * Delete a document
   */
  async deleteDocument(id: string, userId: string): Promise<boolean> {
    const client = await this.getPool().connect();

    try {
      await client.query("BEGIN");

      // Get document info before deletion
      const docQuery =
        "SELECT file_path, thumbnail_path FROM documents WHERE id = $1 AND user_id = $2";
      const docValues = [id, userId];

      const docResult = await client.query(docQuery, docValues);

      if (docResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return false;
      }

      const document = docResult.rows[0];

      // Delete from documents table
      const deleteQuery =
        "DELETE FROM documents WHERE id = $1 AND user_id = $2";
      const deleteValues = [id, userId];

      await client.query(deleteQuery, deleteValues);

      // Remove from file_storage tracking
      if (document.file_path) {
        await this.removeFileFromStorage(client, document.file_path);
      }

      if (document.thumbnail_path) {
        await this.removeFileFromStorage(client, document.thumbnail_path);
      }

      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw new Error(
        `Failed to delete document: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      client.release();
    }
  }

  /**
   * List documents with pagination and filtering
   */
  async listDocuments(options: DocumentQueryOptions): Promise<{
    documents: Document[];
    total: number;
    hasMore: boolean;
  }> {
    const client = await this.getPool().connect();

    try {
      const {
        limit = 50,
        offset = 0,
        documentType,
        processingStatus,
        searchQuery,
        sortBy = "uploaded_at",
        sortOrder = "DESC",
        userId,
      } = options;

      // Build WHERE clause
      const whereConditions: string[] = [];
      const values: any[] = [];
      let valueIndex = 1;

      if (documentType) {
        whereConditions.push(`document_type = $${valueIndex++}`);
        values.push(documentType);
      }

      if (processingStatus) {
        whereConditions.push(`processing_status = $${valueIndex++}`);
        values.push(processingStatus);
      }

      if (searchQuery) {
        whereConditions.push(
          `(filename ILIKE $${valueIndex++} OR content ILIKE $${valueIndex++})`
        );
        values.push(`%${searchQuery}%`, `%${searchQuery}%`);
      }

      // Always filter by userId for security
      whereConditions.push(`user_id = $${valueIndex++}`);
      values.push(userId);

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(" AND ")}`
          : "";

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM documents ${whereClause}`;
      const countResult = await client.query(countQuery, values);
      const total = parseInt(countResult.rows[0].count);

      // Get documents
      const documentsQuery = `
        SELECT * FROM documents 
        ${whereClause}
        ORDER BY ${sortBy} ${sortOrder}
        LIMIT $${valueIndex++} OFFSET $${valueIndex++}
      `;

      values.push(limit, offset);
      const documentsResult = await client.query(documentsQuery, values);

      const documents = documentsResult.rows.map((row) =>
        this.mapRowToDocument(row)
      );
      const hasMore = offset + limit < total;

      return { documents, total, hasMore };
    } catch (error) {
      throw new Error(
        `Failed to list documents: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      client.release();
    }
  }

  /**
   * Search documents by content
   */
  async searchDocuments(
    query: string,
    limit: number = 20,
    userId: string
  ): Promise<Document[]> {
    const client = await this.getPool().connect();

    try {
      const searchQuery = `
        SELECT * FROM documents 
        WHERE (content ILIKE $1 OR filename ILIKE $1) AND user_id = $2
        ORDER BY 
          CASE 
            WHEN filename ILIKE $1 THEN 1
            WHEN content ILIKE $1 THEN 2
            ELSE 3
          END,
          uploaded_at DESC
        LIMIT $3
      `;
      const values = [`%${query}%`, userId, limit.toString()];

      const result = await client.query(searchQuery, values);

      return result.rows.map((row) => this.mapRowToDocument(row));
    } catch (error) {
      throw new Error(
        `Failed to search documents: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get document statistics
   */
  async getDocumentStats(): Promise<{
    totalDocuments: number;
    totalSize: number;
    byType: Record<string, { count: number; totalSize: number }>;
    byStatus: Record<string, number>;
  }> {
    const client = await this.getPool().connect();

    try {
      // Get overall stats
      const overallQuery = `
        SELECT 
          COUNT(*) as total_documents,
          SUM(file_size) as total_size
        FROM documents
      `;

      const overallResult = await client.query(overallQuery);
      const { total_documents, total_size } = overallResult.rows[0];

      // Get stats by type
      const byTypeQuery = `
        SELECT 
          document_type,
          COUNT(*) as count,
          SUM(file_size) as total_size
        FROM documents 
        GROUP BY document_type
      `;

      const byTypeResult = await client.query(byTypeQuery);
      const byType: Record<string, { count: number; totalSize: number }> = {};

      byTypeResult.rows.forEach((row) => {
        byType[row.document_type] = {
          count: parseInt(row.count),
          totalSize: parseInt(row.total_size) || 0,
        };
      });

      // Get stats by status
      const byStatusQuery = `
        SELECT 
          processing_status,
          COUNT(*) as count
        FROM documents 
        GROUP BY processing_status
      `;

      const byStatusResult = await client.query(byStatusQuery);
      const byStatus: Record<string, number> = {};

      byStatusResult.rows.forEach((row) => {
        byStatus[row.processing_status] = parseInt(row.count);
      });

      return {
        totalDocuments: parseInt(total_documents) || 0,
        totalSize: parseInt(total_size) || 0,
        byType,
        byStatus,
      };
    } catch (error) {
      throw new Error(
        `Failed to get document stats: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      client.release();
    }
  }

  /**
   * Track file in storage table
   */
  private async trackFileInStorage(
    client: PoolClient,
    filePath: string,
    fileType: "document" | "thumbnail" | "temp",
    fileSize: number,
    userId: string
  ): Promise<void> {
    const query = `
      INSERT INTO file_storage (file_path, file_type, file_size, user_id)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (file_path) 
      DO UPDATE SET 
        file_size = $3,
        user_id = $4,
        last_accessed = CURRENT_TIMESTAMP
    `;

    await client.query(query, [filePath, fileType, fileSize, userId]);
  }

  /**
   * Remove file from storage tracking
   */
  private async removeFileFromStorage(
    client: PoolClient,
    filePath: string
  ): Promise<void> {
    const query =
      "UPDATE file_storage SET is_deleted = TRUE WHERE file_path = $1";
    await client.query(query, [filePath]);
  }

  /**
   * Map database row to Document object
   */
  private mapRowToDocument(row: any): Document {
    return {
      id: row.id,
      filename: row.filename,
      content: row.content || "",
      uploadedAt: new Date(row.uploaded_at),
      type: row.document_type as DocumentType,
      metadata: row.metadata || {},
      thumbnail: row.thumbnail_path || null,
      // Add any additional fields from the new schema
      filePath: row.file_path,
      fileSize: row.file_size,
      mimeType: row.mime_type,
      processingStatus: row.processing_status,
      errorMessage: row.error_message,
    };
  }
}
