import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ListRenderItem, TouchableOpacity, Switch, Alert, Dimensions } from 'react-native';
import { SharedValue } from 'react-native-reanimated';
import { Attendance } from '~/type/Teacher';
import { User } from '~/type/user';
import { UserType } from '~/type/user';

import io, { Socket } from 'socket.io-client';
import { API_URL } from '~/lib/api';

// --- TYPE DEFINITIONS ---
interface AttendanceListProps {
  isScanning: boolean;
  isSessionActive: boolean;
  onEndSession: () => void;
  sheetY?: SharedValue<number> | null;
  attendance?: Attendance | null;
  students?: User[];
}

interface MarkedStudent extends User {
  markedAt: string;
}

// // Dummy students for demo when no course/students are passed
// const DUMMY_STUDENTS: User[] = [
//   { id: 1, name: 'Aarav Sharma', email: 'aarav@example.com', user_type: UserType.student, is_active: true, onboarding_done: true, created_at: new Date(), updated_at: new Date() },
//   { id: 2, name: 'Priya Patel', email: 'priya@example.com', user_type: UserType.student, is_active: true, onboarding_done: true, created_at: new Date(), updated_at: new Date() },
//   { id: 3, name: 'Rahul Kumar', email: 'rahul@example.com', user_type: UserType.student, is_active: true, onboarding_done: true, created_at: new Date(), updated_at: new Date() },
//   { id: 4, name: 'Sneha Reddy', email: 'sneha@example.com', user_type: UserType.student, is_active: true, onboarding_done: true, created_at: new Date(), updated_at: new Date() },
//   { id: 5, name: 'Vikram Singh', email: 'vikram@example.com', user_type: UserType.student, is_active: true, onboarding_done: true, created_at: new Date(), updated_at: new Date() },
//   { id: 6, name: 'Ananya Nair', email: 'ananya@example.com', user_type: UserType.student, is_active: true, onboarding_done: true, created_at: new Date(), updated_at: new Date() },
//   { id: 7, name: 'Arjun Mehta', email: 'arjun@example.com', user_type: UserType.student, is_active: true, onboarding_done: true, created_at: new Date(), updated_at: new Date() },
//   { id: 8, name: 'Kavya Iyer', email: 'kavya@example.com', user_type: UserType.student, is_active: true, onboarding_done: true, created_at: new Date(), updated_at: new Date() },
//   { id: 9, name: 'Rajesh Kumar', email: 'rajesh@example.com', user_type: UserType.student, is_active: true, onboarding_done: true, created_at: new Date(), updated_at: new Date() },
//   { id: 10, name: 'Sneha Reddy', email: 'sneha@example.com', user_type: UserType.student, is_active: true, onboarding_done: true, created_at: new Date(), updated_at: new Date() },
// ];

