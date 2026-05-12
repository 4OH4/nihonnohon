import { Link } from 'react-router-dom'

/** Placeholder — full library implemented in Epic 3. */
export function LibraryRoute() {
  return (
    <main className="p-8">
      <h1 className="text-xl font-semibold mb-4">Library</h1>
      <p className="text-muted mb-6">Story library — implemented in Epic 3.</p>
      <Link
        to="/read/genki-i-ch6-tanaka-letter"
        className="text-sm underline text-paper-text hover:text-accent transition-colors"
      >
        → Open demo story: A Letter from Mary (Genki I Ch.6)
      </Link>
    </main>
  )
}
