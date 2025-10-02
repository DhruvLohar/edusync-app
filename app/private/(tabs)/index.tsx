import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  ToastAndroid,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useAuthStore } from '~/lib/store/auth.store';
import { postToAPI } from '~/lib/api';


export default function DashboardScreen() {

  const { profile } = useAuthStore();

  return (
    <View className="flex-1 bg-gradient-to-br from-blue-50 to-indigo-100">
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      <Text>Dashboard Screen</Text>
    </View>
  );
}
