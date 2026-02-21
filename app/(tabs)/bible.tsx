import { View, Text, StyleSheet, TouchableOpacity, Button, ActivityIndicator, Image, PanResponder, Dimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { useState, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import * as ImageManipulator from 'expo-image-manipulator';

// Initialize Gemini (Will use env variable)
const ai = new GoogleGenAI({ apiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY });

export default function BibleScreen() {
    const [permission, requestPermission] = useCameraPermissions();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const cameraRef = useRef<CameraView>(null);

    // Analysis State
    const [verseRef, setVerseRef] = useState("John 3:16");
    const [verseText, setVerseText] = useState('"For God so loved the world..."');
    const [originalWord, setOriginalWord] = useState("Agape (Greek: ἀγάπη)");
    const [meaning, setMeaning] = useState("Self-sacrificial love, focusing on the will rather than emotions.");

    // Resizable Crop Box State
    const initialBox = { w: 300, h: 200 };
    const boxRef = useRef(initialBox);
    const [box, setBox] = useState(initialBox);
    const [boxPos, setBoxPos] = useState({ y: 0, x: 0 });

    const createCornerResponder = (isLeft: boolean, isTop: boolean) =>
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                boxRef.current = { ...box };
            },
            onPanResponderMove: (evt, gestureState) => {
                // Symmetrical resizing from center
                const dw = isLeft ? -gestureState.dx * 2 : gestureState.dx * 2;
                const dh = isTop ? -gestureState.dy * 2 : gestureState.dy * 2;
                setBox({
                    w: Math.max(120, Math.min(boxRef.current.w + dw, 380)),
                    h: Math.max(80, Math.min(boxRef.current.h + dh, 600)),
                });
            }
        });

    const tlResponder = useRef(createCornerResponder(true, true)).current;
    const trResponder = useRef(createCornerResponder(false, true)).current;
    const blResponder = useRef(createCornerResponder(true, false)).current;
    const brResponder = useRef(createCornerResponder(false, false)).current;

    if (!permission) {
        // Camera permissions are still loading.
        return <View style={styles.container} />;
    }

    if (!permission.granted) {
        // Camera permissions are not granted yet.
        return (
            <View style={styles.container}>
                <Text style={styles.message}>We need your permission to show the camera</Text>
                <Button onPress={requestPermission} title="grant permission" />
            </View>
        );
    }

    const handleDeepDive = async () => {
        if (!cameraRef.current || isAnalyzing) return;

        setIsAnalyzing(true);
        setCapturedImage(null); // Clear previous

        try {
            // 📸 1. Take the full picture
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.5,
                base64: false
            });

            if (photo?.uri && photo?.width && photo?.height) {
                // Determine precise crop coordinates relative to actual camera resolution
                const { width: windowWidth, height: windowHeight } = Dimensions.get('window');
                const ratioX = photo.width / windowWidth;
                const ratioY = photo.height / windowHeight;

                const cropOriginX = ((windowWidth - box.w) / 2) * ratioX;
                const cropOriginY = boxPos.y * ratioY;
                const cropWidth = box.w * ratioX;
                const cropHeight = box.h * ratioY;

                // ✂️ Crop the image perfectly to the viewfinder
                const cropped = await ImageManipulator.manipulateAsync(
                    photo.uri,
                    [{
                        crop: {
                            originX: Math.max(0, cropOriginX),
                            originY: Math.max(0, cropOriginY),
                            width: Math.min(photo.width, cropWidth),
                            height: Math.min(photo.height, cropHeight)
                        }
                    }],
                    { base64: true, compress: 1.0, format: ImageManipulator.SaveFormat.JPEG }
                );

                setCapturedImage(cropped.uri);

                if (!cropped.base64) return;

                // 🧠 2. Send to Gemini 3.0 Pro (gemini-2.5-pro or latest)
                const prompt = `Analyze this Bible verse image. 
IMPORTANT RULE: You MUST output all your analysis in the EXACT SAME LANGUAGE as the text written in the image. If the image contains Korean text, you MUST answer entirely in Korean. If English, answer in English. 

Return ONLY a JSON object with exactly these keys:
{
  "reference": "e.g., John 3:16 (or 요한복음 3:16)",
  "text": "The main verse text you can read in its original language",
  "originalWord": "e.g., Agape (Greek: ἀγάπη) - pick one key word from the text and show its original Biblical language (Greek/Hebrew) origin",
  "meaning": "Profound theological meaning of that original word in 1-2 sentences, written in the detected language of the image"
}
Do not include \`\`\`json markdown blocks, just the raw JSON.`;

                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-pro', // Using the latest available Pro model mapping to 3.0 specs
                    contents: [
                        {
                            role: 'user',
                            parts: [
                                { inlineData: { data: cropped.base64, mimeType: 'image/jpeg' } },
                                { text: prompt }
                            ]
                        }
                    ]
                });

                const textResult = response.text?.trim() || "{}";

                try {
                    // Try to parse JSON from AI response
                    const cleanJson = textResult.replace(/```json/g, '').replace(/```/g, '');
                    const data = JSON.parse(cleanJson);

                    setVerseRef(data.reference || "Unknown Reference");
                    setVerseText(data.text || "Could not read text clearly.");
                    setOriginalWord(data.originalWord || "Deep Insight");
                    setMeaning(data.meaning || "The AI is pondering the spiritual depth of this passage...");
                } catch (e) {
                    console.error("Failed to parse Gemini JSON:", e, textResult);
                    setVerseRef("Analysis Complete");
                    setVerseText("Extracted meaning from the passage...");
                    setMeaning(textResult.substring(0, 150) + "...");
                }
            }
        } catch (error) {
            console.error("Failed to process deep dive:", error);
            setMeaning("Error contacting AI server.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const resetScanner = () => {
        setCapturedImage(null);
    };

    return (
        <View style={styles.container}>
            {capturedImage ? (
                // --- RESULT VIEW (Showing captured image + Analysis) ---
                <View style={styles.previewContainer}>
                    <Image source={{ uri: capturedImage }} style={styles.previewImage} blurRadius={isAnalyzing ? 10 : 0} />

                    {/* Add a dim overlay */}
                    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.4)" }]} />

                    {/* 🔄 Top Cancel/Rescan Button */}
                    <TouchableOpacity style={styles.cancelBtn} onPress={resetScanner}>
                        <Ionicons name="refresh-circle" size={40} color="#fff" />
                    </TouchableOpacity>

                    {isAnalyzing ? (
                        <View style={styles.analyzingOverlay}>
                            <ActivityIndicator size="large" color="#D4AF37" />
                            <Text style={styles.analyzingText}>Extracting text & meaning...</Text>
                        </View>
                    ) : (
                        // 🃏 Floating Deep Dive Card (Result)
                        <View style={styles.deepDiveCard}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.verseRef}>{verseRef}</Text>
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>DEEP DIVE</Text>
                                </View>
                            </View>
                            <Text style={styles.verseText} numberOfLines={2}>
                                {verseText}
                            </Text>

                            <View style={styles.divider} />

                            <View style={styles.insightSection}>
                                <Text style={styles.originalWord}>{originalWord}</Text>
                                <Text style={styles.meaning}>{meaning}</Text>
                            </View>
                        </View>
                    )}
                </View>
            ) : (
                // --- CAMERA VIEW ---
                <CameraView style={styles.camera} facing="back" ref={cameraRef}>
                    {/* true Scanner Mask Layout */}
                    <View style={styles.overlay}>
                        {/* Top Mask */}
                        <View style={styles.maskTop}>
                            <Text style={styles.modeText}>Bible Lens AR</Text>
                            <Text style={styles.helperText}>Drag corners to resize box</Text>
                        </View>

                        {/* Center Row with clear Viewfinder */}
                        <View
                            style={{ flexDirection: 'row', height: box.h, zIndex: 10 }}
                            onLayout={(e) => setBoxPos({ y: e.nativeEvent.layout.y, x: e.nativeEvent.layout.x })}
                        >
                            <View style={styles.maskSide} />

                            <View style={[styles.viewfinder, { width: box.w }]}>
                                {/* Draggable Corners */}
                                <View style={[styles.cornerHitbox, styles.tl]} {...tlResponder.panHandlers}>
                                    <View style={[styles.corner, styles.tlInner]} />
                                </View>
                                <View style={[styles.cornerHitbox, styles.tr]} {...trResponder.panHandlers}>
                                    <View style={[styles.corner, styles.trInner]} />
                                </View>
                                <View style={[styles.cornerHitbox, styles.bl]} {...blResponder.panHandlers}>
                                    <View style={[styles.corner, styles.blInner]} />
                                </View>
                                <View style={[styles.cornerHitbox, styles.br]} {...brResponder.panHandlers}>
                                    <View style={[styles.corner, styles.brInner]} />
                                </View>
                            </View>

                            <View style={styles.maskSide} />
                        </View>

                        {/* Bottom Mask with Button */}
                        <View style={styles.maskBottom}>
                            <TouchableOpacity style={styles.captureBtn} onPress={handleDeepDive}>
                                <Ionicons name="scan-outline" size={36} color="#000" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </CameraView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
    },
    message: {
        textAlign: 'center',
        paddingBottom: 10,
    },
    camera: {
        flex: 1,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    maskTop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        paddingTop: 60,
    },
    maskCenterRow: {
        flexDirection: 'row',
        height: 240, // Height of the crop box
    },
    maskSide: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    maskBottom: {
        flex: 1.2,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modeText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        backgroundColor: 'rgba(255,255,255,0.2)', // Sleeker background
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 30,
        overflow: 'hidden',
    },
    helperText: {
        color: '#fff',
        marginTop: 12,
        fontSize: 14,
        opacity: 0.8,
        fontWeight: '600',
    },
    viewfinder: {
        backgroundColor: 'transparent',
    },
    cornerHitbox: {
        position: 'absolute',
        width: 60, // Large invisible touch area
        height: 60,
        zIndex: 20,
    },
    corner: {
        position: 'absolute',
        width: 30, // Visible corner size
        height: 30,
        borderColor: '#D4AF37',
        borderWidth: 4,
    },
    tl: { top: -20, left: -20 },
    tr: { top: -20, right: -20 },
    bl: { bottom: -20, left: -20 },
    br: { bottom: -20, right: -20 },

    tlInner: { borderRightWidth: 0, borderBottomWidth: 0, top: 20, left: 20 },
    trInner: { borderLeftWidth: 0, borderBottomWidth: 0, top: 20, right: 20 },
    blInner: { borderRightWidth: 0, borderTopWidth: 0, bottom: 20, left: 20 },
    brInner: { borderLeftWidth: 0, borderTopWidth: 0, bottom: 20, right: 20 },

    captureBtn: {
        backgroundColor: '#fff',
        width: 80, // Bigger scan button
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 40, // Push up slightly in the bottom mask
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 8,
    },
    deepDiveCard: {
        backgroundColor: 'rgba(255,255,255,0.95)', // Semi-transparent white
        borderRadius: 20,
        padding: 24,
        position: 'absolute',
        top: 120, // Floating higher up near the original word
        left: 20,
        right: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 15,
        elevation: 10,
        zIndex: 5, // Keep below the cancel button but above background
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    verseRef: {
        fontSize: 20,
        fontWeight: '800',
        color: Colors.light.text,
    },
    badge: {
        backgroundColor: Colors.light.tint,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    badgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '700',
    },
    verseText: {
        fontSize: 16,
        fontStyle: 'italic',
        color: '#333',
        marginBottom: 12,
        lineHeight: 22,
    },
    divider: {
        height: 1,
        backgroundColor: '#eee',
        marginVertical: 8,
    },
    insightSection: {
        backgroundColor: '#F8FAF6',
        padding: 12,
        borderRadius: 12,
    },
    originalWord: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0A2242',
        marginBottom: 2,
    },
    meaning: {
        fontSize: 14,
        color: '#555',
    },
    previewContainer: {
        flex: 1,
        backgroundColor: '#000',
    },
    previewImage: {
        ...StyleSheet.absoluteFillObject,
        resizeMode: 'cover',
    },
    cancelBtn: {
        position: 'absolute',
        top: 60,
        right: 20, // Set to the right side like a standard dismiss
        zIndex: 10,
    },
    analyzingOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    analyzingText: {
        color: '#D4AF37',
        fontSize: 16,
        fontWeight: '600',
        marginTop: 16,
    },
});
