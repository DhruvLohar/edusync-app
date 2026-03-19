import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Modal from 'react-native-modal';
import { Ionicons } from '@expo/vector-icons';

interface ExitConfirmSheetProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
}

export default function ExitConfirmSheet({
  visible,
  onCancel,
  onConfirm,
  title,
  message,
  confirmText = 'Yes, Exit',
}: ExitConfirmSheetProps) {
  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onCancel}
      onBackButtonPress={onCancel}
      style={{ justifyContent: 'flex-end', margin: 0 }}
      backdropOpacity={0.4}
      animationIn="slideInUp"
      animationOut="slideOutDown"
    >
      <View className="bg-white rounded-t-3xl px-6 pt-6 pb-10">
        <View className="w-10 h-1 bg-gray-300 rounded-full self-center mb-5" />

        <View className="items-center mb-4">
          <View className="w-14 h-14 rounded-full bg-red-50 items-center justify-center mb-3">
            <Ionicons name="warning-outline" size={28} color="#ef4444" />
          </View>
          <Text className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Poppins_600SemiBold' }}>
            {title}
          </Text>
        </View>

        <Text className="text-center text-gray-500 text-sm mb-6 leading-5" style={{ fontFamily: 'Poppins_400Regular' }}>
          {message}
        </Text>

        <TouchableOpacity
          onPress={onConfirm}
          className="bg-red-500 py-4 rounded-xl items-center mb-3"
          activeOpacity={0.8}
        >
          <Text className="text-white font-semibold text-base" style={{ fontFamily: 'Poppins_600SemiBold' }}>
            {confirmText}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onCancel}
          className="bg-gray-100 py-4 rounded-xl items-center"
          activeOpacity={0.8}
        >
          <Text className="text-gray-700 font-semibold text-base" style={{ fontFamily: 'Poppins_600SemiBold' }}>
            Stay Here
          </Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}
