import * as React from 'react';
import { useEffect, useState } from 'react';
import { 
    View, 
    Text, 
    TouchableOpacity, 
    ScrollView, 
    StatusBar 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PieChart, BarChart, LineChart } from '~/components/custom/charts';
import type { 
    PieChartDataItem, 
    BarChartData, 
    LineChartData 
} from '~/components/custom/charts';
import { fetchFromAPI } from '~/lib/api';
import { analyticsCache, cacheManager } from '~/lib/cache';

export default function AnalyticsScreen() {

    return (
        <View className="flex-1 bg-gradient-to-br from-blue-50 to-indigo-100">
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
            
            <Text>Analytics Screen</Text>
        </View>
    );
}
