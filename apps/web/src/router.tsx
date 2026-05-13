import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { LibraryRoute, loader as libraryLoader, LibraryError } from '@/routes/LibraryRoute'
import { ReaderRoute, loader as readerLoader, ReaderError } from '@/routes/ReaderRoute'

const router = createBrowserRouter([
  { path: '/', element: <LibraryRoute />, loader: libraryLoader, errorElement: <LibraryError /> },
  { path: '/read/:storyId', element: <ReaderRoute />, loader: readerLoader, errorElement: <ReaderError /> },
])

export function Router() {
  return <RouterProvider router={router} />
}
