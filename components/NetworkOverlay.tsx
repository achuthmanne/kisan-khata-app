import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNetInfo } from "@react-native-community/netinfo";
import React, { useEffect, useState } from "react";
import { Modal, StatusBar, StyleSheet, View } from "react-native";
import Animated, { SlideInDown, SlideOutDown } from "react-native-reanimated";
import AppText from "./AppText";

export default function NetworkOverlay() {
  const netInfo = useNetInfo();
  const [language, setLanguage] = useState<"te" | "en">("te");

  // Load language once
  useEffect(() => {
    const loadLang = async () => {
      const lang = await AsyncStorage.getItem("APP_LANG");
      if (lang) setLanguage(lang as "te" | "en");
    };
    loadLang();
  }, []);

  // We consider it offline ONLY if isConnected is explicitly false.
  // OR if isInternetReachable is explicitly false (e.g. WiFi is ON but router has no internet, or Mobile Data ON but no balance)
  // When the app starts, these might be null for a split second, so we check `=== false`
  const isOffline = netInfo.isConnected === false || netInfo.isInternetReachable === false;

  return (
    <Modal
      visible={isOffline}
      transparent={true}
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <StatusBar barStyle="light-content" backgroundColor="rgba(0,0,0,0.9)" />
        
        <Animated.View 
          entering={SlideInDown.duration(400).springify()} 
          exiting={SlideOutDown.duration(300)}
          style={styles.card}
        >
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="wifi-off" size={60} color="#EF4444" />
          </View>
          
          <AppText style={styles.title} language={language}>
            {language === "te" ? "ఇంటర్నెట్ కనెక్షన్ లేదు!" : "No Internet Connection!"}
          </AppText>
          
          <AppText style={styles.subtitle} language={language}>
            {language === "te" 
              ? "దయచేసి మీ మొబైల్ డేటా లేదా వైఫై (WiFi) ఆన్ చేసి మళ్ళీ ప్రయత్నించండి." 
              : "Please turn on your Mobile Data or WiFi to continue using the app."}
          </AppText>
          
          <View style={styles.pulseDotContainer}>
            <View style={styles.pulseDot} />
            <AppText style={styles.waitingText} language={language}>
              {language === "te" ? "ఇంటర్నెట్ కోసం వేచి ఉన్నాము..." : "Waiting for connection..."}
            </AppText>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)", 
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    zIndex: 99999, // Ensure it sits on top of everything
  },
  card: {
    backgroundColor: "#FFFFFF",
    width: "100%",
    maxWidth: 400,
    borderRadius: 24,
    padding: 30,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#FEE2E2", // Light red
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    color: "#111827",
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: "#4B5563",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 25,
  },
  pulseDotContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#EF4444",
    marginRight: 10,
  },
  waitingText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  }
});
