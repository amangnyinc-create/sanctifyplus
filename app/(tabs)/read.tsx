import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, ActivityIndicator, Modal, FlatList, Platform, Alert } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { useRouter } from 'expo-router';
import { auth } from '../../config/firebaseConfig';
import { checkAndUpdateUsage } from '../../utils/usageTracker';

const ai = new GoogleGenAI({ apiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY });

const BIBLE_BOOKS = [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth",
    "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah",
    "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah",
    "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum",
    "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi", "Matthew", "Mark", "Luke", "John", "Acts",
    "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians",
    "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews",
    "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"
];

const BIBLE_BOOKS_KO = [
    "창세기", "출애굽기", "레위기", "민수기", "신명기", "여호수아", "사사기", "룻기",
    "사무엘상", "사무엘하", "열왕기상", "열왕기하", "역대상", "역대하", "에스라", "느헤미야",
    "에스더", "욥기", "시편", "잠언", "전도서", "아가", "이사야", "예레미야",
    "애가", "에스겔", "다니엘", "호세아", "요엘", "아모스", "오바댜", "요나", "미가", "나훔",
    "하박국", "스바냐", "학개", "스가랴", "말라기", "마태복음", "마가복음", "누가복음", "요한복음", "사도행전",
    "로마서", "고린도전서", "고린도후서", "갈라디아서", "에베소서", "빌립보서", "골로새서",
    "데살로니가전서", "데살로니가후서", "디모데전서", "디모데후서", "디도서", "빌레몬서", "히브리서",
    "야고보서", "베드로전서", "베드로후서", "요한일서", "요한이서", "요한삼서", "유다서", "요한계시록"
];

const BIBLE_BOOK_CHAPTERS = [
    50, 40, 27, 36, 34, 24, 21, 4,
    31, 24, 22, 25, 29, 36, 10, 13,
    10, 42, 150, 31, 12, 8, 66, 52,
    5, 48, 12, 14, 3, 9, 1, 4, 7, 3,
    3, 3, 2, 14, 4, 28, 16, 24, 21, 28,
    16, 16, 13, 6, 6, 4, 4, 5, 3, 6, 4, 3, 1, 13, 5, 5, 3, 5, 1, 1, 1, 22
];

