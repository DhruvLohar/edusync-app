import React, { useState } from 'react';
import {
    SafeAreaView,
    View,
    Text,
    StatusBar,
    TouchableOpacity,
    StyleSheet,
    Image,
} from 'react-native';
import { useRouter } from 'expo-router';

type UserRole = 'teacher' | 'student' | null;

export const RoleSelectionScreen = () => {
    const router = useRouter();
    const [selectedRole, setSelectedRole] = useState<UserRole>(null);

    const handleRoleSelection = (role: UserRole) => {
        setSelectedRole(role);
        if (role === 'teacher' || role === 'student') {
            router.push(`/(auth)/register/${role}`);
        }
    };
    
    const handleVisualSelection = (role: UserRole) => {
        setSelectedRole(role);
    };

    return (
        <SafeAreaView style={registerStyles.safeArea}>
            <StatusBar barStyle="dark-content" />

            <View style={registerStyles.container}>
                <View>
                    <Image
                        source={require('../../../assets/logo.png')}
                        style={registerStyles.logoImage}
                    />

                    <Text style={registerStyles.welcomeText}>Welcome</Text>
                    <Text style={registerStyles.appNameText}>
                        To <Text style={registerStyles.eduSyncHighlight}>EduSync</Text>
                    </Text>
                    <Text style={registerStyles.taglineText}>Choose your role to get started</Text>
                </View>

                <View style={registerStyles.rolesContainer}>
                    <TouchableOpacity
                        style={[
                            registerStyles.roleCard,
                            selectedRole === 'teacher' && registerStyles.selectedRoleCard,
                        ]}
                        onPress={() => handleRoleSelection('teacher')}
                        onFocus={() => handleVisualSelection('teacher')}
                        activeOpacity={0.7}
                    >
                        {selectedRole === 'teacher' && <View style={registerStyles.selectedRoleIndicator} />}
                        <View style={registerStyles.roleCardContent}>
                            <View style={registerStyles.roleIconPlaceholder} />
                            <View style={registerStyles.roleTextContainer}>
                                <Text style={registerStyles.roleTitle}>I'm a Teacher</Text>
                                <Text style={registerStyles.roleDescription}>
                                    Manage classes and track students attendance
                                </Text>
                            </View>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            registerStyles.roleCard,
                            selectedRole === 'student' && registerStyles.selectedRoleCard,
                        ]}
                        onPress={() => handleRoleSelection('student')}
                        onFocus={() => handleVisualSelection('student')}
                        activeOpacity={0.7}
                    >
                        {selectedRole === 'student' && <View style={registerStyles.selectedRoleIndicator} />}
                        <View style={registerStyles.roleCardContent}>
                            <View style={registerStyles.roleIconPlaceholder} />
                            <View style={registerStyles.roleTextContainer}>
                                <Text style={registerStyles.roleTitle}>I'm a Student</Text>
                                <Text style={registerStyles.roleDescription}>
                                    Register for face-based attendance system
                                </Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                </View>

                <View style={registerStyles.loginLinkContainer}>
                    <Text style={registerStyles.loginText}>Already have an account?</Text>
                    <TouchableOpacity onPress={() => router.push('/(auth)')}>
                        <Text style={registerStyles.loginLink}>Login</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
};

const registerStyles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    container: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 100,
        justifyContent: 'space-between', 
    },
    logoImage: {
        width: 80,
        height: 80,
        resizeMode: 'contain',
        marginBottom: 20,

    },
    welcomeText: {
        fontSize: 32,
        color: '#000',
        fontWeight: 'normal',
        marginBottom: 0,
        fontFamily: 'Poppins_600SemiBold',
    },
    appNameText: {
        fontSize: 32,
        color: '#000',
        fontWeight: 'bold',
        marginBottom: 10,
        fontFamily: 'Poppins_600SemiBold',
    },
    eduSyncHighlight: {
        color: '#1E90FF',
        fontFamily: 'Poppins_600SemiBold',
    },
    taglineText: {
        fontSize: 16,
        color: '#777',
        fontFamily: 'Poppins_400Regular',
    },
    rolesContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        gap: 20,
        paddingBottom: 40,
        marginTop: -80,
    },
    roleCard: {
        flexDirection: 'row',
        backgroundColor: '#F7F8FA',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        paddingVertical: 15,
        paddingLeft: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 3,
        overflow: 'hidden',
        position: 'relative',
    },
    selectedRoleCard: {
        borderColor: '#1E90FF',
        backgroundColor: '#E8F2FF',
    },
    selectedRoleIndicator: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 8,
        backgroundColor: '#1E90FF',
        borderRadius: 12,
        borderTopRightRadius: 0,
        borderBottomRightRadius: 0,
    },
    roleCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        paddingLeft: 10,
    },
    roleIconPlaceholder: {
        width: 50,
        height: 50,
        backgroundColor: '#E0E0E0',
        borderRadius: 8,
        marginRight: 15,
    },
    roleTextContainer: {
        flex: 1,
    },
    roleTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        fontFamily: 'Poppins_600SemiBold',
        marginBottom: 5,
    },
    roleDescription: {
        fontSize: 13,
        color: '#666',
        fontFamily: 'Poppins_400Regular',
    },
    loginLinkContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 20,
    },
    loginText: {
        color: '#555',
        fontSize: 16,
        fontFamily: 'Poppins_400Regular',
    },
    loginLink: {
        color: '#1E90FF',
        fontSize: 16,
        fontFamily: 'Poppins_600SemiBold',
        marginLeft: 5,
    },
});

export default RoleSelectionScreen;