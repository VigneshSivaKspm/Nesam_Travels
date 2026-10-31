// Search and social metadata, shared by the running site (src/lib/seo.ts) and the build-time
// prerender (scripts/seo-prerender.ts). No DOM, React or path aliases here: it also runs in Node.

export const SITE = {
  name: 'People Taxi',
  url: 'https://www.peopletaxi.in',
  legalName: 'NESAM Tours and Travels Private Limited',
  phone: '+919025099990',
  email: 'support@nesamcabs.com',
  logo: '/brand/icon-512.png',
  /** 1200×630 share card. */
  image: '/brand/og-image.jpg',
  imageAlt: 'People Taxi — outstation cabs and drop taxis across Tamil Nadu',
} as const;

export const DEFAULT_DESCRIPTION =
  'Book outstation cabs, one-way drop taxis and round trips across Tamil Nadu, Bangalore and Pondicherry with People Taxi. Upfront fares, verified chauffeurs, 24/7 support.';

const ROBOTS_INDEX = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
const ROBOTS_NOINDEX = 'noindex, nofollow';

export interface BreadcrumbItem {
  name: string;
  path: string;
}

export interface SeoProps {
  /** Page title; " · People Taxi" is appended unless the brand is already in it. */
  title: string;
  /** Snippet text for search results and share cards (about 140–160 characters). */
  description?: string;
  keywords?: string;
  /** Canonical path ('/routes/chennai-to-pondicherry') or absolute URL. */
  canonical?: string;
  /** Private or transactional screens: keep them out of search results. */
  noindex?: boolean;
  /** Share image path or absolute URL; defaults to the site share card. */
  ogImage?: string;
  ogImageAlt?: string;
  breadcrumbs?: BreadcrumbItem[];
  /** Page-level schema.org nodes (no @context needed). */
  schema?: object | object[];
}

export interface ResolvedSeo {
  title: string;
  description: string;
  keywords?: string;
  /** null for noindex screens without a canonical of their own. */
  canonical: string | null;
  robots: string;
  image: string;
  imageAlt: string;
  schema: object | null;
}

export const absoluteUrl = (path: string): string =>
  /^https?:\/\//.test(path) ? path : `${SITE.url}${path.startsWith('/') ? path : `/${path}`}`;

export function breadcrumbSchema(items: BreadcrumbItem[]): object {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((b, i) => ({ '@type': 'ListItem', position: i + 1, name: b.name, item: absoluteUrl(b.path) })),
  };
}

export function faqSchema(faqs: ReadonlyArray<{ q: string; a: string }>): object {
  return {
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
}

export function resolveSeo(p: SeoProps): ResolvedSeo {
  const graph: object[] = [];
  if (p.breadcrumbs?.length) graph.push(breadcrumbSchema(p.breadcrumbs));
  if (p.schema) graph.push(...(Array.isArray(p.schema) ? p.schema : [p.schema]));
  return {
    title: p.title.includes(SITE.name) ? p.title : `${p.title} · ${SITE.name}`,
    description: p.description || DEFAULT_DESCRIPTION,
    keywords: p.keywords,
    canonical: p.canonical ? absoluteUrl(p.canonical) : p.noindex ? null : absoluteUrl('/'),
    robots: p.noindex ? ROBOTS_NOINDEX : ROBOTS_INDEX,
    image: absoluteUrl(p.ogImage || SITE.image),
    imageAlt: p.ogImageAlt || (p.ogImage ? p.title : SITE.imageAlt),
    schema: graph.length ? { '@context': 'https://schema.org', '@graph': graph } : null,
  };
}

/** The business itself, on every page. */
export function siteSchema(): object {
  const id = `${SITE.url}/#business`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'AutoRental',
        '@id': id,
        name: SITE.name,
        legalName: SITE.legalName,
        parentOrganization: { '@type': 'Organization', name: SITE.legalName, url: 'https://nesamcabs.com/' },
        url: `${SITE.url}/`,
        logo: absoluteUrl(SITE.logo),
        image: absoluteUrl(SITE.image),
        description:
          'Outstation cabs, one-way drop taxis, round trips, airport transfers, local hourly rentals and temple tours with verified chauffeurs across Tamil Nadu, Bangalore and Pondicherry.',
        telephone: SITE.phone,
        email: SITE.email,
        currenciesAccepted: 'INR',
        paymentAccepted: 'Cash, UPI',
        address: { '@type': 'PostalAddress', addressLocality: 'Theni', addressRegion: 'Tamil Nadu', postalCode: '625531', addressCountry: 'IN' },
        geo: { '@type': 'GeoCoordinates', latitude: 10.0104, longitude: 77.4768 },
        openingHoursSpecification: {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
          opens: '00:00',
          closes: '23:59',
        },
        areaServed: [
          ...['Tamil Nadu', 'Puducherry', 'Karnataka'].map((name) => ({ '@type': 'State', name })),
          ...['Chennai', 'Bangalore', 'Coimbatore', 'Madurai', 'Trichy', 'Salem', 'Pondicherry', 'Ooty', 'Rameshwaram', 'Thanjavur', 'Tirupati'].map(
            (name) => ({ '@type': 'City', name }),
          ),
        ],
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE.url}/#website`,
        url: `${SITE.url}/`,
        name: SITE.name,
        inLanguage: 'en-IN',
        publisher: { '@id': id },
      },
    ],
  };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const escapeHtml = esc;

/** JSON for a <script type="application/ld+json"> block, safe against a stray "</script>". */
export const jsonLd = (data: object): string => JSON.stringify(data).replace(/</g, '\\u003c');

/** Per-page <head> tags for the prerendered HTML. src/lib/seo.ts keeps the same tags current while browsing. */
export function renderHeadTags(props: SeoProps): string {
  const s = resolveSeo(props);
  const defaultImage = s.image === absoluteUrl(SITE.image);
  const tags = [
    `<title>${esc(s.title)}</title>`,
    `<meta name="description" content="${esc(s.description)}" />`,
    s.keywords ? `<meta name="keywords" content="${esc(s.keywords)}" />` : '',
    `<meta name="robots" content="${s.robots}" />`,
    s.canonical ? `<link rel="canonical" href="${esc(s.canonical)}" />` : '',
    s.canonical ? `<meta property="og:url" content="${esc(s.canonical)}" />` : '',
    `<meta property="og:title" content="${esc(s.title)}" />`,
    `<meta property="og:description" content="${esc(s.description)}" />`,
    `<meta property="og:image" content="${esc(s.image)}" />`,
    defaultImage ? '<meta property="og:image:type" content="image/jpeg" />' : '',
    defaultImage ? '<meta property="og:image:width" content="1200" />' : '',
    defaultImage ? '<meta property="og:image:height" content="630" />' : '',
    `<meta property="og:image:alt" content="${esc(s.imageAlt)}" />`,
    `<meta name="twitter:title" content="${esc(s.title)}" />`,
    `<meta name="twitter:description" content="${esc(s.description)}" />`,
    `<meta name="twitter:image" content="${esc(s.image)}" />`,
    `<meta name="twitter:image:alt" content="${esc(s.imageAlt)}" />`,
    `<script type="application/ld+json">${jsonLd(siteSchema())}</script>`,
    s.schema ? `<script type="application/ld+json" id="page-schema">${jsonLd(s.schema)}</script>` : '',
  ];
  return tags.filter(Boolean).join('\n    ');
}
