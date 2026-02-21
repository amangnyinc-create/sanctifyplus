import { Tabs } from 'expo-router';
import React from 'react';
import { MaterialCommunityIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { Platform } from 'react-native';

export default function TabLayout() {
  const colorScheme = 'light'; // Force light mode for now

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors[colorScheme ?? 'light'].background,
          borderTopWidth: 0,
          elevation: 0,
          height: Platform.OS === 'ios' ? 90 : 70,
          paddingBottom: Platform.OS === 'ios' ? 30 : 10,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto', // Will add custom font later
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Sermon',
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons name={focused ? 'microphone' : 'microphone-outline'} size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="bible"
        options={{
          title: 'Deep Dive',
          tabBarIcon: ({ color, focused }) => (
            <FontAwesome5 name={focused ? 'search' : 'search'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="read"
        options={{
          title: 'Scripture',
          tabBarIcon: ({ color, focused }) => (
            <FontAwesome5 name={focused ? 'book-open' : 'book'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="prayer"
        options={{
          title: 'Prayer',
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons name={focused ? 'hands-pray' : 'hands-pray'} size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
