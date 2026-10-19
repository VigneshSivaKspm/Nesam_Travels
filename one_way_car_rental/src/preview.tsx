// TEMPORARY visual-review harness (not part of the product). Delete before shipping.
import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow/700.css';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/ui.css';
import './styles/shell.css';
import './styles/home.css';
import './styles/booking.css';
import './styles/pages.css';
import { AuthProvider } from '@/state/Auth';
import { ToastProvider } from '@/state/Toasts';
import { InboxProvider } from '@/state/Inbox';
import { CustomerDataProvider } from '@core/context/CustomerData';
import { BookingProvider, useBooking } from '@/state/Booking';
import { AppRoutes } from '@/App';

const params = new URLSearchParams(location.search);
const route = params.get('route') ?? '/book';
const guest = params.get('guest') === '1';
const profile = guest
  ? null
  : { uid: 'preview-user', name: 'Arun Kumar', phone: '+919876543210', email: 'arun@example.com', photoUrl: '', walletBalance: 250, emergencyContact: '+919812345678', language: 'English', status: 'Active' };

function Seed() {
  const { update } = useBooking();
  useEffect(() => {
    if (params.get('seed') !== '1') return;
    const when = new Date(Date.now() + 26 * 3600 * 1000);
    update({
      pickup: { id: 'p', name: 'Chennai Central', address: 'Chennai, Tamil Nadu', lat: 13.0827, lng: 80.2707, type: 'other' },
      drop: { id: 'd', name: 'Pondicherry White Town', address: 'Puducherry', lat: 11.9416, lng: 79.8083, type: 'other' },
      scheduledAt: when,
    });
  }, [update]);
  return null;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <ToastProvider>
          <InboxProvider userId={undefined}>
            <CustomerDataProvider profile={profile}>
              <BookingProvider>
                <Seed />
                <AppRoutes />
              </BookingProvider>
            </CustomerDataProvider>
          </InboxProvider>
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>
  </StrictMode>,
);
