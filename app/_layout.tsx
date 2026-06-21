import { LanguageProvider } from "@/context/LanguageContext";
import messaging from "@react-native-firebase/messaging";
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { PermissionsAndroid, Platform } from "react-native";
import { MenuProvider } from 'react-native-popup-menu';
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import NetworkOverlay from "@/components/NetworkOverlay";
import notifee, { EventType } from '@notifee/react-native';
import { useRouter } from 'expo-router';
import { Audio } from 'expo-av';

SplashScreen.preventAutoHideAsync();

notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'stop') {
    if (detail.notification?.id) {
      await notifee.cancelNotification(detail.notification.id);
    }
  }
});

messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log("🔥 Background notification:", remoteMessage);
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Mandali': require('../assets/fonts/Mandali-Regular.ttf')
  });
  const router = useRouter();
  const [initialRoute, setInitialRoute] = useState<string | null>(null);

  useEffect(() => {
    async function setupApp() {
      // Handle Alarm notification wakeup
      const initialNotification = await notifee.getInitialNotification();
      if (initialNotification?.notification?.data?.reminderId) {
        const { task, crop, reminderId } = initialNotification.notification.data;
        const id = initialNotification.notification.id;
        setTimeout(() => {
          router.replace(`/farmer/reminders/alarm-ring?task=${encodeURIComponent(task as string)}&crop=${encodeURIComponent(crop as string)}&reminderId=${reminderId}&notifId=${id}`);
        }, 100);
      }
      // 🔥 1. Splash hide & Configure Nav Bar
      if (fontsLoaded) {
        if (Platform.OS === 'android') {
          import('expo-navigation-bar').then(NavigationBar => {
            NavigationBar.setBackgroundColorAsync("#FFFFFF");
            NavigationBar.setButtonStyleAsync("dark");
          }).catch(() => {});
        }
        await SplashScreen.hideAsync();
      }

      // 🔥 2. USER ACTIVE TRACK
      const phone = await AsyncStorage.getItem("USER_PHONE");

      if (phone) {
        await firestore()
          .collection("users")
          .doc(phone)
          .update({
            lastActiveAt: firestore.FieldValue.serverTimestamp()
          });
      }
    }

    setupApp();

    const unsubscribe = notifee.onForegroundEvent(async ({ type, detail }) => {
      if ((type === EventType.DELIVERED || type === EventType.PRESS) && detail.notification?.data?.reminderId) {
        const { task, crop, reminderId } = detail.notification.data;
        const id = detail.notification.id;
        router.replace(`/farmer/reminders/alarm-ring?task=${encodeURIComponent(task as string)}&crop=${encodeURIComponent(crop as string)}&reminderId=${reminderId}&notifId=${id}` as any);
      }
    });

    return () => unsubscribe();
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <LanguageProvider>
      <MenuProvider>
        <Stack screenOptions={{ headerShown: false }} />
        <NetworkOverlay />
      </MenuProvider>
    </LanguageProvider>
  );
}