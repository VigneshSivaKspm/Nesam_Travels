import { useState } from "react";
import { useCan } from "../components/AccessContext";
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
  const canPrice = useCan("pricing");
  const canOps = useCan("operations");
  return (
    <div className="ds-page-body">
      <StageBar
        label="Communication"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "Messages", label: <span className="inline-flex items-center gap-2"><Icon name="messages-square" size={15} />Messages &amp; notices</span> },
          { id: "Coupons", label: <span className="inline-flex items-center gap-2"><Icon name="ticket-percent" size={15} />Offers &amp; Coupons</span> },
          { id: "Inbox", label: <span className="inline-flex items-center gap-2"><Icon name="inbox" size={15} />Staff inbox &amp; outbox</span> },
        ]}
      />
      <div className="mt-5">
        {tab === "Messages" && <MessagesPanel canSend={canSend} />}
        {tab === "Coupons" && <CouponsPanel canEdit={canPrice} canSeeUsage={canOps} />}
        {tab === "Inbox" && <NotificationsPage onNavigate={onNavigate} />}
      </div>
    </div>
  );
}
