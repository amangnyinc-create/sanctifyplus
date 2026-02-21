import { useRef, useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Animated, ScrollView, Platform, ActivityIndicator, Modal, Alert } from 'react-native';
import { Colors } from '@/constants/Colors';
import { MaterialIcons, Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { GoogleGenAI } from '@google/genai';
import { useRouter, useFocusEffect } from 'expo-router';
import { auth, db } from '../../config/firebaseConfig';
import { collection, query, orderBy, getDocs, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { checkAndUpdateUsage } from '../../utils/usageTracker';

// Initialize Gemini (Will use env variable)
const ai = new GoogleGenAI({ apiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY });

// Mock Data for "Recent Sermons" - Empty for clean state
const INITIAL_SERMONS: any[] = [];

export default function SermonScreen() {
  const router = useRouter();
  const [sermons, setSermons] = useState(INITIAL_SERMONS);
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recordingObject, setRecordingObject] = useState<Audio.Recording | null>(null);
  const [selectedSermon, setSelectedSermon] = useState<any | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const fetchRecentSermons = async () => {
        if (!auth.currentUser) return;
        setLoadingInitial(true);
        try {
          const q = query(
            collection(db, 'users', auth.currentUser.uid, 'sermon_notes'),
            orderBy('savedAt', 'desc'),
            limit(5)
          );
          const querySnapshot = await getDocs(q);
          const fetched: any[] = [];
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            fetched.push({
              id: doc.id,
              ...data,
              // Add UI specific fields if missing
              highlight: data.highlight || '#FFF3E0',
              badgeColor: data.badgeColor || '#FB8C00'
            });
          });
          setSermons(fetched);
        } catch (error) {
          console.error("Error fetching recent sermons: ", error);
        } finally {
          setLoadingInitial(false);
        }
      };
      fetchRecentSermons();
    }, [])
  );

  const deleteSermon = (id: string) => {
    setSermons(sermons.filter(s => s.id !== id));
    setSelectedSermon(null);
  };

  const pulseAnim = useRef(new Animated.Value(1)).current;

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopPulse = () => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  };

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecordingObject(recording);
      setIsRecording(true);
      startPulse();
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    stopPulse();

    if (recordingObject) {
      setIsAnalyzing(true);
      try {
        await recordingObject.stopAndUnloadAsync();
        const uri = recordingObject.getURI();

        if (uri) {
          const user = auth.currentUser;
          if (!user) {
            Alert.alert("Authentication Error", "You must be signed in to transcribe audio.");
            setIsAnalyzing(false);
            return;
          }

          const canUse = await checkAndUpdateUsage(user.uid, 'deepDive'); // Use deepDive count or perhaps a new 'sermon' tracker if you add one later
          if (!canUse) {
            Alert.alert(
              "Daily Limit Reached",
              "You've used all 3 free AI summaries for today. Upgrade to Sanctify Plus Premium!",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Upgrade Now", onPress: () => router.push('/billing') }
              ]
            );
            setIsAnalyzing(false);
            return;
          }

          // Read the audio file as base64 using expo-file-system explicitly
          const base64Audio = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });

          console.log('Sending audio to Gemini...');

          const prompt = `Listen to this sermon recording (it could be in Korean or English).
IMPORTANT RULE: You MUST output all your analysis in the EXACT SAME LANGUAGE as the audio. If they speak Korean, answer in Korean.

Return ONLY a JSON object with strictly these keys (No markdown formatting):
{
  "title": "A short, catchy, and spiritual title for this sermon (3-5 words)",
  "preacher": "The speaker's name if mentioned, otherwise 'Pastor'",
  "duration": "A short guess of the summary length, e.g., '1 min read'",
  "badge": "A highly relevant 1-word tag (e.g., GRACE, FAITH, LOVE, 소망)",
  "content": "A beautiful 2-3 sentence summary/transcript of the core message"
}`;

          // Send to Gemini 3.0 Flash (gemini-2.5-flash as the latest standard engine)
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
              {
                role: 'user',
                parts: [
                  // We supply the audio. Note: iOS uses m4a mostly, Android standard mp4/m4a
                  { inlineData: { data: base64Audio, mimeType: 'audio/m4a' } },
                  { text: prompt }
                ]
              }
            ]
          });

          const textResult = response.text?.trim() || "{}";
          const cleanJson = textResult.replace(/```json/g, '').replace(/```/g, '');

          try {
            const data = JSON.parse(cleanJson);

            const newSermonData = {
              title: data.title || 'Spiritual Reflection',
              preacher: data.preacher || 'Sermon Audio',
              date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
              duration: data.duration || 'Just now',
              badge: data.badge ? data.badge.toUpperCase() : 'NEW',
              highlight: '#E8F5E9',
              badgeColor: '#43A047',
              content: data.content,
              savedAt: serverTimestamp()
            };

            const docRef = await addDoc(collection(db, 'users', auth.currentUser!.uid, 'sermon_notes'), newSermonData);

            setSermons([{ id: docRef.id, ...newSermonData }, ...sermons]);

          } catch (e) {
            console.error("Failed to parse audio summary:", e);
            alert("Failed to transcribe audio properly.");
          }
        }
      } catch (err) {
        console.error("AI Transcription error:", err);
      } finally {
        setRecordingObject(null);
        setIsAnalyzing(false);
      }
    }
  };

  const handleRecordPress = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Peace be with you,</Text>
          <Text style={styles.userName}>
            {auth.currentUser?.displayName ? `Good morning, ${auth.currentUser.displayName}` : `Good morning, ${auth.currentUser?.email?.split('@')[0] || 'User'}`}
          </Text>
        </View>
        <TouchableOpacity style={styles.settingsIcon} onPress={() => router.push('/profile')}>
          <Ionicons name="settings-outline" size={24} color={Colors.light.text} />
        </TouchableOpacity>
      </View>

      {/* Main Action Area (Gold Microphone) */}
      <View style={styles.heroSection}>
        <View style={styles.micContainerOuter}>
          <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }], opacity: isRecording ? 0.3 : 0 }]} />
          <TouchableOpacity
            style={styles.micButton}
            onPress={handleRecordPress}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={isRecording ? ['#FFCDD2', '#EF9A9A'] : ['#FDE68A', '#D4AF37']} // Red tint if recording
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientFill}
            >
              <MaterialIcons name={isRecording ? "stop" : "mic"} size={48} color={isRecording ? "#D32F2F" : "#FFFFFF"} />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <Text style={styles.heroTitle}>
          {isRecording ? "Recording Sermon..." : isAnalyzing ? "Processing Recording..." : "Start Recording"}
        </Text>
        <Text style={styles.heroSubtitle}>
          {isRecording ? "Capturing spiritual insights" : isAnalyzing ? "Preparing your summary..." : "Record to get a sermon summary"}
        </Text>
      </View>

      {/* Loading indicator when analyzing */}
      {isAnalyzing && (
        <View style={{ alignItems: 'center', marginVertical: 10 }}>
          <ActivityIndicator size="small" color="#D4AF37" />
        </View>
      )}

      {/* Recent Activity */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Sermons</Text>
        <TouchableOpacity onPress={() => router.push('/sermon-notes')}>
          <Text style={styles.viewAllText}>View all</Text>
        </TouchableOpacity>
      </View>

      {loadingInitial ? (
        <ActivityIndicator size="small" color="#D4AF37" style={{ marginVertical: 20 }} />
      ) : sermons.length === 0 ? (
        <View style={{ padding: 20, alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, borderStyle: 'dashed', borderWidth: 1, borderColor: '#CBD5E1' }}>
          <Feather name="mic" size={32} color="#CBD5E1" />
          <Text style={{ marginTop: 8, color: '#94A3B8', fontSize: 14 }}>No recording summaries yet.</Text>
        </View>
      ) : (
        <View style={styles.sermonList}>
          {sermons.map((item: any) => (
            <TouchableOpacity key={item.id} style={styles.sermonCard} onPress={() => setSelectedSermon(item)}>
              <View style={[styles.iconBox, { backgroundColor: item.highlight }]}>
                <Feather name="book-open" size={20} color={item.badgeColor} />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.cardSubtitle}>{item.date} • {item.duration}</Text>
                {item.content && (
                  <Text style={{ fontSize: 13, color: '#666', marginTop: 4, fontStyle: 'italic' }} numberOfLines={2}>
                    "{item.content}"
                  </Text>
                )}
              </View>
              <View style={[styles.badgeContainer, { backgroundColor: item.badgeColor }]}>
                <Text style={styles.badgeText}>{item.badge}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Detail Modal */}
      <Modal visible={!!selectedSermon} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalContainer}>
            {selectedSermon && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalBadgeText}>{selectedSermon.badge}</Text>
                  <TouchableOpacity onPress={() => setSelectedSermon(null)}>
                    <Ionicons name="close" size={28} color="#0A2242" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalScroll}>
                  <Text style={styles.modalTitle}>{selectedSermon.title}</Text>
                  <Text style={styles.modalSubtitle}>
                    {selectedSermon.date} • {selectedSermon.preacher}
                  </Text>

                  <View style={styles.divider} />

                  <Text style={styles.modalContent}>
                    {selectedSermon.content || "No detailed summary is available for this sermon."}
                  </Text>
                </ScrollView>

                <View style={[styles.modalFooter, { flexDirection: 'row', justifyContent: 'space-between' }]}>
                  <TouchableOpacity
                    style={[styles.deleteBtn, { flex: 1, marginRight: 8, backgroundColor: '#F1F5F9' }]}
                    onPress={() => deleteSermon(selectedSermon.id)}
                  >
                    <Feather name="trash-2" size={20} color="#D32F2F" />
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.deleteBtn, { flex: 1, marginLeft: 8, backgroundColor: '#FFFBEB' }]}
                    onPress={async () => {
                      if (!selectedSermon) return;
                      const { auth, db } = require('@/config/firebaseConfig');
                      const { collection, addDoc, serverTimestamp } = require('firebase/firestore');

                      const user = auth.currentUser;
                      if (!user) {
                        alert("로그인이 필요합니다. (Please log in to save)");
                        return;
                      }

                      try {
                        await addDoc(collection(db, 'users', user.uid, 'sermon_notes'), {
                          title: selectedSermon.title,
                          content: selectedSermon.content,
                          date: selectedSermon.date,
                          preacher: selectedSermon.preacher,
                          duration: selectedSermon.duration,
                          badge: selectedSermon.badge,
                          savedAt: serverTimestamp()
                        });
                        alert("Sermon saved to your archive!");
                        setSelectedSermon(null);
                      } catch (error) {
                        console.error("Error saving sermon note: ", error);
                        alert("Failed to save. Please try again.");
                      }
                    }}
                  >
                    <Ionicons name="bookmark" size={20} color="#D4AF37" />
                    <Text style={[styles.deleteBtnText, { color: '#B45309' }]}>Save Note</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
  },
  greeting: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.light.text,
    marginTop: 4,
  },
  settingsIcon: {
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  micContainerOuter: {
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  pulseRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#FDE68A', // Light Gold Pulse
    zIndex: -1,
  },
  micButton: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#D4AF37', // Gold Shadow
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden', // Ensures gradient stays in circle
  },
  gradientFill: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0A2242', // Navy
    marginTop: 10,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0A2242',
  },
  viewAllText: {
    fontSize: 14,
    color: '#D4AF37', // Gold Link
    fontWeight: '600',
  },
  sermonList: {
    gap: 16,
  },
  sermonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0A2242',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
  },
  badgeContainer: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: '60%',
    maxHeight: '90%',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalBadgeText: {
    fontWeight: '700',
    color: '#D4AF37',
    fontSize: 14,
    letterSpacing: 1,
  },
  modalScroll: {
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0A2242',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },
  divider: {
    height: 1,
    backgroundColor: '#EEEEEE',
    marginVertical: 20,
  },
  modalContent: {
    fontSize: 16,
    color: '#4A4A4A',
    lineHeight: 26,
  },
  modalFooter: {
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    paddingTop: 16,
    alignItems: 'center',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  deleteBtnText: {
    color: '#D32F2F',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
});
