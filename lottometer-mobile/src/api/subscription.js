import api from './client';

export const getSubscription = () => api.get('/subscription');
