import api from './client';

export async function listSlots() {
  const { data } = await api.get('/slots');
  return data;
}

export async function getSlot(slotId) {
  const { data } = await api.get(`/slots/${slotId}`);
  return data;
}

export async function createSlot({ slot_name, ticket_price }) {
  const { data } = await api.post('/slots', { slot_name, ticket_price });
  return data;
}

export async function updateSlot(slotId, payload) {
  const { data } = await api.put(`/slots/${slotId}`, payload);
  return data;
}

export async function deleteSlot(slotId) {
  await api.delete(`/slots/${slotId}`);
}

export async function assignBook(slotId, payload) {
  // payload: { barcode, book_name?, ticket_price_override?, confirm_reassign? }
  const { data } = await api.post(`/slots/${slotId}/assign-book`, payload);
  return data;
}

export async function unassignBook(bookId) {
  const { data } = await api.post(`/books/${bookId}/unassign`);
  return data;
}