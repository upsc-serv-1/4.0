import React, { useMemo } from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { AVATARS } from '../constants/avatars';

interface AvatarPickerProps {
  selectedAvatar: string;
  onSelectAvatar: (avatarId: string) => void;
  colors: any;
}

// Memoized avatar item to prevent unnecessary re-renders
const AvatarItem = React.memo(({ avatar, isSelected, onPress, colors }: any) => {
  const styles = useMemo(() => StyleSheet.create({
    item: {
      width: 64,
      height: 64,
      borderRadius: 32,
      borderWidth: 2,
      borderColor: isSelected ? colors.primary : colors.border,
      padding: 2,
      overflow: 'hidden',
    },
    img: {
      width: '100%',
      height: '100%',
      borderRadius: 28,
    },
  }), [isSelected, colors]);

  return (
    <TouchableOpacity
      key={avatar.id}
      onPress={onPress}
      style={styles.item}
      activeOpacity={0.7}
    >
      <Image 
        source={avatar.uri}
        style={styles.img}
      />
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: re-render only if avatar data changes or selection status changes
  return prevProps.avatar.id === nextProps.avatar.id && 
         prevProps.isSelected === nextProps.isSelected &&
         prevProps.colors === nextProps.colors;
});

AvatarItem.displayName = 'AvatarItem';

export const AvatarPicker = React.memo(({ 
  selectedAvatar, 
  onSelectAvatar, 
  colors 
}: AvatarPickerProps) => {
  // Memoize avatar list to prevent recreating on every render
  const memoizedAvatars = useMemo(() => AVATARS, []);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      gap: 12,
      paddingBottom: 8,
    },
  }), []);

  return (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false} 
      contentContainerStyle={styles.container}
      scrollEventThrottle={16}
    >
      {memoizedAvatars.map(av => (
        <AvatarItem
          key={av.id}
          avatar={av}
          isSelected={selectedAvatar === av.id}
          onPress={() => onSelectAvatar(av.id)}
          colors={colors}
        />
      ))}
    </ScrollView>
  );
}, (prevProps, nextProps) => {
  // Only re-render if selected avatar, colors, or callback changes
  return prevProps.selectedAvatar === nextProps.selectedAvatar &&
         prevProps.colors === nextProps.colors &&
         prevProps.onSelectAvatar === nextProps.onSelectAvatar;
});

AvatarPicker.displayName = 'AvatarPicker';
