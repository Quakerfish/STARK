import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Taskbar from '../components/taskbar/taskbar';
import { DtrRow, formatDate, formatTime, isSameDay, rowMinutes, toDuration } from '../utils/dtr';
import { parseDtrLayout } from '../utils/dtr-layout';
import { isSuspicious, scanToRows } from '../utils/dtr-scan';
import { notify } from '../utils/notify';
import { recognizeElements } from '../utils/ocr';

type Field = 'date' | 'timeIn' | 'timeOut';

const newRow = (): DtrRow => ({
  id: String(Date.now()) + Math.random().toString(36).slice(2, 6),
  date: new Date(),
  timeIn: null,
  timeOut: null,
});

const sumMinutes = (rows: DtrRow[]) => rows.reduce((sum, r) => sum + (rowMinutes(r) ?? 0), 0);

export default function DayTimeCalculator() {
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<DtrRow[]>([newRow()]);
  const [picker, setPicker] = useState<{ id: string; field: Field } | null>(null);
  const [scanning, setScanning] = useState(false);
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
    let scanDocument: typeof import('react-native-document-scanner-plugin').default.scanDocument;
    try {
      scanDocument = (await import('react-native-document-scanner-plugin')).default.scanDocument;
    } catch {
      notify('Scanner not available', 'The camera scanner needs a development build. Use "Upload photo" instead.');
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

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Status */}
        <Text style={[styles.status, openRow && styles.statusActive]}>
          {openRow ? `Clocked in at ${formatTime(openRow.timeIn)}` : 'Not clocked in'}
        </Text>

        {/* Header */}
        <View style={[styles.row, styles.headerRow]}>
          <Text style={[styles.headerText, styles.col]}>Date</Text>
          <Text style={[styles.headerText, styles.col]}>In</Text>
          <Text style={[styles.headerText, styles.col]}>Out</Text>
          <Text style={[styles.headerText, styles.col]}>Hours</Text>
          <View style={styles.colDelete} />
        </View>

        {/* Rows */}
        {rows.map((row) => {
          const min = rowMinutes(row);
          return (
            <View key={row.id} style={styles.row}>
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
              <TouchableOpacity style={styles.colDelete} onPress={() => removeRow(row.id)}>
                <Ionicons name="close-circle-outline" size={20} color="#888" />
              </TouchableOpacity>
            </View>
          );
        })}

        {/* Total */}
        <View style={[styles.row, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total:</Text>
          <Text style={styles.totalValue}>{toDuration(totalMinutes)}</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.addBtn, styles.actionBtn]} onPress={addRow}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.addText}>Add row</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.addBtn, styles.actionBtn]} onPress={handleUpload} disabled={scanning}>
            {scanning ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Ionicons name="image-outline" size={20} color="#fff" />
            )}
            <Text style={styles.addText}>{scanning ? 'Reading…' : 'Upload photo'}</Text>
          </TouchableOpacity>
          {Platform.OS !== 'web' && (
            <TouchableOpacity style={[styles.addBtn, styles.actionBtn]} onPress={handleScan} disabled={scanning}>
              <Ionicons name="camera-outline" size={20} color="#fff" />
              <Text style={styles.addText}>Scan DTR</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

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
              Handwriting can be misread. Red rows look off (missing time, very long, or date not read); you can edit any row after adding.
            </Text>

            <ScrollView style={{ maxHeight: 360 }}>
              <View style={[styles.row, styles.headerRow]}>
                <Text style={[styles.headerText, styles.col]}>Date</Text>
                <Text style={[styles.headerText, styles.col]}>In</Text>
                <Text style={[styles.headerText, styles.col]}>Out</Text>
                <Text style={[styles.headerText, styles.col]}>Hours</Text>
              </View>
              {preview?.rows.map((row) => {
                const min = rowMinutes(row);
                const bad = isSuspicious(row) || !!preview?.guessed.has(row.id);
                return (
                  <View key={row.id} style={styles.row}>
                    <Text style={[styles.cell, styles.col, bad && styles.cellBad]}>{formatDate(row.date)}</Text>
                    <Text style={[styles.cell, styles.col, bad && styles.cellBad]}>{formatTime(row.timeIn)}</Text>
                    <Text style={[styles.cell, styles.col, bad && styles.cellBad]}>{formatTime(row.timeOut)}</Text>
                    <Text style={[styles.cell, styles.col, bad && styles.cellBad]}>
                      {min === null ? '-' : toDuration(min)}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.modalTotal}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text style={styles.totalValue}>{toDuration(sumMinutes(preview?.rows ?? []))}</Text>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity style={[styles.addBtn, styles.actionBtn]} onPress={() => setPreview(null)}>
                <Text style={styles.addText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.addBtn, styles.actionBtn, styles.confirmBtn]} onPress={confirmPreview}>
                <Text style={styles.addText}>Add {preview?.rows.length ?? 0} rows</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Taskbar onFingerprintPress={handleFingerprint} fingerprintActive={!!openRow} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  status: { color: '#aaa', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  statusActive: { color: '#2ecc71', fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  headerRow: { backgroundColor: '#2c2c2c', borderTopLeftRadius: 10, borderTopRightRadius: 10 },
  headerText: { color: '#fff', fontWeight: '700', fontSize: 12, textAlign: 'center' },
  cell: { color: '#fff', fontSize: 14, textAlign: 'center' },
  cellBad: { color: '#ff6b6b' },
  // All data columns share the same width so the table stays even.
  col: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  colDelete: { width: 32, alignItems: 'flex-end', justifyContent: 'center' },
  totalRow: {
    justifyContent: 'space-between',
    backgroundColor: '#2c2c2c',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    borderBottomWidth: 0,
    paddingHorizontal: 12,
  },
  totalLabel: { color: '#fff', fontSize: 18, fontWeight: '700' },
  totalValue: { color: '#fff', fontSize: 18, fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  actionBtn: { flexGrow: 1, flexBasis: '30%', marginTop: 0 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#1e1e1e',
  },
  addText: { color: '#fff', marginLeft: 6, fontWeight: '600' },
  confirmBtn: { backgroundColor: '#1f8f4e', borderColor: '#2ecc71' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: {
    backgroundColor: '#121212',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  modalHint: { color: '#aaa', fontSize: 12, marginTop: 4, marginBottom: 12 },
  modalTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#2c2c2c',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
});