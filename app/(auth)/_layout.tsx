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