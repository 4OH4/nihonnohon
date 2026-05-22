// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

const DB_NAME = 'nihonnohon-local-stories'
const STORE_NAME = 'stories'
const DB_VERSION = 1

let db: IDBDatabase | null = null

/** Opens (or reuses) the IndexedDB database, creating the object store on first run. */
function openDb(): Promise<IDBDatabase> {
  if (db) return Promise.resolve(db)
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }
    request.onerror = () => reject(request.error)
  })
}

/** Saves a story JSON object keyed by client-generated UUID. */
export async function saveStory(uuid: string, rawJson: unknown): Promise<void> {
  const database = await openDb()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(rawJson, uuid)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

/** Retrieves a stored story by UUID. Returns null if not found. */
export async function getStory(uuid: string): Promise<unknown | null> {
  const database = await openDb()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).get(uuid)
    request.onsuccess = () => resolve(request.result ?? null)
    request.onerror = () => reject(request.error)
  })
}

/** Test-only: close cached db connection so tests open a fresh instance. */
export function _resetDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
