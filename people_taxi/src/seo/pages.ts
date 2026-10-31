// What each public page tells search engines. The pages call useSeo() with these, and the build
// writes the same tags into each page's prerendered HTML — one source for both.
import { FAQS } from '../pages/book/content';
import type { RouteCorridorDetail } from '../pages/routes/routesData';
import type { ServiceDetail } from '../pages/services/servicesData';
import { SITE, absoluteUrl, faqSchema, type SeoProps } from './site';

export const HOME_SEO: SeoProps = {
  title: 'People Taxi | Outstation Cabs & One Way Drop Taxi in Tamil Nadu',
  description:
    'Book outstation cabs, one-way drop taxis and round trips across Tamil Nadu, Bangalore and Pondicherry with People Taxi. Upfront fares, verified chauffeurs, 24/7 support.',
  keywords:
    'people taxi, outstation cabs tamil nadu, drop taxi, one way drop taxi, drop taxi chennai, intercity cab booking, airport taxi chennai, outstation taxi booking, people cabs',
  canonical: '/',
  schema: faqSchema(FAQS),
};

export const OFFERS_SEO: SeoProps = {
  title: 'Offers, Coupons & Promo Codes',
  description:
    'Save on your next outstation cab or drop taxi booking with People Taxi promo codes, festive discounts and new user coupons.',
  canonical: '/offers',
};

export const SUPPORT_SEO: SeoProps = {
  title: 'Customer Support & 24/7 Helpline',
  description: 'Help with a People Taxi booking or a trip in progress. Call +91 90250 99990 any time, or raise a ticket from your account.',
  canonical: '/support',
};

export const LEGAL_SEO: SeoProps = {
  title: 'Terms of Service & Privacy Policy',
  description: 'Terms of service, privacy policy, fare and cancellation rules for People Taxi customers.',
  canonical: '/legal',
};

export function routeSeo(r: RouteCorridorDetail): SeoProps {
  const path = `/routes/${r.slug}`;
  return {
    title: r.title,
    description: r.metaDescription,
    keywords: r.keywords,
    canonical: path,
    ogImage: r.image,
    ogImageAlt: `${r.origin} to ${r.destination} taxi`,
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: `${r.origin} to ${r.destination}`, path },
    ],
    schema: [
      {
        '@type': 'TaxiService',
        name: r.h1,
        description: r.summary,
        url: absoluteUrl(path),
        provider: { '@id': `${SITE.url}/#business` },
        areaServed: [
          { '@type': 'City', name: r.origin },
          { '@type': 'City', name: r.destination },
        ],
      },
      faqSchema(r.faqs),
    ],
  };
}

export function serviceSeo(s: ServiceDetail): SeoProps {
  const path = `/services/${s.slug}`;
  return {
    title: s.title,
    description: s.metaDescription,
    keywords: s.keywords,
    canonical: path,
    ogImage: s.image,
    ogImageAlt: s.h1,
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: s.h1, path },
    ],
    schema: [
      {
        '@type': 'TaxiService',
        name: s.h1,
        description: s.metaDescription,
        url: absoluteUrl(path),
        provider: { '@id': `${SITE.url}/#business` },
        areaServed: { '@type': 'State', name: 'Tamil Nadu' },
      },
      faqSchema(s.faqs),
    ],
  };
}
