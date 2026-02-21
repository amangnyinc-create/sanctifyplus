import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db } from '../config/firebaseConfig';
import { collection, query, orderBy, getDocs, doc, deleteDoc } from 'firebase/firestore';

export default function SavedPrayersScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [prayers, setPrayers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPrayers = async () => {
            if (!auth.currentUser) {
                setLoading(false);
                return;
            }
            try {
                const q = query(
                    collection(db, 'users', auth.currentUser.uid, 'saved_prayers'),
                    orderBy('savedAt', 'desc')
                );
                const querySnapshot = await getDocs(q);
                const fetchedPrayers: any[] = [];
                querySnapshot.forEach((doc) => {
                    fetchedPrayers.push({ id: doc.id, ...doc.data() });
                });
                setPrayers(fetchedPrayers);
            } catch (error) {
                console.error("Error fetching prayers: ", error);
            } finally {
                setLoading(false);
            }
        };

        fetchPrayers();
    }, []);

    const handleDelete = (id: string) => {
        Alert.alert(
            "Delete Prayer",
            "Are you sure you want to delete this prayer?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        if (!auth.currentUser) return;
                        try {
                            await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'saved_prayers', id));
                            setPrayers(prayers.filter(p => p.id !== id));
                        } catch (error) {
                            console.error("Error deleting prayer: ", error);
                            Alert.alert("Error", "Failed to delete prayer.");
                        }
                    }
                }
            ]
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#020C17" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Saved Prayers</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {loading ? (
                    <ActivityIndicator size="large" color="#D4AF37" style={{ marginTop: 50 }} />
                ) : prayers.length === 0 ? (
                    <View style={styles.emptyState}>
                        <MaterialIcons name="volunteer-activism" size={64} color="#CBD5E1" />
                        <Text style={styles.emptyTitle}>No prayers saved</Text>
                        <Text style={styles.emptyDesc}>Keep track of your deep dives and personalized prayers right here.</Text>
                    </View>
                ) : (
                    prayers.map((prayer) => (
                        <View key={prayer.id} style={styles.card}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <View style={styles.badgeContainer}>
                                    <Text style={styles.badgeText}>{prayer.theme || 'PRAYER'}</Text>
                                </View>
                                <TouchableOpacity onPress={() => handleDelete(prayer.id)} style={{ padding: 4 }}>
                                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.titleText}>{prayer.title}</Text>
                            <View style={styles.divider} />
                            <Text style={styles.bodyText}>"{prayer.body}"</Text>
                            <Text style={styles.amenText}>{prayer.amen}</Text>
                        </View>
                    ))
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 20,
        paddingTop: 10,
    },
    backButton: {
        padding: 8,
        marginLeft: -8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#020C17',
    },
    content: {
        flexGrow: 1,
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#334155',
        marginTop: 16,
        marginBottom: 8,
    },
    emptyDesc: {
        fontSize: 15,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: 20,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 24,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    badgeContainer: {
        alignSelf: 'flex-start',
        backgroundColor: '#F3E8FF',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        marginBottom: 12,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#9333EA',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    titleText: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 4,
    },
    divider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginVertical: 16,
    },
    bodyText: {
        fontSize: 16,
        color: '#334155',
        lineHeight: 26,
        fontStyle: 'italic',
        marginBottom: 16,
    },
    amenText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#D4AF37',
        textAlign: 'right',
        letterSpacing: 1,
    }
});
