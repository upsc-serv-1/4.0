/**
 * UndoToast — Small ephemeral toast with an Undo CTA.
 *
 * Usage:
 *   const [toast, setToast] = useState<UndoSpec | null>(null);
 *   setToast({ message: 'Selection cleared', onUndo: () => restore() });
 *   <UndoToast spec={toast} onDismiss={() => setToast(null)} />
 */
import React, { useEffect } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Undo2 } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';

export interface UndoSpec {
  message: string;
  onUndo: () => void;
  durationMs?: number;
}

export const UndoToast: React.FC<{ spec: UndoSpec | null; onDismiss: () => void }> = ({ spec, onDismiss }) => {
  const { colors } = useTheme();
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!spec) return;
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => onDismiss());
    }, spec.durationMs ?? 4000);
    return () => clearTimeout(t);
  }, [spec, opacity, onDismiss]);

  if (!spec) return null;
  return (
    <Animated.View style={[styles.toast, { backgroundColor: colors.textPrimary, opacity }]}>
      <Text style={styles.message} numberOfLines={2}>{spec.message}</Text>
      <TouchableOpacity testID="undo-toast-action" onPress={() => { spec.onUndo(); onDismiss(); }} style={styles.undoBtn}>
        <Undo2 size={14} color="#fff" />
        <Text style={styles.undoText}>Undo</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  toast: { position: 'absolute', left: 16, right: 16, bottom: 80, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 6, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  message: { color: '#fff', flex: 1, fontWeight: '700', fontSize: 13 },
  undoBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 8 },
  undoText: { color: '#fff', fontWeight: '800', fontSize: 12 },
});

export default UndoToast;
