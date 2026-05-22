// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge Tailwind classes safely — always use this instead of string concatenation. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
