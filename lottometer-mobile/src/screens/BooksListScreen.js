import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import { getBooks } from '../api/books';

const FILTERS = ['all', 'active', 'sold', 'returned'];

export default function BooksListScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const initialStatus = route.params?.initialStatus ?? 'all';

  const [status, setStatus] = useState(initialStatus);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (s) => {
      setLoading(true);
      try {
        const data = await getBooks({ status: s });
        setBooks(data.books || []);
      } catch (err) {
        Alert.alert(t('common.error'), err.message || t('common.networkError'));
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  useFocusEffect(
    useCallback(() => {
      load(status);
    }, [load, status])
  );

  function handleFilterChange(s) {
    setStatus(s);
    load(s);
  }

  function getStatusBadge(book) {
    if (book.returned_at) {
      return { label: t('booksDashboard.returned'), color: '#d97706', bg: '#fef3c7' };
    }
    if (book.is_sold) {
      return { label: t('booksDashboard.sold'), color: '#1a73e8', bg: '#e8f0fe' };
    }
    if (book.is_active) {
      return { label: t('booksDashboard.active'), color: '#16a34a', bg: '#dcfce7' };
    }
    return { label: t('booksList.inactive'), color: '#888', bg: '#f0f0f0' };
  }

  function renderBook({ item }) {
    const badge = getStatusBadge(item);
    return (
      <View style={styles.row}>
        <View style={styles.rowMain}>
          <Text style={styles.code}>{item.static_code}</Text>
          <Text style={styles.slot}>
            {item.slot_name ?? t('booksList.unassigned')}
          </Text>
        </View>
        <View style={styles.rowRight}>
          <Text style={styles.price}>${item.ticket_price}</Text>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.color }]}>
              {badge.label}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#222" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('booksList.title')}</Text>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, status === f && styles.filterTabActive]}
            onPress={() => handleFilterChange(f)}
          >
            <Text
              style={[
                styles.filterTabText,
                status === f && styles.filterTabTextActive,
              ]}
            >
              {t(`booksList.filter_${f}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={books}
          keyExtractor={(item) => String(item.book_id)}
          contentContainerStyle={styles.list}
          renderItem={renderBook}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>{t('booksList.empty')}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f5f7' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 8,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 22, fontWeight: '700', color: '#222' },

  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 6,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  filterTabActive: { backgroundColor: '#1a73e8' },
  filterTabText: { fontSize: 12, fontWeight: '600', color: '#555' },
  filterTabTextActive: { color: '#fff' },

  list: { padding: 16, paddingTop: 4, paddingBottom: 32 },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  rowMain: { flex: 1, marginEnd: 12 },
  code: { fontSize: 15, fontWeight: '700', color: '#222' },
  slot: { fontSize: 12, color: '#666', marginTop: 2 },

  rowRight: { alignItems: 'flex-end', gap: 4 },
  price: { fontSize: 13, fontWeight: '700', color: '#333' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '600' },

  emptyText: { fontSize: 14, color: '#888', textAlign: 'center' },
});