export default function ReadScreen() {
    const router = useRouter();
    const [book, setBook] = useState("Genesis");
    const [chapter, setChapter] = useState(1);
    const [version, setVersion] = useState("ESV");
    const [verses, setVerses] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isVersionMenuOpen, setIsVersionMenuOpen] = useState(false);
    const [selectedBookForChapter, setSelectedBookForChapter] = useState<string | null>(null);

    const [selectedVerse, setSelectedVerse] = useState<any | null>(null);
    const [selectedWord, setSelectedWord] = useState<string | null>(null);
    const [isAnalyzingVerse, setIsAnalyzingVerse] = useState(false);
    const [deepDiveResult, setDeepDiveResult] = useState<any | null>(null);
    const [showTip, setShowTip] = useState(true);

    const scrollViewRef = useRef<ScrollView>(null);

    const VERSIONS = [
        { id: "ESV", label: "English Standard Version (ESV)" },
        { id: "KRV", label: "한글 (개역한글)" }
    ];

    const fetchChapter = async (b: string, c: number, v: string) => {
        setIsLoading(true);
        try {
            const bookIndex = BIBLE_BOOKS.indexOf(b) + 1;
            const res = await fetch(`https://bolls.life/get-text/${v}/${bookIndex}/${c}/`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setVerses(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
            // Scroll to top
            if (scrollViewRef.current) {
                scrollViewRef.current.scrollTo({ y: 0, animated: true });
            }
        }
    };

    useEffect(() => {
        fetchChapter(book, chapter, version);
    }, [book, chapter, version]);

    const handleNext = () => setChapter(c => c + 1);
    const handlePrev = () => setChapter(c => Math.max(1, c - 1));

    const isKo = version === 'KRV';
    const bookIndex = BIBLE_BOOKS.indexOf(book);
    const displayBook = isKo ? BIBLE_BOOKS_KO[bookIndex] : book;
    const displayChapter = chapter + (isKo ? "장" : "");

    const analyzeVerse = async (verseItem: any, word?: string) => {
        const uid = auth.currentUser?.uid;
        if (!uid) {
            Alert.alert("Error", "You must be signed in to use Deep Dive.");
            return;
        }

        const canUse = await checkAndUpdateUsage(uid, 'deepDive');
        if (!canUse) {
            Alert.alert(
                "Daily Limit Reached",
                "You've used all 3 free Deep Dives for today. Upgrade to Sanctify Plus Premium for unlimited analysis!",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Upgrade Now", onPress: () => router.push('/billing') }
                ]
            );
            return;
        }

        setSelectedVerse(verseItem);
        setSelectedWord(word || null);
        setIsAnalyzingVerse(true);
        setDeepDiveResult(null);

        try {
            const verseClean = verseItem.text.replace(/<[^>]*>?/gm, '');
            const refText = `${displayBook} ${chapter}:${verseItem.verse} (${version})`;

            let prompt = "";

            if (word) {
                prompt = `
You are a profound theologian and Bible scholar.
Analyze the original Hebrew/Greek word for "${word}" within the context of the following verse.

Reference: ${refText}
Verse: "${verseClean}"

Return the response strictly as a JSON object with this exact structure:
{
  "reference": "${refText}",
  "text": "Word: ${word}",
  "original_word": "The Original Greek/Hebrew word for '${word}'",
  "meaning": "Detailed meaning, origin, and significance of this specific word (2-3 sentences max)"
}

IMPORTANT: Reply ONLY in JSON. Also, the output values MUST be in ${isKo ? 'Korean language.' : 'English.'}
`;
            } else {
                prompt = `
You are a profound theologian and Bible scholar.
Analyze the following verse and provide a rich "Deep Dive" explanation.

Reference: ${refText}
Text: "${verseClean}"

Return the response strictly as a JSON object with this exact structure:
{
  "reference": "${refText}",
  "text": "${verseClean}",
  "original_word": "Brief interesting Greek/Hebrew word from this verse with its meaning",
  "meaning": "Deep spiritual and theological meaning (2-3 sentences max)"
}

IMPORTANT: Reply ONLY in JSON. Also, the output values MUST be in ${isKo ? 'Korean language.' : 'English.'}
`;
            }

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                }
            });

            const rawJsonText = response.text;
            const parsed = JSON.parse(rawJsonText || "{}");
            setDeepDiveResult(parsed);

        } catch (err) {
            console.error("Verse analysis error:", err);
            setDeepDiveResult({
                reference: `${displayBook} ${chapter}:${verseItem.verse}`,
                text: verseItem.text.replace(/<[^>]*>?/gm, ''),
                original_word: isKo ? "오류 발생" : "Error",
                meaning: isKo ? "분석을 불러오지 못했습니다. 다시 시도해주세요." : "Failed to load Deep Dive insights. Please try again."
            });
        } finally {
            setIsAnalyzingVerse(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header (Book Selector) */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.bookSelector} onPress={() => setIsMenuOpen(true)}>
                    <Text style={styles.bookTitle}>{displayBook} {displayChapter}</Text>
                    <Ionicons name="chevron-down" size={16} color={Colors.light.text} />
                </TouchableOpacity>
                <View style={styles.actions}>
                    <TouchableOpacity style={styles.versionBadge} onPress={() => setIsVersionMenuOpen(true)}>
                        <Text style={styles.versionBadgeText}>{version}</Text>
                        <Ionicons name="swap-vertical" size={14} color="#D4AF37" style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn}><Ionicons name="search" size={24} color={Colors.light.text} /></TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn}><Ionicons name="bookmarks-outline" size={24} color={Colors.light.text} /></TouchableOpacity>
                </View>
            </View>

            {isLoading ? (
                <View style={[styles.scrollContent, { flex: 1, justifyContent: 'center', alignItems: 'center' }]}>
                    <ActivityIndicator size="large" color="#D4AF37" />
                    <Text style={{ marginTop: 10, color: '#888' }}>
                        {isKo ? "말씀을 불러오는 중..." : "Loading Scripture..."}
                    </Text>
                </View>
            ) : (
                <ScrollView
                    ref={scrollViewRef}
                    contentContainerStyle={styles.scrollContent}
                >
                    {showTip && (
                        <View style={styles.tipBanner}>
                            <Ionicons name="bulb" size={20} color="#D4AF37" style={{ marginRight: 8 }} />
                            <Text style={styles.tipText}>
                                {isKo
                                    ? "단어를 터치하면 원어(히브리어/헬라어) 뜻을, 길게 꾹 누르면 구절 심층 분석을 볼 수 있습니다."
                                    : "Tap a word for original language meaning. Long press a verse for a deep dive."}
                            </Text>
                            <TouchableOpacity onPress={() => setShowTip(false)} style={{ padding: 4 }}>
                                <Ionicons name="close" size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                    )}

                    <Text style={styles.chapterTitle}>{displayBook} {displayChapter}</Text>

                    {verses.map((v, index) => {
                        const verseClean = v.text.replace(/<[^>]*>?/gm, '');
                        const words = verseClean.split(' ');
                        const isVerseSelected = selectedVerse?.verse === v.verse && !selectedWord;
                        const isWordSelected = selectedVerse?.verse === v.verse && selectedWord;

                        return (
                            <View
                                key={index}
                                style={[styles.verseContainer, selectedVerse?.verse === v.verse && styles.verseContainerActive]}
                            >
                                <Text style={[styles.verse, isVerseSelected && { textDecorationLine: 'underline', textDecorationColor: '#D4AF37' }]}>
                                    <Text
                                        style={styles.verseNum}
                                        onPress={() => analyzeVerse(v)} // Tapping the number triggers verse
                                    >{v.verse} </Text>

                                    {words.map((word: string, wIndex: number) => {
                                        const cleanWord = word.replace(/[,.!?;:]/g, ''); // strip punctuation for exact match
                                        const isThisWord = isWordSelected && selectedWord === cleanWord;
                                        return (
                                            <Text
                                                key={wIndex}
                                                style={[
                                                    styles.wordText,
                                                    isThisWord && { backgroundColor: '#FFEDD5', color: '#B45309', fontWeight: 'bold' }
                                                ]}
                                                onPress={() => analyzeVerse(v, cleanWord)}
                                                onLongPress={() => analyzeVerse(v)} // Essential: long pressing *any word* triggers verse
                                            >
                                                {word}{' '}
                                            </Text>
                                        );
                                    })}
                                </Text>
                            </View>
                        );
                    })}

                    {/* Pagination Controls */}
                    <View style={styles.pagination}>
                        <TouchableOpacity style={[styles.pageBtn, chapter === 1 && { opacity: 0.3 }]} onPress={handlePrev} disabled={chapter === 1}>
                            <Ionicons name="chevron-back" size={20} color="#0A2242" />
                            <Text style={styles.pageBtnText}>{isKo ? "이전 장" : "Previous"}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.pageBtn} onPress={handleNext}>
                            <Text style={styles.pageBtnText}>{isKo ? "다음 장" : "Next Chap"}</Text>
                            <Ionicons name="chevron-forward" size={20} color="#0A2242" />
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            )}

            {/* Deep Dive Modal */}
            <Modal visible={!!selectedVerse} animationType="slide" transparent>
                <View style={styles.modalBg}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{isKo ? "말씀 깊이 읽기" : "Scripture Deep Dive"}</Text>
                            <TouchableOpacity onPress={() => setSelectedVerse(null)}>
                                <Ionicons name="close" size={28} color="#0A2242" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalScroll}>
                            {isAnalyzingVerse ? (
                                <View style={{ alignItems: 'center', padding: 40 }}>
                                    <ActivityIndicator size="large" color="#D4AF37" />
                                    <Text style={{ marginTop: 16, color: '#888' }}>
                                        {isKo ? "깊은 묵상을 준비 중입니다..." : "Gathering deep insights..."}
                                    </Text>
                                </View>
                            ) : deepDiveResult ? (
                                <>
                                    <Text style={styles.deepDiveRef}>{deepDiveResult.reference}</Text>
                                    <Text style={styles.deepDiveText}>"{deepDiveResult.text}"</Text>

                                    <View style={styles.insightBox}>
                                        <Text style={styles.insightTitle}>{isKo ? "원어 통찰 📖" : "Original Word 📖"}</Text>
                                        <Text style={styles.insightText}>{deepDiveResult.original_word}</Text>
                                    </View>

                                    <View style={styles.insightBox}>
                                        <Text style={styles.insightTitle}>{isKo ? "깊은 의미 ✨" : "Deep Meaning ✨"}</Text>
                                        <Text style={styles.insightText}>{deepDiveResult.meaning}</Text>
                                    </View>
                                </>
                            ) : null}
                        </ScrollView>

                        {deepDiveResult && !isAnalyzingVerse && (
                            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 10, borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 16 }}>
                                <TouchableOpacity
                                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFBEB', paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#FDE68A' }}
                                    onPress={async () => {
                                        const { auth, db } = require('@/config/firebaseConfig');
                                        const { collection, addDoc, serverTimestamp } = require('firebase/firestore');

                                        const user = auth.currentUser;
                                        if (!user) {
                                            alert("로그인이 필요합니다. (Please log in to save)");
                                            return;
                                        }

                                        try {
                                            await addDoc(collection(db, 'users', user.uid, 'saved_verses'), {
                                                reference: deepDiveResult.reference,
                                                text: deepDiveResult.text,
                                                originalWord: deepDiveResult.original_word,
                                                meaning: deepDiveResult.meaning,
                                                savedAt: serverTimestamp()
                                            });
                                            alert(isKo ? "말씀이 보관함에 저장되었습니다." : "Verse saved to your archive!");
                                            setSelectedVerse(null);
                                        } catch (error) {
                                            console.error("Error saving verse: ", error);
                                            alert("Failed to save. Please try again.");
                                        }
                                    }}
                                >
                                    <Ionicons name="bookmark" size={20} color="#D4AF37" />
                                    <Text style={{ fontFamily: 'SF Pro Display', fontSize: 16, fontWeight: '700', color: '#B45309', marginLeft: 8 }}>
                                        {isKo ? "말씀 저장하기" : "Save Verse"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Book & Chapter Picker Modal */}
            <Modal visible={isMenuOpen} animationType="slide" transparent>
                <View style={styles.modalBg}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            {selectedBookForChapter ? (
                                <TouchableOpacity onPress={() => setSelectedBookForChapter(null)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="arrow-back" size={24} color="#0A2242" />
                                    <Text style={[styles.modalTitle, { marginLeft: 8 }]}>
                                        {isKo ? BIBLE_BOOKS_KO[BIBLE_BOOKS.indexOf(selectedBookForChapter)] : selectedBookForChapter}
                                    </Text>
                                </TouchableOpacity>
                            ) : (
                                <Text style={styles.modalTitle}>{isKo ? "성경책 선택" : "Choose Book"}</Text>
                            )}

                            <TouchableOpacity onPress={() => { setIsMenuOpen(false); setSelectedBookForChapter(null); }}>
                                <Ionicons name="close" size={28} color="#0A2242" />
                            </TouchableOpacity>
                        </View>

                        {selectedBookForChapter ? (
                            <FlatList
                                key="chapters"
                                data={Array.from({ length: BIBLE_BOOK_CHAPTERS[BIBLE_BOOKS.indexOf(selectedBookForChapter)] }, (_, i) => i + 1)}
                                keyExtractor={item => item.toString()}
                                numColumns={5}
                                columnWrapperStyle={{ gap: 10, justifyContent: 'flex-start', marginBottom: 10 }}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={[styles.chapterGridItem, book === selectedBookForChapter && chapter === item && styles.chapterGridItemActive]}
                                        onPress={() => {
                                            setBook(selectedBookForChapter);
                                            setChapter(item);
                                            setIsMenuOpen(false);
                                            setSelectedBookForChapter(null);
                                        }}
                                    >
                                        <Text style={[styles.chapterGridText, book === selectedBookForChapter && chapter === item && styles.chapterGridTextActive]}>
                                            {item}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            />
                        ) : (
                            <FlatList
                                key="books"
                                data={BIBLE_BOOKS}
                                keyExtractor={item => item}
                                numColumns={2}
                                columnWrapperStyle={{ gap: 10 }}
                                renderItem={({ item, index }) => (
                                    <TouchableOpacity
                                        style={[styles.bookGridItem, book === item && styles.bookGridItemActive]}
                                        onPress={() => setSelectedBookForChapter(item)}
                                    >
                                        <Text style={[styles.bookGridText, book === item && styles.bookGridTextActive]}>
                                            {isKo ? BIBLE_BOOKS_KO[index] : item}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            />
                        )}
                    </View>
                </View>
            </Modal>

            {/* Version Picker Modal */}
            <Modal visible={isVersionMenuOpen} animationType="fade" transparent>
                <View style={styles.modalBgCenter}>
                    <View style={styles.versionModalContainer}>
                        <View style={styles.versionHeader}>
                            <Text style={styles.modalTitle}>Translation</Text>
                            <TouchableOpacity onPress={() => setIsVersionMenuOpen(false)}>
                                <Ionicons name="close" size={24} color="#0A2242" />
                            </TouchableOpacity>
                        </View>
                        {VERSIONS.map((v) => (
                            <TouchableOpacity
                                key={v.id}
                                style={[styles.versionOption, version === v.id && styles.versionOptionActive]}
                                onPress={() => {
                                    setVersion(v.id);
                                    setIsVersionMenuOpen(false);
                                }}
                            >
                                <Text style={[styles.versionOptionText, version === v.id && styles.versionOptionTextActive]}>
                                    {v.label}
                                </Text>
                                {version === v.id && <Ionicons name="checkmark-circle" size={20} color="#D4AF37" />}
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </Modal>

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background, // Off-white paper feel
        paddingTop: Platform.OS === 'android' ? 40 : 0
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        backgroundColor: '#fff',
    },
    bookSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    bookTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.light.text,
        marginRight: 6,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
    },
    versionBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF8E1',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FFECB3'
    },
    versionBadgeText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#D4AF37',
    },
    iconBtn: {
        padding: 4,
    },
    scrollContent: {
        padding: 24,
        paddingBottom: 60,
    },
    modalScroll: {
        marginBottom: 20,
    },
    chapterTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: Colors.light.text,
        marginBottom: 24,
        textAlign: 'center',
    },
    verseContainer: {
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderRadius: 8,
        marginHorizontal: -8, // Bleed nicely for the background effect
    },
    verseContainerActive: {
        backgroundColor: '#FFF8E1',
    },
    verse: {
        fontSize: 19,
        lineHeight: 32,
        color: '#333',
        marginBottom: 4,
    },
    verseNum: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#D4AF37', // Gold verse numbers
    },
    pagination: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 40,
        borderTopWidth: 1,
        borderTopColor: '#EEE',
        paddingTop: 20,
    },
    pageBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: '#F5F5F5',
        borderRadius: 20,
    },
    pageBtnText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0A2242',
        marginHorizontal: 4,
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
        height: '80%',
        padding: 24,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#0A2242',
    },
    bookGridItem: {
        flex: 1,
        backgroundColor: '#F9F9F9',
        padding: 16,
        marginBottom: 10,
        borderRadius: 12,
        alignItems: 'center',
    },
    bookGridItemActive: {
        backgroundColor: '#D4AF37',
        borderColor: '#D4AF37',
    },
    bookGridText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#0A2242',
    },
    bookGridTextActive: {
        color: '#FFF',
    },
    chapterGridItem: {
        width: '17%', // roughly 5 items per row
        aspectRatio: 1,
        borderWidth: 1,
        borderColor: '#eee',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 8,
    },
    chapterGridItemActive: {
        backgroundColor: '#D4AF37',
        borderColor: '#D4AF37',
    },
    chapterGridText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0A2242',
    },
    chapterGridTextActive: {
        color: '#fff',
    },
    // Version Picker Styles
    modalBgCenter: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    versionModalContainer: {
        width: '80%',
        backgroundColor: '#FFF',
        borderRadius: 20,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10,
    },
    versionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    versionOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: '#F9F9F9',
        marginBottom: 8,
    },
    versionOptionActive: {
        backgroundColor: '#FFF8E1',
        borderColor: '#FFE082',
        borderWidth: 1,
    },
    versionOptionText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#4A4A4A',
    },
    versionOptionTextActive: {
        color: '#D4AF37',
        fontWeight: '700',
    },
    deepDiveRef: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#D4AF37',
        marginBottom: 8,
        textAlign: 'center',
    },
    deepDiveText: {
        fontSize: 18,
        fontStyle: 'italic',
        color: '#333',
        marginBottom: 24,
        textAlign: 'center',
        lineHeight: 28,
    },
    insightBox: {
        backgroundColor: '#F9F9F9',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        borderLeftWidth: 4,
        borderLeftColor: '#D4AF37'
    },
    insightTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0A2242',
        marginBottom: 8,
    },
    insightText: {
        fontSize: 15,
        color: '#4A4A4A',
        lineHeight: 24,
    },
    tipBanner: {
        flexDirection: 'row',
        backgroundColor: '#FFFBEB',
        padding: 12,
        borderRadius: 12,
        marginBottom: 20,
        alignItems: 'flex-start',
        borderWidth: 1,
        borderColor: '#FDE68A',
    },
    tipText: {
        flex: 1,
        fontSize: 13,
        color: '#B45309',
        lineHeight: 18,
    },
    wordText: {
        // Any specific word styling if needed, otherwise inherit from parent Text
    }
});
