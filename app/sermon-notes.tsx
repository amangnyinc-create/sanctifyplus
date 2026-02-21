import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db } from '../config/firebaseConfig';
import { collection, query, orderBy, getDocs, doc, deleteDoc } from 'firebase/firestore';

export default function SermonNotesScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [notes, setNotes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchNotes = async () => {
            if (!auth.currentUser) {
                setLoading(false);
                return;
            }
            try {
                const q = query(
                    collection(db, 'users', auth.currentUser.uid, 'sermon_notes'),
                    orderBy('savedAt', 'desc')
                );
                const querySnapshot = await getDocs(q);
                const fetchedNotes: any[] = [];
                querySnapshot.forEach((doc) => {
                    fetchedNotes.push({ id: doc.id, ...doc.data() });
                });
                setNotes(fetchedNotes);
            } catch (error) {
                console.error("Error fetching sermon notes: ", error);
            } finally {
                setLoading(false);
            }
        };

        fetchNotes();
    }, []);

    const handleDelete = (id: string) => {
        Alert.alert(
            "Delete Sermon Note",
            "Are you sure you want to delete this sermon note?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        if (!auth.currentUser) return;
                        try {
                            await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'sermon_notes', id));
                            setNotes(notes.filter(n => n.id !== id));
                        } catch (error) {
                            console.error("Error deleting note: ", error);
                            Alert.alert("Error", "Failed to delete sermon note.");
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
                <Text style={styles.headerTitle}>Sermon Notes</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {loading ? (
                    <ActivityIndicator size="large" color="#D4AF37" style={{ marginTop: 50 }} />
                ) : notes.length === 0 ? (
                    <View style={styles.emptyState}>
                        <MaterialIcons name="menu-book" size={64} color="#CBD5E1" />
                        <Text style={styles.emptyTitle}>No notes available</Text>
                        <Text style={styles.emptyDesc}>Take notes during sermons to reflect on them later. Your notes will be safely stored here.</Text>
                    </View>
                ) : (
                    notes.map((note) => (
                        <View key={note.id} style={styles.card}>
                            <View style={styles.cardHeader}>
                                <View style={[styles.titleRow, { justifyContent: 'space-between', marginBottom: 8 }]}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                        <Feather name="mic" size={16} color="#64748B" />
                                        <Text style={styles.preacherText}>{note.preacher}</Text>
                                        <View style={styles.badgeContainer}>
                                            <Text style={styles.badgeText}>{note.badge || 'SERMON'}</Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity onPress={() => handleDelete(note.id)} style={{ padding: 4 }}>
                                        <Ionicons name="trash-outline" size={20} color="#EF4444" />
                                    </TouchableOpacity>
                                </View>
                                <Text style={styles.titleText}>{note.title}</Text>
                                <Text style={styles.metaText}>{note.date} • {note.duration}</Text>
                            </View>
                            <View style={styles.divider} />
                            <Text style={styles.contentText}>"{note.content}"</Text>
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
    cardHeader: {
        marginBottom: 12,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    preacherText: {
        fontSize: 13,
        color: '#64748B',
        fontWeight: '600',
        marginLeft: 6,
        flex: 1,
    },
    badgeContainer: {
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#3B82F6',
        letterSpacing: 0.5,
    },
    titleText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 4,
    },
    metaText: {
        fontSize: 13,
        color: '#94A3B8',
    },
    divider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginVertical: 12,
    },
    contentText: {
        fontSize: 15,
        color: '#334155',
        lineHeight: 24,
        fontStyle: 'italic',
    }
});
