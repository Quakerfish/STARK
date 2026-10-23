import { Ionicons } from '@expo/vector-icons';
import { Href } from 'expo-router';

export type AppItem = {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: Href;
};

export const APPS: AppItem[] = [
  {
    id: 'day-time-calculator',
    title: 'DTR Calculator',
    description: 'Log time in and out, get total hours',
    icon: 'calendar-outline',
    route: '/day-time-calculator',
  },
];