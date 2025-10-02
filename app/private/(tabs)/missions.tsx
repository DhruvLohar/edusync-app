import React, { useState, useEffect } from 'react';
import { 
    View, 
    Text, 
    ScrollView, 
    TouchableOpacity, 
    StatusBar,
    Dimensions,
    ActivityIndicator,
    RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchFromAPI, postToAPI } from '~/lib/api';

// Types
interface Mission {
    id: string;
    title: string;
    description: string;
    difficulty: 'easy' | 'medium' | 'hard';
    rewardXp: number;
    icon: string;
    type: 'daily' | 'personalized';
    progress?: number;
    maxProgress?: number;
    isCompleted?: boolean;
    userMissionId?: string | null;
    goalMinutes?: number;
    category?: string;
}

// Components
const MissionCard = ({ mission, onStart }: { mission: Mission; onStart: (id: string) => void }) => {
    const getDifficultyColor = (difficulty: string) => {
        switch (difficulty) {
            case 'easy': return 'bg-green-100 text-green-700';
            case 'medium': return 'bg-yellow-100 text-yellow-700';
            case 'hard': return 'bg-red-100 text-red-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const progressPercentage = mission.progress && mission.maxProgress 
        ? (mission.progress / mission.maxProgress) * 100 
        : 0;

    return (
        <TouchableOpacity 
            className={`bg-white p-5 rounded-3xl shadow-sm border border-gray-100 mb-4 ${
                mission.isCompleted ? 'opacity-75' : ''
            }`}
            onPress={() => !mission.isCompleted && onStart(mission.id)}
            disabled={mission.isCompleted}
        >
            <View className="flex-row items-start justify-between mb-3">
                <View className="flex-row items-center flex-1">
                    <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 ${
                        mission.isCompleted ? 'bg-green-500' : 'bg-blue-100'
                    }`}>
                        {mission.isCompleted ? (
                            <Ionicons name="checkmark" size={20} color="white" />
                        ) : (
                            <Ionicons name={mission.icon as any} size={20} color="#3B82F6" />
                        )}
                    </View>
                    <View className="flex-1">
                        <Text className="text-lg font-bold text-gray-800 mb-1">{mission.title}</Text>
                        <Text className="text-sm text-gray-600">{mission.description}</Text>
                    </View>
                </View>
                <View className="items-end">
                    <View className={`px-3 py-1 rounded-full ${getDifficultyColor(mission.difficulty)}`}>
                        <Text className="text-xs font-medium">{mission.difficulty}</Text>
                    </View>
                </View>
            </View>

            {mission.type === 'personalized' && mission.progress !== undefined && mission.maxProgress && (
                <View className="mb-3">
                    <View className="flex-row justify-between items-center mb-2">
                        <Text className="text-sm font-medium text-gray-600">Progress</Text>
                        <Text className="text-sm font-medium text-gray-600">
                            {mission.progress}/{mission.maxProgress} {(mission.goalMinutes && mission.goalMinutes > 60) ? 'minutes' : 'units'}
                        </Text>
                    </View>
                    <View className="w-full bg-gray-200 rounded-full h-2">
                        <View 
                            className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-300" 
                            style={{ width: `${progressPercentage}%` }} 
                        />
                    </View>
                </View>
            )}

            <View className="flex-row justify-between items-center">
                <View className="flex-row items-center">
                    <Ionicons name="time-outline" size={16} color="#6B7280" />
                    <Text className="text-sm text-gray-500 ml-1">
                        {mission.goalMinutes ? `${mission.goalMinutes} min` : 'Ongoing'}
                    </Text>
                </View>
                <View className="flex-row items-center">
                    <Ionicons name="star-outline" size={16} color="#F59E0B" />
                    <Text className="text-sm font-medium text-gray-700 ml-1">{mission.rewardXp} XP</Text>
                </View>
            </View>
        </TouchableOpacity>
    );
};

export default function MissionsScreen() {

    return (
        <View className="flex-1 bg-gradient-to-br from-blue-50 to-indigo-100">
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

            <Text>Missions Screen</Text>
        </View>
    );
}
