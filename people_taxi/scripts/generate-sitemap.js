import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(__dirname, '../public');

const TODAY = new Date().toISOString().split('T')[0];
const BASE_URL = 'https://peopletaxi.in';

const URL_ENTRIES = [
  { path: '', changefreq: 'daily', priority: '1.0', comment: 'Homepage: People Taxi Online Outstation & Drop Taxi' },
  { path: 'book', changefreq: 'daily', priority: '0.95', comment: 'Booking Engine Entrypoint' },
  { path: 'offers', changefreq: 'weekly', priority: '0.80', comment: 'Special Offers & Promo Codes' },
  { path: 'support', changefreq: 'monthly', priority: '0.70', comment: '24/7 Customer Support & Help Desk' },
  { path: 'legal', changefreq: 'monthly', priority: '0.50', comment: 'Legal, Terms of Service & Privacy Policy' },
  { path: 'services/one-way-drop-taxi', changefreq: 'weekly', priority: '0.90', comment: 'Travel Service: One-Way Drop Taxi' },
  { path: 'services/outstation-round-trip', changefreq: 'weekly', priority: '0.90', comment: 'Travel Service: Outstation Round Trips' },
  { path: 'services/airport-taxi', changefreq: 'weekly', priority: '0.90', comment: 'Travel Service: Airport Transfers' },
  { path: 'services/local-rental', changefreq: 'weekly', priority: '0.85', comment: 'Travel Service: Local Hourly Rental' },
  { path: 'services/pilgrimage-tours', changefreq: 'weekly', priority: '0.85', comment: 'Travel Service: Pilgrimage Tours' },
  { path: 'routes/chennai-to-pondicherry', changefreq: 'weekly', priority: '0.88', comment: 'Popular Corridor: Chennai to Pondicherry' },
  { path: 'routes/chennai-to-bangalore', changefreq: 'weekly', priority: '0.88', comment: 'Popular Corridor: Chennai to Bangalore' },
  { path: 'routes/coimbatore-to-ooty', changefreq: 'weekly', priority: '0.88', comment: 'Popular Corridor: Coimbatore to Ooty' },
  { path: 'routes/madurai-to-rameshwaram', changefreq: 'weekly', priority: '0.88', comment: 'Popular Corridor: Madurai to Rameshwaram' },
  { path: 'routes/bangalore-to-mysore', changefreq: 'weekly', priority: '0.85', comment: 'Popular Corridor: Bangalore to Mysore' },
  { path: 'routes/trichy-to-thanjavur', changefreq: 'weekly', priority: '0.82', comment: 'Popular Corridor: Trichy to Thanjavur' },
  { path: 'routes/salem-to-yercaud', changefreq: 'weekly', priority: '0.82', comment: 'Popular Corridor: Salem to Yercaud' },
  { path: 'routes/chennai-to-tirupati', changefreq: 'weekly', priority: '0.85', comment: 'Popular Corridor: Chennai to Tirupati' },
];

function generateSitemap() {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
  xml += `        xmlns:xhtml="http://www.w3.org/1999/xhtml"\n`;
  xml += `        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

  for (const entry of URL_ENTRIES) {
    const pageUrl = entry.path ? `${BASE_URL}/${entry.path}` : `${BASE_URL}/`;
    xml += `  <!-- ${entry.comment} -->\n`;
    xml += `  <url>\n`;
    xml += `    <loc>${pageUrl}</loc>\n`;
    xml += `    <lastmod>${TODAY}</lastmod>\n`;
    xml += `    <changefreq>${entry.changefreq}</changefreq>\n`;
    xml += `    <priority>${entry.priority}</priority>\n`;
    xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${pageUrl}" />\n`;
    xml += `    <xhtml:link rel="alternate" hreflang="en-IN" href="${pageUrl}" />\n`;
    xml += `    <xhtml:link rel="alternate" hreflang="ta-IN" href="${pageUrl}" />\n`;
    xml += `    <image:image>\n`;
    xml += `      <image:loc>${BASE_URL}/brand/logo.png</image:loc>\n`;
    xml += `      <image:title>People Taxi Outstation Cabs</image:title>\n`;
    xml += `    </image:image>\n`;
    xml += `  </url>\n\n`;
  }

  xml += `</urlset>\n`;
  return xml;
}

const sitemapXml = generateSitemap();
fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap.xml'), sitemapXml, 'utf-8');
console.log('✓ Generated People Taxi sitemap: public/sitemap.xml');
