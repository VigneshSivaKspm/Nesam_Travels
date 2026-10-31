import { describe, it, expect } from 'vitest';
import { SITE, absoluteUrl, breadcrumbSchema, renderHeadTags, resolveSeo } from '@/seo/site';

describe('People Taxi SEO', () => {
  it('always points canonical URLs at the primary domain', () => {
    expect(SITE.url).toBe('https://peopletaxi.in');
    expect(absoluteUrl('/routes/chennai-to-pondicherry')).toBe('https://peopletaxi.in/routes/chennai-to-pondicherry');
    expect(resolveSeo({ title: 'Offers', canonical: '/offers' }).canonical).toBe('https://peopletaxi.in/offers');
  });

  it('brands titles once and uses an absolute share image', () => {
    const s = resolveSeo({ title: 'Offers' });
    expect(s.title).toBe('Offers · People Taxi');
    expect(resolveSeo({ title: 'People Taxi | Home' }).title).toBe('People Taxi | Home');
    expect(s.image).toBe('https://peopletaxi.in/brand/og-image.jpg');
  });

  it('drops the canonical for private screens', () => {
    const s = resolveSeo({ title: 'My Trips', noindex: true });
    expect(s.canonical).toBeNull();
    expect(s.robots).toBe('noindex, nofollow');
  });

  it('builds breadcrumb JSON-LD with absolute URLs', () => {
    const schema = breadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Chennai to Pondicherry', path: '/routes/chennai-to-pondicherry' },
    ]) as { itemListElement: Array<{ position: number; item: string }> };
    expect(schema.itemListElement[0]).toMatchObject({ position: 1, item: 'https://peopletaxi.in/' });
    expect(schema.itemListElement[1].item).toBe('https://peopletaxi.in/routes/chennai-to-pondicherry');
  });

  it('escapes text in prerendered head tags', () => {
    const html = renderHeadTags({ title: 'A "quoted" <b> & title', canonical: '/x' });
    expect(html).toContain('<title>A &quot;quoted&quot; &lt;b&gt; &amp; title · People Taxi</title>');
    expect(html).toContain('<link rel="canonical" href="https://peopletaxi.in/x" />');
  });
});
