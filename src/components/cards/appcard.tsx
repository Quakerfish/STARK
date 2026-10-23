import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppItem } from '../../data/apps';

export default function AppCard({ item }: { item: AppItem }) {
  const router = useRouter();

  return (
    <TouchableOpacity style={styles.card} onPress={() => router.push(item.route)} activeOpacity={0.8}>
      <View style={styles.iconWrap}>
        <Ionicons name={item.icon} size={28} color="#fff" />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.desc}>{item.description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#888" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#2c2c2c',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  textWrap: { flex: 1 },
  title: { color: '#fff', fontSize: 16, fontWeight: '600' },
  desc: { color: '#aaa', fontSize: 13, marginTop: 2 },
});