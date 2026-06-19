import { useLanguage } from "@/context/LanguageContext";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useNetInfo } from "@react-native-community/netinfo";
import React, { useState, useEffect } from "react";
import { StyleSheet, View, TouchableOpacity } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppText from "./AppText";

export default function NetworkOverlay() {
  const netInfo = useNetInfo();
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  const [dismissed, setDismissed] = useState(false);

  // We consider it offline ONLY if isConnected is explicitly false.
  // OR if isInternetReachable is explicitly false
  const isOffline = netInfo.isConnected === false || netInfo.isInternetReachable === false;

  // Reset dismissed state if internet comes back, so it shows again next time it goes offline
  useEffect(() => {
    if (!isOffline) {
      setDismissed(false);
    }
  }, [isOffline]);

  if (!isOffline || dismissed) return null;

  return (
    <View style={[styles.container, { top: insets.top > 0 ? insets.top + 10 : 40 }]} pointerEvents="box-none">
      <Animated.View 
        entering={FadeInUp.duration(400).springify()} 
        exiting={FadeOutUp.duration(300)}
        style={styles.pill}
      >
        <MaterialCommunityIcons name="cloud-off-outline" size={22} color="#F59E0B" style={{ marginRight: 10 }} />
        
        <View style={{ flex: 1 }}>
          <AppText style={styles.text} language={language}>
            {language === "te" ? "ఇంటర్నెట్ లేదు, డేటా ఫోన్ లో సేవ్ అవుతుంది" : "No internet, data is saving locally"}
          </AppText>
        </View>

        <TouchableOpacity onPress={() => setDismissed(true)} style={styles.closeBtn} activeOpacity={0.6}>
          <Ionicons name="close" size={20} color="#9CA3AF" />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 999999,
    elevation: 999999,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#27272A", 
    paddingLeft: 16,
    paddingRight: 10,
    paddingVertical: 12,
    borderRadius: 12,
    marginHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  text: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "500",
  },
  closeBtn: {
    marginLeft: 12,
    padding: 6,
  }
});
