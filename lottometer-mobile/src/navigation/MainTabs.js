import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';

import HomeScreen from '../screens/HomeScreen';
import ScanScreen from '../screens/ScanScreen';
import BooksScreen from '../screens/BooksScreen';
import HistoryScreen from '../screens/HistoryScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Home:     { outline: 'home-outline',     filled: 'home'     },
  Scan:     { outline: 'scan-outline',     filled: 'scan'     },
  Books:    { outline: 'book-outline',     filled: 'book'     },
  History:  { outline: 'time-outline',     filled: 'time'     },
  Settings: { outline: 'settings-outline', filled: 'settings' },
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
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabel: ({ focused, color }) => (
          <Text style={{ fontSize: 12, fontWeight: focused ? '600' : '400', color }}>
            {tabLabels[route.name]}
          </Text>
        ),
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          paddingTop: 6,
          paddingBottom: insets.bottom + 6,
          height: 60 + insets.bottom,
        },
        tabBarIcon: ({ focused, color }) => {
          const { outline, filled } = TAB_ICONS[route.name];
          return (
            <Ionicons
              name={focused ? filled : outline}
              size={focused ? 28 : 24}
              color={color}
            />
          );
        },
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
