import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { LibraryRoute } from '@/routes/LibraryRoute'
import { ReaderRoute } from '@/routes/ReaderRoute'
import { loadStory, LoaderError } from '@nihonnohon/story-loader'

// loadStory and LoaderError will be used by route loaders from Epic 2 onwards.
// Their presence here confirms the AJV v8 CommonJS → Vite/ESM chain works (Story 1.4 AC 2).
export { loadStory, LoaderError }

const router = createBrowserRouter([
  { path: '/', element: <LibraryRoute /> },
  { path: '/read/:storyId', element: <ReaderRoute /> },
])

export function Router() {
  return <RouterProvider router={router} />
}
