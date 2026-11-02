// One Way Car Rentals AI concierge. The chat itself is shared (see user/web AiChatWidget); this is
// this site's wording and icons.
import { AiChatWidget, type ChatBrand } from '../../../user/web/src/components/AiChatWidget';
import { Icon } from './Icon';

const BRAND: ChatBrand = {
  id: 'onewaycarrentals',
  variant: 'oneway',
  assistantName: 'OneWay AI Concierge',
  welcome: {
    en: `Hello! 👋 Welcome to **One Way Car Rentals**. I'm your AI outstation concierge.\n\nAsk me about:\n• **One-way drop taxis** across South India: pay for one way, not the return\n• **Fares shown upfront** for every car, with no surge pricing\n• **Air-conditioned cars**: Sedan, SUV, Innova Crysta\n• **Airport drops and Multicity itineraries**\n\nWhere are you planning to travel?`,
    ta: `வணக்கம்! 👋 **One Way Car Rentals** க்கு வரவேற்கிறோம். நான் உங்கள் AI அவுட்ஸ்டேஷன் உதவியாளர்.\n\nஇவற்றைப் பற்றிக் கேளுங்கள்:\n• தென்னிந்தியா முழுவதும் **ஒருவழி டிராப் டாக்ஸி**: ஒரு வழிக்கான கட்டணம் மட்டுமே\n• ஒவ்வொரு காருக்கும் **முன்கூட்டியே தெரியும் கட்டணம்**, பீக் நேர கூடுதல் கட்டணம் இல்லை\n• **ஏசி கார்கள்**: Sedan, SUV, Innova Crysta\n• **விமான நிலைய டிராப், Multicity பயணத் திட்டம்**\n\nஎங்கே பயணம் செய்ய விரும்புகிறீர்கள்?`,
  },
  prompts: {
    en: ['Why is a one-way taxi cheaper?', 'What car options do you offer?', 'Are tolls and taxes included?', 'How do I book a Multicity tour?', 'What is the free cancellation policy?'],
    ta: ['ஒருவழி டாக்ஸி ஏன் சிக்கனம்?', 'என்ன கார்கள் உள்ளன?', 'சுங்கக் கட்டணம் சேருமா?', 'Multicity சுற்றுலா புக் செய்வது எப்படி?', 'இலவச ரத்து கொள்கை என்ன?'],
  },
  placeholder: { en: 'Ask about one-way fares, cars, routes…', ta: 'ஒருவழி கட்டணம், கார், வழி பற்றிக் கேளுங்கள்…' },
};

export function AiChatbot() {
  return <AiChatWidget brand={BRAND} Icon={Icon} />;
}

export default AiChatbot;
