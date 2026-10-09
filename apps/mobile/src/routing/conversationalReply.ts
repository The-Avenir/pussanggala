import type { Pack } from '@pusang-gala/core';

/** App identity and capabilities are known locally; they never require route inference. */
export function conversationalReply(query: string, pack?: Pack): string | null {
  const text = query.toLowerCase().replace(/[?!.,’']/g, '').replace(/\s+/g, ' ').trim();
  if (/^(hi|hello|hey|hiya|kumusta|kamusta|good (morning|afternoon|evening))( gaile| there| po)?$/.test(text)) {
    return 'Hi! I’m Gaile, your NCR commute companion. Saan ka manggagaling at saan ka pupunta? Try “Paano pumunta Recto to Cubao?”';
  }
  if (/\b(who are you|who r u|what are you|what is your name|whats your name|sino ka|sino si gaile|anong pangalan mo|introduce yourself|tell me about yourself)\b/.test(text)) {
    return 'I’m Gaile, the assistant in Pusang Gala. I help you work out NCR commutes using the route reports stored on your phone. I can help with directions, fares, transfers and reported hours. Saan tayo pupunta?';
  }
  if (/\b(what do you know|what can you do|how can you help|what can i ask|ano ang alam mo|anong alam mo|ano kaya mong gawin|paano ka gamitin)\b/.test(text) || /^(help|help me|tulong)$/.test(text)) {
    return 'I can look up a commute, explain where to board or get off, check reported fares and hours, and search the return trip. ' +
      (pack ? `The installed NCR pack has ${pack.routes.size} route records and ${pack.places.size} places. ` : 'The route pack is still being checked. ') +
      'Ask in English or Taglish—for example, “From Recto to Cubao.” Fares or hours without a report stay unknown. I don’t have live traffic or service updates.';
  }
  if (/\b(available routes|what routes|which routes|list routes|show routes|anong mga ruta|anong routes|mga available na ruta)\b/.test(text)) {
    if (!pack) return 'The route pack is still being checked. Open Offline resources to see its status.';
    const directions = [...new Set([...pack.routes.values()].map(route => route.direction_label)
      .filter(label => label.includes(' to ')))].sort();
    return `I have ${pack.routes.size} NCR route records. Here are some recorded directions:\n\n` +
      directions.slice(0, 12).map(label => '• ' + label.replace(' to ', ' → ')).join('\n') +
      '\n\nTell me your starting point and destination and I’ll check the connections. These are dated reports; current service status is unknown.';
  }
  if (/^(thanks|thanks gaile|thank you|thank you gaile|salamat|salamat po|ty|thank you so much)$/.test(text)) {
    return 'Walang anuman! You can ask about the fare, boarding point, transfers or the return trip. Your current journey is still here.';
  }
  if (/^(how are you|kumusta ka|kamusta ka)$/.test(text)) {
    return 'Ready to help you plan a commute! Saan ka manggagaling at saan ka pupunta?';
  }
  if (/\b(are you offline|do you work offline|need internet|kailangan ba ng internet|do you have internet)\b/.test(text)) {
    return 'Route searches use the pack stored on your phone. After the local model is installed, explanations also run on your phone. Internet is only needed if you choose to download the model; importing a local GGUF works without it.';
  }
  return null;
}
