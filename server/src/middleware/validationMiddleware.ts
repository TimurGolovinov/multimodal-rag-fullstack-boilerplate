import { Request, Response, NextFunction } from "express";
import { z, ZodSchema } from "zod";

/**
 * Validation middleware using Zod schemas
 * @param schema - Zod schema to validate against
 * @param target - Which part of the request to validate ('body', 'query', 'params')
 */
const validate = (
  schema: ZodSchema,
  target: "body" | "query" | "params" = "body"
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const dataToValidate = req[target];
      const validatedData = schema.parse(dataToValidate);

      // Replace the original data with validated data
      req[target] = validatedData;

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedErrors = error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
          code: err.code,
        }));

        res.status(400).json({
          success: false,
          error: "Validation failed",
          message: "Please check your input data",
          details: formattedErrors,
        });
        return;
      }

      // Handle unexpected errors
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: "An unexpected error occurred during validation",
      });
    }
  };
};

/**
 * Validate request body
 */
export const validateBody = (schema: ZodSchema) => validate(schema, "body");

/**
 * Validate query parameters
 */
export const validateQuery = (schema: ZodSchema) => validate(schema, "query");

/**
 * Validate route parameters
 */
export const validateParams = (schema: ZodSchema) => validate(schema, "params");
