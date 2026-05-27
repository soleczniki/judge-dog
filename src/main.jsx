import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { initSentry } from './sentry.js'
import './index.css'
import App from './App.jsx'

// Initialise Sentry before anything else renders.
// No-op until VITE_SENTRY_DSN is set in .env.production.
initSentry();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
