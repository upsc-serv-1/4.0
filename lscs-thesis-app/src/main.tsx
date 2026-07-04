import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { CasePreview } from './components/CasePreview.tsx'

const params = new URLSearchParams(window.location.search);
const previewId = params.get('preview');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {previewId ? <CasePreview id={previewId} /> : <App />}
  </StrictMode>,
)
