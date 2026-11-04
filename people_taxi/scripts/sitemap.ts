// The sitemap for www.peopletaxi.in, built from the same route and service lists as the pages themselves.
// Used by the build (scripts/seo-prerender.ts writes dist/sitemap.xml) and by `npm run seo:sitemap`,
// which saves the same file as public/sitemap.xml so it can be read, checked and submitted from the folder.
import { ALL_ROUTES } from '../src/pages/routes/routesData';
import { ALL_SERVICES } from '../src/pages/services/servicesData';
import { SITE, absoluteUrl, escapeHtml as e } from '../src/seo/site';

export interface SitemapEntry {
  path: string;
  images: Array<{ loc: string; title: string }>;
  /** 0.0 – 1.0, relative to the other pages of this site. */
  priority: string;
  changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly';
}

/** Every public page. Private screens (account, trips, booking steps) are left out on purpose. */
export function sitemapEntries(): SitemapEntry[] {
  return [
    { path: '/', images: [{ loc: SITE.image, title: SITE.imageAlt }], priority: '1.0', changefreq: 'weekly' },
    ...ALL_ROUTES.map((r) => ({
      path: `/routes/${r.slug}`,
      images: [{ loc: r.image, title: `${r.origin} to ${r.destination} taxi` }],
      priority: '0.8',
      changefreq: 'monthly' as const,
    })),
    ...ALL_SERVICES.map((s) => ({
      path: `/services/${s.slug}`,
      images: [{ loc: s.image, title: s.h1 }],
      priority: '0.8',
      changefreq: 'monthly' as const,
    })),
    { path: '/offers', images: [], priority: '0.5', changefreq: 'weekly' },
    { path: '/support', images: [], priority: '0.5', changefreq: 'monthly' },
    { path: '/about', images: [], priority: '0.4', changefreq: 'yearly' },
    { path: '/legal', images: [], priority: '0.3', changefreq: 'yearly' },
  ];
}

export function buildSitemap(entries: SitemapEntry[], lastmod = new Date().toISOString().slice(0, 10)): string {
  const urls = entries.map((p) => {
    const images = p.images
      .map((i) => `\n    <image:image>\n      <image:loc>${e(absoluteUrl(i.loc))}</image:loc>\n      <image:title>${e(i.title)}</image:title>\n    </image:image>`)
      .join('');
    return `  <url>\n    <loc>${e(absoluteUrl(p.path))}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>${images}\n  </url>`;
  });
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' +
    `${urls.join('\n')}\n</urlset>\n`
  );
}
