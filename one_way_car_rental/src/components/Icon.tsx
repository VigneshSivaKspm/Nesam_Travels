// One icon family: the One Way Car Rental icon set (24-unit grid, 1.8 stroke, round caps, currentColor).
import type { CSSProperties } from 'react';

const files = import.meta.glob('../assets/icons/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const SVG_OPEN = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">';

// A few glyphs the collection does not include, drawn to the same grid and stroke.
const extra: Record<string, string> = {
  swap: `${SVG_OPEN}<path d="M7 4v14M7 18l-3-3M7 18l3-3M17 20V6M17 6l-3 3M17 6l3 3"/></svg>`,
  copy: `${SVG_OPEN}<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/></svg>`,
  'arrow-right': `${SVG_OPEN}<path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
  'arrow-left': `${SVG_OPEN}<path d="M19 12H5M11 6l-6 6 6 6"/></svg>`,
  star: `${SVG_OPEN}<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8-4.3-4.1 5.9-.9L12 3.5Z"/></svg>`,
  plane: `${SVG_OPEN}<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2Z"/></svg>`,
  briefcase: `${SVG_OPEN}<rect x="3.5" y="7.5" width="17" height="12" rx="2.5"/><path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5M3.5 13h17"/></svg>`,
  trash: `${SVG_OPEN}<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/></svg>`,
  moon: `${SVG_OPEN}<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg>`,
  luggage: `${SVG_OPEN}<rect x="6" y="7" width="12" height="13" rx="2.5"/><path d="M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2M9.5 11v5M14.5 11v5"/></svg>`,
};

const byName: Record<string, string> = { ...extra };
for (const [path, raw] of Object.entries(files)) {
  const name = path.split('/').pop()!.replace(/\.svg$/, '');
  byName[name] = raw.replace('<svg ', '<svg aria-hidden="true" focusable="false" ');
}

export function Icon({ name, size = 20, className = '', style }: { name: string; size?: number; className?: string; style?: CSSProperties }) {
  const svg = byName[name];
  if (!svg) {
    if (import.meta.env.DEV) console.warn(`[icon] missing "${name}"`);
    return <span className={`icon ${className}`} style={{ '--icon': `${size}px`, ...style } as CSSProperties} />;
  }
  return <span className={`icon ${className}`} style={{ '--icon': `${size}px`, ...style } as CSSProperties} dangerouslySetInnerHTML={{ __html: svg }} />;
}
