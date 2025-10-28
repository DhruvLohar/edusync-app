import { useAuthStore } from "~/lib/store/auth.store";

export default function WithUser({
    children,
    role,
    matchType = 'equals'
}: {
    children: React.ReactNode,
    role: string | null,
    matchType?: 'equals' | 'notEquals'
}) {
    const { profile } = useAuthStore();



    // if (profile) {
        if (!profile) {
        const isMatch = matchType === 'equals'
            ? "student" === role
            // ? profile.user_type === role
            // : profile.user_type !== role;
        : "student" !== role;

        if (isMatch) {
            return children;
        }
    }
    return null;
}