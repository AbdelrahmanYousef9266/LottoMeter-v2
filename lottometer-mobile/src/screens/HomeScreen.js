import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { logout } from '../api/auth';
import { useAuth } from '../context/AuthContext';

export default function HomeScreen() {
  const { user, setUser } = useAuth();

  async function handleLogout() {
    await logout();
    setUser(null);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.title}>Welcome</Text>
        <Text style={styles.text}>Logged in as: {user?.username || `user #${user?.user_id}`}</Text>
        <Text style={styles.text}>Role: {user?.role}</Text>
        <Text style={styles.text}>Store ID: {user?.store_id}</Text>

        <TouchableOpacity style={styles.button} onPress={handleLogout}>
          <Text style={styles.buttonText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 24 },
  text: { fontSize: 16, marginBottom: 8 },
  button: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 32,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});