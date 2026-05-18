// app/farmer/privacy.tsx

import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
  TouchableOpacity
} from "react-native";

import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";

export default function PrivacyPolicy() {
  const [language, setLanguage] = useState<"te" | "en">("te");

  useEffect(() => {
    const loadLang = async () => {
      const lang = await AsyncStorage.getItem("APP_LANG");
      if (lang) setLanguage(lang as "te" | "en");
    };
    loadLang();
  }, []);

  // 🔥 CUSTOM TRANSLATIONS (LEGAL & PROFESSIONAL)
  const t = {
    title: language === "te" ? "గోప్యత విధానం" : "Privacy Policy",
    subtitle: language === "te" ? "మీ డేటా భద్రతే మా ప్రాధాన్యత" : "Your data security is our priority",
    
    introTitle: language === "te" ? "అగ్రిలాగ్ గోప్యత విధానం" : "AgriLog Privacy Policy",
    introDesc: language === "te" 
      ? "అగ్రిలాగ్ (AgriLog) యాప్ వాడే రైతులు మరియు యూజర్ల సమాచారాన్ని మేము ఎలా సేకరిస్తాము, ఎలా భద్రపరుస్తాము అనే వివరాలు కింద స్పష్టంగా ఇవ్వబడ్డాయి."
      : "This policy explains how AgriLog collects, uses, and protects the personal and agricultural data of our farmers and users.",
    
    lastUpdated: language === "te" ? "చివరిగా అప్‌డేట్ చేసినది: మే 2026" : "Last Updated: May 2026",
    contactSupport: language === "te" ? "మమ్మల్ని సంప్రదించండి" : "Contact Support"
  };

  // 🔥 PRIVACY POLICY SECTIONS (CARDS)
  const policies = [
    {
      id: "1",
      iconName: "document-text-outline",
      iconColor: "#0284C7", // Blue
      bgColor: "#E0F2FE",
      title: language === "te" ? "మేము సేకరించే సమాచారం" : "Information We Collect",
      desc: language === "te" 
        ? "ఖాతా తెరవడానికి మీ పేరు మరియు మొబైల్ నంబర్ మాత్రమే సేకరిస్తాము. అలాగే మీరు యాప్ లో నమోదు చేసే వ్యవసాయ డేటా (హాజరు, ఖర్చులు) సేకరించబడుతుంది." 
        : "We collect basic details like your Name and Mobile Number for account creation, along with the agricultural records (attendance, expenses) you enter in the app."
    },
    {
      id: "2",
      iconName: "cloud-done-outline", // 🔥 Changed icon to Cloud
      iconColor: "#D97706", // Orange
      bgColor: "#FEF3C7",
      title: language === "te" ? "క్లౌడ్ స్టోరేజ్ & ఇంటర్నెట్" : "Cloud Storage & Internet", // 🔥 Updated Title
      desc: language === "te"
        ? "మీరు నమోదు చేసిన డేటా మీ రిపోర్ట్స్ కోసం మాత్రమే ఉపయోగించబడుతుంది. మీ సమాచారం క్లౌడ్ లో సురక్షితంగా సేవ్ అవ్వడానికి ఎల్లప్పుడూ యాక్టివ్ ఇంటర్నెట్ (Active Internet) కనెక్షన్ అవసరం."
        : "Your data is strictly used to generate your reports. An active internet connection is always required to securely save and access your agricultural records in our cloud."
    },
    {
      id: "3",
      iconName: "shield-checkmark-outline",
      iconColor: "#16A34A", // Green
      bgColor: "#DCFCE7",
      title: language === "te" ? "100% డేటా భద్రత" : "100% Data Security",
      desc: language === "te"
        ? "మీ వ్యవసాయ లెక్కలు మరియు వ్యక్తిగత సమాచారం పూర్తిగా సురక్షితం. మీ డేటాను ఎట్టి పరిస్థితుల్లోనూ మూడవ పక్షాలకు (Third-parties) అమ్మడం లేదా ఇవ్వడం జరగదు."
        : "Your agricultural and personal data is highly encrypted and secure. We strictly do not sell or share your data with any third-party organizations."
    },
    {
      id: "4",
      iconName: "location-outline",
      iconColor: "#E11D48", // Red
      bgColor: "#FFE4E6",
      title: language === "te" ? "లొకేషన్ & వాతావరణం" : "Location & Weather",
      desc: language === "te"
        ? "మీ ప్రాంతం యొక్క ఖచ్చితమైన వాతావరణం మరియు మార్కెట్ ధరలు చూపించడానికి మాత్రమే మేము మీ పరికరం (Device) యొక్క లొకేషన్ అనుమతిని అడుగుతాము."
        : "We request your device's location permission solely to provide you with accurate, real-time localized weather updates and nearby market prices."
    },
    {
      id: "5",
      iconName: "trash-bin-outline",
      iconColor: "#9333EA", // Purple
      bgColor: "#F3E8FF",
      title: language === "te" ? "మీ హక్కులు" : "Your Rights",
      desc: language === "te"
        ? "మీ ఖాతాను మరియు మీ పూర్తి డేటాను ఎప్పుడైనా పూర్తిగా డిలీట్ చేసుకునే స్వేచ్ఛ మీకు ఉంది. యాప్ అన్‌ఇన్‌స్టాల్ చేసినా మీ డేటా మా క్లౌడ్ లో సురక్షితంగా ఉంటుంది."
        : "You have the complete right to request the deletion of your account and data at any time. Your data remains safely backed up in the cloud even if you uninstall the app."
    }
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
        
        {/* 🛡️ INTRO SECTION */}
        <View style={styles.introCard}>
          <View style={styles.shieldWrapper}>
            <Ionicons name="shield-checkmark" size={40} color="#16A34A" />
          </View>
          <AppText style={styles.introTitle} language={language}>{t.introTitle}</AppText>
          <AppText style={styles.introDesc} language={language}>{t.introDesc}</AppText>
        </View>

        {/* 📄 POLICIES LIST */}
        <View style={styles.policyList}>
          {policies.map((policy) => (
            <View key={policy.id} style={styles.policyCard}>
              <View style={[styles.iconWrapper, { backgroundColor: policy.bgColor }]}>
                <Ionicons name={policy.iconName as any} size={24} color={policy.iconColor} />
              </View>
              <View style={styles.policyTextWrapper}>
                <AppText style={styles.policyTitle} language={language}>{policy.title}</AppText>
                <AppText style={styles.policyDesc} language={language}>{policy.desc}</AppText>
              </View>
            </View>
          ))}
        </View>

        {/* 📞 FOOTER INFO */}
        <View style={styles.footerSection}>
          <AppText style={styles.lastUpdatedText} language={language}>{t.lastUpdated}</AppText>
          
          <TouchableOpacity style={styles.contactBtn} activeOpacity={0.8}>
            <Ionicons name="mail-outline" size={18} color="#4B5563" />
            <AppText style={styles.contactBtnText} language={language}>
              agrilog.support@gmail.com
            </AppText>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
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
  },
  
  // INTRO STYLES
  introCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginBottom: 25,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  shieldWrapper: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#F0FDF4",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  introTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 10,
    textAlign: "center",
  },
  introDesc: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 22,
    textAlign: "center",
    fontFamily: "Mandali"
  },

  // POLICY CARD STYLES
  policyList: {
    width: "100%",
  },
  policyCard: {
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  policyTextWrapper: {
    flex: 1,
  },
  policyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 6,
  },
  policyDesc: {
    fontSize: 13.5,
    color: "#4B5563",
    lineHeight: 22,
    fontFamily: "Mandali"
  },

  // FOOTER STYLES
  footerSection: {
    marginTop: 20,
    alignItems: "center",
    paddingVertical: 10,
  },
  lastUpdatedText: {
    fontSize: 13,
    color: "#9CA3AF",
    marginBottom: 12,
    fontWeight: "500",
  },
  contactBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 8,
  },
  contactBtnText: {
    fontSize: 14,
    color: "#4B5563",
    fontWeight: "600",
  }
});