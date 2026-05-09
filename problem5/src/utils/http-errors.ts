export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message?: string, details?: unknown) {
    super(message ?? code);
    this.statusCode = statusCode;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}
