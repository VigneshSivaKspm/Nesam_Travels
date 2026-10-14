import { db } from './firebase';
import { callBackend } from './backend';
import { createMarketplaceService } from './marketplaceOperations';

export const { rejectBid } = createMarketplaceService(db);

/** Callable errors carry the server's user-safe message. */
async function call(name: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
  try {
    return (await callBackend<Record<string, unknown>, Record<string, unknown>>(name, data)) ?? {};
  } catch (err) {
    const code = (err as { code?: string }).code || '';
    const message = (err as { message?: string }).message || '';
    if (/^functions\/(invalid-argument|failed-precondition|permission-denied|not-found)$/.test(code) && message) throw new Error(message);
    throw new Error('The marketplace action could not be completed. Check your connection and try again.');
  }
}

export const awardBid = (tripId: string, bidId: string) => call('awardMarketplaceBid', { tripId, bidId }).then(() => undefined);

/** Payout omitted = offer from the commission policy; a payout needs finance access. */
export const postBooking = (booking: string, payout: number | null) =>
  call('postBookingToMarketplace', { booking: booking.trim(), ...(payout != null ? { payout } : {}) }).then(() => undefined);

export const assignIndependentDriver = (tripId: string, driverId: string) =>
  call('assignIndependentDriver', { tripId, driverId }).then(() => undefined);
