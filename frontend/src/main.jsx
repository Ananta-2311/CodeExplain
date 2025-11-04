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

