// Fetches the authoritative quotes whenever the trip changes (debounced, stale answers dropped).
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchQuotes, quoteKeyOf, type QuoteRequest, type ServerQuoteResponse } from '../services/quoteService';

export type QuoteStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ServerQuoteState {
  status: QuoteStatus;
  key: string;
  data: ServerQuoteResponse | null;
  error: string;
  retry: () => void;
}

export function useServerQuotes(request: QuoteRequest | null, enabled = true): ServerQuoteState {
  const key = enabled ? quoteKeyOf(request) : '';
  const [state, setState] = useState<{ key: string; status: QuoteStatus; data: ServerQuoteResponse | null; error: string }>({ key: '', status: 'idle', data: null, error: '' });
  const [attempt, setAttempt] = useState(0);
  const [previousKey, setPreviousKey] = useState(key);
  if (key !== previousKey) {
    setPreviousKey(key);
    setState({ key, status: key ? 'loading' : 'idle', data: null, error: '' });
  }
  const latest = useRef(request);
  useEffect(() => { latest.current = request; }, [request]);

  useEffect(() => {
    const req = latest.current;
    if (!key || !req) return undefined;
    let cancelled = false;
    const t = setTimeout(() => {
      setState((s) => ({ key, status: 'loading', data: s.key === key ? s.data : null, error: '' }));
      fetchQuotes(req)
        .then((data) => !cancelled && setState({ key, status: 'ready', data, error: '' }))
        .catch((e: unknown) => !cancelled && setState({ key, status: 'error', data: null, error: (e as { message?: string })?.message || 'We could not get the fare right now.' }));
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [key, attempt]);

  const retry = useCallback(() => {
    setState((s) => ({ ...s, status: 'loading', error: '' }));
    setAttempt((n) => n + 1);
  }, []);
  // A result for a different trip is never exposed.
  const current = state.key === key ? state : { key, status: key ? ('loading' as const) : ('idle' as const), data: null, error: '' };
  return { status: current.status, key, data: current.data, error: current.error, retry };
}
