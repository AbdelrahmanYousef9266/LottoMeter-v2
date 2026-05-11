import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from './config';

const TOKEN_KEY = 'lottometer_jwt';

export async function saveToken(token) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken() {
  return await SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const originalRequest = error.config;

    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const savedToken = await getToken();
        if (savedToken) {
          api.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
          originalRequest.headers['Authorization'] = `Bearer ${savedToken}`;
          return api(originalRequest);
        }
      } catch (_) {
        // silent
      }
      const { DeviceEventEmitter } = require('react-native');
      DeviceEventEmitter.emit('auth:logout');
    }

    const errorPayload = error.response?.data?.error || {
      code: 'NETWORK_ERROR',
      message: error.message || 'Network request failed.',
    };
    return Promise.reject({
      status,
      ...errorPayload,
    });
  }
);

export default api;