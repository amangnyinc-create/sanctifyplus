import { View, Text, StyleSheet, ImageBackground, Dimensions, TouchableOpacity, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback, Share, Alert, ScrollView } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { useRouter } from 'expo-router';
import { auth } from '../../config/firebaseConfig';
import { checkAndUpdateUsage } from '../../utils/usageTracker';

const ai = new GoogleGenAI({ apiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY });
const { width, height } = Dimensions.get('window');

// Local pre-packaged aesthetic Backgrounds (Cross, Bible, Church)
const BACKGROUND_IMAGES = [
    require('@/assets/prayer_bg/bg1.jpg'),
    require('@/assets/prayer_bg/bg2.jpg'),
    require('@/assets/prayer_bg/bg3.jpg'),
    require('@/assets/prayer_bg/bg4.jpg'),
    require('@/assets/prayer_bg/bg5.jpg'),
    require('@/assets/prayer_bg/bg6.jpg'),
];

export default function PrayerScreen() {
    const router = useRouter();
    const [prayerTheme, setPrayerTheme] = useState('');
    const [prayer, setPrayer] = useState({
        title: "A Morning Prayer",
        body: "Lord, grant me strength from your prayer-filled Spirit. Grant me peace amidst the storm, and guide my steps.",
        amen: "Amen."
    });
    const [isGenerating, setIsGenerating] = useState(false);
    const [bgImage, setBgImage] = useState(BACKGROUND_IMAGES[0]);

    const generatePrayer = async () => {
        const uid = auth.currentUser?.uid;
        if (!uid) {
            Alert.alert("Error", "You must be signed in to generate prayers.");
            return;
        }

        const canUse = await checkAndUpdateUsage(uid, 'prayer');
        if (!canUse) {
            Alert.alert(
                "Daily Limit Reached",
                "You've used all 3 free prayers for today. Upgrade to Sanctify Plus Premium for unlimited prayers!",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Upgrade Now", onPress: () => router.push('/billing') }
                ]
            );
            return;
        }

        Keyboard.dismiss();
        setIsGenerating(true);
        // Pick random background
        setBgImage(BACKGROUND_IMAGES[Math.floor(Math.random() * BACKGROUND_IMAGES.length)]);

        try {
            const prompt = `
You are a deeply empathetic, poetic Christian prayer artisan providing a premium, profound spiritual experience.
Write a deeply moving, beautifully crafted, multi-paragraph prayer.

${prayerTheme ? `The user is specifically asking for prayer regarding: "${prayerTheme}". Please focus the prayer entirely on this topic.` : 'Provide an uplifting, comforting, and deeply profound general prayer for today.'}

The prayer must be deeply moving, rich in spiritual depth, and sound natural. It should have 3 distinct paragraphs capturing: 1) Acknowledgment of God, 2) The core petition/struggle, 3) Trust and closing hope.
Return strictly as JSON:
{
  "title": "A short, beautiful 3-4 word title for the prayer",
  "body": "The rich, 3-paragraph prayer text itself with natural language flow. Separate the paragraphs clearly with standard newline formatting (\\n\\n). Do not include 'Amen' at the end.",
  "amen": "The word for Amen in the requested language (e.g. 'Amen.', '아멘.')"
}
IMPORTANT: Write the prayer in the EXACT SAME LANGUAGE as the user's request. If the user's request is empty, default to fluent ${prayer.amen.includes('아멘') || auth.currentUser ? 'Korean' : 'English'} language. Ensure proper formatting.
`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                }
            });

            const parsed = JSON.parse(response.text || "{}");
            if (parsed.title && parsed.body) {
                setPrayer({
                    title: parsed.title,
                    body: parsed.body,
                    amen: parsed.amen || "Amen."
                });
            }
        } catch (e) {
            console.error(e);
            setPrayer({
                title: "Error Generating Prayer",
                body: "Could not load the prayer. Please try again.",
                amen: "Amen."
            });
        } finally {
            setIsGenerating(false);
        }
    };

    // Auto-generate a prayer on first load
    useEffect(() => {
        generatePrayer();
    }, []);

    const sharePrayer = async () => {
        try {
            const amenText = prayer.amen || "Amen.";
            const message = `[Sanctify Plus]\n\n${prayer.title}\n\n"${prayer.body}"\n\n${amenText}`;
            await Share.share({
                message: message,
            });
        } catch (error: any) {
            console.error("Error sharing prayer:", error.message);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            {/* Touchable outside the card to dismiss keyboard */}
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={{ width: '100%', alignItems: 'center' }}>
                    <Text style={styles.headerTitle}>Prayer Artisan</Text>

                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="What kind of prayer do you need? (e.g., wisdom, comfort, family)"
                            placeholderTextColor="#999"
                            value={prayerTheme}
                            onChangeText={setPrayerTheme}
                            returnKeyType="done"
                            onSubmitEditing={generatePrayer}
                        />
                    </View>
                </View>
            </TouchableWithoutFeedback>

            {/* Prayer Card (With Image Background) */}
            <View style={[styles.cardContainer, { backgroundColor: '#333' }]}>
                <ImageBackground
                    source={bgImage}
                    style={styles.cardBackground}
                    imageStyle={{ borderRadius: 24, resizeMode: 'cover' }}
                >
                    <View style={styles.overlay}>
                        {isGenerating ? (
                            <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1, padding: 40 }}>
                                <ActivityIndicator size="large" color="#fff" />
                                <Text style={{ marginTop: 16, color: '#fff', fontSize: 16, fontWeight: '600', opacity: 0.9 }}>
                                    Crafting your prayer...
                                </Text>
                            </View>
                        ) : (
                            <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-start', paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
                                <Text style={styles.prayerTitle}>{prayer.title}</Text>
                                <Text style={styles.prayerBody}>"{prayer.body}"</Text>
                                <Text style={styles.prayerAmen}>{prayer.amen || "Amen."}</Text>
                            </ScrollView>
                        )}
                    </View>
                </ImageBackground>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionRow}>
                <TouchableOpacity style={[styles.regenerateButton, { marginRight: 8 }]} onPress={generatePrayer} disabled={isGenerating}>
                    <Ionicons name="refresh" size={20} color={isGenerating ? '#ccc' : Colors.light.tint} />
                    <Text style={[styles.regenerateText, isGenerating && { color: '#ccc' }]}>Regen</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.regenerateButton, { marginRight: 8, borderColor: '#D4AF37' }]}
                    onPress={async () => {
                        const { auth, db } = require('@/config/firebaseConfig');
                        const { collection, addDoc, serverTimestamp } = require('firebase/firestore');

                        const user = auth.currentUser;
                        if (!user) {
                            alert("로그인이 필요합니다. (Please log in to save)");
                            return;
                        }

                        try {
                            await addDoc(collection(db, 'users', user.uid, 'saved_prayers'), {
                                title: prayer.title,
                                body: prayer.body,
                                amen: prayer.amen,
                                theme: prayerTheme || "General",
                                savedAt: serverTimestamp()
                            });
                            alert(prayerTheme.includes('한국어') || prayer.amen.includes('아멘') ? "기도문이 보관함에 저장되었습니다." : "Prayer saved to your archive!");
                        } catch (e) {
                            console.error("Error saving prayer: ", e);
                            alert("Failed to save. Please try again.");
                        }
                    }}
                    disabled={isGenerating}
                >
                    <Ionicons name="bookmark" size={20} color={isGenerating ? '#ccc' : '#D4AF37'} />
                    <Text style={[styles.regenerateText, { color: '#D4AF37' }, isGenerating && { color: '#ccc' }]}>Save</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.shareButton} onPress={sharePrayer}>
                    <LinearGradient
                        colors={['#FDE68A', '#D4AF37']}
                        style={styles.shareGradient}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                    >
                        <Text style={styles.shareText}>Share</Text>
                        <Ionicons name="share-outline" size={18} color="#0A2242" style={{ marginLeft: 6 }} />
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
        paddingTop: 60,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: Colors.light.text,
        marginBottom: 10,
        fontFamily: 'System',
    },
    inputContainer: {
        width: width * 0.85,
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        marginBottom: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    input: {
        fontSize: 16,
        color: '#333',
    },
    cardContainer: {
        width: width * 0.85,
        height: height * 0.55,
        borderRadius: 24,
        marginBottom: 40,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 8,
    },
    cardBackground: {
        flex: 1,
        justifyContent: 'center',
        padding: 24,
        borderRadius: 24,
        overflow: 'hidden',
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)', // Darker overlay for better contrast
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)', // Subtle border
    },
    prayerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 16,
        textAlign: 'center',
        opacity: 0.9,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    prayerBody: {
        color: '#fff',
        fontSize: 18,
        lineHeight: 28,
        fontWeight: '500',
        fontStyle: 'italic',
        textAlign: 'center',
        fontFamily: 'System', // Falls back nicely
        marginBottom: 10,
    },
    prayerAmen: {
        color: '#D4AF37',
        fontSize: 18,
        fontWeight: '700',
        marginTop: 20,
        textAlign: 'center',
        letterSpacing: 2,
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '90%',
        justifyContent: 'space-between',
    },
    regenerateButton: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        height: 50,
        backgroundColor: '#fff',
        borderRadius: 25,
        borderWidth: 1,
        borderColor: '#eee',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    regenerateText: {
        marginLeft: 6,
        color: Colors.light.text,
        fontWeight: '600',
        fontSize: 14,
    },
    shareButton: {
        flex: 1.2,
        height: 50,
        borderRadius: 25,
        overflow: 'hidden',
        shadowColor: '#D4AF37',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    shareGradient: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    shareText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
});
