import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ActionPopupMenu({ visible, onClose, actions }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Inner Pressable absorbs taps so they don't reach the backdrop. */}
        <Pressable style={styles.menu} onPress={() => {}}>
          {actions.map((action, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.row, idx > 0 && styles.rowBorder]}
              onPress={() => {
                action.onPress();
                onClose();
              }}
            >
              {action.icon && (
                <Ionicons name={action.icon} size={20} color="#5f6368" style={styles.icon} />
              )}
              <Text style={styles.rowText}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-start',
    // flex-end mirrors to the left in RTL — follows the + button's position
    alignItems: 'flex-end',
    paddingTop: 64,
    // paddingEnd is a logical property: maps to paddingRight in LTR, paddingLeft in RTL
    paddingEnd: 16,
  },
  menu: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 210,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
  },
  icon: { marginEnd: 12 },
  rowText: { fontSize: 16, color: '#202124' },
});
