export class LoaderError extends Error {
  constructor(
    public readonly code: 'UNSUPPORTED_VERSION' | 'SCHEMA_INVALID' | 'PARSE_FAILED',
    message: string,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = 'LoaderError'
  }
}
