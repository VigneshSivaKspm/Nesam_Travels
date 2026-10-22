// NESAM brand tokens (match the Web panels: red #E31E24, near-black #111111).
export const colors = {
  primary: '#D92535',
  primaryDark: '#B81C2A',
  primarySoft: '#FFF0F1',
  primaryBorder: '#F6C9CD',
  ink: '#191A20',
  text: '#3A4050',
  muted: '#6E727E',
  faint: '#9AA0AC',
  border: '#E9EBEF',
  divider: '#F0F2F5',
  bg: '#F6F7F9',
  card: '#FFFFFF',
  success: '#167A50',
  successSoft: '#E9F7EF',
  successBorder: '#BFE6D0',
  warning: '#946000',
  warningSoft: '#FFF5DE',
  warningBorder: '#F2DDA3',
  danger: '#B81C2A',
  info: '#2B5CAD',
  infoSoft: '#EEF3FB',
  white: '#FFFFFF',
  overlay: 'rgba(16,19,28,0.5)',
} as const;

export const radius = { sm: 10, md: 12, lg: 16, xl: 22, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const type = {
  h1: { fontSize: 24, fontWeight: '700' as const, color: colors.ink, letterSpacing: -0.4 },
  h2: { fontSize: 18, fontWeight: '700' as const, color: colors.ink },
  h3: { fontSize: 15, fontWeight: '600' as const, color: colors.ink },
  body: { fontSize: 14, color: colors.text },
  small: { fontSize: 12, color: colors.muted },
  tiny: { fontSize: 11, color: colors.faint },
  label: { fontSize: 12, fontWeight: '700' as const, color: colors.text },
} as const;
