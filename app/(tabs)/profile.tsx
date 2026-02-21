import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Image, StatusBar, Platform, Alert, Modal, TextInput } from 'react-native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { auth, db } from '../../config/firebaseConfig';
import { onAuthStateChanged, signOut, User, updateProfile } from 'firebase/auth';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import * as Notifications from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';
import Constants from 'expo-constants';

// Only set the handler if we're not in a restricted environment or if it's supported
if (Platform.OS !== 'android' || (Constants.appOwnership as any) !== 'expo-go') {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
        }),
    });
}

export default function ProfileScreen() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [isPremium, setIsPremium] = useState(false);
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [dailyReminderEnabled, setDailyReminderEnabled] = useState(false);
    const [counts, setCounts] = useState({ verses: 0, notes: 0, prayers: 0 });
    const [reminderTime, setReminderTime] = useState(new Date(new Date().setHours(7, 0, 0, 0))); // Default 7:00 AM
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editedName, setEditedName] = useState('');

    useFocusEffect(
        useCallback(() => {
            const fetchCounts = async () => {
                if (!user) {
                    setCounts({ verses: 0, notes: 0, prayers: 0 });
                    return;
                }
                try {
                    const versesSnap = await getDocs(collection(db, 'users', user.uid, 'saved_verses'));
                    const notesSnap = await getDocs(collection(db, 'users', user.uid, 'sermon_notes'));
                    const prayersSnap = await getDocs(collection(db, 'users', user.uid, 'saved_prayers'));

                    setCounts({
                        verses: versesSnap.size,
                        notes: notesSnap.size,
                        prayers: prayersSnap.size
                    });
                } catch (error) {
                    console.error("Error fetching archive counts: ", error);
                }
            };
            fetchCounts();
        }, [user])
    );

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return unsubscribe;
    }, []);

    const handleSignOut = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error('Error signing out: ', error);
        }
    };

    const requestNotificationPermissions = async () => {
        if (Platform.OS === 'android' && (Constants.appOwnership as any) === 'expo-go') {
            Alert.alert("Expo Go Limitation", "Daily reminders on Android require a standalone build. This feature will work in the final app!");
            return false;
        }
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert("Permission", "Please enable notifications in your phone settings to receive daily reminders.");
            return false;
        }
        return true;
    };

    const scheduleDailyReminder = async (time: Date) => {
        await Notifications.cancelAllScheduledNotificationsAsync();

        const trigger: Notifications.NotificationTriggerInput = {
            hour: time.getHours(),
            minute: time.getMinutes(),
            repeats: true,
            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        };

        await Notifications.scheduleNotificationAsync({
            content: {
                title: "☀️ Good Morning with Sanctify Plus",
                body: "Open your app for today's scripture and sermon insights.",
                sound: 'default',
            },
            trigger,
        });

        const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        Alert.alert("Reminder Set", `You will be notified every day at ${timeStr}.`);
    };

    const cancelDailyReminder = async () => {
        await Notifications.cancelAllScheduledNotificationsAsync();
    };

    const onTimeChange = (event: any, selectedDate?: Date) => {
        setShowTimePicker(Platform.OS === 'ios'); // Keep open on iOS until focus lost? No, just handle it.
        if (selectedDate) {
            setReminderTime(selectedDate);
            if (dailyReminderEnabled) {
                scheduleDailyReminder(selectedDate);
            }
        }
    };

    const handleUpdateProfile = async () => {
        if (!user || !editedName.trim()) return;

        try {
            // 1. Update Firebase Auth Profile
            await updateProfile(user, { displayName: editedName });

            // 2. Update Firestore document
            await updateDoc(doc(db, 'users', user.uid), {
                displayName: editedName
            });

            Alert.alert("Success", "Profile updated successfully!");
            setIsEditModalVisible(false);

            // Refresh local user state if needed, though onAuthStateChanged usually handles it
            // Manually forcing a refresh or just letting Auth handle it
        } catch (error) {
            console.error("Error updating profile: ", error);
            Alert.alert("Error", "Failed to update profile.");
        }
    };

    const openEditModal = () => {
        setEditedName(user?.displayName || '');
        setIsEditModalVisible(true);
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
            <Text style={[styles.sectionTitle, { fontSize: 28, marginTop: 20, marginBottom: 24 }]}>Profile</Text>

            {user ? (
                <View style={styles.profileSection}>
                    <View style={styles.avatarContainer}>
                        <Text style={styles.avatarText}>{user.email ? user.email.charAt(0).toUpperCase() : 'U'}</Text>
                    </View>
                    <View style={styles.profileInfo}>
                        <Text style={styles.profileName}>{user.displayName || 'Account'}</Text>
                        <Text style={styles.profileEmail}>{user.email}</Text>
                    </View>
                    <TouchableOpacity style={styles.editButton} onPress={openEditModal}>
                        <Text style={styles.editButtonText}>Edit</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <TouchableOpacity style={styles.profileSection} onPress={() => router.push('/auth')}>
                    <View style={styles.avatarContainer}>
                        <Ionicons name="person" size={24} color="#D4AF37" />
                    </View>
                    <View style={styles.profileInfo}>
                        <Text style={styles.profileName}>Sign In / Sign Up</Text>
                        <Text style={styles.profileEmail}>Access your saved prayers anywhere</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={24} color="#94A3B8" />
                </TouchableOpacity>
            )}

            {!isPremium && (
                <TouchableOpacity style={styles.premiumBanner} activeOpacity={0.9} onPress={() => router.push('/billing')}>
                    <LinearGradient
                        colors={['#1E293B', '#0F172A']}
                        style={styles.premiumGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <View style={styles.premiumContent}>
                            <View style={{ flex: 1, marginRight: 16 }}>
                                <Text style={styles.premiumTitle}>Sanctify Plus Premium <Ionicons name="sparkles" size={16} color="#D4AF37" /></Text>
                                <Text style={styles.premiumDesc}>Unlimited Deep Dives & Prayer Generations</Text>
                            </View>
                            <View style={styles.upgradeButton}>
                                <Text style={styles.upgradeText}>Upgrade</Text>
                            </View>
                        </View>
                    </LinearGradient>
                </TouchableOpacity>
            )}

            <Text style={styles.sectionTitle}>My Archive</Text>
            <View style={styles.cardGroup}>
                <TouchableOpacity style={styles.cardItem} onPress={() => router.push('/saved-verses')}>
                    <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
                        <Ionicons name="bookmark" size={20} color="#3B82F6" />
                    </View>
                    <Text style={styles.cardText}>Saved Verses</Text>
                    <Text style={styles.cardCount}>{counts.verses}</Text>
                    <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.cardItem} onPress={() => router.push('/sermon-notes')}>
                    <View style={[styles.iconBox, { backgroundColor: '#FEF3C7' }]}>
                        <MaterialIcons name="menu-book" size={20} color="#D97706" />
                    </View>
                    <Text style={styles.cardText}>Sermon Notes</Text>
                    <Text style={styles.cardCount}>{counts.notes}</Text>
                    <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.cardItem, styles.noBorder]} onPress={() => router.push('/saved-prayers')}>
                    <View style={[styles.iconBox, { backgroundColor: '#F3E8FF' }]}>
                        <MaterialIcons name="volunteer-activism" size={20} color="#9333EA" />
                    </View>
                    <Text style={styles.cardText}>Saved Prayers</Text>
                    <Text style={styles.cardCount}>{counts.prayers}</Text>
                    <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
                </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Preferences</Text>
            <View style={styles.cardGroup}>
                <View style={styles.cardItem}>
                    <View style={[styles.iconBox, { backgroundColor: '#F1F5F9' }]}>
                        <Ionicons name="notifications" size={20} color="#475569" />
                    </View>
                    <Text style={styles.cardText}>Push Notifications</Text>
                    <Switch
                        trackColor={{ false: "#CBD5E1", true: "#D4AF37" }}
                        thumbColor="#FFFFFF"
                        ios_backgroundColor="#CBD5E1"
                        onValueChange={(val) => {
                            setNotificationsEnabled(val);
                            Alert.alert("Preferences", val ? "Push notifications enabled!" : "Push notifications disabled.");
                        }}
                        value={notificationsEnabled}
                    />
                </View>

                <View style={[styles.cardItem, styles.noBorder, { flexDirection: 'column', alignItems: 'stretch' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={[styles.iconBox, { backgroundColor: '#F1F5F9' }]}>
                            <Ionicons name="time" size={20} color="#475569" />
                        </View>
                        <Text style={styles.cardText}>Daily Devotion Reminder</Text>
                        <Switch
                            trackColor={{ false: "#CBD5E1", true: "#D4AF37" }}
                            thumbColor="#FFFFFF"
                            ios_backgroundColor="#CBD5E1"
                            onValueChange={async (val) => {
                                if (val) {
                                    const granted = await requestNotificationPermissions();
                                    if (granted) {
                                        setDailyReminderEnabled(true);
                                        scheduleDailyReminder(reminderTime);
                                    } else {
                                        setDailyReminderEnabled(false);
                                    }
                                } else {
                                    setDailyReminderEnabled(false);
                                    cancelDailyReminder();
                                    Alert.alert("Reminder", "Daily reminder disabled.");
                                }
                            }}
                            value={dailyReminderEnabled}
                        />
                    </View>

                    {dailyReminderEnabled && (
                        <TouchableOpacity
                            style={{
                                marginTop: 12,
                                marginLeft: 52,
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: '#F8FAFC',
                                padding: 8,
                                borderRadius: 8,
                                alignSelf: 'flex-start'
                            }}
                            onPress={() => setShowTimePicker(true)}
                        >
                            <Ionicons name="alarm-outline" size={16} color="#D4AF37" style={{ marginRight: 6 }} />
                            <Text style={{ color: '#0A2242', fontWeight: '600' }}>
                                Scheduled for {reminderTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {showTimePicker && (
                        <DateTimePicker
                            value={reminderTime}
                            mode="time"
                            is24Hour={true}
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={onTimeChange}
                        />
                    )}
                </View>
            </View>

            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.cardGroup}>
                <TouchableOpacity style={styles.cardItem}>
                    <Text style={styles.cardText}>Restore Purchases</Text>
                    <Ionicons name="refresh" size={20} color="#94A3B8" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.cardItem} onPress={() => Alert.alert("Privacy Policy", "Our privacy policy ensures your data is safe and never shared. We only store your saved verses and prayers in our encrypted database.")}>
                    <Text style={styles.cardText}>Privacy Policy</Text>
                    <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
                </TouchableOpacity>
                {user ? (
                    <TouchableOpacity style={[styles.cardItem, styles.noBorder]} onPress={handleSignOut}>
                        <Text style={[styles.cardText, { color: '#EF4444' }]}>Sign Out</Text>
                        <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={[styles.cardItem, styles.noBorder]} onPress={() => router.push('/auth')}>
                        <Text style={[styles.cardText, { color: '#0A2242' }]}>Sign In</Text>
                        <Ionicons name="log-in-outline" size={20} color="#0A2242" />
                    </TouchableOpacity>
                )}
            </View>

            <View style={{ height: 40 }} />

            {/* Edit Profile Modal */}
            <Modal
                visible={isEditModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsEditModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Edit Profile</Text>

                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>Full Name</Text>
                            <TextInput
                                style={styles.textInput}
                                value={editedName}
                                onChangeText={setEditedName}
                                placeholder="Enter your name"
                                placeholderTextColor="#94A3B8"
                            />
                        </View>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setIsEditModalVisible(false)}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.saveButton]}
                                onPress={handleUpdateProfile}
                            >
                                <Text style={styles.saveButtonText}>Save Changes</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC', // Very light cool gray
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 30,
    },
    backButton: {
        padding: 8,
        marginLeft: -8,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0A2242',
    },
    profileSection: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: 20,
        borderRadius: 20,
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 2,
    },
    avatarContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#020C17', // Deep navy
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    avatarText: {
        color: '#D4AF37', // Gold text
        fontSize: 28,
        fontWeight: '700',
    },
    profileInfo: {
        flex: 1,
    },
    profileName: {
        fontSize: 22,
        fontWeight: '700',
        color: '#0A2242',
        marginBottom: 4,
    },
    profileEmail: {
        fontSize: 14,
        color: '#64748B',
    },
    editButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#F1F5F9',
        borderRadius: 16,
    },
    editButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#0A2242',
    },
    premiumBanner: {
        borderRadius: 20,
        overflow: 'hidden',
        marginBottom: 30,
        shadowColor: '#D4AF37',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 5,
    },
    premiumGradient: {
        padding: 24,
    },
    premiumContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    premiumTitle: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 6,
    },
    premiumDesc: {
        color: '#94A3B8',
        fontSize: 13,
    },
    upgradeButton: {
        backgroundColor: '#D4AF37',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 16,
    },
    upgradeText: {
        color: '#020C17',
        fontWeight: '700',
        fontSize: 14,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0A2242',
        marginBottom: 12,
        marginLeft: 4,
    },
    cardGroup: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        paddingHorizontal: 16,
        marginBottom: 30,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 10,
        elevation: 2,
    },
    cardItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 18,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    noBorder: {
        borderBottomWidth: 0,
    },
    iconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    cardText: {
        flex: 1,
        fontSize: 16,
        fontWeight: '500',
        color: '#334155',
    },
    cardCount: {
        fontSize: 16,
        fontWeight: '600',
        color: '#94A3B8',
        marginRight: 10,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
        width: '100%',
        maxWidth: 400,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0A2242',
        marginBottom: 20,
        textAlign: 'center',
    },
    inputContainer: {
        marginBottom: 24,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748B',
        marginBottom: 8,
        marginLeft: 4,
    },
    textInput: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        color: '#0A2242',
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    modalButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButton: {
        backgroundColor: '#F1F5F9',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#64748B',
    },
    saveButton: {
        backgroundColor: '#D4AF37',
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#020C17',
    }
});
