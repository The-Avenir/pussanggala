/**
 * T45 ugly wiring — SYNTHETIC dashed schematic (not-to-scale).
 *
 * SYNTHETIC-only fixture view. Never real pack data, never network, never
 * dataset import. Dashed border + explicit not-to-scale label per T45.
 */
import { StyleSheet, Text, View } from 'react-native';

export interface SchematicLeg {
  readonly id: string;
  readonly label: string;
}

export function Schematic({
  legs,
}: {
  readonly legs: readonly SchematicLeg[];
}): React.JSX.Element {
  if (legs.length === 0) {
    return (
      <View style={styles.box}>
        <Text style={styles.title}>SYNTHETIC schematic (not-to-scale, dashed) — SYNTHETIC only</Text>
        <Text style={styles.line}>SYNTHETIC schematic empty — no SYNTHETIC legs yet</Text>
      </View>
    );
  }
  return (
    <View style={styles.box}>
      <Text style={styles.title}>SYNTHETIC schematic (not-to-scale, dashed) — SYNTHETIC only</Text>
      {legs.map((leg, index) => (
        <View key={leg.id}>
          <Text style={styles.line}>
            SYNTHETIC stop {index + 1}: {leg.label} ({leg.id})
          </Text>
          {index < legs.length - 1 ? (
            <Text style={styles.link}>SYNTHETIC dashed link (not-to-scale) | | | SYNTHETIC</Text>
          ) : null}
        </View>
      ))}
      <Text style={styles.note}>SYNTHETIC note: dashed lines not-to-scale, SYNTHETIC order only</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 2,
    borderColor: '#666666',
    borderStyle: 'dashed',
    borderRadius: 4,
    padding: 12,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  line: {
    fontSize: 14,
    marginVertical: 2,
  },
  link: {
    fontSize: 12,
    color: '#666666',
    marginLeft: 8,
  },
  note: {
    fontSize: 12,
    color: '#666666',
    marginTop: 8,
  },
});
