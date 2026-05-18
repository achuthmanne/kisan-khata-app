// app/farmer/help.tsx

import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useState } from "react";
import {
    Alert,
    LayoutAnimation,
    Linking,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    TouchableOpacity,
    UIManager,
    View
} from "react-native";

import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";

// 🔥 ఆండ్రాయిడ్ లో స్మూత్ యానిమేషన్స్ కోసం దీన్ని ఆన్ చేయాలి
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function HelpSupport() {
  const [language, setLanguage] = useState<"te" | "en">("te");
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  useEffect(() => {
    const loadLang = async () => {
      const lang = await AsyncStorage.getItem("APP_LANG");
      if (lang) setLanguage(lang as "te" | "en");
    };
    loadLang();
  }, []);

  const t = {
    title: language === "te" ? "సహాయం & మద్దతు" : "Help & Support",
    subtitle: language === "te" ? "మేము మీకు సహాయం చేస్తాము" : "We are here to help you",
    
    // Video Section
    videoTitle: language === "te" ? "అగ్రిలాగ్ వాడే విధానం" : "How to use AgriLog",
    videoDesc: language === "te" ? "యాప్ ఎలా వాడాలో పూర్తి వివరాలు ఈ వీడియోలో చూడండి." : "Watch this video to learn how to use the app completely.",
    watchBtn: language === "te" ? "వీడియో చూడండి" : "Watch Video",
    
    // WhatsApp Section
    waTitle: language === "te" ? "మాతో చాట్ చేయండి" : "Chat with us",
    waDesc: language === "te" ? "మీకు ఏమైనా సందేహాలు ఉంటే నేరుగా మాకు వాట్సాప్ చేయండి." : "If you have any doubts, message us directly on WhatsApp.",
    waBtn: language === "te" ? "వాట్సాప్ (WhatsApp)" : "WhatsApp",
    
    // FAQ Section
    faqTitle: language === "te" ? "తరచుగా అడిగే ప్రశ్నలు (FAQs)" : "Frequently Asked Questions",
  };

  // 🔥 FAQs DATA (నువ్వు ఇక్కడ క్వశ్చన్స్ మార్చుకోవచ్చు)
  const faqs = [
    {
      id: "1",
      q: language === "te" ? "యాప్‌లో కూలీని / మేస్త్రీని ఎలా చేర్చాలి?" : "How to add a new worker / mestri?",
      a: language === "te" 
        ? "'కూలీల హాజరు' సెక్షన్‌కు వెళ్లి, కింద ఉన్న ప్లస్ (+) బటన్ నొక్కండి. పేరు మరియు మొబైల్ నంబర్ ఇచ్చి సేవ్ చేయండి." 
        : "Go to the 'Attendance' section, click on the plus (+) button at the bottom, enter the name and phone number, and save."
    },
    {
      id: "2",
      q: language === "te" ? "ఇంటర్నెట్ లేకపోయినా యాప్ పనిచేస్తుందా?" : "Does the app work without the internet?",
      a: language === "te" 
        ? "అవును! డేటా సేవ్ చేయడానికి ఇంటర్నెట్ అవసరం లేదు. మీరు ఆఫ్లైన్ లో ఉన్నా లెక్కలు వేసుకోవచ్చు, ఇంటర్నెట్ వచ్చాక ఆటోమేటిక్ గా సింక్ అవుతుంది." 
        : "Yes! You don't need internet to save records. You can enter data offline, and it will sync automatically when you are online."
    },
    {
      id: "3",
      q: language === "te" ? "పాత సంవత్సరం లెక్కలు ఎక్కడ చూడాలి?" : "Where can I see my previous year's records?",
      a: language === "te" 
        ? "డాష్‌బోర్డ్ లో పైన ఉన్న 'ప్రస్తుత సాగు సంవత్సరం' బటన్ పైన నొక్కి, మీరు చూడాలనుకుంటున్న పాత సంవత్సరాన్ని ఎంచుకోవచ్చు." 
        : "Click on the 'Active Season' button on the dashboard and select the previous year you want to view."
    },
    {
      id: "4",
      q: language === "te" ? "రిపోర్ట్స్ పీడీఎఫ్ (PDF) లో డౌన్‌లోడ్ చేయవచ్చా?" : "Can I download reports in PDF format?",
      a: language === "te" 
        ? "అవును, 'వ్యవసాయ నివేదిక' (Farm Report) సెక్షన్ లోకి వెళ్లి మీ డేటాను క్లియర్ గా PDF రూపంలో డౌన్‌లోడ్ చేసుకొని ప్రింట్ తీసుకోవచ్చు." 
        : "Yes, go to the 'Farm Report' section where you can download all your data clearly in PDF format and print it."
    }
  ];

  // 🔥 ACTIONS
  const toggleFaq = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedFaq(expandedFaq === id ? null : id);
  };

  const openWhatsApp = () => {
    // 🔥 బ్రో.. ఇక్కడ 91 పక్కన నీ ఒరిజినల్ వాట్సాప్ నంబర్ ఇవ్వు (Ex: "918121XXXXXX")
    const phoneNumber = "918121648629"; 
    const message = language === "te" ? "హలో అగ్రిలాగ్ సపోర్ట్, నాకు ఒక సహాయం కావాలి." : "Hello AgriLog Support, I need some help.";
    const url = `whatsapp://send?phone=${phoneNumber}&text=${encodeURIComponent(message)}`;
    
    Linking.canOpenURL(url).then(supported => {
      if (supported) Linking.openURL(url);
      else Alert.alert(language === "te" ? "లోపం" : "Error", language === "te" ? "మీ ఫోన్ లో వాట్సాప్ ఇన్స్టాల్ చేసి లేదు!" : "WhatsApp is not installed on your phone!");
    }).catch(err => console.error("An error occurred", err));
  };

  const openYouTubeVideo = () => {
    // 🔥 ఇక్కడ నువ్వు వీడియో చేసిన తర్వాత నీ యూట్యూబ్ లింక్ పెట్టుకో
    const url = "https://www.youtube.com"; 
    Linking.openURL(url);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#1B5E20" />

      <AppHeader
        title={t.title}
        subtitle={t.subtitle}
        language={language}
      />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        
        {/* 🎥 VIDEO TUTORIAL SECTION */}
        <TouchableOpacity style={styles.videoCard} activeOpacity={0.9} onPress={openYouTubeVideo}>
          <View style={styles.videoThumbnail}>
            <Ionicons name="logo-youtube" size={48} color="#FF0000" />
          </View>
          <View style={styles.videoInfo}>
            <AppText style={styles.videoTitle} language={language}>{t.videoTitle}</AppText>
            <AppText style={styles.videoDesc} language={language}>{t.videoDesc}</AppText>
            <View style={styles.watchBtnRow}>
              <AppText style={styles.watchBtnText} language={language}>{t.watchBtn}</AppText>
              <Ionicons name="arrow-forward" size={16} color="#16A34A" />
            </View>
          </View>
        </TouchableOpacity>

        {/* 💬 WHATSAPP SUPPORT SECTION */}
        <LinearGradient colors={["#DCFCE7", "#F0FDF4"]} style={styles.waCard}>
          <View style={styles.waIconBox}>
            <Ionicons name="logo-whatsapp" size={32} color="#25D366" />
          </View>
          <View style={styles.waInfo}>
            <AppText style={styles.waTitle} language={language}>{t.waTitle}</AppText>
            <AppText style={styles.waDesc} language={language}>{t.waDesc}</AppText>
          </View>
          <TouchableOpacity style={styles.waBtn} activeOpacity={0.8} onPress={openWhatsApp}>
            <Ionicons name="logo-whatsapp" size={18} color="white" />
            <AppText style={styles.waBtnText} language={language}>{t.waBtn}</AppText>
          </TouchableOpacity>
        </LinearGradient>

        {/* ❓ FAQS SECTION */}
        <View style={styles.faqSection}>
          <AppText style={styles.faqHeaderTitle} language={language}>{t.faqTitle}</AppText>
          
          {faqs.map((faq) => {
            const isOpen = expandedFaq === faq.id;
            return (
              <TouchableOpacity 
                key={faq.id} 
                style={[styles.faqCard, isOpen && styles.faqCardActive]} 
                activeOpacity={0.8} 
                onPress={() => toggleFaq(faq.id)}
              >
                <View style={styles.faqQuestionRow}>
                  <View style={styles.faqIconBox}>
                    <Ionicons name="help-circle-outline" size={20} color={isOpen ? "#16A34A" : "#6B7280"} />
                  </View>
                  <AppText style={[styles.faqQuestion, isOpen && styles.faqQuestionActive]} language={language}>
                    {faq.q}
                  </AppText>
                  <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={20} color="#9CA3AF" />
                </View>
                
                {/* Answer reveals smoothly with LayoutAnimation */}
                {isOpen && (
                  <View style={styles.faqAnswerBox}>
                    <AppText style={styles.faqAnswer} language={language}>{faq.a}</AppText>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* SPACING AT BOTTOM */}
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
  
  // VIDEO CARD STYLES
  videoCard: {
    backgroundColor: "white",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  videoThumbnail: {
    width: "100%",
    height: 140,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  videoInfo: {
    padding: 16,
  },
  videoTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 6,
  },
  videoDesc: {
    fontSize: 13.5,
    color: "#4B5563",
    lineHeight: 20,
    marginBottom: 12,
  },
  watchBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  watchBtnText: {
    color: "#16A34A",
    fontSize: 13,
    fontWeight: "600",
  },

  // WHATSAPP CARD STYLES
  waCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    marginBottom: 30,
    alignItems: "center",
  },
  waIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#25D366",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  waInfo: {
    alignItems: "center",
    marginBottom: 16,
  },
  waTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#166534",
    marginBottom: 6,
  },
  waDesc: {
    fontSize: 13.5,
    color: "#14532D",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  waBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#25D366",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    gap: 8,
    shadowColor: "#25D366",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  waBtnText: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
  },

  // FAQS STYLES
  faqSection: {
    width: "100%",
  },
  faqHeaderTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 15,
    marginLeft: 5,
  },
  faqCard: {
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
    overflow: "hidden",
  },
  faqCardActive: {
    borderColor: "#16A34A",
    backgroundColor: "#F8FAF9",
  },
  faqQuestionRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  faqIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: "600",
    color: "#374151",
    paddingRight: 10,
    fontFamily: "Mandali"
  },
  faqQuestionActive: {
    color: "#16A34A",
  },
  faqAnswerBox: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingLeft: 60, // Align text with question, skipping icon width
  },
  faqAnswer: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 22,
    fontFamily: "Mandali"
  }
});