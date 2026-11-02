// Groq AI Chatbot for Nesam Cabs, People Taxi, and One Way Car Rentals.
//
// Powered by Groq AI high-speed inference (llama-3.3-70b-versatile / llama-3.1-8b-instant).
// API key is held securely on the server via GROQ_API_KEY env variable; visitors and signed-in
// users are served safely through this endpoint.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { requestIp } from './security';
import { rateLimited } from './http/util';
import { text } from './shared';
import { PUBLIC_CALLABLE_ORIGINS } from './corsOrigins';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatRequestInput {
  brand?: string;
  /** The rider's chosen language: "en" or "ta" (Tamil). Tamil typed by the rider is detected too. */
  language?: string;
  messages?: ChatMessage[];
  context?: {
    pickup?: string;
    drop?: string;
    service?: string;
  };
}

const SUPPORT_PHONE = '+91 90250 99990';
const SUPPORT_PHONE_TEL = '+919025099990';

// ── Brand-specific expert system instructions ──────────────────────────────

const NESAM_SYSTEM_PROMPT = `You are the official NESAM AI Assistant, the intelligent 24/7 travel advisor for NESAM Tours and Travels (operating Nesam Cabs), headquartered in Theni, Tamil Nadu.

Brand Identity & Standards:
- Company: NESAM Tours and Travels Private Limited.
- Services: Outstation One-Way Drop Taxi, Round Trips, Airport Transfers (Chennai MAA, Coimbatore CJB, Madurai IXM, Trichy TRZ, Bangalore BLR), Hourly City Rentals (4hr/40km, 8hr/80km, 12hr/120km), Multi-City and Hill Station Pilgrimage Tours (Munnar, Kodaikanal, Ooty, Madurai, Rameshwaram, Kanyakumari, Tirupati).
- Fleets: Sedan (Dzire, Etios - 4 seats, 2 bags), SUV (Ertiga, Triber - 6-7 seats), Prime SUV (Innova, Innova Crysta - 7 seats, maximum comfort), Tempo Traveller (12, 14, 17 seaters).
- Pricing Model: 100% upfront transparent fares. Zero hidden charges. Zero surge pricing during peak hours or bad weather.
- Boarding & Safety: Safe 4-digit boarding OTP generated for the customer upon booking confirmation, shared only with the verified driver at pickup.
- Payment: Pay the driver directly via Cash or UPI at trip end, or pay online.
- Cancellation: Free until 1 hour before pickup; after that a ₹100 cancellation fee applies.
- 24/7 Helpline: ${SUPPORT_PHONE}.

Guidelines:
- Answer all customer queries clearly, politely, and concisely with bullet points where helpful.
- Support English, Tamil, and Tanglish queries naturally.
- If asked about booking, guide them to use the booking form on the page or offer the 24/7 phone number ${SUPPORT_PHONE}.`;

const PEOPLE_TAXI_SYSTEM_PROMPT = `You are the official People Taxi AI Guide, the friendly 24/7 travel advisor for People Taxi (a unit of NESAM Tours and Travels Private Limited).

Brand Identity & Standards:
- Tone: Friendly, vibrant, helpful, and transparent ("People First, Best Rates").
- Services: One-Way Drop Taxi (pay only for one way!), Round Trips, Airport Transfers, Hourly City Rentals, Multi-City Tours.
- Fleets: Sedan (Dzire, Etios), Prime Sedan, SUV (Ertiga), Prime SUV (Innova / Innova Crysta), Tempo Traveller.
- Pricing: Upfront transparent fares with no surge pricing. Pay your driver directly via Cash or UPI at drop.
- Boarding Safety: Verified drivers with secure boarding OTP.
- 24/7 Customer Care: ${SUPPORT_PHONE}.

Guidelines:
- Keep responses friendly, upbeat, and easy to read.
- Answer travel queries across Tamil Nadu, Bangalore, Pondicherry, Kerala.
- Emphasize saving money on one-way drop trips (no return fare).
- Guide users to select their trip on the home booking form.`;

