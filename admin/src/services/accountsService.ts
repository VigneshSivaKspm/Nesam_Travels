/**
 * Office accounting registers (Master Admin → Accounts): expenses and supplier bills, bank / cash
 * entries, tax payments, account openings / adjustments, partner settlements, security deposits,
 * reconciliation entries and daily closings. Each record is entered once and kept; corrections
 * are new entries. Recording an entry never moves money.
 */
import { addDoc, collection, doc, onSnapshot, runTransaction, serverTimestamp, Timestamp, updateDoc } from "firebase/firestore";
import { ref as storageRef, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "./firebase";

export type RegisterKind = "expense" | "supplier_bill" | "bank" | "tax" | "opening" | "adjustment" | "settlement" | "deposit" | "recon" | "closing" | "refund_request" | "filing";

export interface RegisterEntry {
  id: string;
  kind: RegisterKind;
  date: string;
  amount: number;
  /** Expenses & bills */
  category?: string;
  payee?: string;
  reference?: string;
  taxable?: number;
  tax?: number;
  gstin?: string;
  itcStatus?: "Unreviewed" | "Eligible" | "Ineligible";
  remarks?: string;
  fileName?: string;
  filePath?: string;
  /** Bank / cash / reconciliation */
  account?: "Bank" | "Cash" | "Payment gateway";
  direction?: "Money in" | "Money out" | "Debit" | "Credit";
  description?: string;
  matchStatus?: "Unmatched" | "Matched" | "Amount mismatch";
  matchedRef?: string;
  /** Tax payments */
  taxType?: "GST" | "Income Tax / Advance Tax" | "TDS";
  period?: string;
  purpose?: "Cash ledger deposit" | "Liability discharged";
  liabilitySettled?: number;
  /** Statements: the account an opening / adjustment / settlement / deposit belongs to */
  accountType?: "customer" | "vendor" | "driver" | "business";
  accountId?: string;
  accountName?: string;
  /** Closings */
  snapshot?: { register: string; value: string; basis: string }[];
  status?: string;
  verifiedByName?: string;
  verifiedAt?: Timestamp;
  /** Refund requests */
  bookingId?: string;
  bookingCode?: string;
  createdByName?: string;
  createdBy?: string;
  createdAt?: Timestamp;
}

const COL = "accounts_register";
const who = () => ({ uid: auth.currentUser?.uid ?? "", name: auth.currentUser?.displayName || auth.currentUser?.email?.split("@")[0] || "Staff" });

export function subscribeRegister(cb: (rows: RegisterEntry[]) => void, onError?: (m: string) => void) {
  return onSnapshot(collection(db, COL), (s) => cb(s.docs.map((d) => ({ ...(d.data() as Omit<RegisterEntry, "id">), id: d.id }))), (e) => (onError ? onError(e.message) : cb([])));
}

export async function addRegisterEntry(e: Omit<RegisterEntry, "id" | "createdAt" | "createdBy" | "createdByName">, file?: File | null): Promise<string> {
  const me = who();
  let filePath = "";
  if (file) {
    if (file.size > 750 * 1024) throw new Error("Each file must be 750 KB or smaller.");
    filePath = `accounts/${e.kind}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
    await uploadBytes(storageRef(storage, filePath), file);
  }
  const clean = Object.fromEntries(Object.entries(e).filter(([, v]) => v !== undefined && v !== ""));
  const r = await addDoc(collection(db, COL), { ...clean, ...(file ? { fileName: file.name, filePath } : {}), createdBy: me.uid, createdByName: me.name, createdAt: serverTimestamp() });
  return r.id;
}

/** Status-only updates (ITC review, reconciliation match, closing verification). */
export async function markRegister(id: string, patch: Pick<RegisterEntry, "itcStatus" | "matchStatus" | "matchedRef" | "status">) {
  const me = who();
  await updateDoc(doc(db, COL, id), { ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)), verifiedByName: me.name, verifiedAt: serverTimestamp() });
}

/** Next NSM-CLOSE-###### reference for a daily closing. */
export async function nextClosingRef(): Promise<string> {
  const counter = doc(db, "counters", "accounts_closing");
  return runTransaction(db, async (tx) => {
    const c = await tx.get(counter);
    const n = (c.exists() ? Number(c.data().value) || 0 : 0) + 1;
    tx.set(counter, { value: n }, { merge: true });
    return `NSM-CLOSE-${String(n).padStart(6, "0")}`;
  });
}

export const EXPENSE_CATEGORIES = ["Office rent", "Internet & phone", "Staff expense", "Marketing", "Software", "Travel / operations", "Other"] as const;
export const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
export const tsToDate = (t?: Timestamp) => (t?.toDate ? t.toDate() : null);
