import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DtrRow, formatDate, formatTime, rowMinutes, toDuration, toHours } from '../utils/dtr';

type Field = 'date' | 'timeIn' | 'timeOut';

export default function DayTimeCalculator() {
  const [rows, setRows] = useState<DtrRow[]>([
    { id: String(Date.now()), date: new Date(), timeIn: null, timeOut: null },
  ]);
  const [picker, setPicker] = useState<{ id: string; field: Field } | null>(null);

  const addRow = () =>
    setRows((r) => [...r, { id: String(Date.now()), date: new Date(), timeIn: null, timeOut: null }]);

  const removeRow = (id: string) => setRows((r) => r.filter((x) => x.id !== id));

  const updateRow = (id: string, field: Field, value: Date) =>
    setRows((r) => r.map((x) => (x.id === id ? { ...x, [field]: value } : x)));

  const totalMinutes = rows.reduce((sum, r) => sum + (rowMinutes(r) ?? 0), 0);

  const activeRow = picker ? rows.find((r) => r.id === picker.id) : null;
  const pickerValue = activeRow && picker ? activeRow[picker.field] ?? new Date() : new Date();

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Header */}
        <View style={[styles.row, styles.headerRow]}>
          <Text style={[styles.headerText, styles.colDate]}>Date</Text>
          <Text style={[styles.headerText, styles.colTime]}>In</Text>
          <Text style={[styles.headerText, styles.colTime]}>Out</Text>
          <Text style={[styles.headerText, styles.colHours]}>No. of Hours</Text>
          <View style={styles.colDelete} />
        </View>

        {/* Rows */}
        {rows.map((row) => {
          const min = rowMinutes(row);
          return (
            <View key={row.id} style={styles.row}>
              <TouchableOpacity style={styles.colDate} onPress={() => setPicker({ id: row.id, field: 'date' })}>
                <Text style={styles.cell}>{formatDate(row.date)}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.colTime} onPress={() => setPicker({ id: row.id, field: 'timeIn' })}>
                <Text style={styles.cell}>{formatTime(row.timeIn)}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.colTime} onPress={() => setPicker({ id: row.id, field: 'timeOut' })}>
                <Text style={styles.cell}>{formatTime(row.timeOut)}</Text>
              </TouchableOpacity>
              <Text style={[styles.cell, styles.colHours]}>{min === null ? '-' : toHours(min)}</Text>
              <TouchableOpacity style={styles.colDelete} onPress={() => removeRow(row.id)}>
                <Ionicons name="close-circle-outline" size={20} color="#888" />
              </TouchableOpacity>
            </View>
          );
        })}

        {/* Total */}
        <View style={[styles.row, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total:</Text>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.totalValue}>{toHours(totalMinutes)} hrs</Text>
            <Text style={styles.totalSub}>{toDuration(totalMinutes)}</Text>
          </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
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
  headerText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  cell: { color: '#fff', fontSize: 14 },
  colDate: { flex: 1.1 },
  colTime: { flex: 1.3 },
  colHours: { flex: 1, textAlign: 'right' },
  colDelete: { width: 32, alignItems: 'flex-end' },
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
  totalSub: { color: '#aaa', fontSize: 12, marginTop: 2 },
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