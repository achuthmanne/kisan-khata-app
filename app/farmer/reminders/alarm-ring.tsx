import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Dimensions, SafeAreaView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, Easing } from 'react-native-reanimated';
import notifee from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKeepAwake } from 'expo-keep-awake';

import AppText from '@/components/AppText';

const { width, height } = Dimensions.get('window');

const isSmallScreen = height < 700;
const outerSize = Math.min(width * 0.40, 180);
const innerSize = Math.min(width * 0.35, 160);

export default function AlarmRingScreen() {
  const router = useRouter();
  const { task, crop, reminderId, notifId } = useLocalSearchParams();
  const [language, setLanguage] = useState<"te" | "en">("te");
  
  useKeepAwake(); // Prevents screen from turning off while alarm rings

  // Pulse animation for the logo
  const scale = useSharedValue(1);

  useEffect(() => {
    // Load language preference
    const loadLang = async () => {
      try {
        const storedLang = await AsyncStorage.getItem("APP_LANG");
        if (storedLang) setLanguage(storedLang as "te" | "en");
      } catch (e) {
        console.log(e);
      }
    };
    loadLang();

    // Start pulse animation
    scale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1, // Infinite
      true
    );

    // No need to play expo-av sound because native Android notification sound is already looping!
    // Native sound automatically plays when notification is delivered.

    return () => {
      // Nothing to cleanup here since native handles sound
    };
  }, []);

  const stopAlarm = async () => {
    if (notifId) {
      await notifee.cancelNotification(notifId as string);
    }
    
    // Get role to navigate to correct home
    const role = await AsyncStorage.getItem("USER_ROLE");
    const isFarmer = role?.toUpperCase() === "FARMER" || role === "రైతు";
    
    // First, force the root stack to go to Home so we have a valid back-history
    router.replace(isFarmer ? ("/farmer/(tabs)" as any) : ("/(tabs)" as any));
    
    // Then immediately push the reminders screen on top!
    setTimeout(() => {
      router.push('/farmer/reminders');
    }, 100);
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }]
    };
  });

  const texts = {
    title: language === "te" ? "కిసాన్ ఖాతా" : "Kisan Khata",
    subtitle: language === "te" ? "వ్యవసాయ పని సమయం!" : "Farming Task Reminder!",
    defaultTask: language === "te" ? "వ్యవసాయ పని" : "Farming Task",
    stopBtn: language === "te" ? "అలారం ఆపు" : "STOP ALARM",
  };

  return (
    <LinearGradient colors={["#064E3B", "#16A34A"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          
          <View style={styles.header}>
            <AppText style={styles.appName} language={language}>{texts.title}</AppText>
            <AppText style={styles.titleText} language={language}>{texts.subtitle}</AppText>
          </View>

          <Animated.View style={[styles.logoOuter, animatedStyle]}>
            <View style={styles.logoInner}>
              <Image source={require('@/assets/images/logo.png')} style={styles.logo} />
            </View>
          </Animated.View>

          <View style={styles.taskCard}>
            <View style={styles.iconCircle}>
              <Ionicons name="notifications" size={32} color="#16A34A" />
            </View>
            <AppText style={styles.taskText} language={language}>{task || texts.defaultTask}</AppText>
            {!!crop && (
              <AppText style={styles.cropText} language={language}>{crop}</AppText>
            )}
          </View>
        </View>

        <TouchableOpacity activeOpacity={0.8} style={styles.stopButton} onPress={stopAlarm}>
          <View style={styles.stopButtonInner}>
            <Ionicons name="notifications-off" size={28} color="#EF4444" style={styles.stopIcon} />
            <AppText style={styles.stopButtonText} language={language}>{texts.stopBtn}</AppText>
          </View>
        </TouchableOpacity>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: height * 0.05, // Responsive vertical padding
  },
  content: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 24,
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  appName: {
    fontSize: 28,
    color: '#D1FAE5',
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 8,
    fontFamily: 'Mandali',
  },
  titleText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.9,
    fontFamily: 'Mandali',
  },
  logoOuter: {
    width: outerSize,
    height: outerSize,
    borderRadius: outerSize / 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: isSmallScreen ? 30 : 50,
  },
  logoInner: {
    width: innerSize,
    height: innerSize,
    borderRadius: innerSize / 2,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.4)',
    overflow: 'hidden',
  },
  logo: {
    width: '90%',
    height: '90%',
    resizeMode: 'contain',
  },
  taskCard: {
    backgroundColor: '#ffffff',
    width: '100%',
    paddingVertical: 35,
    paddingHorizontal: 20,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  taskText: {
    fontSize: 24,
    color: '#111827',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: 'Mandali',
  },
  cropText: {
    fontSize: 18,
    color: '#4B5563',
    fontWeight: '500',
    textAlign: 'center',
    fontFamily: 'Mandali',
  },
  stopButton: {
    width: width - 48,
    backgroundColor: '#fff',
    borderRadius: 100,
    overflow: 'hidden',
    marginTop: 20,
  },
  stopButtonInner: {
    flexDirection: 'row',
    height: 65,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  stopIcon: {
    marginRight: 12,
  },
  stopButtonText: {
    color: '#EF4444',
    fontSize: 22,
    fontWeight: '600',
    fontFamily: 'Mandali',
    letterSpacing: 0.5,
  }
});
