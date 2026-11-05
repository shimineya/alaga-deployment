import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./styles/globals.css";
import axios from 'axios';
import { API_URL } from './lib/config';

axios.defaults.baseURL = API_URL;

// Global Real-Time Client Mutation Sync:
// Whenever any user action completes a mutating API call (POST/PUT/PATCH/DELETE),
// immediately notify all mounted modules/tabs in this browser window in addition
// to the backend SSE broadcast (`system_data_update`).
let clientMutationTimer: ReturnType<typeof setTimeout> | null = null;
const scheduleClientRealtimeRefresh = (url: string, method: string) => {
  const upper = (method || 'GET').toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(upper)) return;
  if (
    url.includes('/api/auth/login') ||
    url.includes('/api/auth/verify') ||
    url.includes('/api/auth/forgot-password') ||
    url.includes('/api/alerts/sync-mute') ||
    url.includes('/api/sensor/reading')
  ) {
    return;
  }
  if (clientMutationTimer) clearTimeout(clientMutationTimer);
  clientMutationTimer = setTimeout(() => {
    window.dispatchEvent(
      new CustomEvent('alaga_manual_refresh', {
        detail: { type: 'client_mutation', method: upper, url, timestamp: new Date().toISOString() }
      })
    );
  }, 80);
};

if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await nativeFetch(input, init);
    try {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method || (typeof input === 'object' && 'method' in input ? input.method : 'GET');
      if (response.ok && url.includes('/api/')) {
        scheduleClientRealtimeRefresh(url, method);
      }
    } catch {
      // ignore interceptor inspection errors
    }
    return response;
  };
}

axios.interceptors.response.use(
  (response) => {
    try {
      const url = response.config?.url || '';
      const method = response.config?.method || 'GET';
      if (response.status >= 200 && response.status < 300) {
        scheduleClientRealtimeRefresh(url, method);
      }
    } catch {
      // ignore interceptor inspection errors
    }
    return response;
  },
  (error) => Promise.reject(error)
);

createRoot(document.getElementById("root")!).render(<App />);