const ONEWAY_SYSTEM_PROMPT = `You are the official One Way Car Rentals AI Concierge, the outstation specialist for One Way Car Rentals (a unit of NESAM Tours and Travels Private Limited).

Brand Identity & Standards:
- Tone: Professional, dependable, transparent, premium outstation expert.
- Speciality: Dedicated one-way intercity drops across South India (Tamil Nadu, Karnataka, Kerala, Andhra Pradesh, Pondicherry). Save up to 40% over traditional two-way taxi charges.
- Services: Outstation Drop Taxi, Round Trips, Airport Transfers, Local Hourly Rentals, Multi-City Packages.
- Fleets: Well-maintained, sanitized, air-conditioned Sedans (Etios, Dzire), SUVs (Ertiga), Prime SUVs (Innova Crysta).
- Pricing Guarantee: Upfront exact fare quote before you confirm. Zero surge. Pay driver directly via Cash or UPI.
- 24/7 Dispatch & Support: ${SUPPORT_PHONE}.

Guidelines:
- Provide sharp, factual, and helpful travel answers.
- Explain route estimates and why one-way drop taxis save up to 40%.
- Assist users with itinerary planning and route advice.`;


// ── Facts every brand shares (the app's real rules; the bot must not invent anything beyond them) ──

const SHARED_FACTS = `Booking facts (state only these; never invent fares, offers or availability):
- Every booking is made in advance: pick a date and time, then choose a car. Nothing is charged when booking.
- The exact fare for each car is shown in the booking form before confirming. If someone asks for a price for a route, tell them to enter pickup and drop in the booking form, or call ${SUPPORT_PHONE}. Do not quote rupee amounts per km or per route.
- Payment: the rider pays the driver in cash or by UPI at the end of the trip.
- Tolls, parking and state permits paid by the driver are added to the final receipt at actual cost; they are not in the quoted fare.
- Cancellation: free until 1 hour before pickup, then a ₹100 fee. Cancel from My Trips.
- Boarding code: a 4-digit code on the booking, shared with the driver only once inside the car.
- Driver name, number and vehicle appear on the booking page once a driver is assigned.
- Local Rental packages: 4, 6, 8, 10 or 12 hours with included km.
- Multicity: riders can send a multi-stop itinerary from the Multicity tab; the travel desk prices it and sends a quote to accept.
- Support: ${SUPPORT_PHONE} (24/7), WhatsApp available.`;

const LANGUAGE_RULES = (lang: 'en' | 'ta') => lang === 'ta'
  ? 'Reply in Tamil (தமிழ்) using Tamil script, in simple everyday words. Keep brand names, place names, phone numbers, ₹ amounts and car model names as they are. If the rider writes in English or Tanglish, still reply in Tamil because Tamil is selected.'
  : 'Reply in clear, simple English. If the rider writes in Tamil script, reply in Tamil script; if they write Tamil in English letters (Tanglish), reply in Tamil script as well.';

function getSystemPrompt(brand: string, lang: 'en' | 'ta', context?: { pickup?: string; drop?: string; service?: string }): string {
  const b = (brand || '').toLowerCase();
  let base = NESAM_SYSTEM_PROMPT;
  if (b.includes('people')) base = PEOPLE_TAXI_SYSTEM_PROMPT;
  else if (b.includes('oneway') || b.includes('one_way')) base = ONEWAY_SYSTEM_PROMPT;

  base += `

${SHARED_FACTS}

Style: short answers (under 120 words), bullets for lists, no markdown headings, plain **bold** only. ${LANGUAGE_RULES(lang)}`;
  if (context?.pickup || context?.drop || context?.service) {
    base += `\n\nCurrent User Session Context:\n- Selected Service: ${context.service || 'Not chosen yet'}\n- Pickup: ${context.pickup || 'Not selected'}\n- Drop: ${context.drop || 'Not selected'}`;
  }
  return base;
}

// ── Offline answers (no Groq key, or Groq unavailable) ──────────────────────
// Real facts only (see SHARED_FACTS). English and Tamil, picked from what the rider asked.

const TAMIL = /[஀-௿]/;
const detectLanguage = (chosen: unknown, lastUserText: string): 'en' | 'ta' => (chosen === 'ta' || TAMIL.test(lastUserText) ? 'ta' : 'en');

type Intent = 'greeting' | 'thanks' | 'cancel' | 'payment' | 'fare' | 'toll' | 'vehicle' | 'airport' | 'rental' | 'multicity' | 'oneway' | 'boarding' | 'driver' | 'book' | 'contact';

