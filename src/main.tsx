import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { dispatch, UkladProvider, runtime } from '@/state/runtime'
import { EVENT_IDS } from './state/event-ids.ts'

import './index.css'
import App from './App.tsx'

dispatch([EVENT_IDS.APP_INIT]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UkladProvider runtime={runtime}>
      <App />
    </UkladProvider>
  </StrictMode>,
)
