// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { createBrowserRouter, RouterProvider, Outlet, ScrollRestoration } from 'react-router-dom'
import { LibraryRoute, loader as libraryLoader, LibraryError } from '@/routes/LibraryRoute'
import { ReaderRoute, loader as readerLoader, ReaderError } from '@/routes/ReaderRoute'
import { CreditsRoute } from '@/routes/CreditsRoute'

/** Restores scroll position per pathname so both the back button and in-app
 *  navigation links return the user to where they left off on each page. */
function Root() {
  return (
    <>
      <ScrollRestoration getKey={location => location.pathname} />
      <Outlet />
    </>
  )
}

const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: '/', element: <LibraryRoute />, loader: libraryLoader, errorElement: <LibraryError /> },
      { path: '/read/:storyId', element: <ReaderRoute />, loader: readerLoader, errorElement: <ReaderError /> },
      { path: '/credits', element: <CreditsRoute />, errorElement: <LibraryError /> },
    ],
  },
])

export function Router() {
  return <RouterProvider router={router} />
}
