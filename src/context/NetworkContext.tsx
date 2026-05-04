import NetInfo from '@react-native-community/netinfo';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { SyncQueue } from '../services/SyncQueue';

type Ctx = { online: boolean; pending: number };
const NetworkCtx = createContext<Ctx>({ online: true, pending: 0 });

export const NetworkProvider = ({ children }: { children: React.ReactNode }) => {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(SyncQueue.pendingCount());

  useEffect(() => {
    const unsub = NetInfo.addEventListener(s => {
      const isOn = Boolean(s.isConnected && s.isInternetReachable !== false);
      setOnline(isOn);
      if (isOn) SyncQueue.drain().finally(() => setPending(SyncQueue.pendingCount()));
    });
    const t = setInterval(() => setPending(SyncQueue.pendingCount()), 3000);
    return () => { unsub(); clearInterval(t); };
  }, []);

  return <NetworkCtx.Provider value={{ online, pending }}>{children}</NetworkCtx.Provider>;
};

export const useNetwork = () => useContext(NetworkCtx);
