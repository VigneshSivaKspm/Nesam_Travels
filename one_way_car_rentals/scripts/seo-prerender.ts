// Build-time SEO for the single-page site. Every URL is served by one index.html, so without this
// crawlers and link previews that don't run JavaScript would see the home page's title and
// canonical everywhere. For each public page this writes dist/<path>/index.html with that page's
// head tags and a plain-HTML summary (inside <noscript>), then writes dist/sitemap.xml from the
// same list. Vercel serves those files before falling back to the SPA rewrite.
import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { FAQS, SERVICES } from '../src/pages/book/content';
import { ALL_ROUTES, type RouteGuide } from '../src/pages/routes/routesData';
import { ALL_SERVICES, type ServiceDetail } from '../src/pages/services/servicesData';
import { HOME_SEO, LEGAL_SEO, OFFERS_SEO, SUPPORT_SEO, routeSeo, serviceSeo } from '../src/seo/pages';
import { SITE, absoluteUrl, escapeHtml as e, renderHeadTags, type SeoProps } from '../src/seo/site';

interface Page {
  path: string;
  seo: SeoProps;
  images: Array<{ loc: string; title: string }>;
  body: string;
}

const PHONE_DISPLAY = '+91 90250 99990';

const link = (href: string, text: string) => `<a href="${e(href)}">${e(text)}</a>`;
const list = (items: string[]) => `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
const faqHtml = (faqs: ReadonlyArray<{ q: string; a: string }>) => faqs.map((f) => `<h3>${e(f.q)}</h3><p>${e(f.a)}</p>`).join('');

const routeLinks = (except?: string) =>
  list(
    ALL_ROUTES.filter((r) => r.slug !== except).map(
      (r) => `${link(`/routes/${r.slug}`, `${r.origin} to ${r.destination} one way taxi`)} — about ${e(r.km)}, ${e(r.duration)}`,
    ),
  );
const serviceLinks = (except?: string) =>
  list(ALL_SERVICES.filter((s) => s.slug !== except).map((s) => `${link(`/services/${s.slug}`, s.name)} — ${e(s.lead)}`));

const nav = `<nav aria-label="Site">${list([
  link('/', 'Book a one way taxi'),
  link('/offers', 'Offers'),
  link('/support', 'Support'),
  link('/legal', 'Terms & privacy'),
  link(`tel:${SITE.phone}`, `Call ${PHONE_DISPLAY}`),
])}</nav>`;

const footer = `<footer><p>${e(SITE.legalName)}, Theni, Tamil Nadu 625531, India. 24/7 helpline ${link(`tel:${SITE.phone}`, PHONE_DISPLAY)} · ${e(SITE.email)}</p></footer>`;

const wrap = (inner: string) =>
  `<p class="seo-js-note">${e(SITE.name)} needs JavaScript for live booking. You can also book by phone: ${link(`tel:${SITE.phone}`, PHONE_DISPLAY)}.</p>` +
  `<div class="seo-static">${nav}<main>${inner}</main>${footer}</div>`;

function homeBody(): string {
  return wrap(
    `<h1>One Way Taxi &amp; Outstation Cabs in Tamil Nadu</h1>` +
      `<p>Book a one way drop taxi, outstation round trip, airport transfer or hourly local rental across Tamil Nadu, Bangalore and Pondicherry. See the fare for every vehicle before you book, travel with a verified chauffeur and pay your driver by cash or UPI at the end of the trip.</p>` +
      `<h2>Popular one way routes</h2>${routeLinks()}` +
      `<h2>Services</h2>${serviceLinks()}` +
      `<h2>More ways to travel</h2>${list(SERVICES.map((s) => `<strong>${e(s.title)}</strong> — ${e(s.text)}`))}` +
      `<h2>Frequently asked questions</h2>${faqHtml(FAQS)}`,
  );
}

function routeBody(r: RouteGuide): string {
  return wrap(
    `<h1>${e(r.h1)}</h1><p>${e(r.summary)}</p>` +
      list([`Distance: about ${e(r.km)}`, `Driving time: about ${e(r.duration)}`, `Usual route: ${e(r.highway)}`]) +
      `<h2>Travelling from ${e(r.origin)} to ${e(r.destination)}</h2>${r.overview.map((p) => `<p>${e(p)}</p>`).join('')}` +
      `<h2>Stops along the way</h2>${list(r.keyStops.map((s) => `<strong>${e(s.name)}</strong> — ${e(s.description)}`))}` +
      `<h2>${e(r.origin)} to ${e(r.destination)} taxi FAQs</h2>${faqHtml(r.faqs)}` +
      `<h2>Other one way routes</h2>${routeLinks(r.slug)}`,
  );
}

function serviceBody(s: ServiceDetail): string {
  return wrap(
    `<h1>${e(s.h1)}</h1><p>${e(s.lead)}</p>` +
      list(s.features.map((f) => `<strong>${e(f.title)}</strong> — ${e(f.text)}`)) +
      `<h2>How it works</h2>${s.overview.map((p) => `<p>${e(p)}</p>`).join('')}` +
      `<h2>Billing</h2>${list(s.billing.map((b) => `<strong>${e(b.title)}</strong> — ${e(b.detail)}`))}` +
      `<h2>Frequently asked questions</h2>${faqHtml(s.faqs)}` +
      `<h2>Popular routes</h2>${routeLinks()}<h2>Other services</h2>${serviceLinks(s.slug)}`,
  );
}

const simpleBody = (h1: string, text: string) => wrap(`<h1>${e(h1)}</h1><p>${e(text)}</p><h2>Popular one way routes</h2>${routeLinks()}`);

function pages(): Page[] {
  return [
    {
      path: '/',
      seo: HOME_SEO,
      images: [{ loc: SITE.image, title: SITE.imageAlt }],
      body: homeBody(),
    },
    ...ALL_ROUTES.map((r) => ({
      path: `/routes/${r.slug}`,
      seo: routeSeo(r),
      images: r.imageUrl ? [{ loc: r.imageUrl, title: `${r.origin} to ${r.destination} one way taxi` }] : [],
      body: routeBody(r),
    })),
    ...ALL_SERVICES.map((s) => ({
      path: `/services/${s.slug}`,
      seo: serviceSeo(s),
      images: [{ loc: s.imageUrl, title: s.h1 }],
      body: serviceBody(s),
    })),
    { path: '/offers', seo: OFFERS_SEO, images: [], body: simpleBody('Offers and promo codes', OFFERS_SEO.description ?? '') },
    { path: '/support', seo: SUPPORT_SEO, images: [], body: simpleBody('Customer support', SUPPORT_SEO.description ?? '') },
    { path: '/legal', seo: LEGAL_SEO, images: [], body: simpleBody('Terms of service and privacy policy', LEGAL_SEO.description ?? '') },
  ];
}

const HEAD = /<!--seo:head-->[\s\S]*?<!--\/seo:head-->/;
const BODY = /<!--seo:body-->[\s\S]*?<!--\/seo:body-->/;

function fill(html: string, page: Page): string {
  if (!HEAD.test(html) || !BODY.test(html)) throw new Error('index.html is missing the <!--seo:head--> / <!--seo:body--> markers');
  return html
    .replace(HEAD, () => `<!--seo:head-->\n    ${renderHeadTags(page.seo)}\n    <!--/seo:head-->`)
    .replace(BODY, () => `<!--seo:body-->${page.body}<!--/seo:body-->`);
}

function sitemap(entries: Page[]): string {
  const today = new Date().toISOString().slice(0, 10);
  const urls = entries.map((p) => {
    const images = p.images
      .map((i) => `\n    <image:image>\n      <image:loc>${e(absoluteUrl(i.loc))}</image:loc>\n      <image:title>${e(i.title)}</image:title>\n    </image:image>`)
      .join('');
    return `  <url>\n    <loc>${e(absoluteUrl(p.path))}</loc>\n    <lastmod>${today}</lastmod>${images}\n  </url>`;
  });
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' +
    `${urls.join('\n')}\n</urlset>\n`
  );
}

export function seoPrerender(): Plugin {
  let outDir = 'dist';
  const all = pages();
  const home = all[0];
  return {
    name: 'seo-prerender',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    // Dev and build: index.html (the home page, and the fallback for every other URL) gets the home tags.
    transformIndexHtml(html) {
      return fill(html, home);
    },
    closeBundle() {
      const indexFile = path.join(outDir, 'index.html');
      if (!fs.existsSync(indexFile)) return;
      const template = fs.readFileSync(indexFile, 'utf8');
      for (const page of all.slice(1)) {
        const file = path.join(outDir, ...page.path.split('/').filter(Boolean), 'index.html');
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, fill(template, page));
      }
      fs.writeFileSync(path.join(outDir, 'sitemap.xml'), sitemap(all));
    },
  };
}
