// Module-level singleton so non-React code (API files) can read the current session.
// Set after login and on session restore.

let _userId = null;
let _storeId = null;

export const setSessionContext = (userId, storeId) => {
  _userId = userId;
  _storeId = storeId;
};

export const getSessionContext = () => ({
  userId: _userId,
  storeId: _storeId,
});
