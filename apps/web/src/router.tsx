import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { LibraryRoute } from '@/routes/LibraryRoute'
import { ReaderRoute, loader as readerLoader } from '@/routes/ReaderRoute'

const router = createBrowserRouter([
  { path: '/', element: <LibraryRoute /> },
  { path: '/read/:storyId', element: <ReaderRoute />, loader: readerLoader },
])

export function Router() {
  return <RouterProvider router={router} />
}
