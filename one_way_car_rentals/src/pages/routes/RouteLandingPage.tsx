import { Link, useNavigate, useParams } from 'react-router-dom';
import { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '@core/config/constants';
import { Icon } from '@/components/Icon';
import { useSeo } from '@/lib/seo';
import { routeSeo } from '@/seo/pages';
import { useBooking } from '@/state/Booking';
import { ALL_ROUTES, findRouteBySlug } from './routesData';
import { ALL_SERVICES } from '../services/servicesData';

/** Route guide: what the drive is like, then straight into the booking form with the route filled in. */
export function RouteLandingPage() {
  const { routeId = '' } = useParams<{ routeId: string }>();
  const navigate = useNavigate();
  const { update } = useBooking();
  const route = findRouteBySlug(routeId);

  useSeo(route ? routeSeo(route) : { title: 'Route not found', noindex: true });

  if (!route) {
    return (
      <div className="page lp-missing">
        <h1>Route not found</h1>
        <p className="muted">We couldn’t find that route guide. You can still book any city-to-city trip.</p>
        <Link to="/" className="btn btn--primary">
          Book a ride
        </Link>
      </div>
    );
  }

  // The booking home reads ?service/&trip, switches the console to that trip type and scrolls to it.
  const book = (trip: 'one-way' | 'round-trip') => {
    update({ pickup: route.pickup, drop: route.drop, tripType: trip === 'round-trip' ? 'Round Trip' : 'One Way' });
    navigate(`/?service=outstation&trip=${trip}`);
  };

  const others = ALL_ROUTES.filter((r) => r.slug !== route.slug);

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
              <li aria-current="page">
                {route.origin} to {route.destination}
              </li>
            </ol>
          </nav>
          <p className="eyebrow eyebrow--gold">
            <Icon name="route" size={16} /> {route.highway}
          </p>
          <h1>{route.h1}</h1>
          <p className="lp-hero__lead">{route.summary}</p>
          <ul className="lp-facts">
            <li>
              <Icon name="route" size={20} />
              <span>
                <small>Distance</small>
                <strong>About {route.km}</strong>
              </span>
            </li>
            <li>
              <Icon name="clock" size={20} />
              <span>
                <small>Driving time</small>
                <strong>About {route.duration}</strong>
              </span>
            </li>
            <li>
              <Icon name="verified" size={20} />
              <span>
                <small>One-way drop</small>
                <strong>No return fare</strong>
              </span>
            </li>
          </ul>
          <div className="lp-actions">
            <button type="button" className="btn btn--primary btn--lg" onClick={() => book('one-way')}>
              Book one way <Icon name="arrow-right" size={18} />
            </button>
            <button type="button" className="btn btn--ghost btn--lg lp-btn-light" onClick={() => book('round-trip')}>
              Book round trip
            </button>
            <a href={`tel:${SUPPORT_PHONE}`} className="btn btn--ghost btn--lg lp-btn-light">
              <Icon name="phone" size={18} /> {SUPPORT_PHONE_DISPLAY}
            </a>
          </div>
          <p className="lp-hero__note">Pick your date and time on the next screen to see the fare for every vehicle before you book.</p>
        </div>
      </header>

      <section className="band band--paper" aria-labelledby="lp-overview">
        <div className="wrap lp-cols">
          <div className="lp-prose">
            <p className="eyebrow eyebrow--brand">Route guide</p>
            <h2 id="lp-overview">
              Travelling from {route.origin} to {route.destination}
            </h2>
            {route.overview.map((para) => (
              <p key={para.slice(0, 32)}>{para}</p>
            ))}
          </div>
          <aside className="lp-stops" aria-labelledby="lp-stops">
            <h3 id="lp-stops">Stops along the way</h3>
            <ol>
              {route.keyStops.map((s) => (
                <li key={s.name}>
                  <strong>{s.name}</strong>
                  <span>{s.description}</span>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </section>

      <section className="band" aria-labelledby="lp-faq">
        <div className="wrap lp-narrow">
          <p className="eyebrow eyebrow--brand">Questions</p>
          <h2 id="lp-faq">
            {route.origin} to {route.destination} taxi FAQs
          </h2>
          <div className="faq lp-faq">
            {route.faqs.map((f) => (
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

      <section className="band band--paper" aria-labelledby="lp-more">
        <div className="wrap">
          <p className="eyebrow eyebrow--brand">More one way routes</p>
          <h2 id="lp-more">Other popular drops</h2>
          <ul className="lp-links">
            {others.map((r) => (
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
          <h3 className="lp-subhead">Services</h3>
          <ul className="lp-links">
            {ALL_SERVICES.map((s) => (
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
