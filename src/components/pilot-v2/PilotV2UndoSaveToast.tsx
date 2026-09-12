/**
 * PilotV2UndoSaveToast — temporary "Saved · Undo" snackbar.
 *
 * Surfaces immediately after a smart-append (Step 4) finishes. Keeps the undo
 * handle alive for `durationMs` (default 6 s); tapping "Undo" restores the
 * pre-append note content via `undoSmartAppend`. After the timeout it fades
 * out and discards the handle.
 *
 * Designed to be globally placed (e.g. inside the Pilot V2 root layout) and
 * controlled imperatively via `useUndoSaveToast`.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Platform, Easing,
} from 'react-native';
import { Undo2, CheckCircle2, X } from 'lucide-react-native';
import {
  SmartAppendUndoHandle,
  undoSmartAppend,
} from '../../services/PilotV2SmartAppend';

const ACCENT = '#5B4EFA';
const DEFAULT_DURATION_MS = 6000;

export interface UndoSaveToastState {
  visible: boolean;
  message: string;
  handle: SmartAppendUndoHandle | null;
  durationMs: number;
  /** Optional callback invoked after a successful undo. */
  onUndone?: () => void;
}

export interface PilotV2UndoSaveToastProps {
  state: UndoSaveToastState;
  onDismiss: () => void;
}

/**
 * Stateful toast view — animated entrance / exit and auto-dismiss after
 * `durationMs`. Renders nothing when `state.visible` is false.
 */
export const PilotV2UndoSaveToast: React.FC<PilotV2UndoSaveToastProps> = ({ state, onDismiss }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(40)).current;
  const [undoing, setUndoing] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animate in / out and arm the auto-dismiss timer.
  useEffect(() => {
    if (state.visible) {
      Animated.parallel([
        Animated.timing(opacity,   { toValue: 1, duration: 220, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
        Animated.timing(translate, { toValue: 0, duration: 220, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
      ]).start();
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      dismissTimer.current = setTimeout(() => {
        animateOut();
      }, state.durationMs ?? DEFAULT_DURATION_MS);
    } else {
      animateOut();
    }
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.visible, state.handle, state.durationMs]);

  const animateOut = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity,   { toValue: 0, duration: 180, useNativeDriver: true, easing: Easing.in(Easing.cubic) }),
      Animated.timing(translate, { toValue: 40, duration: 180, useNativeDriver: true, easing: Easing.in(Easing.cubic) }),
    ]).start(({ finished }) => {
      if (finished) onDismiss();
    });
  }, [opacity, translate, onDismiss]);

  const handleUndo = useCallback(async () => {
    if (!state.handle || undoing) return;
    setUndoing(true);
    try {
      const ok = await undoSmartAppend(state.handle);
      if (ok && state.onUndone) state.onUndone();
    } finally {
      setUndoing(false);
      animateOut();
    }
  }, [state.handle, state.onUndone, undoing, animateOut]);

  if (!state.visible && (opacity as any)._value === 0) return null;

  return (
    <Animated.View
      pointerEvents={state.visible ? 'auto' : 'none'}
      testID="pilot-v2-undo-save-toast"
      style={[
        styles.container,
        { opacity, transform: [{ translateY: translate }] },
      ]}
    >
      <View style={styles.iconWrap}>
        <CheckCircle2 size={18} color="#fff" />
      </View>
      <Text style={styles.message} numberOfLines={2}>
        {state.message || 'Saved.'}
      </Text>
      <TouchableOpacity
        testID="pilot-v2-undo-save-undo-btn"
        onPress={handleUndo}
        disabled={!state.handle || undoing}
        style={[styles.undoBtn, (!state.handle || undoing) && { opacity: 0.5 }]}
      >
        <Undo2 size={14} color="#fff" />
        <Text style={styles.undoText}>{undoing ? 'Undoing…' : 'Undo'}</Text>
      </TouchableOpacity>
      <TouchableOpacity testID="pilot-v2-undo-save-close-btn" onPress={animateOut} style={styles.closeBtn}>
        <X size={14} color="rgba(255,255,255,0.85)" />
      </TouchableOpacity>
    </Animated.View>
  );
};

/* ------------------------------------------------------------------------- */
/* Hook                                                                       */
/* ------------------------------------------------------------------------- */

/**
 * Imperative hook — call `show(handle, message?)` after a smart append; the
 * caller wires `state` + `dismiss` into a single `<PilotV2UndoSaveToast />`
 * placed in the root layout.
 */
export function useUndoSaveToast() {
  const [state, setState] = useState<UndoSaveToastState>({
    visible: false,
    message: '',
    handle: null,
    durationMs: DEFAULT_DURATION_MS,
  });

  const show = useCallback((
    handle: SmartAppendUndoHandle | null,
    message: string = 'Saved.',
    options: { durationMs?: number; onUndone?: () => void } = {},
  ) => {
    setState({
      visible: true,
      message,
      handle,
      durationMs: options.durationMs ?? DEFAULT_DURATION_MS,
      onUndone: options.onUndone,
    });
  }, []);

  const dismiss = useCallback(() => {
    setState(s => ({ ...s, visible: false, handle: null }));
  }, []);

  return useMemo(() => ({ state, show, dismiss }), [state, show, dismiss]);
}

/* ------------------------------------------------------------------------- */
/* Styles                                                                     */
/* ------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16, right: 16, bottom: Platform.OS === 'ios' ? 32 : 24,
    zIndex: 1200,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: '#0F172A',
    borderRadius: 14,
    shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
  iconWrap: {
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: ACCENT,
  },
  message: { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 },
  undoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8,
    backgroundColor: ACCENT, minHeight: 36, minWidth: 76, justifyContent: 'center',
  },
  undoText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  closeBtn: { padding: 6 },
});

export default PilotV2UndoSaveToast;
