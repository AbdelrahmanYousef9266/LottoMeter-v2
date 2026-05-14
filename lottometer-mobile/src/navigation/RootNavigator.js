import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import LoadingScreen from '../screens/LoadingScreen';
import SubscriptionExpiredScreen from '../screens/SubscriptionExpiredScreen';
import MainTabs from './MainTabs';
import CameraScannerScreen from '../screens/CameraScannerScreen';
import SlotDetailScreen from '../screens/SlotDetailScreen';
import ReportDetailScreen from '../screens/ReportDetailScreen';
import UsersScreen from '../screens/UsersScreen';
import BulkAssignScreen from '../screens/BulkAssignScreen';
import BooksListScreen from '../screens/BooksListScreen';
import SupportScreen from '../screens/SupportScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { user, loading } = useAuth();
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
            <Stack.Screen name="Support" component={SupportScreen} />
            <Stack.Screen
              name="CameraScanner"
              component={CameraScannerScreen}
              options={{ presentation: 'fullScreenModal' }}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="Loading" component={LoadingScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="SubscriptionExpired" component={SubscriptionExpiredScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}