const AttendanceList: React.FC<AttendanceListProps> = ({ 
  isScanning, 
  isSessionActive, 
  onEndSession, 
  sheetY, 
  attendance, 
  students 
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  // // Use passed students or fall back to dummy list
  // const studentSource = students && students.length > 0 ? students : DUMMY_STUDENTS;

  // Initialize all students as pending
  // const [pendingStudents, setPendingStudents] = useState<User[]>(studentSource);
  // const [markedStudents, setMarkedStudents] = useState<MarkedStudent[]>([]);

  // const [activeTab, setActiveTab] = useState<'present' | 'pending'>('present');

  // // Sync pending students when students prop changes; use dummy list when none passed
  // useEffect(() => {
  //   setPendingStudents(students && students.length > 0 ? students : DUMMY_STUDENTS);
  // }, [students]);
  const [pendingStudents, setPendingStudents] = useState<User[]>(students || []);
  const [markedStudents, setMarkedStudents] = useState<MarkedStudent[]>([]);

  const [activeTab, setActiveTab] = useState<'present' | 'pending'>('present');

  // Initialize pending students when students prop changes
  useEffect(() => {
    if (students && students.length > 0) {
      setPendingStudents(students);
    }
  }, [students]);

  useEffect(() => {
    // Connect to Socket.IO
    const newSocket = io(API_URL, {
      extraHeaders: {
        token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJUeXBlIjoidGVhY2hlciIsImlhdCI6MTc2MTY4MTYwOSwiZXhwIjoxNzYxOTQwODA5fQ.h3yhAIuMqvbpkcDggAiRtJaifkAgOi3rRYYj61VFQK8"
      }
    });

    setSocket(newSocket);

    // Connection events
    newSocket.on('connect', () => {
      setConnected(true);
      console.log('✅ Connected to server');
      
      // Auto-join attendance on connection if live_id exists
      if (attendance?.live_id) {
        newSocket.emit('join_attendance', { live_id: attendance.live_id });
        console.log(`📤 Auto-joining attendance with live_id: ${attendance.live_id}`);
      }
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
      console.log('❌ Disconnected from server');
    });

    // Attendance session events
    newSocket.on('joined_attendance', (data) => {
      console.log(`✅ Joined attendance session: ${data.live_id}`);
    });

    newSocket.on('student_joined', (data) => {
      console.log(`👤 Student joined: ${data.student.name}`);
    });

    newSocket.on('student_marked_present', (data) => {
      console.log(`✓ Student marked present: ${data.student.name}`);
      const studentId = data.student.id;
      const markedAt = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      setPendingStudents(prev => prev.filter(s => s.id !== studentId));
      setMarkedStudents(prev =>
        prev.some(m => m.id === studentId)
          ? prev
          : [...prev, { ...data.student, markedAt }]
      );
    });

    newSocket.on('error', (data) => {
      console.log(`❌ Error: ${data.message}`);
      Alert.alert('Error', data.message);
    });

    // Cleanup on unmount
    return () => {
      newSocket.disconnect();
    };
  }, [attendance?.live_id]);


  // --- Scanning View (Initial State) ---
  if (isScanning && !isSessionActive) {
    return (
      <View
        className="w-full bg-white items-center justify-center"
        style={{ minHeight: 160, borderTopLeftRadius: 40, borderTopRightRadius: 40 }}
      >
        <Text className="text-xl font-medium text-gray-700">
          Scanning for students...
        </Text>
      </View>
    );
  }

  // --- Active Session View ---
  if (isSessionActive) {
    // Render items for PRESENT students
    const renderPresentItem: ListRenderItem<MarkedStudent> = ({ item }) => (
      <View className="flex-row justify-between items-center py-3 px-4 border-b border-gray-100">
        <View className="flex-row items-center">
          <View className="w-4 h-4 rounded-full bg-green-500 mr-3" />
          <Text className="text-base font-semibold text-gray-800">{item.name}</Text>
        </View>
        <Text className="text-sm text-gray-500">{item.markedAt}</Text>
      </View>
    );

    // Render items for PENDING students
    const renderPendingItem: ListRenderItem<User> = ({ item }) => (
      <View className="flex-row justify-between items-center py-3 px-4 border-b border-gray-100">
        <View className="flex-row items-center">
          <View className="w-4 h-4 rounded-full bg-gray-300 mr-3" />
          <Text className="text-base font-semibold text-gray-800">{item.name}</Text>
        </View>
        <View className="flex-row items-center space-x-2">
          <TouchableOpacity
            onPress={() => {
              const studentId = item.id;
              const markedAt = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
              setPendingStudents(prev => prev.filter(s => s.id !== studentId));
              setMarkedStudents(prev => [...prev, { ...item, markedAt }]);
              if (socket && attendance?.live_id) {
                socket.emit('manual_mark_student', {
                  live_id: attendance.live_id,
                  student_id: studentId,
                });
                console.log(`📤 Manually marking student: ${item.name} (ID: ${studentId})`);
              }
            }}
            className="px-3 py-1 rounded-full"
            style={{ backgroundColor: '#0095FF' }}
          >
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }}>
              Mark
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );

    return (
      <View
        className="w-full bg-white"
        style={{ flex: 1, minHeight: 320, borderTopLeftRadius: 40, borderTopRightRadius: 40 }}
      >
        {/* Live Attendance Header */}
        <Text className="text-xl text-center text-gray-800 px-4 pb-2 pt-2" style={{ fontFamily: 'Poppins_600SemiBold' }}>Live Attendance</Text>

        {/* Tab Navigation */}
        <View className="flex-row justify-between px-20 pb-0 pt-2 mt-2">
          {/* Present Tab */}
          <TouchableOpacity
            onPress={() => setActiveTab('present')}
            className="mr-6 pb-2"
            style={{ borderBottomWidth: activeTab === 'present' ? 2 : 0, borderBottomColor: '#0095FF' }}
          >
            <Text className={`text-lg ${activeTab === 'present' ? 'text-[#0095FF]' : 'text-gray-500'}`} style={{ fontFamily: 'Poppins_400Regular' }}>
              Present ({markedStudents.length})
            </Text>
          </TouchableOpacity>
          {/* Pending Tab */}
          <TouchableOpacity
            onPress={() => setActiveTab('pending')}
            className="pb-2"
            style={{ borderBottomWidth: activeTab === 'pending' ? 2 : 0, borderBottomColor: '#0095FF' }}
          >
            <Text className={`text-lg ${activeTab === 'pending' ? 'text-[#0095FF]' : 'text-gray-500'}`} style={{ fontFamily: 'Poppins_400Regular' }}>
              Pending ({pendingStudents.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Student List - fixed maxHeight so FlatList has bounded height and scrolls */}
        <View style={{ flex: 1, maxHeight: Dimensions.get('window').height * 0.55, minHeight: 180 }}>
          {activeTab === 'present' ? (
            <FlatList
              data={markedStudents}
              renderItem={renderPresentItem}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{ paddingBottom: 120 }}
              showsVerticalScrollIndicator={true}
              ListEmptyComponent={
                <View className="items-center justify-center py-10">
                  <Text className="text-gray-400 text-base">No students marked present yet</Text>
                </View>
              }
            />
          ) : (
            <FlatList
              data={pendingStudents}
              renderItem={renderPendingItem}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{ paddingBottom: 120 }}
              showsVerticalScrollIndicator={true}
              ListEmptyComponent={
                <View className="items-center justify-center py-10">
                  <Text className="text-gray-400 text-base">All students marked present!</Text>
                </View>
              }
            />
          )}
        </View>

        {/* Floating End Session Button */}
        <View className=" absolute bottom-10 w-full items-center z-20">
          <TouchableOpacity
            onPress={onEndSession}
            className="w-[80%] h-16 bg-[#0095FF] rounded-full items-center justify-center shadow-md">
            <Text className="text-xl font-bold text-white">End Session</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return null;
};

export default AttendanceList;