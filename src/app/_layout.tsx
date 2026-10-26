import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="day-time-calculator"
        options={{
          headerShown: true,
          title: 'Day & Time Calculator',
          headerStyle: { backgroundColor: '#1e1e1e' },
          headerTintColor: '#fff',
        }}
      />
    </Stack>
    
  );
}