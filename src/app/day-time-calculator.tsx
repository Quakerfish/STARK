import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Taskbar from '../components/taskbar/taskbar';
import { DtrRow, formatDate, formatTime, isSameDay, rowMinutes, toDuration } from '../utils/dtr';

type Field = 'date' | 'timeIn' | 'timeOut';

const newRow = (): DtrRow => ({
  id: String(Date.now()) + Math.random().toString(36).slice(2, 6),
  date: new Date(),
  timeIn: null,
  timeOut: null,
});

export default function DayTimeCalculator() {
  const [rows, setRows] = useState<DtrRow[]>([newRow()]);
  const [picker, setPicker] = useState<{ id: string; field: Field } | null>(null);

  const addRow = () => setRows((r) => [...r, newRow()]);

  const removeRow = (id: string) => setRows((r) => r.filter((x) => x.id !== id));

  const updateRow = (id: string, field: Field, value: Date) =>
    setRows((r) => r.map((x) => (x.id === id ? { ...x, [field]: value } : x)));

  const totalMinutes = rows.reduce((sum, r) => sum + (rowMinutes(r) ?? 0), 0);

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

        <TouchableOpacity style={styles.addBtn} onPress={addRow}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addText}>Add row</Text>
        </TouchableOpacity>
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#1e1e1e',
  },
  addText: { color: '#fff', marginLeft: 6, fontWeight: '600' },
});