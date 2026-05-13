/**
 * NetworkStatus — singleton for tracking online/offline state.
 *
 * Two sources feed into this:
 *   1. Real network events via @react-native-community/netinfo (optional).
 *   2. Manual override via setSimulatedOffline() — used by the offline-diag
 *      "Simulate Offline" toggle so the simulation accurately mirrors true
 *      airplane mode even when Wi-Fi is connected.
 *
 * The manual override always wins over real-network detection.
 *
 * Usage:
 *   import { NetworkStatus } from '../services/NetworkStatus';
 *   if (!NetworkStatus.isOnline()) { /* use cache *\/ }
 *   NetworkStatus.setSimulatedOffline(true); // start simulation
 *   NetworkStatus.setSimulatedOffline(false); // stop simulation (restore real state)
 */

type Listener = (online: boolean) => void;

class NetworkStatusService {
  /** Real connectivity as detected by NetInfo / device. */
  private _realOnline = true;
  /** Manual override set by the diagnostic screen. null = no override. */
  private _simulatedOffline: boolean | null = null;
  private _listeners: Set<Listener> = new Set();

  /** Returns true if the app should consider itself able to reach Supabase. */
  isOnline(): boolean {
    if (this._simulatedOffline !== null) return !this._simulatedOffline;
    return this._realOnline;
  }

  /**
   * Set the manual offline simulation override.
   * Pass `true`  to go offline (blocks all Supabase calls).
   * Pass `false` to go back to real network state.
   */
  setSimulatedOffline(offline: boolean) {
    this._simulatedOffline = offline;
    this._notify();
  }

  /** Clear any manual override — app returns to real network state. */
  clearSimulation() {
    this._simulatedOffline = null;
    this._notify();
  }

  /** Called by NetInfo listener. Does NOT override manual simulation. */
  setRealOnline(online: boolean) {
    this._realOnline = online;
    if (this._simulatedOffline === null) this._notify();
  }

  /** Subscribe to online/offline changes. Returns an unsubscribe fn. */
  subscribe(fn: Listener): () => void {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  private _notify() {
    const online = this.isOnline();
    this._listeners.forEach(fn => {
      try { fn(online); } catch {}
    });
  }
}

export const NetworkStatus = new NetworkStatusService();
