import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GradientBackground from '../components/gradient-background';
import Taskbar from '../components/taskbar/taskbar';
import { DtrRow, formatDate, formatTime, isSameDay, rowMinutes, toDuration } from '../utils/dtr';
import { parseDtrLayout } from '../utils/dtr-layout';
import { isSuspicious, scanToRows } from '../utils/dtr-scan';
import { notify } from '../utils/notify';
import { recognizeElements } from '../utils/ocr';

type Field = 'date' | 'timeIn' | 'timeOut';

const TASKBAR_HEIGHT = 65;
const FAB_SIZE = 60;

const newRow = (): DtrRow => ({
  id: String(Date.now()) + Math.random().toString(36).slice(2, 6),
  date: new Date(),
  timeIn: null,
  timeOut: null,
});

const sumMinutes = (rows: DtrRow[]) => rows.reduce((sum, r) => sum + (rowMinutes(r) ?? 0), 0);

export default function DayTimeCalculator() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [rows, setRows] = useState<DtrRow[]>([newRow()]);
  const [picker, setPicker] = useState<{ id: string; field: Field } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [preview, setPreview] = useState<{ rows: DtrRow[]; guessed: Set<string> } | null>(null);

  const addRow = () => setRows((r) => [...r, newRow()]);

  const removeRow = (id: string) => setRows((r) => r.filter((x) => x.id !== id));

  const updateRow = (id: string, field: Field, value: Date) =>
    setRows((r) => r.map((x) => (x.id === id ? { ...x, [field]: value } : x)));

  const totalMinutes = sumMinutes(rows);

  // A row that has a time in but no time out yet = currently clocked in.
  const openRow = rows.find((r) => r.timeIn && !r.timeOut);

  // Fingerprint: first press = time in, next press = time out.
  const handleFingerprint = () => {
    const now = new Date();
    if (openRow) {
      updateRow(openRow.id, 'timeOut', now);
      return;
    }
    const emptyToday = rows.find((r) => !r.timeIn && !r.timeOut && isSameDay(r.date, now));
    if (emptyToday) {
      setRows((r) => r.map((x) => (x.id === emptyToday.id ? { ...x, date: now, timeIn: now } : x)));
    } else {
      setRows((r) => [...r, { ...newRow(), date: now, timeIn: now }]);
    }
  };

  // Read an image (from the camera scanner or the gallery / file picker),
  // rebuild the table with the layout parser, and show it for review.
  const processImage = async (uri: string) => {
    setScanning(true);
    try {
      const elements = await recognizeElements(uri);
      const { rows: parsed, guessedDateIds } = scanToRows(parseDtrLayout(elements));
      if (parsed.length === 0) {
        notify('No rows found', 'Could not read any times from that image. Try a straight-on, well-lit photo of the sheet.');
        return;
      }
      setPreview({ rows: parsed, guessed: guessedDateIds });
    } catch (e) {
      notify('Scan failed', e instanceof Error ? e.message : String(e));
    } finally {
      setScanning(false);
    }
  };

  // Works everywhere: gallery on phones, file chooser on web.
  const handleUpload = async () => {
    setMenuOpen(false);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      if (result.canceled || result.assets.length === 0) return;
      await processImage(result.assets[0].uri);
    } catch (e) {
      notify('Could not open the image', e instanceof Error ? e.message : String(e));
    }
  };

  // Phones only: native document scanner (edge detection + cleanup).
  // Loaded lazily so the page still works in Expo Go and on web, where it doesn't exist.
  const handleScan = async () => {
    setMenuOpen(false);
    let scanDocument: typeof import('react-native-document-scanner-plugin').default.scanDocument;
    try {
      scanDocument = (await import('react-native-document-scanner-plugin')).default.scanDocument;
    } catch {
      notify('Scanner not available', 'The camera scanner needs a development build. Use "Upload from gallery" instead.');
      return;
    }
    try {
      const { scannedImages, status } = await scanDocument({
        maxNumDocuments: 1, // Android only
        croppedImageQuality: 100,
      });
      if (status !== 'success' || !scannedImages || scannedImages.length === 0) return;
      await processImage(scannedImages[0]);
    } catch (e) {
      notify('Scan failed', e instanceof Error ? e.message : String(e));
    }
  };

  const confirmPreview = () => {
    if (!preview) return;
    // Drop the untouched placeholder row, keep anything the user already entered.
    setRows((r) => [...r.filter((x) => x.timeIn || x.timeOut), ...preview.rows]);
    setPreview(null);
  };

  const activeRow = picker ? rows.find((r) => r.id === picker.id) : null;
  const pickerValue = activeRow && picker ? activeRow[picker.field] ?? new Date() : new Date();

  const fabBottom = TASKBAR_HEIGHT + insets.bottom + 20;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false, animation: 'none' }} />
      <GradientBackground />

      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 18, paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Title pill */}
        <View style={styles.titlePill}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            hitSlop={8}
            accessibilityLabel="Back to home"
          >
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.titleText}>STARK</Text>
        </View>

        <Text style={[styles.status, openRow && styles.statusActive]}>
          {openRow ? `Clocked in at ${formatTime(openRow.timeIn)}` : 'Not clocked in'}
        </Text>

        {/* Table card: Date | In | Out | Hours */}
        <View style={styles.card}>
          <View style={[styles.cardRow, styles.headRow]}>
            <Text style={[styles.headText, styles.col]}>Date</Text>
            <Text style={[styles.headText, styles.col]}>In</Text>
            <Text style={[styles.headText, styles.col]}>Out</Text>
            <Text style={[styles.headText, styles.col]}>Hours</Text>
            <View style={styles.colDelete} />
          </View>

          {rows.map((row) => {
            const min = rowMinutes(row);
            return (
              <View key={row.id} style={[styles.cardRow, styles.dataRow]}>
                <TouchableOpacity style={styles.col} onPress={() => setPicker({ id: row.id, field: 'date' })}>
                  <Text style={styles.cell}>{formatDate(row.date)}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.col} onPress={() => setPicker({ id: row.id, field: 'timeIn' })}>
                  <Text style={styles.cell}>{formatTime(row.timeIn)}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.col} onPress={() => setPicker({ id: row.id, field: 'timeOut' })}>
                  <Text style={styles.cell}>{formatTime(row.timeOut)}</Text>
                </TouchableOpacity>
                <View style={styles.col}>
                  <Text style={styles.cell}>{min === null ? '-' : toDuration(min)}</Text>
                </View>
                <TouchableOpacity style={styles.colDelete} onPress={() => removeRow(row.id)} hitSlop={8}>
                  <Ionicons name="close-circle-outline" size={20} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
              </View>
            );
          })}

          <View style={styles.divider} />
          <View style={styles.totalLine}>
            <Text style={styles.totalLabel}>Total Hours:</Text>
            <Text style={styles.totalLabel}>{toDuration(totalMinutes)}</Text>
          </View>
        </View>

        {/* Totals update live, so this slot adds a row instead of "Calculate". */}
        <TouchableOpacity style={styles.pillButton} onPress={addRow}>
          <Text style={styles.pillButtonText}>Add row</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Tap outside to close the camera menu */}
      {menuOpen && <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)} />}

      {/* Camera button + dropdown */}
      {menuOpen && (
        <View style={[styles.menu, { bottom: fabBottom + FAB_SIZE + 14 }]}>
          <TouchableOpacity style={styles.menuItem} onPress={handleUpload}>
            <View style={styles.menuLabel}>
              <Text style={styles.menuLabelText}>Upload from gallery</Text>
            </View>
            <View style={styles.menuIcon}>
              <Ionicons name="cloud-upload-outline" size={22} color="#fff" />
            </View>
          </TouchableOpacity>
          {Platform.OS !== 'web' && (
            <TouchableOpacity style={styles.menuItem} onPress={handleScan}>
              <View style={styles.menuLabel}>
                <Text style={styles.menuLabelText}>Scan with camera</Text>
              </View>
              <View style={styles.menuIcon}>
                <Ionicons name="camera-outline" size={22} color="#fff" />
              </View>
            </TouchableOpacity>
          )}
        </View>
      )}
      <TouchableOpacity
        style={[styles.fab, { bottom: fabBottom }]}
        onPress={() => setMenuOpen((o) => !o)}
        disabled={scanning}
        activeOpacity={0.8}
      >
        {scanning ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Ionicons name={menuOpen ? 'close' : 'camera-outline'} size={32} color="#fff" />
        )}
      </TouchableOpacity>

      {picker && (
        <DateTimePicker
          value={pickerValue}
          mode={picker.field === 'date' ? 'date' : 'time'}
          onChange={(event, selected) => {
            const current = picker;
            setPicker(null);
            if (event.type === 'set' && selected && current) updateRow(current.id, current.field, selected);
          }}
        />
      )}

      {/* Review scanned rows before adding them */}
      <Modal visible={preview !== null} animationType="slide" transparent onRequestClose={() => setPreview(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.modalTitle}>Review scanned rows</Text>
            <Text style={styles.modalHint}>
              Red rows look off (missing time, very long, or date not read). You can edit any row after adding.
            </Text>

            <ScrollView style={{ maxHeight: 340 }}>
              <View style={[styles.modalRow, styles.modalHead]}>
                <Text style={[styles.modalHeadText, styles.col]}>Date</Text>
                <Text style={[styles.modalHeadText, styles.col]}>In</Text>
                <Text style={[styles.modalHeadText, styles.col]}>Out</Text>
                <Text style={[styles.modalHeadText, styles.col]}>Hours</Text>
              </View>
              {preview?.rows.map((row) => {
                const min = rowMinutes(row);
                const bad = isSuspicious(row) || !!preview?.guessed.has(row.id);
                return (
                  <View key={row.id} style={styles.modalRow}>
                    <Text style={[styles.modalCell, styles.col, bad && styles.modalBad]}>{formatDate(row.date)}</Text>
                    <Text style={[styles.modalCell, styles.col, bad && styles.modalBad]}>{formatTime(row.timeIn)}</Text>
                    <Text style={[styles.modalCell, styles.col, bad && styles.modalBad]}>{formatTime(row.timeOut)}</Text>
                    <Text style={[styles.modalCell, styles.col, bad && styles.modalBad]}>
                      {min === null ? '-' : toDuration(min)}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.modalTotal}>
              <Text style={styles.modalTotalText}>Total:</Text>
              <Text style={styles.modalTotalText}>{toDuration(sumMinutes(preview?.rows ?? []))}</Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtn} onPress={() => setPreview(null)}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalConfirm]} onPress={confirmPreview}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Add {preview?.rows.length ?? 0} rows</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Taskbar variant="glass" onFingerprintPress={handleFingerprint} fingerprintActive={!!openRow} />
    </View>
  );
}

