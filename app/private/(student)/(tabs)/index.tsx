import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StatusBar,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';

import { fetchFromAPI } from '~/lib/api';
import { renderAPIImage } from '~/lib/ImageChecker';
import AttendanceOverview from '~/components/custom/studentHome/AttendanceOverview';
import TodaysLecture from '~/components/custom/studentHome/AttendanceHistory';
import LectureCards from '~/components/custom/studentHome/LectureCards';
import { BottomModal } from '~/components/ui/BottomModal';
import type { AttendanceRecord } from '~/type/Student';
import { SafeAreaView } from 'react-native-safe-area-context';


// --- MAIN SCREEN COMPONENT ---
const StudentHomeScreen: React.FC = () => {
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [isAttendanceModalVisible, setIsAttendanceModalVisible] = useState(false);


  // --- ADDED: Fetch attendance history from backend ---
  useEffect(() => {
    const fetchHistory = async () => {
      const res = await fetchFromAPI<{ records: AttendanceRecord[] }>('/students/history');
      if (res && res.success && res.data && Array.isArray(res.data.records)) {
        setHistory(res.data.records);
      } else {
        setHistory([]);
      }
    };
    fetchHistory();
  }, []);
  // --- END ADDED ---

  // --- ADDED: Fetch student profile on mount ---
  useEffect(() => {
    const fetchProfile = async () => {
      const res = await fetchFromAPI<any>('/users/profile');
      if (res && res.success && res.data) {
        setProfile(res.data);
      } else {
        setProfile(null);
      }
    };
    fetchProfile();
  }, []);
  // --- END ADDED ---

  return (
    <SafeAreaView className="flex-1">
      <StatusBar barStyle="dark-content" />

      <ScrollView
        className="flex-1 mt-5 bg-[#D3EDFF]"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header (Greeting & Settings Icon) */}
        <View className="w-full px-5 flex-row justify-between items-center py-4 mt-8">

          <View className="flex-1 ml-4">
            <Text
              className="text-xl text-gray-600 mb-1"
              style={{ fontFamily: 'Poppins_400Regular' }}
            >
              Good Morning,
            </Text>
            <Text
              className="text-3xl text-gray-900"
              style={{ fontFamily: 'Poppins_600SemiBold' }}
            >
              {profile?.name || 'Student'}
            </Text>
          </View>
          {profile && profile.profile_photo ? (
            <Image
              source={{ uri: renderAPIImage(profile.profile_photo) }}
              className="w-24 h-24 rounded-full border-4 border-white shadow-md mb-2"
              style={{ width: 64, height: 64, borderRadius: 48, marginBottom: 8 }}
            />
          ) : (
            <View className="w-24 h-24 rounded-full bg-gray-300 border-4 border-white shadow-md mb-2" />
          )}
        </View>
        <View className="px-5 mt-6 mb-6">
          <TouchableOpacity
            onPress={() => setIsAttendanceModalVisible(true)}
            className="w-full bg-[#0095FF] rounded-full py-4 items-center justify-center"
            activeOpacity={0.7}
          >
            <View className="flex-row items-center gap-2">
              <Text
                className="text-lg text-white font-semibold"
                style={{ fontFamily: 'Poppins_600SemiBold' }}
              >
                Give Attendance
              </Text>
            </View>
          </TouchableOpacity>
        </View>
        <View className='bg-white rounded-t-[50px] p-4 mt-5'>
          <AttendanceOverview history={history} />
          <TodaysLecture history={history} />
        </View>
      </ScrollView>

      {/* Bottom Sheet Modal for Attendance */}
      <BottomModal
        isVisible={isAttendanceModalVisible}
        onClose={() => setIsAttendanceModalVisible(false)}
      >
        <View className="mb-4 px-4">
          <Text
            className="text-2xl text-gray-900 mt-4"
            style={{ fontFamily: 'Poppins_600SemiBold' }}
          >
            Ongoing Lecture
          </Text>
        </View>
        <LectureCards />
      </BottomModal>
    </SafeAreaView>
  );
};

// --- STYLING ---
const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
});

export default StudentHomeScreen;