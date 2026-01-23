export enum ErrorCode {
  TAPE_NOT_FOUND = 'TAPE_NOT_FOUND',
  INVALID_TAPE = 'INVALID_TAPE',
  FILE_READ_ERROR = 'FILE_READ_ERROR',
  INVALID_ARGUMENT = 'INVALID_ARGUMENT',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export class TaraCLIError extends Error {
  constructor(
    message: string,
    public code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
    public details?: unknown
  ) {
    super(message);
    this.name = 'TaraCLIError';
  }
}

export function handleError(error: unknown): never {
  if (error instanceof TaraCLIError) {
    console.error(`Error: ${error.message}`);
    if (error.details && process.env.VERBOSE) {
      console.error('Details:', error.details);
    }
    process.exit(1);
  } else if (error instanceof Error) {
    console.error(`Error: ${error.message}`);
    if (process.env.VERBOSE) {
      console.error(error.stack);
    }
    process.exit(1);
  } else {
    console.error('An unknown error occurred');
    if (process.env.VERBOSE) {
      console.error(error);
    }
    process.exit(1);
  }
}

export function assertTapeExists(tapeId: string | null, availableTapes?: string[]): asserts tapeId is string {
  if (!tapeId) {
    throw new TaraCLIError(
      'Tape ID is required',
      ErrorCode.INVALID_ARGUMENT
    );
  }

  // This will be called after we've verified the tape exists
  // The actual existence check happens in tape-utils.ts
}
