import { useState } from 'react';
import { Text, View } from 'react-native';
import type { Card, HourStatement } from '@pusang-gala/core';
import { Button, type, palette } from '../ui/travel';
import { cardFacts } from '../routing/facts';

export function RouteEvidence({ cards, hours, packId }: {
  cards: readonly Card[]; hours: readonly HourStatement[]; packId: string;
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);
  return <View style={{ gap: 16 }}>
    <Button variant="text" label={expanded ? 'Hide route reports & sources' : 'Route reports & sources'} onPress={() => setExpanded(value => !value)}/>
    {expanded ? <View style={{ gap: 16 }}>
    <Text style={type.caption}>OFFLINE ROUTE REPORTS · {packId}</Text>
    {hours.map(hour => <Text key={hour.routeId} style={type.body}>{hour.text}</Text>)}
    {cards.map((card, index) => <View key={card.cardId} style={{ gap: 8, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: palette.line }}>
      <Text style={type.heading}>Step {index + 1}</Text>
      {cardFacts(card).map((fact, factIndex) => <Text key={factIndex} style={factIndex === 0 ? type.label : type.secondary}>{fact}</Text>)}
      <Text style={type.caption}>Sources: {card.sources.map(source => source.sourceId + ' · ' + (source.postedAt?.slice(0, 10) ?? 'date unknown') + (source.stale ? ' · stale' : '')).join('; ') || 'date unknown'}</Text>
    </View>)}
    </View> : null}
  </View>;
}
