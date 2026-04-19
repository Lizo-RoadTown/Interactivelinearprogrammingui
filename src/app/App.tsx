import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';

// Render free tier sleeps the backend after 15 min idle; cold-start is 30-60s.
// Hit /api/health as soon as the app loads so the backend is warm by the time
// the user actually presses Solve.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _env = (import.meta as any).env ?? {};
const API_BASE = _env.VITE_API_URL ? `${_env.VITE_API_URL}/api`
               : _env.DEV            ? 'http://localhost:8000/api'
               : '/api';

function warmBackend() {
  // Fire-and-forget. Cache the wake-up per tab so we don't re-ping on every render.
  if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('backend_warmed')) return;
  fetch(`${API_BASE}/health`).catch(() => {});
  if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('backend_warmed', '1');
}

export default function App() {
  useEffect(() => { warmBackend(); }, []);
  return <RouterProvider router={router} />;
}
