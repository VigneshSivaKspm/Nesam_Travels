// What each public page tells search engines. The pages call useSeo() with these, and the build
// writes the same tags into each page's prerendered HTML — one source for both.
import { FAQS } from '../pages/book/content';
import type { RouteGuide } from '../pages/routes/routesData';
import type { ServiceDetail } from '../pages/services/servicesData';
import { SITE, absoluteUrl, faqSchema, type SeoProps } from './site';

export const HOME_SEO: SeoProps = {
  title: 'One Way Car Rentals | One Way Taxi & Drop Cabs in Tamil Nadu',
  description:
    'Book a one way taxi or outstation cab across Tamil Nadu, Bangalore and Pondicherry. Pay for the drop only, see every fare before you book, verified chauffeurs, 24/7 support.',
  keywords:
    'one way car rentals, one way taxi, one way drop taxi, one way cab, drop taxi tamil nadu, outstation cabs, one way car rental with driver, chennai one way taxi, intercity cab booking',
  canonical: '/',
  schema: faqSchema(FAQS),
};

export const OFFERS_SEO: SeoProps = {
  title: 'Offers & Promo Codes on One Way Taxi Bookings',
  description:
    'Current promo codes and discounts on One Way Car Rentals one way drops, outstation round trips and airport taxis. Apply a code before you confirm your booking.',
  canonical: '/offers',
};

export const SUPPORT_SEO: SeoProps = {
  title: 'Customer Support & 24/7 Helpline',
  description:
    'Help with a One Way Car Rentals booking or a trip in progress. Call +91 90250 99990 any time, or raise a ticket from your account.',
  canonical: '/support',
};

export const LEGAL_SEO: SeoProps = {
  title: 'Terms of Service & Privacy Policy',
  description: 'Terms of service, privacy policy, fare and cancellation rules for One Way Car Rentals customers.',
  canonical: '/legal',
};

export function routeSeo(r: RouteGuide): SeoProps {
  const path = `/routes/${r.slug}`;
  return {
    title: r.title,
    description: r.metaDescription,
    keywords: r.keywords,
    canonical: path,
    ogImage: r.imageUrl,
    ogImageAlt: `${r.origin} to ${r.destination} one way taxi`,
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: `${r.origin} to ${r.destination} taxi`, path },
    ],
    schema: [
      {
        '@type': 'TaxiService',
        name: `${r.origin} to ${r.destination} one way taxi`,
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
    ogImage: s.imageUrl,
    ogImageAlt: s.h1,
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: s.name, path },
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
