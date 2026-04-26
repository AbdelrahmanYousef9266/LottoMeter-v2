import api from './client';

export async function recordWholeBookSale(subshiftId, payload) {
  // payload: { barcode, ticket_price, pin, note? }
  const { data } = await api.post(
    `/shifts/${subshiftId}/whole-book-sale`,
    payload
  );
  return data;
}

export async function returnBookToVendor(bookId, payload) {
  // payload: { barcode, pin }
  const { data } = await api.post(
    `/books/${bookId}/return-to-vendor`,
    payload
  );
  return data;
}