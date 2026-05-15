export { getDb } from './db';
export {
  seedLocalDatabase,
  clearLocalDatabase,
} from './seed';
export {
  saveOfflineSession,
  getOfflineSession,
  clearOfflineSession,
  hasOfflineAccess,
} from './offlineAuth';
export {
  getLengthForPrice,
  getLastPosition,
  LENGTH_BY_PRICE,
} from './constants';
export {
  saveLocalStore,
  saveLocalUser,
  saveLocalSlot,
  saveLocalSlots,
  deleteLocalSlot,
  saveLocalBook,
  markLocalBookSold,
  saveLocalBusinessDay,
  saveLocalEmployeeShift,
  closeLocalEmployeeShift,
  saveLocalScan,
  saveLocalExtraSale,
  // sync queue state transitions
  markSyncItemSyncing,
  markSyncItemSynced,
  markSyncItemConflict,
  markSyncItemRetry,
  markSyncItemFailed,
  // manual retry / discard
  retryFailedSyncItem,
  discardFailedSyncItem,
  // bulk queries
  getFailedSyncItems,
  getSyncQueueStats,
  // local read helpers
  getLocalSlots,
  getLocalBooksSummary,
} from './localDb';
export { setSessionContext, getSessionContext } from './sessionStore';
export {
  recordOfflineScan,
  getOfflinePendingCounts,
  parseBarcode,
} from './scanEngine';
export {
  getOrCreateOfflineBusinessDay,
  openOfflineShift,
  closeOfflineShift,
  getOfflineShiftSummary,
} from './shiftEngine';
export {
  syncPendingItems,
  startSyncListener,
  getPendingSyncCount,
  getFailedSyncCount,
} from './syncEngine';
