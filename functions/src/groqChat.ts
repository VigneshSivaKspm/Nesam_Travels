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
- Boarding & Safety: Safe 4-digit boarding OTP generated for the customer upon booking confirmation, shared only with the verified chauffeur at pickup.
- Payment: Pay the driver directly via Cash or UPI at trip end, or pay online.
- Cancellation: Free cancellation up to 6 hours before scheduled pickup time.
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
- Boarding Safety: Verified chauffeurs with secure boarding OTP.
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

function getSystemPrompt(brand: string, context?: { pickup?: string; drop?: string; service?: string }): string {
  const b = (brand || '').toLowerCase();
  let base = NESAM_SYSTEM_PROMPT;
  if (b.includes('people')) base = PEOPLE_TAXI_SYSTEM_PROMPT;
  else if (b.includes('oneway') || b.includes('one_way')) base = ONEWAY_SYSTEM_PROMPT;

  if (context?.pickup || context?.drop || context?.service) {
    base += `\n\nCurrent User Session Context:\n- Selected Service: ${context.service || 'Not chosen yet'}\n- Pickup: ${context.pickup || 'Not selected'}\n- Drop: ${context.drop || 'Not selected'}`;
  }
  return base;
}

// ── Fallback generator when API key is missing or service is offline ────────

function generateFallbackResponse(brand: string, userQuery: string): string {
  const q = userQuery.toLowerCase();
  const b = brand.toLowerCase();
  const brandName = b.includes('people') ? 'People Taxi' : b.includes('oneway') ? 'One Way Car Rentals' : 'NESAM Cabs';

  if (q.includes('fare') || q.includes('price') || q.includes('cost') || q.includes('rate') || q.includes('charge')) {
    return `At **${brandName}**, our fares are 100% transparent with **zero surge pricing**!

• **One-Way Drop Taxi**: You only pay for the distance travelled — no return fare charges.
• **Round Trips**: Economical per-km rates with flexible sightseeing options.
• **Airport Transfers**: Fixed, predictable rates with punctual pickup guaranteed.
• **Local Hourly Rentals**: Packages starting from 4 hours / 40 km up to full day rentals.

To get the exact instant fare for your route, simply enter your pickup and drop locations in the booking form on this page, or call our 24/7 team directly at **${SUPPORT_PHONE}**!`;
  }

  if (q.includes('cancel') || q.includes('refund')) {
    return `**Cancellation & Refund Policy at ${brandName}**:

• **Free Cancellation**: You can cancel your scheduled booking free of charge up to **6 hours before pickup**.
• **Simple Process**: Cancel directly from the "My Trips" section using your booking ID or contact our 24/7 helpline.
• **Refunds**: Any advance or online payments are refunded back to your original payment method promptly.

For immediate cancellation assistance, our team is available 24/7 at **${SUPPORT_PHONE}**.`;
  }

  if (q.includes('car') || q.includes('vehicle') || q.includes('fleet') || q.includes('sedan') || q.includes('suv') || q.includes('innova')) {
    return `**Available Vehicle Categories**:

1. **Sedan** (Maruti Dzire, Toyota Etios) — 4 Passengers, 2 Medium Bags. Perfect for couples, solo travelers, and small families.
2. **SUV** (Maruti Ertiga, Renault Triber) — 6-7 Passengers, 3-4 Bags. Extra boot space and comfortable group seating.
3. **Prime SUV** (Toyota Innova, Innova Crysta) — 7 Passengers, Premium Legroom & AC. Ideal for long outstation journeys and VIP comfort.
4. **Tempo Traveller** (12 / 14 / 17 Seater) — Large family reunions, weddings, and pilgrimage tours.

All vehicles are clean, air-conditioned, and chauffeured by verified drivers.`;
  }

  if (q.includes('contact') || q.includes('phone') || q.includes('number') || q.includes('help') || q.includes('support')) {
    return `We are here to assist you 24 hours a day, 7 days a week!

• **24/7 Helpline**: [${SUPPORT_PHONE}](tel:${SUPPORT_PHONE_TEL})
• **WhatsApp**: [Chat with us](https://wa.me/919025099990)
• **Payment**: Cash or UPI directly to your driver at trip end.

How else can I help plan your journey today?`;
  }

  return `Hello! Welcome to **${brandName}**. I am your 24/7 AI travel guide.

I can help you with:
• **Finding the best cab & fares** for outstation drops, round trips, or airport transfers.
• **Explaining our zero-surge pricing guarantee** and payment terms (Cash / UPI).
• **Information on our vehicle fleet** (Sedans, SUVs, Innova Crysta, Tempo Travellers).
• **Booking, cancellation, and baggage policies**.

You can also call our 24/7 booking desk directly at **${SUPPORT_PHONE}**. What trip are you planning?`;
}

// ── Main Callable ──────────────────────────────────────────────────────────

export const chatWithBot = onCall(
  {
    timeoutSeconds: 45,
    cors: PUBLIC_CALLABLE_ORIGINS,
    allowInvalidAppCheckToken: true, // public endpoint — no App Check required for chat
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
    .map((m) => ({
      role: m.role,
      content: text(m.content, 2000),
    }));

  const lastUserMessage = [...validMessages].reverse().find((m) => m.role === 'user')?.content || '';

  const apiKey = (process.env.GROQ_API_KEY ?? '').trim();
  const model = (process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile').trim();

  // If Groq API key is not configured, reply with smart fallback knowledge
  if (!apiKey) {
    return {
      message: generateFallbackResponse(brand, lastUserMessage),
      provider: 'fallback',
    };
  }

  const systemPrompt = getSystemPrompt(brand, input.context);

  try {
    const groqPayload = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...validMessages,
      ],
      temperature: 0.5,
      max_tokens: 800,
      top_p: 0.95,
      stream: false,
    };

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(groqPayload),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn('[groqChat] Groq API returned status:', response.status, errText);
      return {
        message: generateFallbackResponse(brand, lastUserMessage),
        provider: 'fallback_error',
      };
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const aiText = json?.choices?.[0]?.message?.content?.trim();
    if (!aiText) {
      return {
        message: generateFallbackResponse(brand, lastUserMessage),
        provider: 'fallback_empty',
      };
    }

    return {
      message: aiText,
      provider: 'groq',
      model,
    };
  } catch (err) {
    console.warn('[groqChat] Exception calling Groq API:', err);
    return {
      message: generateFallbackResponse(brand, lastUserMessage),
      provider: 'fallback_exception',
    };
  }
});

