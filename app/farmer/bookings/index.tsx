import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useStore } from "@/store/useStore";
import { useEffect, useState } from "react";
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
  ScrollView,
  ImageBackground
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform } from "react-native";

export default function BookingEntry() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets.top, Platform.OS === "android" ? (StatusBar.currentHeight || 20) : 20);

  const [language, setLanguage] = useState<"te" | "en">("te");
  const [machineCount, setMachineCount] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem("APP_LANG").then(l => { if (l) setLanguage(l as any); });
  }, []);

  const machinesGlobal = useStore(state => state.machines);

  useEffect(() => {
    setMachineCount(machinesGlobal.length);
  }, [machinesGlobal]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      {/* Fixed Top Section (Does not scroll) */}
      <View style={{ paddingTop: safeTop + 10, paddingHorizontal: 0 }}>
        {/* HERO BANNER */}
        <View style={styles.heroBanner}>
          <LinearGradient colors={["#1E3A8A", "#3B82F6"]} start={{x:0, y:0}} end={{x:1, y:1}} style={styles.heroGradient}>
            
            {/* Background Watermark Icon */}
            <View style={{position: 'absolute', right: -10, bottom: -10, opacity: 0.15, transform: [{ rotate: "-25deg" }]}}>
              <FontAwesome5 name="tractor" size={120} color="white" />
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 10 }}>
              <View style={[styles.heroIconBadge, { transform: [{ rotate: "-45deg" }] }]}>
                <Ionicons name="link" size={20} color="#1E3A8A" />
              </View>
              <AppText style={styles.heroTitle} language={language}>
                {language === "te" ? "అగ్రి కనెక్ట్" : "AgriConnect"}
              </AppText>
            </View>

            <AppText style={styles.heroSubtitle} language={language}>
              {language === "te" 
                ? "మీకు కావాల్సిన యంత్రాలు ఇక్కడే దొరుకుతాయి. మధ్యవర్తులు లేకుండా నేరుగా రైతులకి, యజమానులకి అనుసంధానం." 
                : "The easiest way to rent or hire farm machinery. Connect directly with owners and farmers with zero commission."}
            </AppText>
            
          </LinearGradient>
        </View>

        {/* TRUST BADGES */}
        <View style={styles.trustBadgesRow}>
          <View style={styles.badge}>
            <Ionicons name="shield-checkmark" size={14} color="#16A34A" />
            <AppText style={styles.badgeText} language={language}>{language === "te" ? "100% నమ్మకం" : "100% Trusted"}</AppText>
          </View>
          <View style={styles.badgeDivider} />
          <View style={styles.badge}>
            <Ionicons name="call" size={14} color="#2563EB" />
            <AppText style={styles.badgeText} language={language}>{language === "te" ? "డైరెక్ట్ కాల్స్" : "Direct Calls"}</AppText>
          </View>
          <View style={styles.badgeDivider} />
          <View style={styles.badge}>
            <Ionicons name="cash-outline" size={14} color="#D97706" />
            <AppText style={styles.badgeText} language={language}>{language === "te" ? "0% కమిషన్" : "0% Commission"}</AppText>
          </View>
        </View>
      </View>

      {/* Scrolling Content (Only Cards) */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingTop: 0 }]}>
        <View style={styles.cardsContainer}>
          {/* FARMER ACTION CARD (Primary) */}
          <View style={{ overflow: 'hidden', borderRadius: 24 }}>
            <LinearGradient colors={["#FFB020", "#F59E0B"]} start={{x:0, y:0}} end={{x:1, y:1}} style={styles.massiveCard}>
              {/* Watermark */}
              <View style={{position: 'absolute', right: -25, bottom: -25, opacity: 0.15}}>
                <MaterialCommunityIcons name="map-marker-radius" size={130} color="white" />
              </View>

              <View style={styles.cardTopRow}>
                <View style={styles.cardIconCircle}>
                  <MaterialCommunityIcons name="magnify-scan" size={28} color="#D97706" />
                </View>
                <View style={styles.cardTag}>
                  <AppText style={styles.cardTagText} language={language}>{language === "te" ? "రైతుల కోసం" : "For Farmers"}</AppText>
                </View>
              </View>
              <AppText style={styles.massiveCardTitle} language={language}>
                {language === "te" ? "యంత్రాలు లేదా కూలీల కోసం వెతకండి" : "Find & Hire Machines or Labour"}
              </AppText>
              <AppText style={styles.massiveCardDesc} language={language}>
                {language === "te" 
                  ? "మీ చుట్టుపక్కల అందుబాటులో ఉన్న ట్రాక్టర్లు, కూలీల బృందాలకు నేరుగా ఫోన్ చేసి మాట్లాడుకోండి." 
                  : "Search and directly contact available machinery & labour around your location for your farm work."}
              </AppText>
              <TouchableOpacity activeOpacity={0.8} onPress={() => router.push("/farmer/bookings/find-machines")} style={styles.actionRow}>
                <AppText style={styles.actionText} language={language}>{language === "te" ? "ఇప్పుడే వెతకండి" : "Start Searching"}</AppText>
                <Ionicons name="arrow-forward" size={18} color="white" />
              </TouchableOpacity>
            </LinearGradient>
          </View>

          {/* OWNER ACTION CARD (Secondary) */}
          <View style={{ overflow: 'hidden', borderRadius: 24 }}>
            <LinearGradient colors={["#10B981", "#059669"]} start={{x:0, y:0}} end={{x:1, y:1}} style={styles.massiveCard}>
              {/* Watermark */}
              <View style={{position: 'absolute', right: -25, bottom: -20, opacity: 0.15}}>
                <FontAwesome5 name="wallet" size={110} color="white" />
              </View>

              <View style={styles.cardTopRow}>
                <View style={[styles.cardIconCircle, { backgroundColor: "#D1FAE5" }]}>
                  <MaterialCommunityIcons name="tractor" size={28} color="#059669" />
                </View>
                <View style={[styles.cardTag, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
                  <AppText style={styles.cardTagText} language={language}>{language === "te" ? "యజమానులు/మేస్త్రీ కోసం" : "For Owners/Mestri"}</AppText>
                </View>
              </View>
              <AppText style={styles.massiveCardTitle} language={language}>
                {language === "te" ? "మీ యంత్రాన్ని/కూలీల గ్రూప్ ని నమోదు చేయండి" : "List Your Machine/Labour & Earn"}
              </AppText>
              <AppText style={styles.massiveCardDesc} language={language}>
                {language === "te"
                  ? "మీ ట్రాక్టర్ లేదా కూలీల బృందాలను యాప్‌లో ఉచితంగా నమోదు చేసుకుని రైతుల నుండి కాల్స్ పొందండి."
                  : "Register your equipment or labour group for free and get direct calls from farmers."}
              </AppText>
              <TouchableOpacity activeOpacity={0.8} onPress={() => router.push("/farmer/bookings/add-machine")} style={styles.actionRow}>
                <AppText style={styles.actionText} language={language}>{language === "te" ? "ఇప్పుడే నమోదు చేయండి" : "Add Listing Now"}</AppText>
                <Ionicons name="arrow-forward" size={18} color="white" />
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>

      </ScrollView>

      {/* STICKY FOOTER FOR MY MACHINES */}
      {machineCount > 0 && (
        <View style={styles.stickyFooter}>
          <TouchableOpacity activeOpacity={0.9} style={styles.myMachinesBtn} onPress={() => router.push("/farmer/bookings/my-machines")}>
             <Ionicons name="list-circle" size={24} color="#1D4ED8" />
             <AppText style={styles.myMachinesText} language={language}>
               {language === "te" ? `నేను నమోదు చేసినవి (${machineCount})` : `My Registrations (${machineCount})`}
             </AppText>
             <Ionicons name="chevron-forward" size={20} color="#1D4ED8" style={{marginLeft: "auto"}} />
          </TouchableOpacity>
        </View>
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F9FAFB"
  },
  scrollContent: {
    paddingBottom: 160
  },
  heroBanner: {
    margin: 16,
    borderRadius: 20,
    overflow: "hidden"
  },
  heroGradient: {
    width: "100%",
    padding: 24,
    minHeight: 160,
    justifyContent: "center"
  },
  heroIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center"
  },
  heroTitle: {
    color: "white",
    fontSize: 24,
    fontWeight: "600",
    letterSpacing: 0.5
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    lineHeight: 22,
    fontFamily: "Mandali"
  },
  trustBadgesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    paddingHorizontal: 16
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  badgeText: {
    fontSize: 12,
    color: "#4B5563",
    fontWeight: "600",
    fontFamily: "Mandali"
  },
  badgeDivider: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
    marginHorizontal: 12
  },
  cardsContainer: {
    paddingHorizontal: 16,
    gap: 20
  },
  massiveCard: {
    borderRadius: 24,
    padding: 24
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16
  },
  cardIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FEF3C7",
    justifyContent: "center",
    alignItems: "center"
  },
  cardTag: {
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20
  },
  cardTagText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600"
  },
  massiveCardTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: "white",
    marginBottom: 8
  },
  massiveCardDesc: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    lineHeight: 22,
    marginBottom: 20,
    fontFamily: "Mandali"
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignSelf: "flex-start",
    gap: 8
  },
  actionText: {
    color: "white",
    fontSize: 15,
    fontWeight: "600"
  },
  stickyFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "white",
    padding: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    elevation: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 }
  },
  myMachinesBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#BFDBFE"
  },
  myMachinesText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E3A8A",
    marginLeft: 12,
    fontFamily: "Mandali"
  }
});