// Matched in order, against the lower-cased question. Tanglish spellings are included.
const INTENT_WORDS: Array<[Intent, RegExp]> = [
  ['thanks', /(thank|thanks|thx|nandri|நன்றி)/],
  ['cancel', /(cancel|refund|ரத்து|பணத்திரும்ப|thirumba|ratthu)/],
  ['toll', /(toll|parking|permit|state tax|சுங்க|டோல்|பார்க்கிங்)/],
  ['payment', /(payment|\bpay\b|upi|cash|advance|gpay|phonepe|செலுத்த|பணம்|panam)/],
  ['boarding', /(otp|boarding|code|safety|safe|பாதுகாப்பு|ஓடிபி)/],
  ['driver', /(driver|driver|டிரைவர்|ஓட்டுநர்)/],
  ['airport', /(airport|flight|விமான)/],
  ['rental', /(rental|hourly|\bhours?\b|local|disposal|வாடகை|மணி நேர)/],
  ['multicity', /(multi|tour|package|itinerary|munnar|ooty|kodai|rameshwaram|kanyakumari|tirupati|pilgrim|சுற்றுலா|யாத்திரை)/],
  ['oneway', /(one.?way|drop taxi|round trip|return|ஒருவழி|ஒரு வழி|சுற்றுப் ?பயண)/],
  ['vehicle', /(car|vehicle|fleet|sedan|suv|innova|crysta|ertiga|tempo|traveller|seater|கார்|வாகன|இன்னோவா)/],
  ['fare', /(fare|price|cost|rate|charge|how much|kattanam|vilai|evlo|evvalavu|கட்டண|விலை|எவ்வளவு)/],
  ['book', /(book|booking|how to|reserve|புக்|பதிவு)/],
  ['contact', /(contact|phone|number|call|help|support|whatsapp|உதவி|தொடர்பு|அழை)/],
];

function intentOf(q: string): Intent | null {
  const t = q.trim().toLowerCase();
  if (/^(hi+|hello+|hey+|hai+|hlo|vanakkam|good (morning|afternoon|evening)|வணக்கம்|ஹாய்|ஹலோ)[\s!.,?]*$/.test(t)) return 'greeting';
  for (const [intent, re] of INTENT_WORDS) if (re.test(t)) return intent;
  return null;
}

