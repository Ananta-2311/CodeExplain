/**
 * Bootstraps the React app: mounts under #root and wraps the tree in SettingsProvider.
 *
 * Entry point for Vite: creates a React 18 root, enables StrictMode for
 * double-invoking effects in dev, and provides settings context to the whole tree.
 */
import React from 'react'
import { createRoot } from 'react-dom/client'
import { SettingsProvider } from './context/SettingsContext'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SettingsProvider>
      <App />
    </SettingsProvider>
  </React.StrictMode>
)

