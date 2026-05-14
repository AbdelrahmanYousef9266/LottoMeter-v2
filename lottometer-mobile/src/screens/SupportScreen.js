import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { submitComplaint } from '../api/complaints';

// ── design tokens (mirrors SettingsScreen) ─────────────────────────────────────
const D = {
  PRIMARY:    '#0077CC',
  SUCCESS:    '#16A34A',
  ERROR:      '#DC2626',
  BACKGROUND: '#F8FAFC',
  CARD:       '#FFFFFF',
  TEXT:       '#0F172A',
  SUBTLE:     '#64748B',
  BORDER:     '#E2E8F0',
  FB:         '#1877F2',
};
const FS = { xs: 11, sm: 13, md: 15, lg: 18 };
const FW = { regular: '400', semibold: '600', bold: '700' };
const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
const BR = { sm: 8, md: 12, lg: 16 };
const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.06,
  shadowRadius: 4,
  elevation: 2,
};

export default function SupportScreen() {
  const navigation = useNavigation();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const canSend = subject.trim().length > 0 && message.trim().length > 0;

  async function handleSend() {
    if (!canSend || sending) return;
    setSending(true);
    try {
      await Promise.all([
        submitComplaint({ subject: subject.trim(), message: message.trim() }),
        new Promise(r => setTimeout(r, 800)),
      ]);
      setSubject('');
      setMessage('');
      Alert.alert(
        'Message sent',
        "We'll respond within 1 business day.",
        [{ text: 'OK' }]
      );
    } catch (err) {
      Alert.alert('Send failed', err.message || 'Could not send message. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView style={s.root}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={12}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Contact Support</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Channel cards */}
          <Text style={s.sectionLabel}>REACH US ON</Text>
          <View style={s.sectionCard}>

            {/* Email */}
            <TouchableOpacity
              style={s.channelRow}
              onPress={() => Linking.openURL('mailto:support@lottometer.com')}
              activeOpacity={0.7}
            >
              <View style={[s.channelIcon, { backgroundColor: '#DBEAFE' }]}>
                <Text style={s.channelEmoji}>✉️</Text>
              </View>
              <View style={s.channelInfo}>
                <Text style={s.channelTitle}>Email</Text>
                <Text style={[s.channelSub, { color: D.PRIMARY }]}>support@lottometer.com</Text>
              </View>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>

            <View style={s.rowDivider} />

            {/* Facebook */}
            <TouchableOpacity
              style={s.channelRow}
              onPress={() => Linking.openURL('https://www.facebook.com/profile.php?id=61589356135499')}
              activeOpacity={0.7}
            >
              <View style={[s.channelIcon, { backgroundColor: '#EEF2FF' }]}>
                <Text style={s.channelEmoji}>📘</Text>
              </View>
              <View style={s.channelInfo}>
                <Text style={s.channelTitle}>Facebook</Text>
                <Text style={[s.channelSub, { color: D.FB }]}>LottoMeter Page</Text>
              </View>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Complaint form */}
          <Text style={s.sectionLabel}>SEND A MESSAGE</Text>
          <View style={[s.sectionCard, { padding: SP.lg }]}>

            <Text style={s.inputLabel}>Subject</Text>
            <TextInput
              style={s.input}
              placeholder="Brief description of your issue"
              placeholderTextColor={D.SUBTLE}
              value={subject}
              onChangeText={setSubject}
              editable={!sending}
              maxLength={255}
              returnKeyType="next"
            />

            <Text style={[s.inputLabel, { marginTop: SP.md }]}>Message</Text>
            <TextInput
              style={[s.input, s.textarea]}
              placeholder="Describe your issue in detail…"
              placeholderTextColor={D.SUBTLE}
              value={message}
              onChangeText={setMessage}
              editable={!sending}
              multiline
              textAlignVertical="top"
              numberOfLines={5}
              returnKeyType="default"
            />

            <TouchableOpacity
              style={[s.sendBtn, (!canSend || sending) && s.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!canSend || sending}
              activeOpacity={0.8}
            >
              {sending
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.sendBtnText}>Send message</Text>
              }
            </TouchableOpacity>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: D.BACKGROUND },

  header: {
    height: 56,
    backgroundColor: D.CARD,
    borderBottomWidth: 1,
    borderBottomColor: D.BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SP.md,
  },
  backBtn:    { width: 40, justifyContent: 'center' },
  backArrow:  { fontSize: 28, color: D.PRIMARY, lineHeight: 32 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: FS.lg, fontWeight: FW.bold, color: D.TEXT },

  sectionLabel: {
    paddingHorizontal: SP.lg,
    paddingTop: SP.lg,
    paddingBottom: SP.sm,
    fontSize: FS.xs,
    fontWeight: FW.semibold,
    color: D.SUBTLE,
    letterSpacing: 1,
  },
  sectionCard: {
    backgroundColor: D.CARD,
    borderRadius: BR.lg,
    marginHorizontal: SP.lg,
    marginBottom: SP.md,
    overflow: 'hidden',
    ...CARD_SHADOW,
  },

  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SP.lg,
  },
  channelIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  channelEmoji: { fontSize: FS.lg },
  channelInfo:  { flex: 1, marginLeft: SP.md },
  channelTitle: { fontSize: FS.md, fontWeight: FW.semibold, color: D.TEXT },
  channelSub:   { fontSize: FS.sm, marginTop: 2 },
  rowDivider:   { height: 1, backgroundColor: D.BORDER, marginLeft: 72 },
  chevron:      { fontSize: 24, color: D.SUBTLE },

  inputLabel: { fontSize: FS.sm, fontWeight: FW.semibold, color: D.TEXT, marginBottom: SP.xs },
  input: {
    borderWidth: 1.5,
    borderColor: D.BORDER,
    borderRadius: BR.md,
    padding: SP.md,
    fontSize: FS.md,
    color: D.TEXT,
    backgroundColor: D.BACKGROUND,
  },
  textarea: { minHeight: 110 },

  sendBtn: {
    marginTop: SP.lg,
    height: 50,
    backgroundColor: D.PRIMARY,
    borderRadius: BR.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: '#fff', fontSize: FS.md, fontWeight: FW.bold },
});
