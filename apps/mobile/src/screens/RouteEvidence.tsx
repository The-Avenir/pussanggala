import { StyleSheet, Text, View } from 'react-native';
import type { Card, HourStatement } from '@pusang-gala/core';
import { Icon, type, palette, ui } from '../ui/travel';
import { fareLabel, hoursText, isVisibleStep, stepText, timeLabel } from '../routing/routePresentation';

export function RouteDetails({ cards, hours }: {
  cards: readonly Card[]; hours: readonly HourStatement[];
}): React.JSX.Element {
  return <View style={{ gap: 16 }}>
    {hours.map(hour => <Text key={hour.routeId} style={type.secondary}>{hoursText(hour)}</Text>)}
    {cards.filter(isVisibleStep).map((card, index) => <View key={card.cardId} style={styles.card}>
      <View style={ui.row}><View style={[styles.mode, card.kind === 'ride' ? styles.ride : styles.walk]}>
        <Icon name={card.kind === 'ride' ? card.mode === 'rail' ? 'train' : 'bus' : 'walk'} color={card.kind === 'ride' ? palette.rail : palette.success} size={20}/></View>
        <Text style={[type.label, ui.flex]}>Step {index + 1} · {card.kind === 'ride' ? 'Ride' : 'Walk / transfer'}</Text></View>
      <Text style={type.label}>{stepText(card)}</Text>
      <Text style={[type.secondary, styles.metrics]}>{card.kind === 'ride' ? `Fare ${fareLabel(card)} · Travel ${timeLabel(card)}` : `Walk ${timeLabel(card)}`}</Text>
    </View>)}
  </View>;
}
const styles = StyleSheet.create({
  card: { marginLeft: 40, gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, borderLeftWidth: 3, borderLeftColor: palette.accent, borderColor: palette.line, backgroundColor: palette.card },
  mode: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  ride: { backgroundColor: palette.railSoft }, walk: { backgroundColor: palette.successSoft },
  metrics: { paddingTop: 10, borderTopWidth: 1, borderColor: palette.line },
});
