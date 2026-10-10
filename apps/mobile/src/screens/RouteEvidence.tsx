import { Text, View } from 'react-native';
import type { Card, HourStatement } from '@pusang-gala/core';
import { type, palette } from '../ui/travel';
import { fareLabel, hoursText, isVisibleStep, stepText, timeLabel } from '../routing/routePresentation';

export function RouteDetails({ cards, hours }: {
  cards: readonly Card[]; hours: readonly HourStatement[];
}): React.JSX.Element {
  return <View style={{ gap: 16 }}>
    {hours.map(hour => <Text key={hour.routeId} style={type.secondary}>{hoursText(hour)}</Text>)}
    {cards.filter(isVisibleStep).map((card, index) => <View key={card.cardId} style={{ gap: 8, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: palette.line }}>
      <Text style={type.heading}>Step {index + 1}</Text>
      <Text style={type.label}>{stepText(card)}</Text>
      <Text style={type.secondary}>{card.kind === 'ride' ? `Fare ${fareLabel(card)} · Travel ${timeLabel(card)}` : `Walk ${timeLabel(card)}`}</Text>
    </View>)}
  </View>;
}
