import type { Booking } from "../types";
import { subscribeToDocument } from "./adminFirestoreService";

/** Live view of one booking. `undefined` is "still loading" for the caller; a missing booking is `null`. */
export function subscribeBookingById(id: string, cb: (b: Booking | null) => void, onError?: (message: string) => void) {
  let booking: Booking | null | undefined;
  let contact: { phone?: string; email?: string; whatsapp?: string } | null = null;
  const emit = () => {
    if (booking === undefined) return;
    if (booking === null || !contact) return cb(booking);
    cb({ ...booking, phone: contact.phone || booking.phone, customerEmail: contact.email || booking.customerEmail,
      customerWhatsapp: booking.customerWhatsapp ?? (contact.whatsapp ? { e164: contact.whatsapp, sameAsMobile: contact.whatsapp === contact.phone } : undefined) } as Booking);
  };
  const a = subscribeToDocument<Booking>(`bookings/${id}`, (b) => { booking = b; emit(); }, onError);
  // Raw contact details are in booking_contacts; staff read them there.
  const c = subscribeToDocument<{ phone?: string; email?: string; whatsapp?: string }>(`booking_contacts/${id}`, (x) => { contact = x; emit(); }, () => undefined);
  return () => { a(); c(); };
}
