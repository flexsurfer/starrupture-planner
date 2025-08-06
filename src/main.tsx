import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { dispatch } from '@flexsurfer/reflex'
import { EVENT_IDS } from './state/event-ids.ts'

import './index.css'
import './state/db.ts'
import './state/events.ts'
import './state/effects.ts'
import './state/subs.ts'

import App from './App.tsx'

dispatch([EVENT_IDS.INIT_APP]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
