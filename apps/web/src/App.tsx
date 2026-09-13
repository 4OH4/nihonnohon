// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { Router } from '@/router'

export default function App() {
  return (
    <>
      <Router />
      {/* Analytics and Speed Insights are first-party: both the script and the
          collection endpoints are served from this origin under /_vercel/insights,
          which exists only on a Vercel deployment. Gating on PROD therefore keeps
          the dev server and Playwright runs free of 404s and debug logging, and
          avoids the package's NODE_ENV sniffing, which is unreliable under Vite.
          Without route props the injected script auto-tracks history changes, so
          client-side navigation is counted but reported under literal pathnames. */}
      {import.meta.env.PROD && (
        <>
          <Analytics />
          <SpeedInsights />
        </>
      )}
    </>
  )
}
