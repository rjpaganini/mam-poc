// index.js - Main entry point for the React frontend
// Purpose: Bootstraps the React application and mounts it to the DOM

import React from 'react';
import ReactDOM from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import './index.css';
import App from './App';

// Error Boundary for catching React rendering errors
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log to console in development
    console.error('React Error Boundary caught an error:', error, errorInfo);
    // TODO: Send to error tracking service
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: '20px', 
          textAlign: 'center', 
          backgroundColor: '#1a1a1a',
          color: '#fff' 
        }}>
          <h2>Something went wrong</h2>
          <button 
            onClick={() => window.location.reload()} 
            style={{
              padding: '10px 20px',
              backgroundColor: '#6366f1',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              cursor: 'pointer'
            }}
          >
            Reload Application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Router configuration with future flags
const routerConfig = {
    future: {
        v7_startTransition: true,
        v7_relativeSplatPath: true
    },
    // Add initial entry for MemoryRouter
    initialEntries: ['/'],
    initialIndex: 0
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <ErrorBoundary>
            <MemoryRouter {...routerConfig}>
                <App />
            </MemoryRouter>
        </ErrorBoundary>
    </React.StrictMode>
);
