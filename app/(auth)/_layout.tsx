import { Stack } from 'expo-router';

export default function AuthLayout() {
    return (
        <Stack>
            {/* Login Screen (app/(auth)/index.tsx) */}
            <Stack.Screen
                name="index"
                options={{
                    title: 'Login',
                    headerShown: false
                }}
            />
            
            {/* Role Selection Screen (app/(auth)/register/index.tsx) */}
            {/* The name 'register' refers to the folder. */}
            <Stack.Screen
                name="register/index"
                options={{
                    title: 'Create Account',
                    headerShown: false // Role selection page also hides the header
                }}
            />
            
            {/* Teacher Registration Screen (app/(auth)/register/teacher.tsx) */}
            <Stack.Screen
                name="register/teacher"
                options={{
                    title: 'Teacher Sign Up',
                    headerShown: false // Hide header for full screen form
                }}
            />

            {/* Student Registration Screen (app/(auth)/register/student.tsx) */}
            <Stack.Screen
                name="register/student"
                options={{
                    title: 'Student Sign Up',
                    headerShown: false // Hide header for full screen form
                }}
            />
        </Stack>
    );
}