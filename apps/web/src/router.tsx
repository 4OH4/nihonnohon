import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { LibraryRoute } from '@/routes/LibraryRoute'
import { ReaderRoute } from '@/routes/ReaderRoute'
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- verifies AJV v8 ESM chain (Story 1.4 AC 2); import moves to route loader in Epic 2
import { loadStory, LoaderError } from '@nihonnohon/story-loader'

const router = createBrowserRouter([
  { path: '/', element: <LibraryRoute /> },
  { path: '/read/:storyId', element: <ReaderRoute /> },
])

export function Router() {
  return <RouterProvider router={router} />
}
