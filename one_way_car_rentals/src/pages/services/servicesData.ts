// Service pages (/services/:slug). Editorial copy only — no prices: fares come from the booking
// server. Kept free of runtime imports so the build-time SEO prerender can read it.
import type { TripType } from '@core/types';
import { IMG } from '../book/content';

export interface ServiceDetail {
  slug: string;
  /** The matching service card id on the booking home. */
  homeId: string;
  title: string;
  h1: string;
  /** Short name for links and breadcrumbs. */
  name: string;
  tripType: TripType;
  imageUrl: string;
  metaDescription: string;
  keywords: string;
  lead: string;
  features: Array<{ title: string; text: string }>;
  overview: string[];
  billing: Array<{ title: string; detail: string }>;
  faqs: Array<{ q: string; a: string }>;
}

const TOLLS = { title: 'Tolls, parking & permits', detail: 'Added to your receipt at actual cost against receipts, with no markup.' };
const PAYMENT = { title: 'Payment', detail: 'Nothing is charged when you book. Pay your driver in cash or by UPI at the end of the trip.' };

export const ALL_SERVICES: ServiceDetail[] = [
  {
    slug: 'one-way-drop-taxi',
    homeId: 'one-way',
    title: 'One Way Drop Taxi in Tamil Nadu | No Return Fare',
    h1: 'One Way Drop Taxi Across Tamil Nadu',
    name: 'One way drop taxi',
    tripType: 'One Way',
    imageUrl: IMG('photography/service-one-way'),
    metaDescription:
      'One way drop taxi between cities in Tamil Nadu, Bangalore and Pondicherry. Pay for the drop only, see every vehicle’s fare before booking, verified chauffeurs.',
    keywords:
      'one way drop taxi, one way taxi tamil nadu, one way cab, drop taxi online booking, intercity one way cab, one way car rental with driver, outstation drop taxi',
    lead: 'Going to another city and not coming back the same way? Book a one-way drop and pay for the trip you actually take — never for the car’s empty return.',
    features: [
      { title: 'No return fare', text: 'A one-way booking is priced for your drop, not for a round trip you won’t take.' },
      { title: 'Fares before you book', text: 'Compare every vehicle — hatchback to tempo traveller — with what is and isn’t included.' },
      { title: 'Verified chauffeurs', text: 'Commercial drivers who know the highways, with name, phone and vehicle number shared once assigned.' },
      { title: 'Boarding code', text: 'The trip can’t start until you share the 4-digit code shown only to you.' },
    ],
    overview: [
      'One Way Car Rentals is built around the intercity drop: Chennai to Pondicherry, Coimbatore to Ooty, Madurai to Rameshwaram, Chennai to Bangalore and any other city pair across Tamil Nadu and the neighbouring states.',
      'Enter your pickup and drop, choose a date and time from 30 minutes to 30 days ahead, and the booking page lists every vehicle with its fare. Once a driver is assigned you can follow them live on the map, and a receipt with the full fare breakup is saved to your trips.',
    ],
    billing: [
      { title: 'Distance', detail: 'Priced on the one-way route between your pickup and drop.' },
      { title: 'What’s included', detail: 'Shown on the fare screen for each vehicle before you confirm.' },
      TOLLS,
      PAYMENT,
    ],
    faqs: [
      {
        q: 'What is a one way drop taxi?',
        a: 'A cab that takes you from one city to another without you paying for its return journey. You are billed for the one-way route only.',
      },
      {
        q: 'Can I stop for food on the way?',
        a: 'Yes. Short stops for meals and rest breaks are normal on intercity drops — just let your driver know.',
      },
      {
        q: 'How far ahead can I book?',
        a: 'Pickups can be booked from 30 minutes to 30 days ahead.',
      },
    ],
  },
  {
    slug: 'outstation-round-trip',
    homeId: 'round-trip',
    title: 'Outstation Round Trip Cab with Driver | Multi-Day Car Rental',
    h1: 'Outstation Round Trips with a Chauffeur',
    name: 'Outstation round trip',
    tripType: 'Round Trip',
    imageUrl: IMG('photography/service-round-trip'),
    metaDescription:
      'Outstation round trip cabs with a dedicated chauffeur for one day or several. Calendar-day billing, fares shown before you book, clean AC cars across South India.',
    keywords:
      'outstation round trip cab, outstation cab with driver, multi day car rental with driver, round trip taxi tamil nadu, family trip car rental',
    lead: 'Out and back over one day or many, with the same car and driver throughout. Billed by calendar day, with the fare shown before you book.',
    features: [
      { title: 'Same car, same driver', text: 'Your chauffeur stays with you for the whole trip.' },
      { title: 'Calendar-day billing', text: 'Simple to plan: each calendar day of the trip is a billing day.' },
      { title: 'Your own schedule', text: 'Stop for viewpoints, temples and meals when you want to.' },
      { title: 'Room for everyone', text: 'Sedans, SUVs and tempo travellers for families and groups.' },
    ],
    overview: [
      'Round trips suit weekend getaways to Ooty or Kodaikanal, temple circuits, weddings and business visits that take in several towns. Add your return date when booking and the fare for each vehicle covers the whole trip.',
      'Because the car stays with you, there is no need to find a new cab at each stop — your driver waits while you sightsee, shop or attend meetings.',
    ],
    billing: [
      { title: 'Calendar days', detail: 'Each calendar day from departure to return counts as one billing day.' },
      { title: 'What’s included', detail: 'Shown on the fare screen for each vehicle before you confirm.' },
      TOLLS,
      PAYMENT,
    ],
    faqs: [
      {
        q: 'How is a multi-day round trip billed?',
        a: 'By calendar day: leaving on Saturday morning and returning on Sunday evening is a two-day trip. The fare screen shows the full amount for each vehicle before you book.',
      },
      {
        q: 'Can I book a round trip for a single day?',
        a: 'Yes. Set the same date for departure and return; the trip is then billed as one calendar day.',
      },
    ],
  },
  {
    slug: 'airport-taxi',
    homeId: 'airport',
    title: 'Airport Taxi | Chennai, Bangalore, Coimbatore, Madurai & Trichy',
    h1: 'Airport Taxi Pickups and Drops',
    name: 'Airport taxi',
    tripType: 'Airport Taxi',
    imageUrl: IMG('photography/service-airport'),
    metaDescription:
      'Pre-booked airport taxi for Chennai, Bangalore, Coimbatore, Madurai and Trichy airports. Scheduled pickups, verified chauffeurs, fares shown before you book.',
    keywords:
      'airport taxi chennai, chennai airport cab, bangalore airport taxi, coimbatore airport taxi, madurai airport cab, trichy airport taxi, airport drop taxi',
    lead: 'Pickups and drops arranged before your flight, with the fare for every vehicle shown upfront and a driver you can call once assigned.',
    features: [
      { title: 'Booked ahead', text: 'Schedule your pickup up to 30 days in advance.' },
      { title: 'Driver details early', text: 'Name, phone and vehicle number appear on your ride page once assigned.' },
      { title: 'Space for luggage', text: 'Choose an SUV or larger vehicle when travelling with several bags.' },
      { title: 'Onward intercity drops', text: 'Go straight from the airport to another city — Coimbatore airport to Ooty, for example.' },
    ],
    overview: [
      'We cover Chennai (MAA), Kempegowda Bengaluru (BLR), Coimbatore (CJB), Madurai (IXM) and Tiruchirappalli (TRZ) airports, for city transfers and for direct drops to other towns.',
      'Choose the airport as your pickup or drop, set the time, and compare vehicles with their fares before you confirm.',
    ],
    billing: [
      { title: 'Fare', detail: 'Shown for each vehicle before you confirm.' },
      { title: 'Airport parking & tolls', detail: 'Added at actual cost against receipts.' },
      PAYMENT,
    ],
    faqs: [
      {
        q: 'Which airports do you serve?',
        a: 'Chennai, Bengaluru, Coimbatore, Madurai and Tiruchirappalli airports, for both city transfers and intercity drops.',
      },
      {
        q: 'Will the driver help with luggage?',
        a: 'Yes, our chauffeurs help load and unload your bags.',
      },
    ],
  },
  {
    slug: 'local-rental',
    homeId: 'local-rental',
    title: 'Local Car Rental with Driver by the Hour | City Cab Packages',
    h1: 'Local Car Rental with a Driver, by the Hour',
    name: 'Local hourly rental',
    tripType: 'Local Rental',
    imageUrl: IMG('photography/service-corporate'),
    metaDescription:
      'Hire a car with a chauffeur by the hour within city limits — for meetings, shopping, hospital visits or family functions. Fares shown before you book.',
    keywords:
      'local car rental with driver, hourly cab rental, car with driver for a day, city cab package, local taxi by the hour chennai',
    lead: 'A car and chauffeur at your disposal by the hour within city limits. Make as many stops as you need while the driver waits.',
    features: [
      { title: 'Car waits for you', text: 'Your driver waits at each stop while you finish your work.' },
      { title: 'Hourly packages', text: 'Choose the package that fits your day.' },
      { title: 'Clean AC fleet', text: 'Well-kept cars suitable for guests, clients and family.' },
      { title: 'Clear extras', text: 'Extra time and distance rates are shown before you confirm.' },
    ],
    overview: [
      'Days with several stops — client meetings, wedding shopping, hospital appointments or family functions — are easier with one car for the whole day than with a string of separate cabs.',
      'Pick a package, set your start time and pickup, and the fare for each vehicle is shown before you book.',
    ],
    billing: [
      { title: 'Packages', detail: 'Billed by hourly package, with the included time and distance shown when you book.' },
      { title: 'Extra time or distance', detail: 'Rates shown on the fare screen before you confirm.' },
      TOLLS,
      PAYMENT,
    ],
    faqs: [
      {
        q: 'Can I make multiple stops?',
        a: 'Yes. Travel to as many places as you need within your booked hours and city limits.',
      },
    ],
  },
  {
    slug: 'pilgrimage-tours',
    homeId: 'pilgrimage',
    title: 'Temple Tour Taxi in Tamil Nadu | Pilgrimage Cab with Driver',
    h1: 'Temple and Pilgrimage Trips by Car',
    name: 'Temple & pilgrimage trips',
    tripType: 'Round Trip',
    imageUrl: IMG('photography/service-pilgrimage'),
    metaDescription:
      'Temple tour cabs for Rameswaram, Tirupati, Madurai Meenakshi, Palani and the Navagraha temples. Courteous chauffeurs, fares shown before you book.',
    keywords:
      'temple tour taxi tamil nadu, pilgrimage cab, navagraha temple tour car, rameshwaram taxi, tirupati darshan cab, palani temple taxi',
    lead: 'Darshan trips and multi-temple circuits without the travel stress, with patient chauffeurs who are used to temple towns.',
    features: [
      { title: 'Temple-town experience', text: 'Drivers familiar with temple timings and parking near the shrines.' },
      { title: 'Easy for elders', text: 'Comfortable cars and unhurried driving for senior family members.' },
      { title: 'Multi-day circuits', text: 'Book a round trip to keep the same car across several towns.' },
      { title: 'Room for the family', text: 'SUVs and tempo travellers for larger groups.' },
    ],
    overview: [
      'Tamil Nadu’s great temples — Madurai Meenakshi, Rameswaram, Thanjavur, Palani, the Navagraha temples around Kumbakonam — and Tirupati just across the border draw families from across the country.',
      'For a single temple, a one-way drop may be all you need. For a circuit over several days, book a round trip so your car and driver stay with you from shrine to shrine.',
    ],
    billing: [
      { title: 'Round trips', detail: 'Billed by calendar day, with the full fare shown before you confirm.' },
      TOLLS,
      PAYMENT,
    ],
    faqs: [
      {
        q: 'Can you plan a Navagraha temple circuit?',
        a: 'Yes. Book a round trip from Kumbakonam, Thanjavur or Trichy covering your chosen days, or call us to plan the route.',
      },
    ],
  },
];

export function findServiceBySlug(slug: string): ServiceDetail | undefined {
  const norm = slug.toLowerCase().replace(/_|\s+/g, '-');
  return ALL_SERVICES.find((s) => s.slug === norm || s.homeId === norm);
}

/** The service page for a service card on the booking home, if one exists. */
export const serviceSlugFor = (homeId: string): string | undefined => ALL_SERVICES.find((s) => s.homeId === homeId)?.slug;
