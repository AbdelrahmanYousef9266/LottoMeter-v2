import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import HomeScreen from '../screens/HomeScreen';
import ScanScreen from '../screens/ScanScreen';
import BooksScreen from '../screens/BooksScreen';
import HistoryScreen from '../screens/HistoryScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();

const ICONS = {
  Home: '🏠',
  Scan: '📷',
  Books: '📚',
  History: '🕒',
  Settings: '⚙️',
};

export default function MainTabs() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const tabLabels = {
    Home: t('tabs.home'),
    Scan: t('tabs.scan'),
    Books: t('tabs.books'),
    History: t('tabs.history'),
    Settings: t('tabs.settings'),
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#1a73e8',
        tabBarInactiveTintColor: '#888',
        tabBarLabel: tabLabels[route.name],
        tabBarStyle: {
          paddingTop: 6,
          paddingBottom: insets.bottom + 6,
          height: 60 + insets.bottom,
        },
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: focused ? 22 : 20 }}>{ICONS[route.name]}</Text>
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Scan" component={ScanScreen} />
      <Tab.Screen name="Books" component={BooksScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}