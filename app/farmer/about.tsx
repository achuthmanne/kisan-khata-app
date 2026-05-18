// app/farmer/about.tsx

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons"; // 🔥 MaterialCommunityIcons యాడ్ చేశాం
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState } from "react";
import {
    Dimensions,
    FlatList,
    Image,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    View
} from "react-native";

import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";

const { width } = Dimensions.get("window");

export default function AboutUs() {
  const [language, setLanguage] = useState<"te" | "en">("te");
  const APP_VERSION = "1.0.0"; 

  useEffect(() => {
    const loadLang = async () => {
      const lang = await AsyncStorage.getItem("APP_LANG");
      if (lang) setLanguage(lang as "te" | "en");
    };
    loadLang();
  }, []);

  // 🔥 CUSTOM TRANSLATIONS & MISSION
  const t = {
    title: language === "te" ? "మా గురించి" : "About Us",
    subtitle: language === "te" ? "అగ్రిలాగ్ వివరాలు" : "Know about AgriLog",
    appName: "AgriLog",
    tagline: language === "te" ? "మీ వ్యవసాయానికి మా డిజిటల్ తోడు" : "Your Digital Companion for Agriculture",
    version: language === "te" ? `వెర్షన్ ${APP_VERSION}` : `Version ${APP_VERSION}`,
    missionTitle: language === "te" ? "మా లక్ష్యం" : "Our Mission",
    missionDesc: language === "te" 
      ? "రైతులు ఇకపై పుస్తకాలలో లెక్కలు రాసుకోవాల్సిన అవసరం లేకుండా, వారి ఖర్చులు, ఆదాయం, కూలీల హాజరు, ట్రాక్టర్లు మరియు యంత్రాల లెక్కలను సులభంగా తమ ఫోన్‌లోనే నమోదు చేసుకునేలా చేయడమే మా లక్ష్యం. ఎక్కడ ఎంత ఖర్చు అవుతోంది, ఎంత లాభం లేదా నష్టం వస్తోంది అనే పూర్తి వివరాలను వారి కళ్ళముందు ఉంచి, ఆర్థిక స్పష్టత కల్పించడమే ఈ అగ్రిలాగ్ ప్రధాన ఉద్దేశ్యం." 
      : "Our mission is to replace traditional paper notebooks with a simple digital platform. We enable farmers to easily track labor attendance, machinery usage, daily expenses, and crop sales. By providing a clear, real-time summary of income, expenses, and overall profit or loss, we aim to give farmers complete financial clarity.",
    featuresTitle: language === "te" ? "ముఖ్య సేవలు" : "Key Features",
    devCredit: language === "te" ? "రూపకల్పన: అచ్యుత్ మన్నె" : "Developed by Achuth Manne",
    
    // 🔥 SHORT & NATIVE TELUGU TRANSLATION
    madeIn: language === "te" ? "భారతదేశంలో ❤️ తో తయారైంది" : "Made with ❤️ in India",
    
    // HIGHLIGHT FEATURES
    f1: language === "te" ? "హాజరు & జీతాలు" : "Attendance & Pay",
    f2: language === "te" ? "ఖర్చులు & అమ్మకాలు" : "Expenses & Sales",
    f3: language === "te" ? "లాభనష్టాల నివేదిక" : "Profit/Loss Report",
    f4: language === "te" ? "వాహనాల లెక్కలు" : "Vehicle Logs",
    f5: language === "te" ? "వాతావరణం & మార్కెట్" : "Weather & Market",
    f6: language === "te" ? "100% భద్రత" : "100% Secure",
  };

  // 🔥 MULTI-COLORED FEATURES ARRAY WITH ICON FAMILY
  const appFeatures = [
    { id: "1", title: t.f1, iconName: "people-outline", family: "Ionicons", bgColor: "#E0F2FE", iconColor: "#0284C7" },
    { id: "2", title: t.f2, iconName: "wallet-outline", family: "Ionicons", bgColor: "#DCFCE7", iconColor: "#16A34A" },
    { id: "3", title: t.f3, iconName: "pie-chart-outline", family: "Ionicons", bgColor: "#F3E8FF", iconColor: "#9333EA" },
    // 🔥 TRACTOR ICON FROM MATERIAL COMMUNITY ICONS
    { id: "4", title: t.f4, iconName: "tractor-variant", family: "MaterialCommunity", bgColor: "#FEF3C7", iconColor: "#D97706" }, 
    { id: "5", title: t.f5, iconName: "partly-sunny-outline", family: "Ionicons", bgColor: "#FFE4E6", iconColor: "#E11D48" },
    { id: "6", title: t.f6, iconName: "shield-checkmark-outline", family: "Ionicons", bgColor: "#E0E7FF", iconColor: "#4F46E5" },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#1B5E20" />

      <AppHeader
        title={t.title}
        subtitle={t.subtitle}
        language={language}
      />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        
        {/* 🚀 APP LOGO & TITLE SECTION */}
        <View style={styles.logoSection}>
          <View style={styles.logoWrapper}>
            <Image 
              source={require('../../assets/images/logo.jpeg')} 
              style={styles.logoImage} 
              resizeMode="cover"
            />
          </View>
          <AppText style={styles.appName} language={language}>{t.appName}</AppText>
          <AppText style={styles.tagline} language={language}>{t.tagline}</AppText>
          
          <View style={styles.versionBadge}>
            <AppText style={styles.versionText} language={language}>{t.version}</AppText>
          </View>
        </View>

        {/* 🎯 MISSION SECTION */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconBox}>
              <Ionicons name="bulb-outline" size={22} color="#16A34A" />
            </View>
            <AppText style={styles.cardTitle} language={language}>{t.missionTitle}</AppText>
          </View>
          <AppText style={styles.cardDesc} language={language}>
            {t.missionDesc}
          </AppText>
        </View>

        {/* 🌟 KEY FEATURES (DYNAMIC ICON RENDERING) */}
        <View style={styles.featuresSection}>
          <AppText style={styles.featuresTitle} language={language}>{t.featuresTitle}</AppText>
          
          <FlatList
            data={appFeatures}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingLeft: 5, paddingRight: 20 }}
            snapToAlignment="start"
            decelerationRate="fast"
            snapToInterval={(width * 0.28) + 12} 
            renderItem={({ item }) => (
              <View style={styles.serviceCard}>
                <View style={[styles.serviceIconWrapper, { backgroundColor: item.bgColor }]}>
                  {/* 🔥 CONDITIONAL RENDER BASED ON ICON FAMILY */}
                  {item.family === "Ionicons" ? (
                    <Ionicons name={item.iconName as any} size={24} color={item.iconColor} />
                  ) : (
                    <MaterialCommunityIcons name={item.iconName as any} size={26} color={item.iconColor} />
                  )}
                </View>
                <AppText style={styles.serviceText} language={language} numberOfLines={2}>
                  {item.title}
                </AppText>
              </View>
            )}
          />
        </View>

        {/* 🇮🇳 FOOTER & DEVELOPER CREDIT */}
        <View style={styles.footer}>
          <AppText style={styles.madeInText} language={language}>{t.madeIn}</AppText>
          <AppText style={styles.copyrightText} language={language}>
            © {new Date().getFullYear()} {t.appName}. All rights reserved.
          </AppText>
          
          <View style={styles.devTagRow}>
            <Ionicons name="code-slash" size={14} color="#9CA3AF" />
            <AppText style={styles.devCreditText} language={language}>
              {t.devCredit}
            </AppText>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  container: {
    padding: 20,
    paddingBottom: 40,
    alignItems: "center"
  },
  logoSection: {
    alignItems: "center",
    marginTop: 10,
    marginBottom: 25,
  },
  logoWrapper: {
    width: 100,
    height: 100,
    borderRadius: 30,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#16A34A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 8,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: "#E5E7EB"
  },
  logoImage: {
    width: "100%",
    height: "100%",
  },
  appName: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 6,
    letterSpacing: 0.5
  },
  tagline: {
    fontSize: 14,
    color: "#16A34A",
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "center"
  },
  versionBadge: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  versionText: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "600",
  },
  card: {
    backgroundColor: "white",
    width: "100%",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F0FDF4",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  cardDesc: {
    fontSize: 14.5,
    color: "#4B5563",
    lineHeight: 25,
    fontWeight: "500",
    fontFamily: "Mandali"
  },
  featuresSection: {
    width: "100%",
    marginBottom: 30,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 15,
    marginLeft: 5,
    fontFamily: "Mandali"
  },
  serviceCard: {
    width: width * 0.28,
    height: 110,
    backgroundColor: "white",
    borderRadius: 16,
    padding: 10,
    alignItems: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    justifyContent: "center",
  },
  serviceIconWrapper: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  serviceText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
    textAlign: "center",
    fontFamily: "Mandali",
    lineHeight: 20
  },
  footer: {
    alignItems: "center",
    marginTop: 10,
  },
  madeInText: {
    fontSize: 13,
    color: "#16A34A",
    fontWeight: "600",
    marginBottom: 6,
  },
  copyrightText: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "500",
    marginBottom: 15,
  },
  devTagRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6
  },
  devCreditText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
    fontFamily: "Mandali"
  }
});