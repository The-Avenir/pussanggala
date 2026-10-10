import type { Pack, TripState } from '@pusang-gala/core';
import { isTaglish } from './routePresentation';

/** App identity and capabilities are known locally; they never require route inference. */
export function conversationalReply(query: string, pack?: Pack, trip?: TripState): string | null {
  const text = query.toLowerCase().replace(/[?!.,’']/g, '').replace(/\s+/g, ' ').trim();
  const taglish = isTaglish(query) || /kumusta|kamusta/.test(text);
  const nextQuestion = trip?.originPlaceId && trip.destinationPlaceId ? taglish ? 'Ano ang gusto mong malaman tungkol sa biyahe natin?' : 'What would you like to know about our journey?'
    : trip?.destinationPlaceId ? taglish ? 'Saan ka manggagaling?' : 'Where are you coming from?'
    : taglish ? 'Saan tayo pupunta?' : 'Where are we heading today?';
  if (/^(hi|hello|hey|hiya|kumusta|kamusta|good (morning|afternoon|evening))( gaile| there| po)?$/.test(text)) {
    return `Hi, traveler! ${nextQuestion}` + (!trip?.originPlaceId && !trip?.destinationPlaceId
      ? taglish ? ' Sabihin mo ang lugar, tutulungan kitang makarating doon.' : ' Tell me the place, and I’ll help you figure out how to get there.' : '');
  }
  if (/\b(who are you|who r u|what are you|what is your name|whats your name|sino ka|sino si gaile|anong pangalan mo|introduce yourself|tell me about yourself)\b/.test(text)) {
    return 'I’m Gaile, your commute companion in Pusang Gala. Tell me where you want to go in Metro Manila, and I’ll help you find your way. ' + nextQuestion;
  }
  if (/\b(what do you know|what can you do|how can you help|what can i ask|ano ang alam mo|anong alam mo|ano kaya mong gawin|paano ka gamitin)\b/.test(text) || /^(help|help me|tulong)$/.test(text)) {
    return 'I can help you choose a route, find where to board and get off, and check fares and travel times when they’re available. We can take the directions one step at a time. ' + nextQuestion;
  }
  if (/\b(available routes|what routes|which routes|list routes|show routes|anong mga ruta|anong routes|mga available na ruta)\b/.test(text)) {
    if (!pack) return 'The route pack is still being checked. Open Offline resources to see its status.';
    const directions = [...new Set([...pack.routes.values()].map(route => route.direction_label)
      .filter(label => label.includes(' to ')))].sort();
    return 'Here are a few journeys I can check for you:\n\n' +
      directions.slice(0, 12).map(label => '• ' + label.replace(' to ', ' → ')).join('\n') +
      '\n\nWhich destination do you have in mind?';
  }
  if (/^(thanks|thanks gaile|thank you|thank you gaile|salamat|salamat po|ty|thank you so much)$/.test(text)) {
    return taglish ? 'Walang anuman! Ingat sa biyahe.' : 'You’re welcome! Hope the journey goes smoothly.';
  }
  if (/^(how are you|kumusta ka|kamusta ka)$/.test(text)) {
    return 'Ready for our next adventure! ' + nextQuestion;
  }
  if (/\b(are you offline|do you work offline|need internet|kailangan ba ng internet|do you have internet)\b/.test(text)) {
    return 'Route searches use the pack stored on your phone. After the local model is installed, explanations also run on your phone. Internet is only needed if you choose to download the model; importing a local GGUF works without it.';
  }
  return null;
}
