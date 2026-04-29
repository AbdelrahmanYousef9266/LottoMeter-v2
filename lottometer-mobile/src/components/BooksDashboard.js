import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { getBooksSummary } from '../api/books';

export default function BooksDashboard() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError(null);
      getBooksSummary()
        .then((data) => { if (active) setSummary(data); })
        .catch((err) => { if (active) setError(err.message || t('common.networkError')); })
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, [t])
  );

  const chips = [
    {
      key: 'active',
      label: t('booksDashboard.active'),
      count: summary?.active,
      color: '#16a34a',
      bg: '#dcfce7',
    },
    {
      key: 'sold',
      label: t('booksDashboard.sold'),
      count: summary?.sold,
      color: '#1a73e8',
      bg: '#e8f0fe',
    },
    {
      key: 'returned',
      label: t('booksDashboard.returned'),
      count: summary?.returned,
      color: '#d97706',
      bg: '#fef3c7',
    },
  ];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('booksDashboard.title')}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('BooksList', { initialStatus: 'all' })}>
          <Text style={styles.viewAll}>{t('booksDashboard.viewAll')}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.spinner} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <View style={styles.chips}>
          {chips.map((chip) => (
            <TouchableOpacity
              key={chip.key}
              style={[styles.chip, { backgroundColor: chip.bg }]}
              onPress={() => navigation.navigate('BooksList', { initialStatus: chip.key })}
            >
              <Text style={[styles.chipCount, { color: chip.color }]}>
                {chip.count ?? 0}
              </Text>
              <Text style={[styles.chipLabel, { color: chip.color }]}>
                {chip.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 16, fontWeight: '700', color: '#222' },
  viewAll: { fontSize: 13, color: '#1a73e8', fontWeight: '600' },
  spinner: { marginTop: 8 },
  error: { fontSize: 13, color: '#dc2626', marginTop: 4 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  chipCount: { fontSize: 22, fontWeight: '700' },
  chipLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
});
