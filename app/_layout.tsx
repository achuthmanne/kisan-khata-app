import { LanguageProvider } from "@/context/LanguageContext";
import messaging from "@react-native-firebase/messaging";
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { PermissionsAndroid, Platform } from "react-native";
import { MenuProvider } from 'react-native-popup-menu';
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import NetworkOverlay from "@/components/NetworkOverlay";

SplashScreen.preventAutoHideAsync();

messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log("🔥 Background notification:", remoteMessage);
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Mandali': require('../assets/fonts/Mandali-Regular.ttf')
  });

  useEffect(() => {
    async function setupApp() {
      // 🔥 1. Splash hide
      if (fontsLoaded) {
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
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <LanguageProvider>
      <MenuProvider>
        <NetworkOverlay />
        <Stack screenOptions={{ headerShown: false }} />
      </MenuProvider>
    </LanguageProvider>
  );
}