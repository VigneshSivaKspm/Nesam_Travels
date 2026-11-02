// Keeps a failed page from leaving a blank screen, for NESAM Cabs, One Way Car Rentals and People Taxi.
//
// The usual cause is a new version being published while a visitor still has the site open: the
// open page asks for page files that no longer exist, and the download fails. The site then reloads
// itself once to pick up the new version. Anything else that breaks a page shows a short message
// with Reload and Home buttons instead of a white screen.
import { Component, type ErrorInfo, type ReactNode } from 'react';

const RELOAD_KEY = 'nesam.stale.reload';

/** Reloads the page once (never in a loop) so a new version of the site is picked up. */
export function reloadForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < 30_000) return false; // just reloaded and it still fails: show the message
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

const STALE_FILE = /(dynamically imported module|importing a module script failed|failed to load module script|loading chunk|loading css chunk|error loading dynamically)/i;
export const isStaleFileError = (error: unknown) => STALE_FILE.test(`${(error as Error | undefined)?.name ?? ''} ${(error as Error | undefined)?.message ?? ''}`);

/** Call once at startup: a page file that fails to download after a new publish triggers the one-time reload. */
export function installStaleVersionReload(): void {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    reloadForNewVersion();
  });
}

interface BoundaryState {
  failed: boolean;
}

class Boundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (isStaleFileError(error)) reloadForNewVersion();
    else console.error('Page failed to render:', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="page">
        <div className="card card--center" role="alert">
          <h2>This page didn’t load</h2>
          <p className="muted">The site may have just been updated. Reload to get the latest version.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 14 }}>
            <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
              Reload page
            </button>
            <a className="btn btn--secondary" href="/">
              Go to home
            </a>
          </div>
        </div>
      </div>
    );
  }
}

/**
 * Wrap the page area. Pass the current page (`resetKey`, e.g. the route's pathname) so the screen
 * recovers by itself when the rider moves to another page. (This file is shared by three sites, so it
 * does not import the router itself.)
 */
export function RouteErrorBoundary({ resetKey, children }: { resetKey: string; children: ReactNode }) {
  return <Boundary key={resetKey}>{children}</Boundary>;
}

export default RouteErrorBoundary;
