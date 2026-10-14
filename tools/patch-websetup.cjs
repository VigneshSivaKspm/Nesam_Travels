const fs = require('fs');
const f = 'user/src/platform/webSetup.web.ts';
let s = fs.readFileSync(f, 'utf8');
s = s.replace(`//   4. The app is designed for a phone screen — on a wide window it is shown as
//      a centred column instead of stretching across the monitor.
`, `//   4. Page-level CSS: full-viewport height that survives mobile browser chrome,
//      no rubber-band scrolling, visible keyboard focus.
// (Responsive layout itself lives in theme/responsive.ts and components/layout.tsx.)
`);
s = s.replace(`/** Widest the app column gets on a desktop window (px). */
const MAX_COLUMN_WIDTH = 480;

`, '');
const start = s.indexOf('function installLayout(): void {');
const end = s.indexOf('installAlert();');
s = s.slice(0, start) + `function installLayout(): void {
  const style = document.createElement('style');
  style.id = 'nesam-web-layout';
  style.textContent = \`
    html, body { background: #F7F7F7; overscroll-behavior: none; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
    body { overflow: hidden; }
    /* 100dvh tracks the visible area on phones whose address bar collapses. */
    html, body, #root { height: 100%; }
    @supports (height: 100dvh) { html, body, #root { height: 100dvh; } }
    input, textarea, select, button { font-family: inherit; }
    /* Keyboard users get a visible focus ring; mouse and touch users do not. */
    :focus { outline: none; }
    :focus-visible { outline: 2px solid #E31E24; outline-offset: 2px; }
    @media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
  \`;
  document.head.appendChild(style);
}

` + s.slice(end);
fs.writeFileSync(f, s);
for (const d of ['driver', 'vendor']) fs.copyFileSync(f, `${d}/src/platform/webSetup.web.ts`);
