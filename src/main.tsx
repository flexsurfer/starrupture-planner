import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { dispatch, enableTracing } from '@flexsurfer/reflex'
import { EVENT_IDS } from './state/event-ids.ts'

import './index.css'
import './state/db.ts'
import './state/events.ts'
import './state/effects.ts'
import './state/subs.ts'

import App from './App.tsx'

// Enable Reflex tracing and devtools only in development
if (import.meta.env.DEV) {
  enableTracing()

  // Import and enable devtools dynamically
  import('@flexsurfer/reflex-devtools').then(({ enableDevtools }) => {
    enableDevtools()
  })
}

dispatch([EVENT_IDS.INIT_APP]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
