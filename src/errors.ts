/**
 * Error classes for Engram
 */

export class EngramError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "EngramError";
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NoLLMError extends EngramError {
  constructor() {
    super(
      "remember() requires an LLM function. Use store() for manual memory creation.",
      "NO_LLM",
    );
    this.name = "NoLLMError";
  }
}

export class ExtractionError extends EngramError {
  constructor(details: string) {
    super(`Memory extraction failed: ${details}`, "EXTRACTION_FAILED");
    this.name = "ExtractionError";
  }
}

export class StoreError extends EngramError {
  constructor(details: string) {
    super(`Storage operation failed: ${details}`, "STORE_FAILED");
    this.name = "StoreError";
  }
}

export class ConfigError extends EngramError {
  constructor(details: string) {
    super(`Invalid configuration: ${details}`, "CONFIG_ERROR");
    this.name = "ConfigError";
  }
}
