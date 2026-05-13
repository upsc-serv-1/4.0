/**
 * networkStatus.ts — Process-wide source of truth for "are we online?".
 *
 * Why a singleton (and not just React context)?
 *   - Services that run outside React (SyncQueue worker, repositories, the
 *     Supabase customFetch interceptor, OfflineManager) need a SYNC `isOnline()`
 *     read without subscribing to a context.
 *   - The "Simulate Offline" toggle in the diagnostic page needs to force this
 *     flag too, so every consumer responds identically to real airplane mode.
 *
 * The flag is driven by THREE inputs and the most-pessimistic wins:
 *   1. NetInfo (real device connectivity).      ← `realOnline`
 *   2. Diagnostic "Simulate Offline" toggle.    ← `simulatedOffline`
 *   3. Programmatic override (rare/testing).    ← `forcedOffline`
 *
 * Effective:  online  =  realOnline  AND  NOT simulatedOffline  AND  NOT forcedOffline
 */

type Listener = (online: boolean) => void;

class NetworkStatusService {
  private realOnline = true;          // updated by NetworkContext via NetInfo
  private simulatedOffline = false;   // toggled by offline-diag screen
  private forcedOffline = false;      // for tests
  private listeners = new Set<Listener>();

  /** Synchronous check used by services outside React. */
  isOnline(): boolean {
    return this.realOnline && !this.simulatedOffline && !this.forcedOffline;
  }

  isOffline(): boolean {
    return !this.isOnline();
  }

  /** Called from NetworkContext when NetInfo state changes. */
  setRealOnline(online: boolean) {
    if (this.realOnline === online) return;
    this.realOnline = online;
    this.emit();
  }

  /** Called from offline-diag screen when user toggles simulation. */
  setSimulatedOffline(simulated: boolean) {
    if (this.simulatedOffline === simulated) return;
    this.simulatedOffline = simulated;
    this.emit();
  }

  isSimulatedOffline(): boolean {
    return this.simulatedOffline;
  }

  /** Programmatic override — used by tests and tooling. */
  setForcedOffline(forced: boolean) {
    if (this.forcedOffline === forced) return;
    this.forcedOffline = forced;
    this.emit();
  }

  /** Subscribe to changes. Returns unsubscribe fn. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private emit() {
    const online = this.isOnline();
    this.listeners.forEach((l) => {
      try { l(online); } catch { /* swallow */ }
    });
  }
}

export const NetworkStatus = new NetworkStatusService();

/** Convenience helper — `if (isOnline()) { ... }`. */
export const isOnline = (): boolean => NetworkStatus.isOnline();
export const isOffline = (): boolean => NetworkStatus.isOffline();
