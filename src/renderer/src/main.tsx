import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'
import { warmServerUrl } from '@/lib/api-client'
import { startEventStream } from '@/lib/event-stream'

// Kick off the server-url IPC before React mounts so the first route
// loader doesn't pay for it. Saves a round-trip on initial paint.
warmServerUrl()

// Open the SSE connection up front. Any session events emitted before
// the first subscriber attaches (e.g. a running session finishing during
// cold start) would otherwise be dropped. Opening here means the channel
// is live by the time the first component subscribes.
startEventStream()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
