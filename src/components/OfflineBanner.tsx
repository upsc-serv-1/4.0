import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNetwork } from '../context/NetworkContext';

export const OfflineBanner = () => {
  const { online, pending } = useNetwork();
  if (online && pending === 0) return null;
  return (
    <View style={[styles.bar, online ? styles.sync : styles.offline]}>
      <Text style={styles.txt}>
        {online ? `Syncing ${pending} change${pending === 1 ? '' : 's'}…` : 'Offline — cached data'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: { paddingVertical: 6, alignItems: 'center' },
  offline: { backgroundColor: '#b91c1c' },
  sync: { backgroundColor: '#2563eb' },
  txt: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
