import { Link, useNavigate, useParams } from 'react-router-dom';
import { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '@core/config/constants';
import { Icon } from '@/components/Icon';
import { useSeo } from '@/lib/seo';
import { serviceSeo } from '@/seo/pages';
import { ALL_ROUTES } from '../routes/routesData';
import { ALL_SERVICES, findServiceBySlug, type ServiceDetail } from './servicesData';

/** The booking-home query that opens the console on this service's trip type. */
const bookingLink = (s: ServiceDetail) =>
  s.tripType === 'Airport Taxi'
    ? '/?service=airport'
    : s.tripType === 'Local Rental'
      ? '/?service=rental'
      : `/?service=outstation&trip=${s.tripType === 'Round Trip' ? 'round-trip' : 'one-way'}`;

export function ServiceLandingPage() {
  const { serviceId = '' } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const service = findServiceBySlug(serviceId);

  useSeo(service ? serviceSeo(service) : { title: 'Service not found', noindex: true });

  if (!service) {
    return (
      <div className="page lp-missing">
        <h1>Service not found</h1>
        <p className="muted">We couldn’t find that page. You can still book any trip from the home page.</p>
        <Link to="/" className="btn btn--primary">
          Book a ride
        </Link>
      </div>
    );
  }

  const others = ALL_SERVICES.filter((s) => s.slug !== service.slug);

  return (
    <article className="lp">
      <header className="lp-hero">
        <div className="wrap lp-hero__inner">
          <nav className="lp-crumbs" aria-label="Breadcrumb">
            <ol>
              <li>
                <Link to="/">Home</Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page">{service.name}</li>
            </ol>
          </nav>
          <p className="eyebrow eyebrow--gold">
            <Icon name="car" size={16} /> One Way Car Rentals
          </p>
          <h1>{service.h1}</h1>
          <p className="lp-hero__lead">{service.lead}</p>
          <div className="lp-actions">
            <button type="button" className="btn btn--primary btn--lg" onClick={() => navigate(bookingLink(service))}>
              Plan your trip <Icon name="arrow-right" size={18} />
            </button>
            <a href={`tel:${SUPPORT_PHONE}`} className="btn btn--ghost btn--lg lp-btn-light">
              <Icon name="phone" size={18} /> {SUPPORT_PHONE_DISPLAY}
            </a>
          </div>
        </div>
      </header>

      <section className="band band--paper" aria-labelledby="lp-features">
        <div className="wrap">
          <p className="eyebrow eyebrow--brand">Why book with us</p>
          <h2 id="lp-features">What you get</h2>
          <ul className="lp-tiles">
            {service.features.map((f) => (
              <li key={f.title}>
                <strong>{f.title}</strong>
                <span>{f.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="band" aria-labelledby="lp-overview">
        <div className="wrap lp-cols">
          <div className="lp-prose">
            <p className="eyebrow eyebrow--brand">How it works</p>
            <h2 id="lp-overview">{service.name}, step by step</h2>
            {service.overview.map((para) => (
              <p key={para.slice(0, 32)}>{para}</p>
            ))}
          </div>
          <aside className="lp-stops" aria-labelledby="lp-billing">
            <h3 id="lp-billing">How you’re billed</h3>
            <ol>
              {service.billing.map((b) => (
                <li key={b.title}>
                  <strong>{b.title}</strong>
                  <span>{b.detail}</span>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </section>

      <section className="band band--paper" aria-labelledby="lp-faq">
        <div className="wrap lp-narrow">
          <p className="eyebrow eyebrow--brand">Questions</p>
          <h2 id="lp-faq">Frequently asked questions</h2>
          <div className="faq lp-faq">
            {service.faqs.map((f) => (
              <details key={f.q} name="lp-faq" className="faq__item">
                <summary>
                  <span className="faq__q">{f.q}</span>
                  <Icon name="chevron-down" size={20} />
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="band" aria-labelledby="lp-routes">
        <div className="wrap">
          <p className="eyebrow eyebrow--brand">Popular routes</p>
          <h2 id="lp-routes">Route guides</h2>
          <ul className="lp-links">
            {ALL_ROUTES.map((r) => (
              <li key={r.slug}>
                <Link to={`/routes/${r.slug}`} className="lp-link">
                  <strong>
                    {r.origin} <Icon name="arrow-right" size={15} /> {r.destination}
                  </strong>
                  <span>
                    About {r.km} · {r.duration}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <h3 className="lp-subhead">Other services</h3>
          <ul className="lp-links">
            {others.map((s) => (
              <li key={s.slug}>
                <Link to={`/services/${s.slug}`} className="lp-link">
                  <strong>{s.name}</strong>
                  <span>{s.lead}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </article>
  );
}
