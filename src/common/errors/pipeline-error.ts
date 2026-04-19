export class PipelineError extends Error {
  constructor(
    public readonly stage: string,
    public readonly cause: unknown,
  ) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = 'PipelineError';
  }

  getCauseDetails(): Record<string, unknown> {
    if (this.cause instanceof Error) {
      const errorWithExtras = this.cause as Error & {
        code?: unknown;
        status?: unknown;
        statusCode?: unknown;
      };

      return {
        type: this.cause.name,
        message: this.cause.message,
        stack: this.cause.stack,
        code: errorWithExtras.code,
        status: errorWithExtras.status ?? errorWithExtras.statusCode,
      };
    }

    return {
      type: typeof this.cause,
      message: String(this.cause),
    };
  }
}