function offlineAnswer(brand: string, userQuery: string, lang: 'en' | 'ta'): string {
  const b = brand.toLowerCase();
  const name = b.includes('people') ? 'People Taxi' : b.includes('oneway') || b.includes('one_way') ? 'One Way Car Rentals' : 'NESAM Cabs';
  const call = `**${SUPPORT_PHONE}**`;
  const ta = lang === 'ta';
  const intent = intentOf(userQuery);

  switch (intent) {
    case 'greeting':
      return ta
        ? `வணக்கம்! **${name}** உதவியாளர் இங்கே. 😊\n\nநான் உதவக்கூடியவை:\n• **கட்டணம்** மற்றும் வாகன வகைகள்\n• **ஒருவழி டிராப்**, சுற்றுப் பயணம், விமான நிலையம், உள்ளூர் வாடகை\n• **ரத்து**, பணம் செலுத்தும் முறை, பாதுகாப்பு\n\nஎங்கே பயணம் செய்ய விரும்புகிறீர்கள்?`
        : `Hello! I'm the **${name}** assistant. 😊\n\nI can help with:\n• **Fares** and car types\n• **One-way drops**, round trips, airport rides and local rentals\n• **Cancellation**, payment and safety\n\nWhere would you like to travel?`;
    case 'thanks':
      return ta ? `மகிழ்ச்சி! வேறு ஏதாவது உதவி வேண்டுமா? 24/7 எண்: ${call}.` : `You're welcome! Anything else I can help with? We're on ${call}, 24/7.`;
    case 'cancel':
      return ta
        ? `**ரத்து கொள்கை — ${name}**\n• பிக்கப்புக்கு **1 மணி நேரம் முன்** வரை **இலவசமாக** ரத்து செய்யலாம்.\n• அதன் பிறகு **₹100** ரத்து கட்டணம் உண்டு.\n• "My Trips" பகுதியில் உங்கள் புக்கிங்கைத் திறந்து ரத்து செய்யலாம்; கட்டணம் இருந்தால் உறுதிப்படுத்தும் முன் திரையில் தெரியும்.\n\nஉதவிக்கு: ${call}`
        : `**Cancellation at ${name}**\n• **Free** until **1 hour before pickup**.\n• After that a **₹100** cancellation fee applies.\n• Cancel from **My Trips**; any fee is shown before you confirm.\n\nNeed help? Call ${call}.`;
    case 'payment':
      return ta
        ? `**பணம் செலுத்தும் முறை**\n• புக்கிங் செய்யும்போது **எந்தப் பணமும் வசூலிக்கப்படாது**.\n• பயணம் முடிந்ததும் டிரைவரிடம் **ரொக்கமாக அல்லது UPI** மூலம் செலுத்தலாம்.\n• சுங்கம், பார்க்கிங், மாநில அனுமதிக் கட்டணங்கள் உண்மையான செலவில் இறுதி ரசீதில் சேர்க்கப்படும்.`
        : `**Payment**\n• **Nothing is charged** when you book.\n• Pay your driver in **cash or UPI** at the end of the trip.\n• Tolls, parking and state permits are added to the final receipt at actual cost.`;
    case 'toll':
      return ta
        ? `**சுங்கம், பார்க்கிங், அனுமதிக் கட்டணம்** மேற்கோள் காட்டிய கட்டணத்தில் **சேராது**. டிரைவர் செலுத்தும் இவை உண்மையான செலவில், ரசீதுகளுடன் இறுதி ரசீதில் சேர்க்கப்படும்.`
        : `**Tolls, parking and state permits** are **not** in the quoted fare. What the driver pays is added to your final receipt at actual cost, against receipts.`;
    case 'boarding':
      return ta
        ? `**பாதுகாப்பு**\n• ஒவ்வொரு புக்கிங்குக்கும் **4 இலக்க போர்டிங் குறியீடு** உண்டு. காரில் ஏறிய பிறகே டிரைவரிடம் சொல்லுங்கள்; அது இல்லாமல் பயணம் தொடங்காது.\n• டிரைவர் ஒதுக்கப்பட்டதும் அவர் பெயர், எண், வாகன எண் உங்கள் புக்கிங் பக்கத்தில் தெரியும்.`
        : `**Safety**\n• Every booking has a **4-digit boarding code**. Share it with the driver only once you're in the car; the trip can't start without it.\n• Once a driver is assigned, their name, number and vehicle appear on your booking page.`;
    case 'driver':
      return ta
        ? `டிரைவர் ஒதுக்கப்பட்டதும் அவர் **பெயர், தொலைபேசி எண், வாகன எண்** உங்கள் புக்கிங் பக்கத்தில் (My Trips) தெரியும். எல்லா டிரைவர்களும் சரிபார்க்கப்பட்டவர்கள்.`
        : `Once a driver is assigned, their **name, phone number and vehicle number** appear on your booking page (My Trips). All our drivers are verified.`;
    case 'airport':
      return ta
        ? `**விமான நிலைய பயணம்**\n• முகப்புப் பக்கத்தில் **Airport** தேர்வு செய்து, "To airport" அல்லது "From airport" என்பதைத் தேர்ந்தெடுங்கள்.\n• பிக்கப் / டிராப் இடம், தேதி, நேரம் உள்ளிட்டால் ஒவ்வொரு காருக்கும் கட்டணம் தெரியும்.\n• விமான நேரத்துக்கு முன்பே பதிவு செய்வது நல்லது.`
        : `**Airport rides**\n• Choose **Airport** on the home page, then "To airport" or "From airport".\n• Enter the pickup/drop, date and time to see the fare for each car.\n• Book ahead of your flight time.`;
    case 'rental':
      return ta
        ? `**உள்ளூர் மணிநேர வாடகை**\n• நகருக்குள் டிரைவருடன் கார் — **4, 6, 8, 10 அல்லது 12 மணி நேர** பேக்கேஜ்கள், குறிப்பிட்ட கி.மீ உட்பட.\n• முகப்புப் பக்கத்தில் **Local Rental** தேர்வு செய்து பிக்கப் இடம் உள்ளிடுங்கள்; ஒவ்வொரு காருக்கும் பேக்கேஜ் கட்டணம் தெரியும்.`
        : `**Local hourly rental**\n• A car with a driver inside the city: **4, 6, 8, 10 or 12 hour** packages with included km.\n• Choose **Local Rental** on the home page and enter your pickup; each car shows its package fare.`;
    case 'multicity':
      return ta
        ? `**பல நகரச் சுற்றுலா (Multicity)**\n• முகப்புப் பக்கத்தில் **Multicity** தாவலைத் திறந்து, தொடக்க இடம், இடையில் நிற்கும் நகரங்கள், இறுதி இடம், தேதி, நேரம் ஆகியவற்றைக் கொடுத்து படிவத்தின் கீழுள்ள பொத்தானை அழுத்துங்கள்.\n• எங்கள் பயண மேசை வழியைக் கணக்கிட்டு உங்களுக்குக் கட்டணத்தை அனுப்பும்; ஏற்றால் புக்கிங் உறுதியாகும்.\n• உங்கள் கோரிக்கை நிலை **My Trips** இல் தெரியும்.`
        : `**Multicity tours**\n• Open the **Multicity** tab on the home page, add your start, the cities in between, the final drop, date and time, then send the request with the button at the bottom of the form.\n• Our travel desk works out the route and sends you a price; accept it and the booking is confirmed.\n• You can follow your request under **My Trips**.`;
    case 'oneway':
      return ta
        ? `**ஒருவழி டிராப் டாக்ஸி**: நீங்கள் செல்லும் ஒரு வழிக்கான கட்டணம் மட்டுமே; காலி வண்டி திரும்பும் கட்டணம் இல்லை. **சுற்றுப் பயணம்** (Round Trip) தேர்வு செய்தால் திரும்பும் தேதியும் நேரமும் கொடுக்க வேண்டும்.\nஉங்கள் வழிக்கான சரியான கட்டணத்தை புக்கிங் படிவத்தில் பார்க்கலாம்.`
        : `**One-way drop taxi**: you pay for the one way you travel, with no empty return fare. For a **Round Trip** you also give the return date and time.\nYour exact fare for the route shows in the booking form.`;
    case 'vehicle':
      return ta
        ? `**வாகன வகைகள்**\n• **Sedan** — 4 பயணிகள்; தம்பதி, சிறு குடும்பம்.\n• **SUV / MPV** — 6–7 பயணிகள்; அதிக லக்கேஜ் இடம்.\n• **Innova / Innova Crysta** — 7 பயணிகள்; நீண்ட பயணத்துக்கு வசதி.\n• குழுவுக்கு **வேன் / மினி பஸ்** வகைகளும் உண்டு.\nஎல்லா வாகனங்களும் ஏசி; டிரைவர் சரிபார்க்கப்பட்டவர். உங்கள் வழிக்கு கிடைக்கும் வாகனங்களும் கட்டணமும் புக்கிங் படிவத்தில் தெரியும்.`
        : `**Car types**\n• **Sedan** — 4 passengers; couples and small families.\n• **SUV / MPV** — 6–7 passengers; more luggage space.\n• **Innova / Innova Crysta** — 7 passengers; comfortable for long drives.\n• **Vans / mini buses** for groups.\nAll cars are air-conditioned with verified drivers. The cars available for your route, and their fares, show in the booking form.`;
    case 'fare':
      return ta
        ? `**${name}** இல் **ஒவ்வொரு காருக்கும் கட்டணம் புக்கிங் செய்வதற்கு முன்பே** காட்டப்படும்; மறைமுகக் கட்டணம் இல்லை, பீக் நேர கூடுதல் கட்டணமும் இல்லை.\n\nஉங்கள் வழிக்கான கட்டணம் அறிய: முகப்புப் பக்கத்தில் **பிக்கப், டிராப், தேதி, நேரம்** உள்ளிட்டு **See fares / Search Cabs** அழுத்துங்கள்.\nசுங்கம், பார்க்கிங் தனியாக உண்மையான செலவில் சேரும். உதவிக்கு: ${call}`
        : `At **${name}** the **fare for every car is shown before you book**, with no hidden charges and no surge pricing.\n\nTo see the fare for your route, enter **pickup, drop, date and time** on the home page and tap **See fares / Search Cabs**.\nTolls and parking are added separately at actual cost. Need a person? Call ${call}.`;
    case 'book':
      return ta
        ? `**புக்கிங் செய்வது எப்படி**\n1. முகப்புப் பக்கத்தில் சேவையைத் தேர்ந்தெடுங்கள் (Outstation, Airport, Local Rental, Multicity).\n2. பிக்கப், டிராப், தேதி, நேரம் உள்ளிடுங்கள்.\n3. கார் மற்றும் கட்டணத்தைத் தேர்ந்தெடுத்து, மொபைல் எண்ணுடன் உள்நுழைந்து உறுதிப்படுத்துங்கள்.\nபுக்கிங்கின் போது பணம் வசூலிக்கப்படாது.`
        : `**How to book**\n1. Choose a service on the home page (Outstation, Airport, Local Rental, Multicity).\n2. Enter pickup, drop, date and time.\n3. Pick a car and fare, sign in with your mobile number and confirm.\nNothing is charged at booking.`;
    case 'contact':
      return ta
        ? `நாங்கள் 24/7 உங்களுக்கு உதவுகிறோம்!\n• **அழைக்க**: [${SUPPORT_PHONE}](tel:${SUPPORT_PHONE_TEL})\n• **WhatsApp**: [எங்களுடன் பேசுங்கள்](https://wa.me/919025099990)\n• பணம்: பயணம் முடிந்ததும் டிரைவரிடம் ரொக்கம் / UPI.`
        : `We're here 24/7!\n• **Call**: [${SUPPORT_PHONE}](tel:${SUPPORT_PHONE_TEL})\n• **WhatsApp**: [Chat with us](https://wa.me/919025099990)\n• Payment: cash or UPI to your driver after the trip.`;
    default:
      return ta
        ? `மன்னிக்கவும், அந்தக் கேள்வியை என்னால் சரியாகப் புரிந்துகொள்ள முடியவில்லை. இவற்றைப் பற்றிக் கேளுங்கள்:\n• **கட்டணம்**, வாகன வகைகள்\n• **ரத்து**, பணம் செலுத்துதல்\n• **விமான நிலையம்**, உள்ளூர் வாடகை, Multicity சுற்றுலா\n\nஅல்லது எங்களை அழையுங்கள்: ${call} (24/7).`
        : `Sorry, I couldn't quite understand that. You can ask me about:\n• **Fares** and car types\n• **Cancellation** and payment\n• **Airport rides**, local rentals and **Multicity** tours\n\nOr call us on ${call}, 24/7.`;
  }
}

