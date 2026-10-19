import { describe, it, expect } from 'vitest';
import {
  PRIMARY_DOMAIN,
  PRIMARY_BASE_URL,
  SUPPORTED_DOMAINS,
  ALL_BRAND_URLS,
  getActiveDomain,
  getActiveBaseUrl,
  buildBreadcrumbSchema,
} from './seo';

describe('People Taxi SEO Utilities', () => {
  it('contains People Taxi domains', () => {
    expect(SUPPORTED_DOMAINS).toEqual([
      'peopletaxi.in',
      'peopletaxi.com',
      'nesamcabs.com',
    ]);
    expect(PRIMARY_DOMAIN).toBe('peopletaxi.in');
    expect(PRIMARY_BASE_URL).toBe('https://peopletaxi.in');
    expect(ALL_BRAND_URLS).toContain('https://peopletaxi.in/');
  });

  it('resolves primary domain when window is undefined or untrusted hostname', () => {
    expect(getActiveDomain()).toBe('peopletaxi.in');
    expect(getActiveBaseUrl()).toBe('https://peopletaxi.in');
  });

  it('builds breadcrumb JSON-LD schema with correct URLs and positions', () => {
    const breadcrumbs = [
      { name: 'Home', path: '/' },
      { name: 'Corridors', path: '/routes' },
      { name: 'Chennai to Pondicherry', path: '/routes/chennai-to-pondicherry' },
    ];
    const schema = buildBreadcrumbSchema(breadcrumbs, 'https://peopletaxi.in') as any;

    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('BreadcrumbList');
    expect(schema.itemListElement).toHaveLength(3);
    expect(schema.itemListElement[0]).toEqual({
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: 'https://peopletaxi.in/',
    });
    expect(schema.itemListElement[2]).toEqual({
      '@type': 'ListItem',
      position: 3,
      name: 'Chennai to Pondicherry',
      item: 'https://peopletaxi.in/routes/chennai-to-pondicherry',
    });
  });
});
