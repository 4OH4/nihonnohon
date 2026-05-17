/** Root application component. Mounts the AuthoringTool shell. */
export default function App() {
  return (
    <div className="min-h-screen bg-surface">
      <main className="max-w-[860px] mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold text-paper-text">
          nihonnohon Story Authoring Tool
        </h1>
        <p className="text-muted mt-2">
          Story 2.1 scaffold — components added in subsequent stories.
        </p>
      </main>
    </div>
  )
}
