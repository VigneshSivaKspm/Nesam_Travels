// Responsive layout model shared by every screen (same file in all three apps).
//
// Window size classes follow the Material / Android "window size class" ranges so
// the same rules apply to phones, foldables, tablets and desktop browsers:
//   compact  < 600 dp   phones in portrait      → one column, bottom tabs
//   medium   600–1023   tablets, phones in landscape, small windows
//                                               → centred content, side rail, 2-up lists
//   expanded ≥ 1024     large tablets / desktop → wider content, side rail, 2–3-up lists
import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

export type SizeClass = 'compact' | 'medium' | 'expanded';

export const BREAKPOINTS = { medium: 600, expanded: 1024 } as const;

/** Side navigation width when the tab bar moves to the left: icon rail (medium) / labelled sidebar (expanded). */
export const NAV_WIDTH = { medium: 96, expanded: 232 } as const;

/** Widest the content of a form / detail / reading screen gets. */
export const NARROW_MAX = 640;
/** Widest a dashboard or card grid gets. */
export const WIDE_MAX = 1040;
/** Target width of one card in a multi-column list. */
const CARD_MIN = 420;

export type ContentKind = 'narrow' | 'wide';

export interface Responsive {
  /** Window size in dp / CSS px. */
  width: number;
  height: number;
  sizeClass: SizeClass;
  isCompact: boolean;
  isMedium: boolean;
  isExpanded: boolean;
  isLandscape: boolean;
  /** A phone held sideways: plenty of width, very little height. */
  isShort: boolean;
  /** Width left for screen content after the side navigation (if shown). */
  available: number;
  /** Width of the side navigation (0 on compact, where tabs are at the bottom). */
  navWidth: number;
  /** Max width for a content kind (Infinity on compact: use the full width). */
  maxWidth: (kind?: ContentKind) => number;
  /** How many equal columns a list of cards should use. */
  columns: number;
  /** Side padding for page content. */
  gutter: number;
}

export function sizeClassFor(width: number): SizeClass {
  if (width >= BREAKPOINTS.expanded) return 'expanded';
  if (width >= BREAKPOINTS.medium) return 'medium';
  return 'compact';
}

export function columnsFor(available: number, maxColumns = 3): number {
  return Math.max(1, Math.min(maxColumns, Math.floor((available - 32) / CARD_MIN)));
}

export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();
  return useMemo(() => {
    const sizeClass = sizeClassFor(width);
    const isCompact = sizeClass === 'compact';
    const navWidth = isCompact ? 0 : sizeClass === 'medium' ? NAV_WIDTH.medium : NAV_WIDTH.expanded;
    const available = width - navWidth;
    return {
      width,
      height,
      sizeClass,
      isCompact,
      isMedium: sizeClass === 'medium',
      isExpanded: sizeClass === 'expanded',
      isLandscape: width > height,
      isShort: height < 480,
      available,
      navWidth,
      maxWidth: (kind: ContentKind = 'narrow') => (isCompact ? Infinity : kind === 'wide' ? WIDE_MAX : NARROW_MAX),
      columns: isCompact ? 1 : columnsFor(available),
      gutter: isCompact ? 16 : 24,
    };
  }, [width, height]);
}
