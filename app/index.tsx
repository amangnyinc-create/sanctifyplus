import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Animated, ImageBackground, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const ONBOARDING_DATA = [
    {
        title: "A Sacred Start",
        subtitle: "Deep reflection, just for you. Sanctify Plus.",
        image: "https://images.unsplash.com/photo-1494548162494-384bba4ab999?w=1080&q=80",
    },
    {
        title: "Scripture Lens",
        subtitle: "Deepen your reading with original language insights.",
        image: "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?w=1080&q=80",
    },
    {
        title: "Prayer Artisan",
        subtitle: "Your personal prayer companion for every burden.",
        image: "https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?w=1080&q=80",
    }
];

export default function OnboardingScreen() {
    const router = useRouter();
    const [currentIndex, setCurrentIndex] = useState(0);
    const fadeAnim = useRef(new Animated.Value(1)).current;

    // Background and text cross-fade animation
    const goToNextSlide = () => {
        if (currentIndex < ONBOARDING_DATA.length - 1) {
            Animated.sequence([
                Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
            ]).start(() => {
                setCurrentIndex((prev) => prev + 1);
                Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
            });
        }
    };

    const finishOnboarding = () => {
        // Here we could set AsyncStorage 'has_seen_onboarding' to true later
        router.replace('/(tabs)');
    };

    const currentSlide = ONBOARDING_DATA[currentIndex];
    const isLastSlide = currentIndex === ONBOARDING_DATA.length - 1;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

            <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim, backgroundColor: '#020C17' }]}>
                {currentSlide.image && (
                    <ImageBackground
                        source={{ uri: currentSlide.image }}
                        style={styles.backgroundImage}
                        resizeMode="cover"
                    >
                        <View style={styles.overlay} />
                    </ImageBackground>
                )}
            </Animated.View>

            <View style={styles.contentContainer}>
                <Animated.View style={[styles.textContainer, { opacity: fadeAnim, transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
                    <Text style={styles.title}>{currentSlide.title}</Text>
                    <Text style={styles.subtitle}>{currentSlide.subtitle}</Text>
                </Animated.View>

                {/* Dots indicator */}
                <View style={styles.indicatorContainer}>
                    {ONBOARDING_DATA.map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.dot,
                                currentIndex === index ? styles.activeDot : styles.inactiveDot
                            ]}
                        />
                    ))}
                </View>

                {/* Bottom Buttons */}
                <View style={styles.buttonContainer}>
                    {isLastSlide ? (
                        <TouchableOpacity style={styles.mainButton} onPress={finishOnboarding} activeOpacity={0.8}>
                            <Text style={styles.mainButtonText}>Enter Sanctify Plus</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity style={styles.nextButton} onPress={goToNextSlide} activeOpacity={0.8}>
                            <Text style={styles.nextButtonText}>Next</Text>
                            <Ionicons name="arrow-forward" size={20} color="#FFF" style={{ marginLeft: 8 }} />
                        </TouchableOpacity>
                    )}

                    {!isLastSlide && (
                        <TouchableOpacity style={styles.skipButton} onPress={finishOnboarding}>
                            <Text style={styles.skipText}>Skip</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    backgroundImage: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.55)', // Premium dark overlay
    },
    contentContainer: {
        flex: 1,
        justifyContent: 'flex-end',
        paddingHorizontal: 30,
        paddingBottom: 60,
    },
    textContainer: {
        marginBottom: 40,
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: '#FFFFFF',
        marginBottom: 16,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 18,
        color: '#E0E0E0',
        lineHeight: 28,
        fontWeight: '400',
    },
    indicatorContainer: {
        flexDirection: 'row',
        marginBottom: 40,
    },
    dot: {
        height: 6,
        borderRadius: 3,
        marginRight: 8,
    },
    activeDot: {
        width: 24,
        backgroundColor: '#D4AF37', // Gold color
    },
    inactiveDot: {
        width: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
    },
    buttonContainer: {
        alignItems: 'center',
        width: '100%',
    },
    nextButton: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    nextButtonText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '600',
    },
    mainButton: {
        backgroundColor: '#D4AF37', // Solid premium gold
        width: '100%',
        paddingVertical: 18,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
    },
    mainButtonText: {
        color: '#020C17', // Deep navy for contrast with gold
        fontSize: 18,
        fontWeight: '700',
    },
    skipButton: {
        paddingVertical: 10,
    },
    skipText: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 15,
        fontWeight: '500',
    }
});
