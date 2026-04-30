import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import MainTabs from './MainTabs';
import CameraScannerScreen from '../screens/CameraScannerScreen';
import SlotDetailScreen from '../screens/SlotDetailScreen';
import ReportDetailScreen from '../screens/ReportDetailScreen';
import UsersScreen from '../screens/UsersScreen';
import BulkAssignScreen from '../screens/BulkAssignScreen';
import BooksListScreen from '../screens/BooksListScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { user, loading } = useAuth();
  // Native splash is still visible while auth loads — return null to wait
  if (loading) return null;
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="SlotDetail" component={SlotDetailScreen} />
            <Stack.Screen name="ReportDetail" component={ReportDetailScreen} />
            <Stack.Screen name="Users" component={UsersScreen} />
            <Stack.Screen
              name="BulkAssign"
              component={BulkAssignScreen}
              options={{ gestureEnabled: false }}
            />
            <Stack.Screen name="BooksList" component={BooksListScreen} />
            <Stack.Screen
              name="CameraScanner"
              component={CameraScannerScreen}
              options={{ presentation: 'fullScreenModal' }}
            />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}