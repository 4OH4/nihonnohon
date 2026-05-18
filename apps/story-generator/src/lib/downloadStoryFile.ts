/**
 * Trigger a browser download of story JSON as `{id}.json`.
 *
 * Uses a Blob with UTF-8 encoding and no BOM (Blob default).
 * Creates and immediately removes a temporary anchor element to trigger the download.
 */
export function downloadStoryFile(id: string, json: string): void {
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${id}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Defer revoke to the next tick so the browser has time to start the download
  // before the object URL is invalidated (required on Safari/Firefox).
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