const GLASS = 'rgba(60,105,165,0.72)';
const GLASS_BORDER = 'rgba(255,255,255,0.85)';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#5b9ceb' },

  titlePill: {
    height: 52,
    borderRadius: 26,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtn: {
    position: 'absolute',
    left: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: 1 },

  status: { color: '#1f3b63', fontSize: 13, textAlign: 'center', marginTop: 14, marginBottom: 14 },
  statusActive: { color: '#0f6b3a', fontWeight: '700' },

  card: {
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: GLASS_BORDER,
    backgroundColor: GLASS,
    overflow: 'hidden',
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  // All data columns share the same width so the table stays even.
  col: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  colDelete: { width: 30, alignItems: 'flex-end', justifyContent: 'center' },
  headRow: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.5)' },
  headText: { color: '#fff', fontWeight: '700', fontSize: 14, textAlign: 'center' },
  dataRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.25)' },
  cell: { color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  divider: { height: 1.5, backgroundColor: GLASS_BORDER },
  totalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  totalLabel: { color: '#fff', fontSize: 16, fontWeight: '700' },

  pillButton: {
    marginTop: 18,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: GLASS_BORDER,
    backgroundColor: 'rgba(70,115,175,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  fab: {
    position: 'absolute',
    right: 18,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: 16,
    backgroundColor: '#4c7db5',
    borderWidth: 1.5,
    borderColor: GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menu: { position: 'absolute', right: 18, alignItems: 'flex-end', gap: 12 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  menuLabel: {
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(60,105,165,0.88)',
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    justifyContent: 'center',
  },
  menuLabelText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(60,105,165,0.88)',
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,40,70,0.55)' },
  modalSheet: {
    backgroundColor: '#f2f7fe',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
  },
  modalTitle: { color: '#1f3b63', fontSize: 18, fontWeight: '800' },
  modalHint: { color: '#4a6288', fontSize: 12, marginTop: 4, marginBottom: 12 },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#d5e2f5',
  },
  modalHead: { backgroundColor: 'rgba(60,105,165,0.9)', borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottomWidth: 0 },
  modalHeadText: { color: '#fff', fontWeight: '700', fontSize: 12, textAlign: 'center' },
  modalCell: { color: '#1f3b63', fontSize: 14, textAlign: 'center' },
  modalBad: { color: '#d64545', fontWeight: '700' },
  modalTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(60,105,165,0.9)',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  modalTotalText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(60,105,165,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirm: { backgroundColor: 'rgba(60,105,165,0.95)' },
  modalBtnText: { color: '#1f3b63', fontWeight: '700', fontSize: 15 },
});