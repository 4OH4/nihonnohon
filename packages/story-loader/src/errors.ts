// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

export class LoaderError extends Error {
  constructor(
    public readonly code: 'UNSUPPORTED_VERSION' | 'SCHEMA_INVALID' | 'PARSE_FAILED',
    message: string,
    public readonly cause?: unknown
  ) {
    super(message, { cause })
    this.name = 'LoaderError'
  }
}
