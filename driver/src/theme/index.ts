// NESAM brand tokens (match the Web panels: red #E31E24, near-black #111111).
export const colors = {
  primary: '#E31E24',
  primaryDark: '#C41820',
  primarySoft: '#FEF2F2',
  primaryBorder: '#FBD5D5',
  ink: '#111111',
  text: '#1F2937',
  muted: '#6B7280',
  faint: '#9CA3AF',
  border: '#E5E7EB',
  divider: '#F0F0F0',
  bg: '#F7F7F7',
  card: '#FFFFFF',
  success: '#15803D',
  successSoft: '#ECFDF5',
  successBorder: '#A7F3D0',
  warning: '#B45309',
  warningSoft: '#FFFBEB',
  warningBorder: '#FDE68A',
  danger: '#D92D20',
  info: '#1D4ED8',
  infoSoft: '#EFF6FF',
  white: '#FFFFFF',
  page: '#FFFFFF',
  slate: '#64748B',
  navy: '#1E2B58',
  overlay: 'rgba(17,17,17,0.55)',
} as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const shadows = {
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
} as const;

export const type = {
  display: { fontSize: 30, fontWeight: '800' as const, color: colors.ink, letterSpacing: -0.5 },
  h1: { fontSize: 24, fontWeight: '800' as const, color: colors.ink, letterSpacing: -0.3 },
  h2: { fontSize: 20, fontWeight: '700' as const, color: colors.ink, letterSpacing: -0.2 },
  h3: { fontSize: 16, fontWeight: '700' as const, color: colors.ink },
  body: { fontSize: 15, color: colors.text, lineHeight: 22 },
  bodyMedium: { fontSize: 15, fontWeight: '600' as const, color: colors.text, lineHeight: 22 },
  small: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  tiny: { fontSize: 12, fontWeight: '600' as const, color: colors.muted, lineHeight: 16 },
  label: { fontSize: 14, fontWeight: '700' as const, color: colors.text },
} as const;
