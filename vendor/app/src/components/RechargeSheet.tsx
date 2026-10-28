// "Add money" to the working wallet. The server creates the gateway order; Razorpay Checkout runs in a WebView;
// the wallet is credited only after the server verifies the captured payment (functions/src/partnerOps.ts).
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Sheet, TextField } from './ui';
import { Feedback, PButton } from './partner';
import { createWalletRecharge, verifyWalletRecharge, type RechargeOrder } from '../services/partnerOps';
import { colors, space } from '../theme';

const checkoutHtml = (o: RechargeOrder) => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;color:#7a8593">Opening secure payment…
<script src="https://checkout.razorpay.com/v1/checkout.js"></script><script>
var post=function(m){window.ReactNativeWebView.postMessage(JSON.stringify(m))};
var rz=new Razorpay({key:${JSON.stringify(o.keyId)},amount:${o.amount},currency:${JSON.stringify(o.currency)},order_id:${JSON.stringify(o.orderId)},
name:'NESAM Partner',description:'Working wallet recharge',prefill:{name:${JSON.stringify(o.name)},contact:${JSON.stringify(o.phone)}},theme:{color:'#c62828'},
handler:function(r){post({ok:true,orderId:r.razorpay_order_id,paymentId:r.razorpay_payment_id,signature:r.razorpay_signature})},
modal:{ondismiss:function(){post({ok:false,reason:'Payment was cancelled. No money was taken.'})}}});
rz.on('payment.failed',function(){post({ok:false,reason:'The payment failed. You have not been charged; please try again.'})});
rz.open();</script></body></html>`;

export function RechargeSheet({ onClose, onDone }: { onClose: () => void; onDone: (message: string) => void }) {
  const [amount, setAmount] = useState('1000');
  const [order, setOrder] = useState<RechargeOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const start = async () => {
    const n = Number(amount);
    if (!Number.isSafeInteger(n) || n < 100 || n > 100000) { setError('Enter an amount from ₹100 to ₹1,00,000.'); return; }
    setBusy(true); setError('');
    try { setOrder(await createWalletRecharge(n)); }
    catch (e) {
      const m = (e as Error).message;
      setError(/PAYMENT_NOT_CONFIGURED/.test(m) ? 'Online payment is not switched on yet. Contact the NESAM office to add money to your wallet.' : m);
    } finally { setBusy(false); }
  };

  const onMessage = async (raw: string) => {
    let m: { ok: boolean; reason?: string; orderId?: string; paymentId?: string; signature?: string };
    try { m = JSON.parse(raw); } catch { return; }
    setOrder(null);
    if (!m.ok || !m.orderId || !m.paymentId || !m.signature) { setError(m.reason || 'Payment was not completed.'); return; }
    setBusy(true);
    try {
      const v = await verifyWalletRecharge(m.orderId, m.paymentId, m.signature);
      onDone(v.status === 'credited' ? `₹${Number(amount).toLocaleString('en-IN')} added to your working wallet.` : v.message || 'Your payment is being confirmed.');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Sheet visible onClose={onClose} title="Add money" dismissible={!busy && !order}>
      {order ? (
        <View style={styles.web}>
          <WebView originWhitelist={['*']} source={{ html: checkoutHtml(order) }} onMessage={(e) => void onMessage(e.nativeEvent.data)} javaScriptEnabled />
        </View>
      ) : (
        <>
          <Text style={styles.intro}>Add funds to your working wallet.</Text>
          <View style={styles.presets}>
            {[500, 1000, 2000].map((v) => (
              <Pressable key={v} onPress={() => setAmount(String(v))} style={[styles.preset, amount === String(v) && styles.presetOn]} accessibilityRole="button" accessibilityState={{ selected: amount === String(v) }}>
                <Text style={[styles.presetText, amount === String(v) && { color: colors.primary }]}>₹{v.toLocaleString('en-IN')}</Text>
              </Pressable>
            ))}
          </View>
          <TextField label="Enter amount (₹)" value={amount} onChangeText={(v) => setAmount(v.replace(/\D/g, ''))} keyboardType="number-pad" hint="Range: ₹100–₹1,00,000. Your wallet is credited after the payment is confirmed." />
          <Feedback tone="error" message={error} />
          <PButton title="Continue to payment" icon="arrow-forward" busy={busy} full onPress={() => void start()} />
          <Text style={[styles.intro, { textAlign: 'center', marginTop: space.md }]}>Secure payment by Razorpay · UPI, cards and net banking.</Text>
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  web: { height: 520, borderRadius: 12, overflow: 'hidden' },
  intro: { fontSize: 13, color: colors.muted, marginBottom: space.sm },
  presets: { flexDirection: 'row', gap: 10, marginBottom: space.md },
  preset: { flex: 1, minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  presetOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  presetText: { fontSize: 15, fontWeight: '600', color: colors.ink },
});
