// The home page below (and beside) the booking form: popular routes, the NESAM way, reviews,
// FAQ and the app. Nothing here is a price, a rating or a review: fares come from the booking
// server and reviews are shown only once NESAM publishes real ones (none are published yet).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SCHEDULED_CANCELLATION_FEE, SCHEDULED_FREE_CANCEL_BEFORE_MS, SUPPORT_PHONE } from '@core/config/constants';
import { formatINR } from '@core/utils/format';
import { Icon } from '@/components/Icon';
import { POPULAR_ROUTES, type PopularRoute } from './content';

export function HeroCopy() {
  return (
    <div className="hero-copy">
      <p className="eyebrow eyebrow--muted hero-copy__eyebrow">
        <span aria-hidden="true" /> NESAM Cabs &amp; Car Rentals
      </p>
      <h1>
        Your next journey,
        <br />
        <span>made simple.</span>
      </h1>
      <p className="hero-copy__lead">From city escapes to airport runs, find your ride with NESAM.</p>
      <ul className="hero-copy__points">
        <li>
          <Icon name="shield-check" size={13} /> Clear fare details
        </li>
        <li>
          <Icon name="support" size={13} /> Dedicated support
        </li>
      </ul>
      <figure className="hero-car">
        <span className="hero-car__stage" aria-hidden="true" />
        <img src="/nesam/cars/carens.webp" alt="A white NESAM SUV" width={960} height={480} fetchPriority="high" />
        <figcaption>Category image. Assigned model may vary.</figcaption>
      </figure>
    </div>
  );
}

function SectionHeading({ eyebrow, title, id, children }: { eyebrow?: string; title: string; id: string; children?: React.ReactNode }) {
  return (
    <div className="sec-heading">
      {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
      <h2 id={id}>{title}</h2>
      {children}
    </div>
  );
}

export function PopularRoutes({ onPick }: { onPick: (r: PopularRoute) => void }) {
  const [all, setAll] = useState(false);
  return (
    <section className={`routes ${all ? 'routes--all' : ''}`} aria-labelledby="routes-title">
      <div className="routes__head">
        <div>
          <h2 id="routes-title" className="display-h">
            Popular routes
          </h2>
          <p>A few favourites from Chennai.</p>
        </div>
        <button type="button" className="routes__toggle" aria-expanded={all} aria-controls="routes-grid" onClick={() => setAll((a) => !a)}>
          {all ? 'Show fewer' : 'View all routes'} <Icon name={all ? 'chevron-up' : 'arrow-right'} size={14} />
        </button>
      </div>
      <ul className="routes__grid" id="routes-grid">
        {POPULAR_ROUTES.map((r) => (
          <li key={r.id}>
            <button type="button" className="route-card" onClick={() => onPick(r)} aria-label={`Plan a trip from ${r.from} to ${r.to}`}>
              <span className="route-card__art">
                <img src={r.art} alt="" width={900} height={450} loading="lazy" />
              </span>
              <span className="route-card__body">
                <span className="route-card__name">
                  <span>{r.from}</span>
                  <Icon name="arrow-right" size={14} />
                  <strong>{r.to}</strong>
                </span>
                <span className="route-card__cta">
                  Plan trip <Icon name="arrow-right" size={12} />
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function WhySection() {
  const items = [
    { icon: 'receipt', title: 'Clear fares', text: 'Know your inclusions, applicable GST and extra rates before you book.' },
    { icon: 'location-pin', title: 'Doorstep pickup', text: 'Choose the pickup address that works for your journey.' },
    { icon: 'support', title: 'Trip support', text: 'A direct line to NESAM for booking and journey assistance.' },
  ];
  return (
    <section className="why" aria-labelledby="why-title">
      <div className="why__intro">
        <span className="eyebrow">The NESAM way</span>
        <h2 id="why-title" className="display-h">
          Travel with clarity.
        </h2>
      </div>
      <ul className="why__list">
        {items.map((i) => (
          <li key={i.title}>
            <Icon name={i.icon} size={20} />
            <h3>{i.title}</h3>
            <p>{i.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ReviewsSection() {
  return (
    <section className="reviews" aria-labelledby="reviews-title">
      <SectionHeading eyebrow="From our travellers" title="Customer reviews" id="reviews-title" />
      <div className="reviews__empty">
        <span className="reviews__mark" aria-hidden="true">
          <Icon name="chat" size={20} />
        </span>
        <div>
          <h3>Your journey. Your words.</h3>
          <p>Travelled with NESAM? We would love to hear about your experience.</p>
          <small>Customer reviews will appear here once published.</small>
        </div>
        <Link className="inline-link" to="/support?topic=feedback">
          Share feedback <Icon name="arrow-up-right" size={13} />
        </Link>
      </div>
    </section>
  );
}

export function FaqSection() {
  const freeHours = Math.round(SCHEDULED_FREE_CANCEL_BEFORE_MS / 3600000);
  const faqs = [
    {
      q: 'What does my fare include?',
      a: 'Each car shows its total fare before you book, with the fare breakup — base fare, driver allowance where it applies and GST — and what the fare includes. NESAM’s booking server confirms the final amount when you submit.',
    },
    { q: 'Are toll, parking and state tax included?', a: 'No. Tolls, parking and state permits paid by the driver during the trip are added to your final receipt at actual cost, against receipts.' },
    { q: 'Can I book now and pay later?', a: 'Yes. Nothing is charged when you book. You pay your driver in cash or by UPI at the end of the trip.' },
    {
      q: 'When will I get my driver details?',
      a: 'NESAM first reviews your booking request. Once a driver is assigned, their name, phone number and vehicle number appear in My Bookings, before your pickup.',
    },
    {
      q: 'How do cancellations and refunds work?',
      a: `Cancel from My Bookings. Cancelling more than ${freeHours} hour${freeHours === 1 ? '' : 's'} before pickup is free; after that a ${formatINR(SCHEDULED_CANCELLATION_FEE)} fee applies. The screen shows any fee before you confirm, and any refund is recorded under Payments.`,
    },
  ];
  return (
    <section className="faq" id="faq" aria-labelledby="faq-title">
      <div className="faq__intro">
        <span className="eyebrow">Good to know</span>
        <h2 id="faq-title" className="display-h display-h--lg">
          A little help, before you go.
        </h2>
        <p>The details that make planning easier.</p>
        <a className="inline-link" href={`tel:${SUPPORT_PHONE}`}>
          Talk to NESAM <Icon name="arrow-up-right" size={13} />
        </a>
      </div>
      <div className="faq__list">
        {faqs.map((f, i) => (
          <details key={f.q} className="faq__item" name="home-faq" open={i === 0}>
            <summary>
              <span>{f.q}</span>
              <Icon name="plus" size={16} className="faq__plus" />
            </summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function AppSection() {
  return (
    <section className="get-app" aria-labelledby="app-title">
      <div className="get-app__copy">
        <span className="eyebrow">The NESAM app</span>
        <h2 id="app-title" className="display-h">
          Every trip. One place.
        </h2>
        <p>Your bookings, driver details and trip updates, together.</p>
      </div>
      <div className="get-app__stores">
        <div className="store">
          <small>For Android</small>
          <strong>Google Play</strong>
          <span>Coming soon</span>
        </div>
        <div className="store">
          <small>For iPhone</small>
          <strong>App Store</strong>
          <span>Coming soon</span>
        </div>
      </div>
    </section>
  );
}
