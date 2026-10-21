import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '@core/config/constants';
import { Icon } from './Icon';

export function DashboardMainSkeleton() {
  return (
    <div className="sk-main" aria-busy="true">
      <section className="sk-hero" aria-labelledby="sk-hero-title">
        <div className="sk-hero__stage">
          <div className="sk-hero__copy">
            <p className="sk-eyebrow">
              <Icon name="route" size={16} /> Outstation &amp; intercity cabs
            </p>
            <h1 id="sk-hero-title" className="sk-title">
              Outstation rides, <em>priced before you book.</em>
            </h1>
            <p className="sk-lead">
              Verified chauffeurs, clean air-conditioned cars and the fare for every vehicle upfront — across Tamil Nadu and beyond.
            </p>
            <ul className="sk-points">
              <li>
                <Icon name="check" size={18} /> Fares shown upfront
              </li>
              <li>
                <Icon name="check" size={18} /> Verified chauffeurs
              </li>
              <li>
                <Icon name="check" size={18} /> Pay your driver in cash or UPI
              </li>
            </ul>
          </div>
          <div className="sk-hero__media">
            <picture>
              <source media="(max-width: 720px)" srcSet="/website-images/web/heroes/hero-mobile.webp" />
              <img
                src="/website-images/web/heroes/hero-desktop.webp"
                alt="One Way Car Rental outstation and intercity cab service across Tamil Nadu"
                width={1774}
                height={887}
                fetchPriority="high"
              />
            </picture>
          </div>
        </div>
        <div className="sk-console">
          <div className="sk-console__inner">
            <div className="sk-console__tabs">
              <span className="sk-tab is-active">One Way</span>
              <span className="sk-tab">Round Trip</span>
              <span className="sk-tab">Local Rental</span>
              <span className="sk-tab">Airport Taxi</span>
            </div>
            <div className="sk-console__row">
              <div className="sk-fields">
                <div className="sk-field">
                  <span className="sk-field__label">Pickup</span>
                  <div className="sk-field__box sk-shimmer" />
                </div>
                <div className="sk-field">
                  <span className="sk-field__label">Destination</span>
                  <div className="sk-field__box sk-shimmer" />
                </div>
              </div>
              <div className="sk-when">
                <div className="sk-when__item">
                  <span className="sk-field__label">Pickup date</span>
                  <div className="sk-field__box sk-shimmer" />
                </div>
                <div className="sk-when__item">
                  <span className="sk-field__label">Time</span>
                  <div className="sk-field__box sk-shimmer" />
                </div>
              </div>
              <div className="sk-btn-go">
                See fares
                <Icon name="arrow-right" size={20} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="sk-strip" aria-label="Why riders choose One Way Car Rental">
        {[
          { title: 'Fares before you book', desc: 'See the fare for every vehicle upfront' },
          { title: 'Verified chauffeurs', desc: 'Commercial drivers who know the highways' },
          { title: 'Clean, AC cars', desc: 'A well-kept fleet ready for long distances' },
          { title: 'A team you can call', desc: '24/7 dedicated customer assistance' },
        ].map((item, idx) => (
          <div key={idx} className="sk-strip__item">
            <div className="sk-strip__box sk-shimmer" />
            <div className="sk-strip__text">
              <strong className="sk-strip__line1 sk-shimmer" />
              <span className="sk-strip__line2 sk-shimmer" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton({ label = 'Loading…', children }: { label?: string; children?: ReactNode }) {
  return (
    <div className="shell-skeleton" aria-busy="true">
      <span className="sr-only" role="status">
        {label}
      </span>

      <aside className="sk-side" aria-label="Site loading">
        <Link to="/book" className="sk-brand" aria-label="One Way Car Rental — book a ride">
          <img src="/brand/ow-logo.png" alt="" width={44} height={44} />
          <span className="sk-brand__word">
            <b>One Way</b>
            <small>Car Rental</small>
          </span>
        </Link>
        <nav className="sk-side__nav" aria-label="Main menu">
          <p className="sk-side__label">Menu</p>
          <div className="sk-side__link is-active">
            <Icon name="car" size={21} />
            <span className="lbl-long">Book a ride</span>
          </div>
          <div className="sk-side__link">
            <Icon name="trip-history" size={21} />
            <span className="lbl-long">My trips</span>
          </div>
          <div className="sk-side__link">
            <Icon name="offers" size={21} />
            <span className="lbl-long">Offers</span>
          </div>
          <div className="sk-side__link">
            <Icon name="notifications" size={21} />
            <span className="lbl-long">Notifications</span>
          </div>
        </nav>
        <div className="sk-side__foot">
          <div className="sk-side__link">
            <Icon name="support" size={21} />
            <span className="lbl-long">Help &amp; tickets</span>
          </div>
          <a className="sk-side__call" href={`tel:${SUPPORT_PHONE}`} aria-label={`Call One Way Car Rental ${SUPPORT_PHONE_DISPLAY}`}>
            <Icon name="phone" size={20} />
            <span className="lbl-long">
              <small>Talk to us</small>
              <span className="num">{SUPPORT_PHONE_DISPLAY}</span>
            </span>
          </a>
          <div className="sk-side__btn">Sign in</div>
        </div>
      </aside>

      <div className="shell-skeleton__body">
        <header className="sk-topbar">
          <div className="sk-topbar__inner">
            <Link to="/book" className="sk-brand" aria-label="One Way Car Rental — book a ride">
              <img src="/brand/ow-logo.png" alt="" width={36} height={36} />
              <span className="sk-brand__word">
                <b>One Way</b>
                <small>Car Rental</small>
              </span>
            </Link>
            <div className="topbar__mobile">
              <div className="sk-topbar__btn">Sign in</div>
            </div>
          </div>
        </header>

        <main id="main" tabIndex={-1} className="shell-skeleton__main">
          {children ?? <DashboardMainSkeleton />}
        </main>

        <nav className="sk-tabbar" aria-label="Mobile navigation">
          <div className="sk-tabbar__link is-active">
            <Icon name="car" size={24} />
            <span>Book</span>
          </div>
          <div className="sk-tabbar__link">
            <Icon name="trip-history" size={24} />
            <span>Trips</span>
          </div>
          <div className="sk-tabbar__link">
            <Icon name="notifications" size={24} />
            <span>Alerts</span>
          </div>
          <div className="sk-tabbar__link">
            <Icon name="profile" size={24} />
            <span>Account</span>
          </div>
        </nav>
      </div>
    </div>
  );
}
