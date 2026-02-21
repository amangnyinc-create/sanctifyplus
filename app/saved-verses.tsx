import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db } from '../config/firebaseConfig';
import { collection, query, orderBy, getDocs, doc, deleteDoc } from 'firebase/firestore';

export default function SavedVersesScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [verses, setVerses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchVerses = async () => {
            if (!auth.currentUser) {
                setLoading(false);
                return;
            }
            try {
                const q = query(
                    collection(db, 'users', auth.currentUser.uid, 'saved_verses'),
                    orderBy('savedAt', 'desc')
                );
                const querySnapshot = await getDocs(q);
                const fetchedVerses: any[] = [];
                querySnapshot.forEach((doc) => {
                    fetchedVerses.push({ id: doc.id, ...doc.data() });
                });
                setVerses(fetchedVerses);
            } catch (error) {
                console.error("Error fetching verses: ", error);
            } finally {
                setLoading(false);
            }
        };

        fetchVerses();
    }, []);

    const handleDelete = (id: string) => {
        Alert.alert(
            "Delete Verse",
            "Are you sure you want to delete this verse?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        if (!auth.currentUser) return;
                        try {
                            await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'saved_verses', id));
                            setVerses(verses.filter(v => v.id !== id));
                        } catch (error) {
                            console.error("Error deleting verse: ", error);
                            Alert.alert("Error", "Failed to delete verse.");
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
                <Text style={styles.headerTitle}>Saved Verses</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {loading ? (
                    <ActivityIndicator size="large" color="#D4AF37" style={{ marginTop: 50 }} />
                ) : verses.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="bookmark-outline" size={64} color="#CBD5E1" />
                        <Text style={styles.emptyTitle}>No verses saved yet</Text>
                        <Text style={styles.emptyDesc}>Discover and save verses that inspire you. They will appear here for easy access.</Text>
                    </View>
                ) : (
                    verses.map((v) => (
                        <View key={v.id} style={styles.card}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <Text style={[styles.reference, { marginBottom: 0 }]}>{v.reference}</Text>
                                <TouchableOpacity onPress={() => handleDelete(v.id)} style={{ padding: 4 }}>
                                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.verseText}>"{v.text}"</Text>
                            {v.meaning && <Text style={styles.meaningText}>{v.meaning}</Text>}
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
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    reference: {
        color: '#D4AF37',
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    verseText: {
        fontSize: 18,
        color: '#1E293B',
        lineHeight: 26,
        fontWeight: '600',
        fontStyle: 'italic',
        marginBottom: 12,
    },
    meaningText: {
        fontSize: 14,
        color: '#64748B',
        lineHeight: 22,
        backgroundColor: '#F1F5F9',
        padding: 12,
        borderRadius: 10,
    }
});
