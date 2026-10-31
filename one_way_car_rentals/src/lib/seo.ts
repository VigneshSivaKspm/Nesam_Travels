import { useEffect } from 'react';
import { resolveSeo, type SeoProps } from '@/seo/site';

export type { SeoProps, BreadcrumbItem } from '@/seo/site';

function setMeta(attr: 'name' | 'property', key: string, content: string | undefined) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (content === undefined) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(href: string | null) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!href) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('link');
    el.rel = 'canonical';
    document.head.appendChild(el);
  }
  el.href = href;
}

/** Page-level JSON-LD; the business/website graph from index.html stays untouched. */
function setPageSchema(data: object | null) {
  let el = document.getElementById('page-schema') as HTMLScriptElement | null;
  if (!data) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('script');
    el.id = 'page-schema';
    el.type = 'application/ld+json';
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

/** Keeps title, description, robots, canonical, share tags and page schema in step with the screen. */
export function updateSeo(props: SeoProps): void {
  const s = resolveSeo(props);
  document.title = s.title;
  setMeta('name', 'description', s.description);
  setMeta('name', 'keywords', s.keywords);
  setMeta('name', 'robots', s.robots);
  setCanonical(s.canonical);
  setMeta('property', 'og:url', s.canonical ?? undefined);
  setMeta('property', 'og:title', s.title);
  setMeta('property', 'og:description', s.description);
  setMeta('property', 'og:image', s.image);
  setMeta('property', 'og:image:alt', s.imageAlt);
  setMeta('name', 'twitter:title', s.title);
  setMeta('name', 'twitter:description', s.description);
  setMeta('name', 'twitter:image', s.image);
  setMeta('name', 'twitter:image:alt', s.imageAlt);
  setPageSchema(s.schema);
}

export function useSeo(props: SeoProps): void {
  const key = JSON.stringify(props);
  useEffect(() => {
    updateSeo(props);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
