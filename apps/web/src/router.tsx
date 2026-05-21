// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { LibraryRoute, loader as libraryLoader, LibraryError } from '@/routes/LibraryRoute'
import { ReaderRoute, loader as readerLoader, ReaderError } from '@/routes/ReaderRoute'
import { CreditsRoute } from '@/routes/CreditsRoute'

const router = createBrowserRouter([
  { path: '/', element: <LibraryRoute />, loader: libraryLoader, errorElement: <LibraryError /> },
  { path: '/read/:storyId', element: <ReaderRoute />, loader: readerLoader, errorElement: <ReaderError /> },
  { path: '/credits', element: <CreditsRoute />, errorElement: <LibraryError /> },
])

export function Router() {
  return <RouterProvider router={router} />
}
