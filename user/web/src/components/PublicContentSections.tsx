import { useEffect, useState } from 'react';
import { subscribePublicContent, type PublicContent } from '@core/services/catalogService';
import { SUPPORT_PHONE } from '@core/config/constants';
import { formatINR } from '@core/utils/format';
function SectionHeading({title,id,eyebrow}:{title:string;id:string;eyebrow?:string}) { return <header><small>{eyebrow}</small><h2 id={id}>{title}</h2></header>; }

export function ReviewsSection() {
  const [reviews,setReviews]=useState<PublicContent[]>([]);
  const [error,setError]=useState('');
  useEffect(()=>subscribePublicContent('reviews',rows=>{setReviews(rows);setError('');},setError),[]);
  return (
    <section className="reviews" aria-labelledby="reviews-title">
      <SectionHeading eyebrow="From our travellers" title="Customer reviews" id="reviews-title" />
      {error && <p role="status" className="muted small">{error}</p>}
      {reviews.length>0 ? <ul className="card card--list" aria-label="Published customer reviews">{reviews.slice(0,6).map(r=><li key={r.id} style={{padding:20}}><strong>{r.name} · {r.rating}/5</strong><p>{r.text}</p>{r.response&&<p className="muted small"><strong>NESAM:</strong> {r.response}</p>}</li>)}</ul> :
      <div className="reviews__empty">
        <span className="reviews__mark" aria-hidden="true">
          
        </span>
        <div>
          <h3>Your journey. Your words.</h3>
          <p>Travelled with NESAM? We would love to hear about your experience.</p>
          <small>Customer reviews will appear here once published.</small>
        </div>
        <a className="inline-link" href="/support?topic=feedback">
          Share feedback 
        </a>
      </div>
      }
    </section>
  );
}

export function CatalogSection() {
  const [services,setServices]=useState<PublicContent[]>([]),[packages,setPackages]=useState<PublicContent[]>([]),[places,setPlaces]=useState<PublicContent[]>([]);
  const [error,setError]=useState('');
  useEffect(()=>{const off=[subscribePublicContent('services',setServices,setError),subscribePublicContent('tour_packages',setPackages,setError),subscribePublicContent('locations',setPlaces,setError)];return()=>off.forEach(f=>f());},[]);
  if(!services.length&&!packages.length&&!places.length&&!error)return null;
  const href=(s:PublicContent)=>s.onlineBookingEnabled ? s.serviceType==='Airport Taxi'?'/book?service=airport':s.serviceType==='Local Rental'?'/book?service=rental':['One Way Taxi','Outstation Cab'].includes(s.serviceType??'')?'/book?service=outstation':null:null;
  return <section className="wrap" aria-labelledby="catalog-title" style={{paddingBlock:32}}><SectionHeading title="Services, tours & destinations" id="catalog-title" />{error&&<p role="status">{error}</p>}
    {services.length>0&&<><h3>Our services</h3><ul className="card card--list">{services.map(s=><li key={s.id} style={{padding:16}}><strong>{s.name}</strong><p>{s.description}</p>{href(s)?<a className="inline-link" href={href(s)!}>Check availability</a>:<a className="inline-link" href={`tel:${SUPPORT_PHONE}`}>Enquire with NESAM</a>}</li>)}</ul></>}
    {packages.length>0&&<><h3>Tour packages</h3><ul className="card card--list">{packages.map(p=><li key={p.id} style={{padding:16}}><strong>{p.name}</strong><p>{p.description}</p>{p.basePrice!=null&&<p>Starting from {formatINR(p.basePrice)} · final price confirmed by NESAM</p>}<a className="inline-link" href={`tel:${SUPPORT_PHONE}`}>Enquire about this package</a></li>)}</ul></>}
    {places.length>0&&<><h3>Destinations we serve</h3><p>{places.map(p=>[p.name,p.city,p.state].filter(Boolean).join(', ')).join(' · ')}</p></>}
  </section>;
}
