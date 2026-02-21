import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

const LIMIT = 3;

interface UsageData {
    count: number;
    lastUsed: string; // ISO date string without time
}

export const checkAndUpdateUsage = async (uid: string, featureType: 'prayer' | 'deepDive'): Promise<boolean> => {
    try {
        const userRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);
        // Get strictly local date string (YYYY-MM-DD)
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayDate = `${year}-${month}-${day}`;
        if (userSnap.exists()) {
            const data = userSnap.data();

            // If user is premium, always allow
            if (data.isPremium) {
                return true;
            }

            const usageData: UsageData = data[`${featureType}Usage`] || { count: 0, lastUsed: '' };

            if (usageData.lastUsed !== todayDate) {
                // First use today, reset and allow
                await updateDoc(userRef, {
                    [`${featureType}Usage`]: { count: 1, lastUsed: todayDate }
                });
                return true;
            } else if (usageData.count < LIMIT) {
                // Used today but under limit, increment and allow
                await updateDoc(userRef, {
                    [`${featureType}Usage`]: { count: usageData.count + 1, lastUsed: todayDate }
                });
                return true;
            } else {
                // Limit reached
                return false;
            }
        } else {
            // User document doesn't exist, create it with initial usage
            // Although it should exist from signup, handle edge case securely
            await setDoc(userRef, {
                uid: uid,
                isPremium: false,
                [`${featureType}Usage`]: { count: 1, lastUsed: todayDate }
            }, { merge: true });
            return true;
        }
    } catch (error) {
        console.error("Usage tracking error:", error);
        // Better error handling depending on requirements. In a real app we might reject on DB failure or allow as fail-open.
        // Failing open briefly to prevent frustrating real users in this edge case:
        return true;
    }
};
