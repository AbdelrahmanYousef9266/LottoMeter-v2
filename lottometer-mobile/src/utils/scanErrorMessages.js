const ERROR_KEYS = {
  BOOK_NOT_FOUND: 'scan.errors.bookNotFound',
  BOOK_NOT_ACTIVE: 'scan.errors.bookNotActive',
  BOOK_ALREADY_SOLD: 'scan.errors.bookAlreadySold',
  INVALID_POSITION: 'scan.errors.invalidPosition',
  POSITION_BEFORE_OPEN: 'scan.errors.positionBeforeOpen',
  OPEN_RESCAN_BLOCKED: 'scan.errors.openRescanBlocked',
  SHIFT_CLOSED: 'scan.errors.shiftClosed',
  SHIFT_VOIDED: 'scan.errors.shiftVoided',
  SALES_BLOCKED_PENDING_INIT: 'scan.errors.salesBlockedPendingInit',
};

export function friendlyScanError(err, t) {
  const key = err?.code && ERROR_KEYS[err.code];
  if (key) return t(key);
  return err?.message || t('common.tryAgain');
}
