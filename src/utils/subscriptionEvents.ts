/**
 * Simple global event emitter for showing the subscription sheet.
 * The sheet is mounted at the root layout level, and any component
 * can trigger it by calling `emitShowSubscription()`.
 */

type Listener = (visible: boolean) => void;
let listener: Listener | null = null;

export function onShowSubscription(fn: Listener) {
  listener = fn;
  return () => { listener = null; };
}

export function emitShowSubscription() {
  listener?.(true);
}
