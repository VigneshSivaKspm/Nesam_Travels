// Route guide pages (/routes/:slug). Editorial copy only: like the booking home, nothing here is a
// price. The fare for every vehicle comes from the booking server once the rider picks a date.
// Kept free of runtime imports so the build-time SEO prerender (scripts/seo-prerender.ts) can read it.
import { CORRIDORS, IMG, MORE_CORRIDORS, type Corridor } from '../book/content';

export interface RouteFaq {
  q: string;
  a: string;
}

export interface RouteStop {
  name: string;
  description: string;
}

interface RouteCopy {
  /** Matches the Corridor id on the booking home. */
  corridorId: string;
  slug: string;
  title: string;
  h1: string;
  highway: string;
  metaDescription: string;
  keywords: string;
  summary: string;
  overview: string[];
  keyStops: RouteStop[];
  faqs: RouteFaq[];
}

export type RouteGuide = RouteCopy & Corridor & { imageUrl?: string };

const COPY: RouteCopy[] = [
  {
    corridorId: 'chennai-pondicherry',
    slug: 'chennai-to-pondicherry',
    title: 'Chennai to Pondicherry One Way Taxi | Drop Cab via ECR',
    h1: 'Chennai to Pondicherry One Way Taxi',
    highway: 'East Coast Road (ECR) or GST Road via Tindivanam',
    metaDescription:
      'Chennai to Pondicherry one way taxi with a verified chauffeur. Pay for the drop only, see the fare for every car before you book, pay the driver by cash or UPI.',
    keywords:
      'chennai to pondicherry one way taxi, chennai to pondicherry drop taxi, chennai to pondicherry cab, ecr taxi pondicherry, one way cab chennai to puducherry',
    summary:
      'A coastal drive of about 150 km down the East Coast Road. Book a one-way drop, pay only for the trip you take, and see every vehicle’s fare before you commit.',
    overview: [
      'Most travellers take the East Coast Road out of Chennai, which keeps the Bay of Bengal in view for much of the way and passes Mahabalipuram before reaching White Town in Pondicherry. The inland GST Road through Tindivanam is a little longer but useful when the coast road is busy.',
      'Because this is a one-way drop, you are not billed for the car’s return to Chennai. Enter your exact pickup — home, hotel, railway station or Chennai airport — and the fare screen shows each vehicle with what is and isn’t included. Pondicherry is a Union Territory, so any entry permit and the tolls on the way are added at actual cost against receipts.',
    ],
    keyStops: [
      { name: 'Mahabalipuram', description: 'Shore Temple and Pancha Rathas, a short detour off the ECR and a common breakfast stop.' },
      { name: 'Muttukadu backwaters', description: 'Boating on the backwaters just south of the city limits.' },
      { name: 'Alamparai Fort', description: 'Ruins of an 18th-century sea fort where the backwater meets the coast.' },
      { name: 'Auroville', description: 'The experimental township and Matrimandir, just before Pondicherry town.' },
    ],
    faqs: [
      {
        q: 'How long does a Chennai to Pondicherry taxi take?',
        a: 'About 3 hours for the roughly 150 km drive via the East Coast Road, depending on where in Chennai you are picked up and on traffic leaving the city.',
      },
      {
        q: 'Do I pay a return fare on a one-way drop to Pondicherry?',
        a: 'No. A one-way booking is priced for the drop you take. The fare for each vehicle is shown before you book, and tolls or permits are added at actuals against receipts.',
      },
      {
        q: 'Can I stop at Mahabalipuram on the way?',
        a: 'Yes. Short stops for food, photos or a quick visit are fine; tell the driver when you board. If you plan a long sightseeing halt, mention it when booking so the trip is planned for it.',
      },
    ],
  },
  {
    corridorId: 'chennai-bangalore',
    slug: 'chennai-to-bangalore',
    title: 'Chennai to Bangalore One Way Taxi | Drop Cab on NH-48',
    h1: 'Chennai to Bangalore One Way Taxi',
    highway: 'NH-48 via Sriperumbudur, Vellore, Krishnagiri and Hosur',
    metaDescription:
      'Chennai to Bangalore one way cab with highway-experienced chauffeurs. Upfront fares for every vehicle, no return fare on drops, pay your driver by cash or UPI.',
    keywords:
      'chennai to bangalore one way taxi, chennai to bangalore drop taxi, chennai to bangalore cab, one way cab chennai to bengaluru, chennai to bangalore car rental with driver',
    summary:
      'Around 345 km on the NH-48 corridor between Tamil Nadu’s capital and Bengaluru. A single drop, priced for the one way you travel, with a chauffeur who drives this highway regularly.',
    overview: [
      'The Chennai–Bangalore run is mostly divided highway through Sriperumbudur, Ranipet, Vellore, Krishnagiri and Hosur, with plenty of food courts along the way. Early-morning departures avoid the heaviest city traffic at both ends.',
      'Pick up anywhere in Chennai — including the airport or Chennai Central — and drop at any address in Bengaluru, from Electronic City to Whitefield or Kempegowda Airport. As the trip crosses into Karnataka, the interstate permit and tolls are billed at actual cost and shown on your receipt.',
    ],
    keyStops: [
      { name: 'Sripuram Golden Temple, Vellore', description: 'The gold-covered temple complex a few kilometres off the highway.' },
      { name: 'Ambur', description: 'The town known across the south for its biryani — a popular lunch halt.' },
      { name: 'Krishnagiri', description: 'Hills and the reservoir mark the climb onto the Deccan plateau.' },
      { name: 'Hosur', description: 'The last Tamil Nadu town before the Karnataka border and Bengaluru’s outskirts.' },
    ],
    faqs: [
      {
        q: 'How many hours is Chennai to Bangalore by taxi?',
        a: 'Usually about 6 hours for the roughly 345 km drive, plus time for meal stops. Leaving early in the morning helps you avoid city traffic.',
      },
      {
        q: 'Is the Karnataka permit included in the fare?',
        a: 'Interstate permits and tolls are paid during the trip and added to your final receipt at actual cost against the receipts — never with a markup.',
      },
      {
        q: 'Which vehicle is best for a family going to Bangalore?',
        a: 'A sedan suits up to four people with regular luggage. For larger families or more bags, an SUV or premium SUV gives more room; you can compare all of them with their fares before booking.',
      },
    ],
  },
  {
    corridorId: 'coimbatore-ooty',
    slug: 'coimbatore-to-ooty',
    title: 'Coimbatore to Ooty One Way Taxi | Nilgiris Ghat Road Cab',
    h1: 'Coimbatore to Ooty One Way Taxi',
    highway: 'Mettupalayam and the Nilgiri ghat road via Coonoor',
    metaDescription:
      'Coimbatore to Ooty one way taxi with drivers experienced on the Nilgiri hairpin bends. Pickup from Coimbatore airport or city, upfront fares, cash or UPI payment.',
    keywords:
      'coimbatore to ooty one way taxi, coimbatore to ooty cab, coimbatore airport to ooty taxi, coimbatore to ooty drop taxi, ooty cab booking',
    summary:
      'About 88 km from the plains to the Queen of Hills, climbing the Nilgiri ghat through Coonoor. Book a one-way drop with a chauffeur used to hill driving.',
    overview: [
      'From Coimbatore the road runs flat to Mettupalayam, then climbs steadily through tea estates and hairpin bends to Coonoor and on to Ooty. The climb is slow, so plan for close to three hours even though the distance is short.',
      'Many riders book this trip straight from Coimbatore airport after a flight. Set your pickup at the airport or any address in the city, choose your drop in Ooty — a hotel, cottage or the lake — and compare every vehicle’s fare before you confirm.',
    ],
    keyStops: [
      { name: 'Mettupalayam', description: 'Foothill town at the start of the ghat road and of the Nilgiri Mountain Railway.' },
      { name: 'Coonoor', description: 'Sim’s Park and tea gardens, about two-thirds of the way up.' },
      { name: 'Dolphin’s Nose', description: 'A cliff viewpoint near Coonoor over the Catherine Falls valley.' },
      { name: 'Ooty', description: 'Botanical Garden, the lake and the town centre at the top of the climb.' },
    ],
    faqs: [
      {
        q: 'How long is the drive from Coimbatore to Ooty?',
        a: 'Roughly 2 hours 50 minutes for about 88 km. The ghat section after Mettupalayam is slow-going, especially on weekends and holidays.',
      },
      {
        q: 'Can I be picked up at Coimbatore airport?',
        a: 'Yes. Choose Coimbatore airport as your pickup when booking; your driver’s name, phone and vehicle number appear on your ride page once assigned.',
      },
      {
        q: 'Are the drivers used to hill roads?',
        a: 'Trips on ghat roads are assigned to verified commercial chauffeurs comfortable with hairpin bends and hill traffic.',
      },
    ],
  },
  {
    corridorId: 'madurai-rameshwaram',
    slug: 'madurai-to-rameshwaram',
    title: 'Madurai to Rameshwaram One Way Taxi | Temple Drop Cab',
    h1: 'Madurai to Rameshwaram One Way Taxi',
    highway: 'NH-87 via Paramakudi, Ramanathapuram and the Pamban bridge',
    metaDescription:
      'Madurai to Rameshwaram one way taxi for temple visits and Dhanushkodi. Verified chauffeurs, fares shown before booking, pay your driver by cash or UPI.',
    keywords:
      'madurai to rameshwaram one way taxi, madurai to rameshwaram cab, madurai to rameshwaram drop taxi, rameshwaram temple taxi, madurai airport to rameshwaram cab',
    summary:
      'A 172 km pilgrimage drive from the temple city to Rameswaram island, crossing the Pamban bridge over the sea. One-way drops from Madurai city, railway station or airport.',
    overview: [
      'The road east from Madurai passes Manamadurai, Paramakudi and Ramanathapuram before the Pamban road bridge carries you across to Rameswaram island. Most pilgrims time the trip to reach the Ramanathaswamy Temple for morning or evening darshan.',
      'If you are continuing to Dhanushkodi or returning the same day, a round trip may suit you better than a one-way drop; both are available from the same booking page, with fares shown for every vehicle before you confirm.',
    ],
    keyStops: [
      { name: 'Pamban bridge', description: 'The road bridge to Rameswaram island, with views of the old rail bridge.' },
      { name: 'Ramanathaswamy Temple', description: 'One of the twelve Jyotirlingas, known for its long pillared corridors.' },
      { name: 'Dr. APJ Abdul Kalam Memorial', description: 'Memorial to the former President at Peikarumbu, near the town.' },
      { name: 'Dhanushkodi', description: 'The ghost town and land’s end at the tip of the island.' },
    ],
    faqs: [
      {
        q: 'How far is Rameshwaram from Madurai by road?',
        a: 'About 172 km, usually around 3 hours 30 minutes by car via NH-87 and the Pamban bridge.',
      },
      {
        q: 'Should I book one way or round trip for Rameshwaram?',
        a: 'Book one way if you are staying on in Rameswaram or travelling on by train. If you want to return to Madurai the same day or the next, a round trip keeps the same car and driver with you.',
      },
      {
        q: 'Can I start from Madurai airport?',
        a: 'Yes. Pick Madurai airport as the pickup point when you book.',
      },
    ],
  },
  {
    corridorId: 'trichy-thanjavur',
    slug: 'trichy-to-thanjavur',
    title: 'Trichy to Thanjavur One Way Taxi | Big Temple Drop Cab',
    h1: 'Trichy to Thanjavur One Way Taxi',
    highway: 'Trichy–Thanjavur highway via Thuvakudi and Vallam',
    metaDescription:
      'Trichy to Thanjavur one way taxi to the Big Temple and Chola heritage sites. Short 58 km drop, upfront fares for every car, pay by cash or UPI at the end.',
    keywords:
      'trichy to thanjavur one way taxi, trichy to thanjavur cab, thanjavur big temple taxi, trichy to tanjore drop taxi, trichy airport to thanjavur cab',
    summary:
      'A quick 58 km hop from Tiruchirappalli to Thanjavur and the Brihadeeswarar Temple. Ideal from Trichy airport or junction, with no return fare on a one-way drop.',
    overview: [
      'The drive east from Trichy takes a little over an hour on a good highway through Thuvakudi and Vallam. It is one of the easiest ways to reach Thanjavur from Trichy airport or Tiruchirappalli Junction.',
      'Riders often pair it with the Navagraha and Kumbakonam temple circuit. For a single drop, book one way; to keep the car for the day, choose a round trip or local rental instead.',
    ],
    keyStops: [
      { name: 'Brihadeeswarar Temple', description: 'The thousand-year-old Chola “Big Temple”, a UNESCO World Heritage Site.' },
      { name: 'Thanjavur Maratha Palace', description: 'The palace complex with the Saraswathi Mahal library and bronze gallery.' },
      { name: 'Schwartz Church', description: 'An 18th-century church in the palace gardens.' },
    ],
    faqs: [
      {
        q: 'How long does Trichy to Thanjavur take by cab?',
        a: 'About 1 hour 10 minutes for roughly 58 km, depending on your pickup point in Trichy.',
      },
      {
        q: 'Can the cab wait while I visit the Big Temple?',
        a: 'A one-way booking ends at your drop. If you want the car to wait and bring you back, book a round trip or a local hourly rental.',
      },
    ],
  },
  {
    corridorId: 'bangalore-mysore',
    slug: 'bangalore-to-mysore',
    title: 'Bangalore to Mysore One Way Taxi | Expressway Drop Cab',
    h1: 'Bangalore to Mysore One Way Taxi',
    highway: 'Bengaluru–Mysuru Expressway (NH-275)',
    metaDescription:
      'Bangalore to Mysore one way taxi on the Bengaluru–Mysuru expressway. Verified chauffeurs, every vehicle’s fare shown upfront, cash or UPI payment.',
    keywords:
      'bangalore to mysore one way taxi, bangalore to mysore cab, bengaluru to mysuru drop taxi, bangalore to mysore car with driver, mysore palace taxi',
    summary:
      'About 142 km on the Bengaluru–Mysuru expressway to the palace city. Book a one-way drop from anywhere in Bengaluru, including Kempegowda airport.',
    overview: [
      'The access-controlled expressway has cut the Bangalore–Mysore drive to roughly two and a half hours, bypassing the towns that used to slow the old road. Expressway tolls are added to your receipt at actual cost.',
      'Drop at Mysore Palace, your hotel or Chamundi Hill. If you plan to visit Srirangapatna or return the same day, compare a round trip on the same booking page.',
    ],
    keyStops: [
      { name: 'Ramanagara', description: 'Granite hills just off the expressway, known for rock climbing.' },
      { name: 'Channapatna', description: 'The toy town famous for lacquered wooden toys.' },
      { name: 'Srirangapatna', description: 'Tipu Sultan’s island fort and the Ranganathaswamy Temple.' },
      { name: 'Mysore Palace', description: 'The Wadiyar palace, lit up on Sunday evenings and during Dasara.' },
    ],
    faqs: [
      {
        q: 'How long is Bangalore to Mysore by taxi?',
        a: 'Around 2 hours 30 minutes for about 142 km via the expressway, plus city traffic at the Bengaluru end.',
      },
      {
        q: 'Are expressway tolls included?',
        a: 'Tolls are paid during the trip and added to your receipt at actual cost against receipts.',
      },
    ],
  },
  {
    corridorId: 'salem-yercaud',
    slug: 'salem-to-yercaud',
    title: 'Salem to Yercaud One Way Taxi | Hill Station Drop Cab',
    h1: 'Salem to Yercaud One Way Taxi',
    highway: 'Yercaud ghat road with 20 hairpin bends',
    metaDescription:
      'Salem to Yercaud one way taxi up the 20 hairpin bends of the Shevaroy hills. Experienced hill drivers, fares shown before you book, pay by cash or UPI.',
    keywords:
      'salem to yercaud one way taxi, salem to yercaud cab, yercaud taxi booking, salem junction to yercaud cab, yercaud hill station taxi',
    summary:
      'A short but steep 32 km climb from Salem into the Shevaroy hills. One-way drops from Salem Junction, the bus stand or any address in town.',
    overview: [
      'Yercaud is the closest hill station to Salem: the ghat road climbs through 20 hairpin bends and coffee estates and reaches the lake in about an hour.',
      'Book a one-way drop to your resort or homestay. For a day trip that returns to Salem, a round trip keeps the car and driver with you between viewpoints.',
    ],
    keyStops: [
      { name: 'Yercaud Lake', description: 'Boating on the lake at the centre of town.' },
      { name: 'Pagoda Point', description: 'A ridge viewpoint over the plains and Salem town.' },
      { name: 'Lady’s Seat', description: 'The best-known lookout over the ghat road and the valley below.' },
    ],
    faqs: [
      {
        q: 'How long does it take to reach Yercaud from Salem?',
        a: 'About an hour for the 32 km drive up the ghat road, longer on weekends and holidays.',
      },
      {
        q: 'Can I book a taxi from Salem Junction railway station?',
        a: 'Yes. Set Salem Junction as your pickup and your hotel in Yercaud as the drop.',
      },
    ],
  },
  {
    corridorId: 'chennai-tirupati',
    slug: 'chennai-to-tirupati',
    title: 'Chennai to Tirupati One Way Taxi | Darshan Drop Cab',
    h1: 'Chennai to Tirupati One Way Taxi',
    highway: 'Via Tiruvallur and Tiruttani',
    metaDescription:
      'Chennai to Tirupati one way taxi for Tirumala darshan. Verified chauffeurs, upfront fares for every vehicle, interstate permit and tolls at actuals, cash or UPI.',
    keywords:
      'chennai to tirupati one way taxi, chennai to tirupati cab, chennai to tirupati drop taxi, chennai to tirumala taxi, tirupati darshan cab from chennai',
    summary:
      'About 138 km from Chennai to Tirupati, passing the Tiruttani Murugan temple. A one-way drop for pilgrims heading to Tirumala, priced before you book.',
    overview: [
      'The road from Chennai runs through Tiruvallur and Tiruttani into Andhra Pradesh and reaches Tirupati in roughly three hours. Many families leave before dawn to meet a booked darshan slot.',
      'As the trip crosses a state border, the interstate permit and tolls are added to your receipt at actual cost. If you need the car to go up to Tirumala and bring you back, a round trip is usually the better choice.',
    ],
    keyStops: [
      { name: 'Tiruttani', description: 'The hilltop Murugan temple, one of the six Arupadai Veedu shrines.' },
      { name: 'Alipiri', description: 'The foot of the Tirumala hills, where the footpath and ghat road begin.' },
      { name: 'Tirumala', description: 'The Sri Venkateswara Temple in the Seshachalam hills.' },
    ],
    faqs: [
      {
        q: 'How long does Chennai to Tirupati take by car?',
        a: 'About 3 hours for roughly 138 km, depending on your pickup point in Chennai and traffic at the border check post.',
      },
      {
        q: 'Is the Andhra Pradesh permit charged extra?',
        a: 'Interstate permits and tolls are added to your final receipt at actual cost against receipts.',
      },
      {
        q: 'Can I book a return trip from Tirupati to Chennai?',
        a: 'Yes. Book a round trip to keep the same car for the return, or book a separate one-way trip back.',
      },
    ],
  },
];

const ALL_CORRIDORS = [...CORRIDORS, ...MORE_CORRIDORS];

export const ALL_ROUTES: RouteGuide[] = COPY.map((copy) => {
  const corridor = ALL_CORRIDORS.find((c) => c.id === copy.corridorId);
  if (!corridor) throw new Error(`Route guide ${copy.slug} has no corridor ${copy.corridorId}`);
  return { ...corridor, ...copy, imageUrl: corridor.image ? IMG(corridor.image) : undefined };
});

/** Accepts the canonical slug ("chennai-to-pondicherry") or the home's corridor id ("chennai-pondicherry"). */
export function findRouteBySlug(slug: string): RouteGuide | undefined {
  const norm = slug.toLowerCase().replace(/_|\s+/g, '-');
  return ALL_ROUTES.find((r) => r.slug === norm || r.corridorId === norm);
}

/** The route guide for a corridor on the booking home, if one exists. */
export const routeSlugFor = (corridorId: string): string | undefined =>
  ALL_ROUTES.find((r) => r.corridorId === corridorId)?.slug;
