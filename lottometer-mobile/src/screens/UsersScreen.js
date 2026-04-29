import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../context/AuthContext';
import { listUsers, createUser, updateUser, deleteUser } from '../api/users';
import EmptyState from '../components/EmptyState';

export default function UsersScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { user: currentUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState([]);
  const [busy, setBusy] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null); // null = create mode
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('employee');

  const load = useCallback(async () => {
    try {
      const data = await listUsers();
      setUsers(data);
    } catch (err) {
      Alert.alert(t('common.error'), err.message || t('common.tryAgain'));
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function openCreate() {
    setEditingUser(null);
    setUsername('');
    setPassword('');
    setRole('employee');
    setModalOpen(true);
  }

  function openEdit(u) {
    setEditingUser(u);
    setUsername(u.username);
    setPassword('');
    setRole(u.role);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingUser(null);
    setUsername('');
    setPassword('');
    setRole('employee');
  }

  async function handleSubmit() {
    const isEdit = editingUser !== null;

    if (!username.trim() || username.trim().length < 2) {
      Alert.alert(t('users.invalidUsername'), t('users.invalidUsernameHint'));
      return;
    }

    if (!isEdit && (!password || password.length < 6)) {
      Alert.alert(t('users.invalidPassword'), t('users.invalidPasswordHint'));
      return;
    }

    if (isEdit && password && password.length < 6) {
      Alert.alert(t('users.invalidPassword'), t('users.invalidPasswordHint'));
      return;
    }

    setBusy(true);
    try {
      if (isEdit) {
        const payload = {};
        if (username.trim() !== editingUser.username) {
          payload.username = username.trim();
        }
        if (role !== editingUser.role) {
          payload.role = role;
        }
        if (password) {
          payload.new_password = password;
        }
        if (Object.keys(payload).length === 0) {
          closeModal();
          setBusy(false);
          return;
        }
        await updateUser(editingUser.user_id, payload);
        Alert.alert(t('users.userUpdatedTitle'));
      } else {
        await createUser({
          username: username.trim(),
          password,
          role,
        });
        Alert.alert(
          t('users.userCreatedTitle'),
          t('users.userCreatedHint', { username: username.trim() })
        );
      }
      closeModal();
      await load();
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(u) {
    Alert.alert(
      t('users.deleteUserTitle'),
      t('users.deleteUserMessage', { username: u.username }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('users.delete'),
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await deleteUser(u.user_id);
              Alert.alert(t('users.userDeletedTitle'));
              await load();
            } catch (err) {
              handleError(err);
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  }

  function handleError(err) {
    if (err.code === 'USERNAME_TAKEN') {
      Alert.alert(t('users.usernameTakenTitle'), t('users.usernameTakenHint'));
    } else if (err.code === 'LAST_ADMIN') {
      Alert.alert(t('users.lastAdminTitle'), t('users.lastAdminHint'));
    } else if (err.code === 'CANNOT_DELETE_SELF') {
      Alert.alert(t('users.cannotDeleteSelfTitle'), t('users.cannotDeleteSelfHint'));
    } else {
      Alert.alert(err.code || t('common.error'), err.message || t('common.tryAgain'));
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← {t('settings.title')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <Text style={styles.title}>{t('users.title')}</Text>

        <TouchableOpacity style={styles.addButton} onPress={openCreate}>
          <Text style={styles.addButtonText}>{t('users.addUser')}</Text>
        </TouchableOpacity>

        {users.length <= 1 ? (
          <EmptyState
            icon="people-outline"
            title={t('users.emptyTitle')}
            subtitle={t('users.emptySubtitle')}
            actionLabel={t('users.emptyAction')}
            onAction={openCreate}
          />
        ) : (
          users.map((u) => {
            const isMe = u.user_id === currentUser?.user_id;
            return (
              <View key={u.user_id} style={styles.userCard}>
                <View style={styles.userHeader}>
                  <Text style={styles.username}>
                    {u.username}
                    {isMe && (
                      <Text style={styles.youBadge}>  ({t('users.currentUserBadge')})</Text>
                    )}
                  </Text>
                  <View
                    style={[
                      styles.roleBadge,
                      u.role === 'admin' ? styles.adminBadge : styles.employeeBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.roleBadgeText,
                        u.role === 'admin' ? styles.adminBadgeText : styles.employeeBadgeText,
                      ]}
                    >
                      {u.role === 'admin' ? t('users.roleAdmin') : t('users.roleEmployee')}
                    </Text>
                  </View>
                </View>

                <View style={styles.userActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.editAction]}
                    onPress={() => openEdit(u)}
                    disabled={busy}
                  >
                    <Text style={styles.editActionText}>{t('common.edit')}</Text>
                  </TouchableOpacity>
                  {!isMe && (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteAction]}
                      onPress={() => handleDelete(u)}
                      disabled={busy}
                    >
                      <Text style={styles.deleteActionText}>{t('users.delete')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Create / Edit Modal */}
      <Modal
        visible={modalOpen}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>
                {editingUser ? t('users.editUserTitle') : t('users.newUserTitle')}
              </Text>

              <Text style={styles.label}>{t('users.username')}</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder={t('users.usernamePlaceholder')}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.label}>
                {editingUser ? t('users.newPassword') : t('users.password')}
              </Text>
              {editingUser && (
                <Text style={styles.helperText}>{t('users.newPasswordHint')}</Text>
              )}
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder={t('users.passwordPlaceholder')}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.label}>{t('users.role')}</Text>
              <View style={styles.roleGroup}>
                <TouchableOpacity
                  style={[
                    styles.roleOption,
                    role === 'employee' && styles.roleOptionActive,
                  ]}
                  onPress={() => setRole('employee')}
                >
                  <Text
                    style={[
                      styles.roleOptionText,
                      role === 'employee' && styles.roleOptionTextActive,
                    ]}
                  >
                    {t('users.roleEmployee')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.roleOption,
                    role === 'admin' && styles.roleOptionActive,
                  ]}
                  onPress={() => setRole('admin')}
                >
                  <Text
                    style={[
                      styles.roleOptionText,
                      role === 'admin' && styles.roleOptionTextActive,
                    ]}
                  >
                    {t('users.roleAdmin')}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={closeModal}
                  disabled={busy}
                >
                  <Text style={styles.cancelText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.submitButton, busy && styles.disabled]}
                  onPress={handleSubmit}
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitText}>
                      {editingUser ? t('users.save') : t('users.create')}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f5f7' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { padding: 16 },
  backText: { color: '#1a73e8', fontSize: 16, fontWeight: '600' },

  scroll: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 16 },

  addButton: {
    backgroundColor: '#1a73e8',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  addButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },

  userCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  username: { fontSize: 17, fontWeight: '700', color: '#222' },
  youBadge: { fontSize: 13, color: '#888', fontWeight: '500' },

  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  adminBadge: { backgroundColor: '#e8f0fe' },
  employeeBadge: { backgroundColor: '#f0f0f0' },
  roleBadgeText: { fontSize: 12, fontWeight: '700' },
  adminBadgeText: { color: '#1a73e8' },
  employeeBadgeText: { color: '#666' },

  userActions: { flexDirection: 'row', gap: 8 },
  actionButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  editAction: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#1a73e8' },
  editActionText: { color: '#1a73e8', fontWeight: '600' },
  deleteAction: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dc3545' },
  deleteActionText: { color: '#dc3545', fontWeight: '600' },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  modalTitle: { fontSize: 22, fontWeight: '700', marginBottom: 16 },

  label: {
    fontSize: 13,
    color: '#444',
    marginBottom: 6,
    marginTop: 12,
    fontWeight: '600',
  },
  helperText: { fontSize: 12, color: '#888', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },

  roleGroup: { flexDirection: 'row', gap: 8, marginTop: 4 },
  roleOption: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    alignItems: 'center',
  },
  roleOptionActive: { borderColor: '#1a73e8', backgroundColor: '#e8f0fe' },
  roleOptionText: { color: '#666', fontWeight: '600' },
  roleOptionTextActive: { color: '#1a73e8' },

  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalButton: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center' },
  cancelButton: { backgroundColor: '#f0f0f0' },
  cancelText: { color: '#444', fontWeight: '600' },
  submitButton: { backgroundColor: '#1a73e8' },
  submitText: { color: '#fff', fontWeight: '600' },
  disabled: { opacity: 0.6 },
});