/**
 * Bootstraps the React app: mounts under #root and wraps the tree in SettingsProvider.
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

