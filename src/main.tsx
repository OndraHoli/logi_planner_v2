import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx' // <--- Tohle musí směřovat na tvůj upravený soubor
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)