import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, StatusBar, Alert, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView } from 'react-native-webview';
import { auth, db } from '../config/firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';
import { getPayPalToken, createPayPalOrder, capturePayPalOrder } from '../utils/paypalApi';

export default function BillingScreen() {
    const router = useRouter();
    const [showWebView, setShowWebView] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [orderId, setOrderId] = useState<string | null>(null);
    const [approvalUrl, setApprovalUrl] = useState<string | null>(null);

    const handlePurchase = async () => {
        Alert.alert(
            "Security Confirmation",
            "You are about to securely connect to PayPal to upgrade your account to Premium.\n\n$9.99/month. Cancel anytime. Proceed?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Connect to PayPal",
                    style: "default",
                    onPress: async () => {
                        setIsLoading(true);
                        try {
                            const token = await getPayPalToken();
                            const order = await createPayPalOrder(token, "9.99");

                            if (order.id) {
                                setOrderId(order.id);
                                const approveLink = order.links.find((link: any) => link.rel === 'approve');
                                if (approveLink) {
                                    setApprovalUrl(approveLink.href);
                                    setShowWebView(true);
                                }
                            } else {
                                throw new Error("Failed to create PayPal order.");
                            }
                        } catch (error) {
                            console.error(error);
                            Alert.alert(
                                "Demo Mode / Error",
                                "Network issue or using incomplete PayPal keys. Would you like to simulate a successful payment for testing?",
                                [
                                    { text: "Cancel", style: "cancel" },
                                    { text: "Simulate Success", onPress: finalizePurchase }
                                ]
                            );
                        } finally {
                            setIsLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const finalizePurchase = async () => {
        setIsLoading(true);
        try {
            const user = auth.currentUser;
            if (user) {
                // Update Firestore to mark user as premium
                await updateDoc(doc(db, 'users', user.uid), {
                    isPremium: true,
                    premiumStartedAt: new Date(),
                });

                Alert.alert(
                    "Welcome to Premium!",
                    "Your Sanctify Plus Premium features are now active.",
                    [{ text: "Great!", onPress: () => router.replace('/profile') }]
                );
            }
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Payment failed. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    if (showWebView && approvalUrl) {
        return (
            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.webViewHeader}>
                    <TouchableOpacity onPress={() => setShowWebView(false)}>
                        <Ionicons name="close" size={28} color="#000" />
                    </TouchableOpacity>
                    <Text style={styles.webViewTitle}>PayPal Checkout</Text>
                    <View style={{ width: 28 }} />
                </View>
                <WebView
                    source={{ uri: approvalUrl }}
                    onNavigationStateChange={async (navState) => {
                        if (navState.url.includes('success')) {
                            setShowWebView(false);
                            if (orderId) {
                                try {
                                    setIsLoading(true);
                                    const token = await getPayPalToken();
                                    const capture = await capturePayPalOrder(token, orderId);
                                    if (capture.status === 'COMPLETED') {
                                        await finalizePurchase();
                                    } else {
                                        Alert.alert("Payment Failed", "The payment could not be captured.");
                                    }
                                } catch (error) {
                                    console.error("Capture error:", error);
                                    Alert.alert("Error", "Could not complete the capture process.");
                                } finally {
                                    setIsLoading(false);
                                }
                            }
                        } else if (navState.url.includes('cancel')) {
                            setShowWebView(false);
                        }
                    }}
                />
            </SafeAreaView>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#0A2242" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Premium</Text>
                    <View style={{ width: 24 }} />
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.heroSection}>
                        <LinearGradient
                            colors={['#D4AF37', '#B8860B']}
                            style={styles.heroBadge}
                        >
                            <Ionicons name="sparkles" size={20} color="#FFF" />
                            <Text style={styles.heroBadgeText}>LIMITED OFFER</Text>
                        </LinearGradient>
                        <Text style={styles.mainTitle}>Sanctify Plus{"\n"}Premium</Text>
                        <Text style={styles.mainSubtitle}>Elevate your spiritual journey with AI-powered insights.</Text>
                    </View>

                    <View style={styles.comparisonSection}>
                        <View style={styles.tableHeader}>
                            <View style={styles.featureCol}><Text style={styles.headerText}>Features</Text></View>
                            <View style={styles.freeCol}><Text style={styles.headerText}>Free</Text></View>
                            <View style={styles.plusCol}><Text style={styles.plusHeaderText}>Plus</Text></View>
                        </View>

                        <View style={styles.tableRow}>
                            <View style={styles.featureCol}><Text style={styles.rowTitle}>Bible Reading</Text></View>
                            <View style={styles.freeCol}><Text style={styles.rowText}>Unlimited</Text></View>
                            <View style={styles.plusCol}><Text style={styles.plusRowText}>Unlimited</Text></View>
                        </View>

                        <View style={styles.tableRow}>
                            <View style={styles.featureCol}><Text style={styles.rowTitle}>AI Deep Dive</Text></View>
                            <View style={styles.freeCol}><Text style={styles.rowText}>3 / day</Text></View>
                            <View style={styles.plusCol}>
                                <View style={styles.unlimitedBadge}>
                                    <Text style={styles.unlimitedText}>Unlimited</Text>
                                </View>
                            </View>
                        </View>

                        <View style={styles.tableRow}>
                            <View style={styles.featureCol}><Text style={styles.rowTitle}>Prayer Artisan</Text></View>
                            <View style={styles.freeCol}><Text style={styles.rowText}>3 / day</Text></View>
                            <View style={styles.plusCol}>
                                <View style={styles.unlimitedBadge}>
                                    <Text style={styles.unlimitedText}>Unlimited</Text>
                                </View>
                            </View>
                        </View>

                        <View style={styles.tableRow}>
                            <View style={styles.featureCol}><Text style={styles.rowTitle}>Sermon Archive</Text></View>
                            <View style={styles.freeCol}><Text style={styles.rowText}>Recent 10</Text></View>
                            <View style={styles.plusCol}>
                                <View style={styles.unlimitedBadge}>
                                    <Text style={styles.unlimitedText}>Unlimited</Text>
                                </View>
                            </View>
                        </View>

                        <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
                            <View style={styles.featureCol}><Text style={styles.rowTitle}>Early Access</Text></View>
                            <View style={styles.freeCol}><Ionicons name="close" size={20} color="#94A3B8" /></View>
                            <View style={styles.plusCol}><Ionicons name="checkmark-circle" size={20} color="#D4AF37" /></View>
                        </View>
                    </View>

                    <View style={styles.pricingSection}>
                        <View style={styles.pricingCard}>
                            <Text style={styles.pricingLabel}>Monthly Plan</Text>
                            <View style={styles.priceRow}>
                                <Text style={styles.currency}>$</Text>
                                <Text style={styles.price}>9.99</Text>
                                <Text style={styles.period}>/ month</Text>
                            </View>
                            <Text style={styles.pricingNote}>Cancel anytime. No hidden fees.</Text>
                        </View>
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={styles.payButton}
                        onPress={handlePurchase}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#020C17" />
                        ) : (
                            <>
                                <Ionicons name="card" size={20} color="#020C17" style={{ marginRight: 8 }} />
                                <Text style={styles.payButtonText}>Pay with PayPal or Card</Text>
                            </>
                        )}
                    </TouchableOpacity>
                    <Text style={styles.footerTerms}>
                        Supports PayPal accounts, Credit, and Debit cards.{'\n'}
                        By clicking pay, you agree to our Terms of Service.
                    </Text>
                </View>
            </SafeAreaView>
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
        paddingHorizontal: 16,
        height: 60,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0A2242',
    },
    scrollContent: {
        paddingBottom: 40,
    },
    heroSection: {
        alignItems: 'center',
        paddingTop: 30,
        paddingBottom: 40,
        paddingHorizontal: 30,
    },
    heroBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginBottom: 16,
    },
    heroBadgeText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '800',
        marginLeft: 6,
    },
    mainTitle: {
        fontSize: 32,
        fontWeight: '800',
        color: '#0A2242',
        textAlign: 'center',
        lineHeight: 40,
    },
    mainSubtitle: {
        fontSize: 16,
        color: '#64748B',
        textAlign: 'center',
        marginTop: 12,
        lineHeight: 24,
    },
    comparisonSection: {
        marginHorizontal: 20,
        marginBottom: 40,
        backgroundColor: '#FFF',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    tableHeader: {
        flexDirection: 'row',
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        alignItems: 'center',
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        alignItems: 'center',
    },
    featureCol: {
        flex: 2,
        paddingRight: 8,
    },
    freeCol: {
        flex: 1,
        alignItems: 'center',
    },
    plusCol: {
        flex: 1.2,
        alignItems: 'center',
        backgroundColor: '#FFFBEB',
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
    },
    headerText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#64748B',
    },
    plusHeaderText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#D4AF37',
    },
    rowTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1E293B',
    },
    rowText: {
        fontSize: 14,
        color: '#64748B',
        fontWeight: '500',
    },
    plusRowText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#B45309',
    },
    unlimitedBadge: {
        backgroundColor: '#D4AF37',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    unlimitedText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '800',
    },
    pricingSection: {
        paddingHorizontal: 24,
        marginBottom: 20,
    },
    pricingCard: {
        backgroundColor: '#FFF',
        borderRadius: 24,
        padding: 30,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#D4AF37',
        shadowColor: '#D4AF37',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    pricingLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#D4AF37',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 8,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    currency: {
        fontSize: 24,
        fontWeight: '700',
        color: '#0A2242',
    },
    price: {
        fontSize: 48,
        fontWeight: '800',
        color: '#0A2242',
    },
    period: {
        fontSize: 18,
        color: '#64748B',
        marginLeft: 4,
    },
    pricingNote: {
        fontSize: 14,
        color: '#94A3B8',
        marginTop: 12,
    },
    footer: {
        padding: 24,
        backgroundColor: '#FFF',
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
    },
    payButton: {
        backgroundColor: '#D4AF37',
        paddingVertical: 18,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    payButtonText: {
        color: '#020C17',
        fontSize: 18,
        fontWeight: '700',
    },
    footerTerms: {
        fontSize: 12,
        color: '#94A3B8',
        textAlign: 'center',
        marginTop: 16,
    },
    webViewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        height: 50,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#EEE',
    },
    webViewTitle: {
        fontSize: 16,
        fontWeight: '600',
    }
});
