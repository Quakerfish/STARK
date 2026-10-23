import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function Taskbar() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.taskbarContainer, { paddingBottom: insets.bottom, height: 65 + insets.bottom }]}>
      {/* Home Button */}
      <TouchableOpacity style={styles.navItem} onPress={() => console.log('Home pressed')}>
        <Ionicons name="home-outline" size={24} color="#fff" />
        <Text style={styles.navText}>Home</Text>
      </TouchableOpacity>

      {/* Search/Explore Button */}
      <TouchableOpacity style={styles.navItem} onPress={() => console.log('Search pressed')}>
        <Ionicons name="search-outline" size={24} color="#fff" />
        <Text style={styles.navText}>Search</Text>
      </TouchableOpacity>

      {/* Profile Button */}
      <TouchableOpacity style={styles.navItem} onPress={() => console.log('Profile pressed')}>
        <Ionicons name="person-outline" size={24} color="#fff" />
        <Text style={styles.navText}>Profile</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  taskbarContainer: {
    flexDirection: 'row',
    backgroundColor: '#1e1e1e',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  navText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 2,
  },
});