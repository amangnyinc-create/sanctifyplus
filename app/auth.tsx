import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db } from '../config/firebaseConfig';
import { collection, doc, setDoc } from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';

export default function AuthScreen() {
    const router = useRouter();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const handleAuthentication = async () => {
        if (!email || !password) {
            setErrorMsg('Please enter both email and password.');
            return;
        }

        setLoading(true);
        setErrorMsg('');

        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
                router.replace('/profile');
            } else {
                if (!name) {
                    setErrorMsg('Please enter your name.');
                    setLoading(false);
                    return;
                }
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(userCredential.user, { displayName: name });

                // Also create a user document in Firestore to be safe
                await setDoc(doc(db, 'users', userCredential.user.uid), {
                    uid: userCredential.user.uid,
                    email: email,
                    displayName: name,
                    createdAt: new Date()
                });

                router.replace('/profile');
            }
        } catch (error: any) {
            console.error(error);
            setErrorMsg(error.message || 'Authentication failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={styles.content}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="close" size={28} color="#FFFFFF" />
                </TouchableOpacity>

                <View style={styles.headerContainer}>
                    <Text style={styles.title}>{isLogin ? 'Welcome Back' : 'Join Sanctify Plus'}</Text>
                    <Text style={styles.subtitle}>
                        {isLogin ? 'Sign in to access your premium features and saved prayers.' : 'Create an account to save your prayers and deep dives.'}
                    </Text>
                </View>

                {errorMsg ? (
                    <View style={styles.errorBox}>
                        <Ionicons name="alert-circle" size={20} color="#EF4444" />
                        <Text style={styles.errorText}>{errorMsg}</Text>
                    </View>
                ) : null}

                <View style={styles.form}>
                    {!isLogin && (
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Full Name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Your Name"
                                placeholderTextColor="#64748B"
                                value={name}
                                onChangeText={setName}
                            />
                        </View>
                    )}

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Email Address</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="hello@example.com"
                            placeholderTextColor="#64748B"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Password</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="••••••••"
                            placeholderTextColor="#64748B"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.mainButton, loading && styles.mainButtonDisabled]}
                        onPress={handleAuthentication}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#020C17" />
                        ) : (
                            <Text style={styles.mainButtonText}>
                                {isLogin ? 'Sign In' : 'Create Account'}
                            </Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.switchModeButton} onPress={() => setIsLogin(!isLogin)}>
                        <Text style={styles.switchModeText}>
                            {isLogin ? "Don't have an account? " : "Already have an account? "}
                            <Text style={styles.switchModeTextBold}>
                                {isLogin ? 'Sign Up' : 'Log In'}
                            </Text>
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#020C17', // Deep navy
    },
    content: {
        flex: 1,
        padding: 24,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        justifyContent: 'center',
    },
    backButton: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 30,
        right: 20,
        zIndex: 10,
        padding: 8,
    },
    headerContainer: {
        marginBottom: 40,
    },
    title: {
        fontSize: 32,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#94A3B8',
        lineHeight: 24,
    },
    errorBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        padding: 12,
        borderRadius: 8,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    errorText: {
        color: '#EF4444',
        marginLeft: 8,
        flex: 1,
        fontSize: 14,
    },
    form: {
        width: '100%',
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        color: '#CBD5E1',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#0F172A',
        borderWidth: 1,
        borderColor: '#1E293B',
        borderRadius: 12,
        padding: 16,
        color: '#FFFFFF',
        fontSize: 16,
    },
    mainButton: {
        backgroundColor: '#D4AF37', // Gold
        padding: 18,
        borderRadius: 30,
        alignItems: 'center',
        marginTop: 10,
        shadowColor: '#D4AF37',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    mainButtonDisabled: {
        opacity: 0.7,
    },
    mainButtonText: {
        color: '#020C17',
        fontSize: 18,
        fontWeight: '700',
    },
    switchModeButton: {
        marginTop: 24,
        alignItems: 'center',
    },
    switchModeText: {
        color: '#94A3B8',
        fontSize: 15,
    },
    switchModeTextBold: {
        color: '#D4AF37',
        fontWeight: '700',
    }
});
