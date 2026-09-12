import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNetwork } from '../context/NetworkContext';

export const OfflineBanner = () => {
  const { online } = useNetwork();
  
  // Hide completely when online (sync happens silently in the background)
  if (online) return null;

  return (
    <View style={[styles.bar, styles.offline]}>
      <Text style={styles.txt}>
        Offline — cached data
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
