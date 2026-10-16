// How a booking is presented to the customer (unit-tested).
import { isActiveStatus } from '../services/rideService';
import type { TripRecord } from '../types';
import { formatINR } from './format';

export type TripTab = 'Upcoming' | 'Completed' | 'Cancelled';

export const tabOfTrip = (t: TripRecord): TripTab => (isActiveStatus(t.status) ? 'Upcoming' : t.status === 'Completed' ? 'Completed' : 'Cancelled');

const DAY_MS = 24 * 3600000;

/**
 * The customer-facing status line and what it means. Exact wording for an advance booking:
 * a booking is never described as "finding a driver" and nothing promises an arrival time.
 */
export function customerStatus(t: TripRecord, now = Date.now()): { label: string; detail: string } {
  if (t.status === 'Rejected') return { label: 'Not accepted', detail: 'one_way_car_rental could not accept this booking request.' };
  switch (t.phase) {
    case 'awaiting_review':
      return { label: 'Awaiting review', detail: 'one_way_car_rental is reviewing your booking request. We’ll confirm here and by message once it is approved.' };
    case 'arranging':
      return { label: 'Approved — arranging your vehicle', detail: 'Your booking is approved. one_way_car_rental is arranging a vehicle and driver, and you’ll see their details here as soon as they are assigned.' };
    case 'partner_confirmed':
      return {
        label: 'Vendor assigned — driver details pending',
        detail: `${t.assignedVendorName || 'A one_way_car_rental partner'} will provide your vehicle. Driver and vehicle details will appear here before your pickup.`,
      };
    case 'driver_assigned': {
      const soon = !!t.scheduledAt && t.scheduledAt.getTime() - now <= DAY_MS;
      return {
        label: soon ? 'Upcoming trip' : 'Driver and vehicle assigned',
        detail: soon ? 'Your driver and vehicle are confirmed for your pickup.' : 'Your driver and vehicle are confirmed. We’ll remind you before your pickup.',
      };
    }
    case 'driver_en_route':
      return { label: 'Driver on the way to pickup', detail: 'Your driver has started towards your pickup point.' };
    case 'driver_arrived':
      return { label: 'Driver at pickup', detail: 'Your driver has reached the pickup point.' };
    case 'in_trip':
      return { label: 'Trip in progress', detail: 'Your trip is underway.' };
    case 'completed':
      return { label: 'Completed', detail: 'This trip is complete.' };
    default:
      return { label: 'Cancelled', detail: 'This booking was cancelled.' };
  }
}

/** Status chip text + colours; the text always carries the meaning, colour only reinforces it. */
export function tripStatusChip(t: TripRecord, now = Date.now()): { label: string; fg: string; bg: string } {
  const blue = { fg: '#1D4ED8', bg: '#E0EDFF' };
  const green = { fg: '#15803D', bg: '#DCFCE7' };
  const amber = { fg: '#B45309', bg: '#FEF3C7' };
  const red = { fg: '#B91C1C', bg: '#FEE2E2' };
  const { label } = customerStatus(t, now);
  if (t.status === 'Rejected') return { label, ...red };
  switch (t.phase) {
    case 'awaiting_review':
    case 'arranging':
      return { label, ...amber };
    case 'completed':
      return { label, ...green };
    case 'cancelled':
      return { label, ...red };
    default:
      return { label, ...blue };
  }
}

/** What the customer still has to do about money on this trip. */
export function paymentLabel(t: TripRecord): { text: string; tone: 'muted' | 'success' | 'danger' } {
  if (t.status === 'Cancelled' || t.status === 'Rejected') {
    if (t.refund && t.refund.amount > 0) return { text: `Refund ${t.refund.status.toLowerCase()}: ${formatINR(t.refund.amount)}`, tone: 'muted' };
    return t.cancellationFee > 0 ? { text: `Cancellation fee ${formatINR(t.cancellationFee)}`, tone: 'danger' } : { text: 'No charge', tone: 'muted' };
  }
  if (t.paymentStatus === 'Paid' || (t.paid && t.paid.totalPaid > 0 && t.paid.balanceDue <= 0)) return { text: 'Paid', tone: 'success' };
  if (t.paid && t.paid.totalPaid > 0) return { text: `Balance ${formatINR(t.paid.balanceDue)}`, tone: 'danger' };
  return { text: t.paymentMethod === 'UPI' ? 'Pay by UPI' : 'Pay at drop', tone: 'muted' };
}

/** Bookings with money to show: completed ones, and cancelled ones that were charged or refunded. */
export function paymentRows(trips: TripRecord[]): TripRecord[] {
  return trips
    .filter((t) => t.status === 'Completed' || t.cancellationFee > 0 || (t.refund && t.refund.amount > 0) || (t.paid && t.paid.totalPaid > 0))
    .sort((a, b) => ((b.completedAt ?? b.cancelledAt ?? b.createdAt)?.getTime() ?? 0) - ((a.completedAt ?? a.cancelledAt ?? a.createdAt)?.getTime() ?? 0));
}
