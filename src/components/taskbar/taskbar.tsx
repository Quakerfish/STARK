import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type TaskbarProps = {
  // When provided, a raised fingerprint button replaces the Search slot in the middle.
  onFingerprintPress?: () => void;
  fingerprintActive?: boolean;
  // 'dark' (default) is the original bar; 'glass' matches the light-blue theme.
  variant?: 'dark' | 'glass';
};

export default function Taskbar({ onFingerprintPress, fingerprintActive = false, variant = 'dark' }: TaskbarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const glass = variant === 'glass';

  return (
    <View
      style={[
        styles.taskbarContainer,
        glass && styles.glassContainer,
        { paddingBottom: insets.bottom, height: 65 + insets.bottom },
      ]}
    >
      {/* Home Button */}
      <TouchableOpacity style={styles.navItem} onPress={() => router.navigate('/')}>
        <Ionicons name="home-outline" size={24} color="#fff" />
        <Text style={styles.navText}>Home</Text>
      </TouchableOpacity>

      {onFingerprintPress ? (
        /* Fingerprint (clock in / clock out) Button */
        <View style={styles.navItem}>
          <TouchableOpacity
            style={[
              styles.fingerprintBtn,
              glass && styles.fingerprintGlass,
              fingerprintActive && styles.fingerprintActive,
            ]}
            onPress={onFingerprintPress}
            activeOpacity={0.8}
          >
            <Ionicons name="finger-print" size={34} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : (
        /* Search/Explore Button */
        <TouchableOpacity style={styles.navItem} onPress={() => console.log('Search pressed')}>
          <Ionicons name="search-outline" size={24} color="#fff" />
          <Text style={styles.navText}>Search</Text>
        </TouchableOpacity>
      )}

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
  glassContainer: {
    backgroundColor: 'rgba(60,105,165,0.92)',
    borderTopColor: 'rgba(255,255,255,0.6)',
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
  fingerprintBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2c2c2c',
    borderWidth: 2,
    borderColor: '#555',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28,
  },
  fingerprintGlass: {
    backgroundColor: '#4c7db5',
    borderColor: '#fff',
  },
  fingerprintActive: {
    backgroundColor: '#1f8f4e',
    borderColor: '#2ecc71',
  },
});