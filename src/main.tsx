import { appIds } from './app/uklad/catalog';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { UkladProvider } from '@/app/uklad/bindings'
import { runtime } from '@/app/uklad/bootstrap'

import './index.css'
import App from './App.tsx'

runtime.dispatch([appIds.events.APP_INIT]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UkladProvider runtime={runtime}>
      <App />
    </UkladProvider>
  </StrictMode>,
)
