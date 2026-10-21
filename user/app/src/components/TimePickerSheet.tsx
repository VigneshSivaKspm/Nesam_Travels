// The reference's 12-hour time picker: hour, quarter-hour minute and AM/PM, with
// past or out-of-window times disabled and the choice re-checked on confirm.
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Notice, Sheet } from './ui';
import { colors, fonts, space } from '../theme';

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = [0, 15, 30, 45];
type Period = 'AM' | 'PM';

const pad = (n: number) => String(n).padStart(2, '0');

function compose(day: Date, hour12: number, minute: number, period: Period): Date {
  const d = new Date(day);
  d.setHours((hour12 % 12) + (period === 'PM' ? 12 : 0), minute, 0, 0);
  return d;
}

function zoneLabel(d: Date): string {
  return -d.getTimezoneOffset() === 330 ? 'Indian Standard Time' : 'Your phone’s time zone';
}

/** Mount it only while open (`{open ? <TimePickerSheet … /> : null}`) so it starts from the current value each time. */
export function TimePickerSheet({
  visible,
  title,
  day,
  value,
  problemOf,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  /** The calendar day the time applies to. */
  day: Date;
  value: Date | null;
  /** Why an instant can't be chosen ('' when it can) — e.g. the booking window or “after pickup”. */
  problemOf: (at: Date) => string;
  onClose: () => void;
  onConfirm: (at: Date) => void;
}) {
  const initial = value ?? compose(day, 6, 0, 'PM');
  const [hour, setHour] = useState(() => initial.getHours() % 12 || 12);
  const [minute, setMinute] = useState(() => MINUTES.reduce((a, m) => (Math.abs(m - initial.getMinutes()) < Math.abs(a - initial.getMinutes()) ? m : a), 0));
  const [period, setPeriod] = useState<Period>(() => (initial.getHours() >= 12 ? 'PM' : 'AM'));
  const [error, setError] = useState('');

  const ok = (h: number, m: number, p: Period) => !problemOf(compose(day, h, m, p));
  const current = useMemo(() => compose(day, hour, minute, period), [day, hour, minute, period]);
  const currentProblem = problemOf(current);
  const dayText = day.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  const confirm = () => {
    // Re-checked now: a time can become past while the sheet is open.
    const p = problemOf(current);
    if (p) {
      setError(p);
      return;
    }
    onConfirm(current);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={title} subtitle={`${dayText} · ${zoneLabel(day)}`}>
      <Group label="Hour">
        {HOURS.map((h) => (
          <Option key={h} label={pad(h)} on={h === hour} disabled={!MINUTES.some((m) => ok(h, m, period))} onPress={() => setHour(h)} />
        ))}
      </Group>
      <Group label="Minute">
        {MINUTES.map((m) => (
          <Option key={m} label={pad(m)} on={m === minute} disabled={!ok(hour, m, period)} onPress={() => setMinute(m)} wide />
        ))}
      </Group>
      <Group label="AM / PM">
        {(['AM', 'PM'] as Period[]).map((p) => (
          <Option key={p} label={p} on={p === period} disabled={!HOURS.some((h) => MINUTES.some((m) => ok(h, m, p)))} onPress={() => setPeriod(p)} wide />
        ))}
      </Group>
      <Text style={styles.value} accessibilityLiveRegion="polite">
        {pad(hour)}:{pad(minute)} {period}
      </Text>
      {currentProblem || error ? <Notice tone="warning" message={error || currentProblem} /> : null}
      <Text style={styles.note}>Past times are unavailable. The time is checked again before your booking is confirmed.</Text>
      <Button title="Confirm time" icon="check" onPress={confirm} disabled={!!currentProblem} style={{ marginTop: space.lg }} />
    </Sheet>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {children}
      </View>
    </View>
  );
}

function Option({ label, on, disabled, onPress, wide }: { label: string; on: boolean; disabled: boolean; onPress: () => void; wide?: boolean }) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: on, disabled }}
      style={({ pressed }) => [styles.option, wide && styles.optionWide, on && styles.optionOn, disabled && styles.optionOff, pressed && !disabled && { opacity: 0.7 }]}
    >
      <Text style={[styles.optionText, on && styles.optionTextOn, disabled && { color: '#B5BCC6' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.muted, marginBottom: 7 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  option: { minWidth: 46, flexGrow: 1, flexBasis: '14%', minHeight: 40, borderRadius: 6, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  optionWide: { flexBasis: '20%' },
  optionOn: { borderColor: colors.primary, backgroundColor: '#FFF6F5' },
  optionOff: { backgroundColor: '#F6F7F9', borderColor: '#EEF0F3' },
  optionText: { fontFamily: fonts.medium, fontSize: 14, color: colors.value },
  optionTextOn: { color: colors.primary, fontFamily: fonts.semiBold },
  value: { fontFamily: fonts.semiBold, fontSize: 28, letterSpacing: -0.6, color: colors.ink, textAlign: 'center', marginVertical: space.md },
  note: { fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 17, color: colors.muted },
});
