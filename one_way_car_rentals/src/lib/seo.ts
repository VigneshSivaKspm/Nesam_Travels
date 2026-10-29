import { useEffect } from 'react';

export interface SeoProps {
  /** Page specific title. Will be formatted as "${title} · One Way Car Rentals" or used directly if it includes branding */
  title: string;
  /** Meta description for search engine snippets and social cards (140-160 chars recommended) */
  description?: string;
  /** Canonical URL path (e.g. '/book', '/offers') or full absolute URL */
  canonical?: string;
  /** Set true for user-private screens like /account, /trips, /ride to prevent search indexing */
  noindex?: boolean;
  /** Optional custom OpenGraph image URL */
  ogImage?: string;
}

const BASE_URL = 'https://onewaycarrental.nesamcabs.com';
const DEFAULT_DESCRIPTION =
  'Book outstation cabs, one-way drop taxis & round trips across Tamil Nadu, Bangalore & Pondicherry. Verified chauffeurs, clean AC cars, upfront fares & 24/7 customer support.';
const DEFAULT_OG_IMAGE = `${BASE_URL}/website-images/web/heroes/hero-desktop.webp`;

function setMetaTag(attrName: 'name' | 'property', attrValue: string, content: string) {
  let element = document.querySelector(`meta[${attrName}="${attrValue}"]`) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attrName, attrValue);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function setCanonical(href: string) {
  let element = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
}

export function updateSeo({ title, description, canonical, noindex, ogImage }: SeoProps): void {
  const fullTitle = title.includes('One Way Car Rentals')
    ? title
    : `${title} · One Way Car Rentals`;
  const fullDescription = description || DEFAULT_DESCRIPTION;
  const canonicalUrl = canonical
    ? canonical.startsWith('http')
      ? canonical
      : `${BASE_URL}${canonical.startsWith('/') ? canonical : `/${canonical}`}`
    : `${BASE_URL}/`;
  const image = ogImage || DEFAULT_OG_IMAGE;

  // Title
  document.title = fullTitle;

  // Primary Meta Tags
  setMetaTag('name', 'title', fullTitle);
  setMetaTag('name', 'description', fullDescription);
  setMetaTag(
    'name',
    'robots',
    noindex
      ? 'noindex, nofollow'
      : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
  );

  // Canonical Link
  setCanonical(canonicalUrl);

  // Open Graph
  setMetaTag('property', 'og:title', fullTitle);
  setMetaTag('property', 'og:description', fullDescription);
  setMetaTag('property', 'og:url', canonicalUrl);
  setMetaTag('property', 'og:image', image);

  // Twitter Cards
  setMetaTag('name', 'twitter:title', fullTitle);
  setMetaTag('name', 'twitter:description', fullDescription);
  setMetaTag('name', 'twitter:image', image);
}

/**
 * Hook to manage page titles, meta descriptions, canonical URLs, and robots directives.
 */
export function useSeo(props: SeoProps): void {
  useEffect(() => {
    updateSeo(props);
  }, [props.title, props.description, props.canonical, props.noindex, props.ogImage]);
}
