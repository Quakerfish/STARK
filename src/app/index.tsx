import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppCard from '../components/cards/appcard';
import Taskbar from '../components/taskbar/taskbar';
import { APPS } from '../data/apps';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  console.log('APPS length:', APPS.length); // before the return, not inside the JSX

  return (
    <View style={styles.container}>
      <FlatList
        data={APPS}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <AppCard item={item} />}
        ListHeaderComponent={<Text style={styles.title}>STARK</Text>}
        ListEmptyComponent={<Text style={{ color: 'red' }}>APPS is empty</Text>}
        contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16 }}
      />
      <Taskbar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  title: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginBottom: 20 },
});