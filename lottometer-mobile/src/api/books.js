import api from './client';

export async function getBooksSummary() {
  const { data } = await api.get('/books/summary');
  return data; // { active, sold, returned, total }
}

export async function getBooksActivity(period) {
  const { data } = await api.get(`/books/activity?period=${period}`);
  return data; // { period, from, to, sold, returned, previous_period: { sold, returned } | null }
}

export async function getBooks(filters = {}) {
  const params = new URLSearchParams();
  if (filters.status === 'active')   params.set('is_active', 'true');
  if (filters.status === 'sold')     params.set('is_sold', 'true');
  if (filters.status === 'returned') params.set('returned', 'true');
  const query = params.toString();
  const { data } = await api.get(query ? `/books?${query}` : '/books');
  return data; // { books: [...] }
}
