import { StyleSheet, View } from 'react-native';

// Vertical sky-blue -> white gradient built from stacked bands, so it needs no native
// package (works in Expo Go, dev builds and web without a rebuild).
const STEPS = 48;
const TOP = [91, 155, 235];
const BOTTOM = [253, 254, 255];

const COLORS = Array.from({ length: STEPS }, (_, i) => {
  const t = i / (STEPS - 1);
  const c = TOP.map((v, j) => Math.round(v + (BOTTOM[j] - v) * t));
  return `rgb(${c.join(',')})`;
});

export default function GradientBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {COLORS.map((color, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: color }} />
      ))}
    </View>
  );
}