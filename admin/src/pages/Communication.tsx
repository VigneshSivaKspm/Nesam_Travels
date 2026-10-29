import { useState } from "react";
import { useCan, useCanDo, useStaffFlag } from "../components/AccessContext";
import { StageBar } from "../components/ui/ListKit";
import { Icon } from "../components/ui";
import MessagesPanel from "../components/communication/Messages";
import CouponsPanel from "../components/communication/Coupons";
import NotificationsPage from "./NotificationsPage";

type Tab = "Messages" | "Coupons" | "Inbox";

/** Master Admin "Communication": notices and wishes, offers & coupons; the staff inbox / outbox stays as an extra tab. */
export default function Communication({ onNavigate, initialTab }: { onNavigate: (page: string) => void; initialTab?: string }) {
  const [tab, setTab] = useState<Tab>(initialTab === "Coupons" || initialTab === "Inbox" ? initialTab : "Messages");
  const canSend = useCan("engagement");
  // Coupon setup is a Settings change (rules: pricing + Settings edit); reading coupons needs View coupons.
  const canPrice = useCan("pricing");
  const canEditSettings = useCanDo("Settings", "edit");
  const canViewCoupons = useStaffFlag("partnerRights", "viewCoupons");
  const canOps = useCan("operations");
  return (
    <div className="ds-page-body">
      <StageBar
        label="Communication"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "Messages", label: <span className="inline-flex items-center gap-2"><Icon name="messages-square" size={15} />Messages &amp; notices</span> },
          ...(canViewCoupons ? [{ id: "Coupons" as const, label: <span className="inline-flex items-center gap-2"><Icon name="ticket-percent" size={15} />Offers &amp; Coupons</span> }] : []),
          { id: "Inbox", label: <span className="inline-flex items-center gap-2"><Icon name="inbox" size={15} />Staff inbox &amp; outbox</span> },
        ]}
      />
      <div className="mt-5">
        {tab === "Messages" && <MessagesPanel canSend={canSend} />}
        {tab === "Coupons" && canViewCoupons && <CouponsPanel canEdit={canPrice && canEditSettings} canSeeUsage={canOps} />}
        {tab === "Inbox" && <NotificationsPage onNavigate={onNavigate} />}
      </div>
    </div>
  );
}