// ── Groq call ────────────────────────────────────────────────────────────────

/** One Groq request with a time limit; null when it fails so the next model (or the offline answer) is tried. */
async function askGroq(apiKey: string, model: string, system: string, history: ChatMessage[]): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, ...history], temperature: 0.4, max_tokens: 700, top_p: 0.95, stream: false }),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.warn('[groqChat] Groq API returned status:', response.status, model);
      return null;
    }
    const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return json?.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.warn('[groqChat] Groq call failed:', model, err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── Main Callable ──────────────────────────────────────────────────────────

export const chatWithBot = onCall(
  {
    timeoutSeconds: 60,
    cors: PUBLIC_CALLABLE_ORIGINS,
  },
  async (request) => {
  const input = (request.data ?? {}) as ChatRequestInput;
  const brand = text(input.brand, 40) || 'nesam';
  const rawMessages = Array.isArray(input.messages) ? input.messages : [];

  const uid = request.auth?.uid ?? '';
  const ip = requestIp(request as never) || 'unknown';
  if (rateLimited(`groq:${uid || ip}`, 30, 60 * 1000)) {
    throw new HttpsError('resource-exhausted', 'You are sending messages too quickly. Please pause for a moment.');
  }

  const validMessages: ChatMessage[] = rawMessages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-10)
    .map((m) => ({ role: m.role, content: text(m.content, 2000) }));

  const lastUserMessage = [...validMessages].reverse().find((m) => m.role === 'user')?.content || '';
  const lang = detectLanguage(input.language, lastUserMessage);

  const apiKey = (process.env.GROQ_API_KEY ?? '').trim();
  const offline = (provider: string) => ({ message: offlineAnswer(brand, lastUserMessage, lang), provider, language: lang });

  // No Groq key: answer from the built-in knowledge instead.
  if (!apiKey) return offline('fallback');

  const system = getSystemPrompt(brand, lang, input.context);
  // The main model first; a smaller, faster one when it is busy or rate-limited.
  const primary = (process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile').trim();
  for (const model of [...new Set([primary, 'llama-3.1-8b-instant'])]) {
    const answer = await askGroq(apiKey, model, system, validMessages);
    if (answer) return { message: answer, provider: 'groq', model, language: lang };
  }
  return offline('fallback_error');
});
