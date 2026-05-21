// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  // AJV is in devDependencies so tsup bundles it automatically into output
  // @nihonnohon/schema is in dependencies so tsup treats it as external
})
