import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles/tokens.css';
import './styles/base.css';
import './styles/ui.css';
import './styles/shell.css';
import './styles/home.css';
import './styles/booking.css';
import './styles/pages.css';
import './styles/multicity.css';
import './styles/mobile.css';
import { App } from './App';
import { installStaleVersionReload } from './components/RouteErrorBoundary';

installStaleVersionReload();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
