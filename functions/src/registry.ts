// The server functions a client may call by name through the HTTP API (api/call/[name]).
//
// This is an explicit allow-list: Firestore triggers, the scheduler and webhooks are
// exported from index.ts too, but must never be reachable as client-callable endpoints.
import * as fns from './index';
import { createRazorpayOrder, verifyRazorpayPayment } from './payments';
import { reconcile } from './reconcile';

export interface CallableLike {
  run(request: {
    data: unknown;
    auth?: { uid: string; token: Record<string, unknown> };
    rawRequest?: unknown;
    acceptsStreaming?: boolean;
  }): unknown;
}

export const CALLABLES: Readonly<Record<string, CallableLike>> = Object.freeze({
  // bookings
  createBooking: fns.createBooking,
  createAdminBooking: fns.createAdminBooking,
  overrideBookingFare: fns.overrideBookingFare,
  approveBooking: fns.approveBooking,
  rejectBooking: fns.rejectBooking,
  cancelBooking: fns.cancelBooking,
  updateRefund: fns.updateRefund,
  assignDriver: fns.assignDriver,
  acknowledgeUnassignedAlert: fns.acknowledgeUnassignedAlert,
  migrateMarketplaceVisibility: fns.migrateMarketplaceVisibility,
  backfillFulfilmentRoute: fns.backfillFulfilmentRoute,
  // money
  recordPayment: fns.recordPayment,
  voidPayment: fns.voidPayment,
  saveFareAdjustment: fns.saveFareAdjustment,
  saveTariffConfig: fns.saveTariffConfig,
  saveTariffSection: fns.saveTariffSection,
  saveServiceRule: fns.saveServiceRule,
  setServiceRuleStatus: fns.setServiceRuleStatus,
  quoteBooking: fns.quoteBooking,
  saveCommissionPolicy: fns.saveCommissionPolicy,
  requestPartnerPayout: fns.requestPartnerPayout,
  rebuildPartnerLedger: fns.rebuildPartnerLedger,
  updateSettlement: fns.updateSettlement,
  createRazorpayOrder,
  verifyRazorpayPayment,
  reconcile,
  // trips
  getCustomerContact: fns.getCustomerContact,
  updateBookingContact: fns.updateBookingContact,
  migrateBookingContacts: fns.migrateBookingContacts,
  advanceTrip: fns.advanceTrip,
  overrideReachedPickup: fns.overrideReachedPickup,
  verifyBoarding: fns.verifyBoarding,
  createCaptureSession: fns.createCaptureSession,
  getSlotChallenge: fns.getSlotChallenge,
  submitCapturePhoto: fns.submitCapturePhoto,
  finalizeVehicleVerification: fns.finalizeVehicleVerification,
  // marketplace
  awardMarketplaceBid: fns.awardMarketplaceBid,
  rejectMarketplaceBid: fns.rejectMarketplaceBid,
  postBookingToMarketplace: fns.postBookingToMarketplace,
  assignIndependentDriver: fns.assignIndependentDriver,
  assignVendor: fns.assignVendor,
  vendorAssignDriver: fns.vendorAssignDriver,
  findPartnerDriver: fns.findPartnerDriver,
  findPartnerVehicle: fns.findPartnerVehicle,
  requestDriverLink: fns.requestDriverLink,
  requestVehicleLink: fns.requestVehicleLink,
  adminCreatePartnerLink: fns.adminCreatePartnerLink,
  verifyPartnerLinkOtp: fns.verifyPartnerLinkOtp,
  resendPartnerLinkOtp: fns.resendPartnerLinkOtp,
  requestPartnerLinkHelp: fns.requestPartnerLinkHelp,
  cancelPartnerLink: fns.cancelPartnerLink,
  decidePartnerLink: fns.decidePartnerLink,
  claimMarketplaceDuty: fns.claimMarketplaceDuty,
  submitMarketplaceBid: fns.submitMarketplaceBid,
  withdrawMarketplaceBid: fns.withdrawMarketplaceBid,
  // penalties
  issuePenalty: fns.issuePenalty,
  transitionPenalty: fns.transitionPenalty,
  acknowledgePenalty: fns.acknowledgePenalty,
  disputePenalty: fns.disputePenalty,
  // identity, legal, security
  reportSecurityEvent: fns.reportSecurityEvent,
  getIntegrityNonce: fns.getIntegrityNonce,
  verifyDeviceIntegrity: fns.verifyDeviceIntegrity,
  sendVerificationCode: fns.sendVerificationCode,
  verifyCustomerCode: fns.verifyCustomerCode,
  getLegalStatus: fns.getLegalStatus,
  acceptLegalDocuments: fns.acceptLegalDocuments,
  publishLegalDocument: fns.publishLegalDocument,
  seedLegalDocuments: fns.seedLegalDocuments,
  // staff & partners
  approveAdminRequest: fns.approveAdminRequest,
  rejectAdminRequest: fns.rejectAdminRequest,
  updateAdminAccess: fns.updateAdminAccess,
  saveStaffRole: fns.saveStaffRole,
  deleteStaffRole: fns.deleteStaffRole,
  saveStaffProfile: fns.saveStaffProfile,
  revokeStaffSessions: fns.revokeStaffSessions,
  requestVendorRegistration: fns.requestVendorRegistration,
  issueVendorInvitation: fns.issueVendorInvitation,
  revokeVendorInvitation: fns.revokeVendorInvitation,
  redeemVendorInvitation: fns.redeemVendorInvitation,
  lookupVehicleByRegistration: fns.lookupVehicleByRegistration,
  // notifications
  sendNotification: fns.sendNotification,
  sendNoticeCampaign: fns.sendNoticeCampaign,
  retryFailedDeliveries: fns.retryFailedDeliveries,
});

/** Names whose result changes a booking, so the booking is reconciled right after the call. */
export const BOOKING_ID_FIELDS = ['bookingId', 'requestId', 'tripId', 'id'] as const;

/** Callables that create / change bookings or payout requests (reconciled after success). */
export const RECONCILES_BOOKING = new Set([
  'createBooking', 'createAdminBooking', 'overrideBookingFare', 'approveBooking', 'rejectBooking', 'cancelBooking', 'updateRefund',
  'assignDriver', 'recordPayment', 'voidPayment', 'advanceTrip', 'overrideReachedPickup', 'verifyBoarding', 'awardMarketplaceBid', 'rejectMarketplaceBid', 'postBookingToMarketplace',
  'assignIndependentDriver', 'assignVendor', 'vendorAssignDriver', 'claimMarketplaceDuty', 'submitMarketplaceBid', 'withdrawMarketplaceBid', 'finalizeVehicleVerification',
]);
export const RECONCILES_PAYOUT = new Set(['requestPartnerPayout']);

/** Callables a signed-out visitor may use: read-only fare quotes (rate-limited per IP, nothing written). */
export const PUBLIC_CALLABLES: ReadonlySet<string> = new Set(['quoteBooking']);
