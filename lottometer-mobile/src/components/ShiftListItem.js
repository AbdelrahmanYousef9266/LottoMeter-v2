import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../theme';
import StatusBadge from './StatusBadge';
import { formatLocalTime } from '../utils/dateTime';

export default function ShiftListItem({ shift, onPress, currentUserId, t }) {
  const isOpen = shift.status === 'open';
  const openedBy =
    shift.employee_id === currentUserId
      ? (t ? t('history.you') : 'You')
      : `#${shift.employee_id}`;
  const endLabel = isOpen
    ? (t ? t('history.statusActive') : 'Active')
    : formatLocalTime(shift.closed_at);

  const badgeStatus = isOpen ? 'active' : shift.shift_status;

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.left}>
        <Text style={styles.number}>
          {t
            ? t('history.shiftNumber', { number: shift.shift_number })
            : `Shift #${shift.shift_number}`}
        </Text>
        <Text style={styles.time}>
          {formatLocalTime(shift.opened_at)} → {endLabel}
        </Text>
        <Text style={styles.by}>{openedBy}</Text>
      </View>
      <StatusBadge status={badgeStatus} voided={shift.voided} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  left: { flex: 1, marginRight: 10 },
  number: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textWhite,
    marginBottom: 3,
  },
  time: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  by: {
    fontSize: 11,
    color: Colors.textFaint,
  },
});
