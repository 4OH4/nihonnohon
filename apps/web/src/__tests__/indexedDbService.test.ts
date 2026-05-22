// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { saveStory, getStory, _resetDb } from '@/services/indexedDbService'

beforeEach(() => {
  _resetDb()
})

describe('indexedDbService', () => {
  it('save and retrieve round-trip returns the original object', async () => {
    const uuid = 'test-uuid-1234'
    const rawJson = { schema_version: '1', id: 'test', title: 'Test' }

    await saveStory(uuid, rawJson)
    const result = await getStory(uuid)

    expect(result).toEqual(rawJson)
  })

  it('getStory returns null for an unknown UUID', async () => {
    const result = await getStory('nonexistent-uuid')
    expect(result).toBeNull()
  })
})
