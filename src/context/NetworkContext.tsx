import NetInfo from '@react-native-community/netinfo';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { SyncQueue } from '../services/SyncQueue';
import { NetworkStatus } from '../lib/networkStatus';

type Ctx = { online: boolean; pending: number };
const NetworkCtx = createContext<Ctx>({ online: true, pending: 0 });

export const NetworkProvider = ({ children }: { children: React.ReactNode }) => {
  const [online, setOnline] = useState<boolean>(NetworkStatus.isOnline());
  const [pending, setPending] = useState<number>(SyncQueue.pendingCount());

  useEffect(() => {
    // 1) Bridge NetInfo -> NetworkStatus singleton.
    const unsubNetInfo = NetInfo.addEventListener((s) => {
      const isReal = Boolean(s.isConnected && s.isInternetReachable !== false);
      NetworkStatus.setRealOnline(isReal);
    });

    // 2) Bridge NetworkStatus singleton -> React state.
    //    Both the diagnostic "Simulate Offline" toggle and the real NetInfo
    //    state funnel through here, so every consumer sees the same flag.
    const unsubStatus = NetworkStatus.subscribe((isOn) => {
      setOnline(isOn);
      if (isOn) {
        SyncQueue.drain().finally(() => setPending(SyncQueue.pendingCount()));
      }
    });

    const t = setInterval(() => setPending(SyncQueue.pendingCount()), 3000);
    return () => {
      unsubNetInfo();
      unsubStatus();
      clearInterval(t);
    };
  }, []);

  return <NetworkCtx.Provider value={{ online, pending }}>{children}</NetworkCtx.Provider>;
};

export const useNetwork = () => useContext(NetworkCtx);
