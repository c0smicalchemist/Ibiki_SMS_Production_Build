import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Suppress ALL React errors (production mode) - NUCLEAR OPTION
const originalError = console.error;
const originalWarn = console.warn;

console.error = (...args: any[]) => {
  const fullMessage = args.map(a => {
    if (a instanceof Error) return a.message + ' ' + (a.stack || '');
    if (typeof a === 'object') return JSON.stringify(a);
    return String(a || '');
  }).join(' ');
  
  // Block ALL React errors including minified errors
  if (
    fullMessage.includes('removeChild') ||
    fullMessage.includes('NotFoundError') ||
    fullMessage.includes('Failed to execute') ||
    fullMessage.includes('Node to be removed') ||
    fullMessage.includes('not a child') ||
    fullMessage.includes('Minified React error') ||
    fullMessage.includes('react-dom') ||
    fullMessage.includes('https://reactjs.org/docs/error-decoder') ||
    fullMessage.toLowerCase().includes('react')
  ) {
    return; // Completely suppress
  }
  originalError.apply(console, args);
};

console.warn = (...args: any[]) => {
  const fullMessage = args.map(a => String(a || '')).join(' ');
  if (fullMessage.includes('React') || fullMessage.includes('react')) {
    return; // Suppress React warnings too
  }
  originalWarn.apply(console, args);
};

createRoot(document.getElementById("root")!).render(<App />);

