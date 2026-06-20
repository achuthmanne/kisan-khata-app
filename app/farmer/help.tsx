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
    videoTitle: language === "te" ? "కిసాన్ ఖాతా వాడే విధానం" : "How to use Kisan Khata",
    videoDesc: language === "te" ? "యాప్ ఎలా వాడాలో పూర్తి వివరాలు ఈ వీడియోలో చూడండి." : "Watch this video to learn how to use the app completely.",
    watchBtn: language === "te" ? "వీడియో చూడండి" : "Watch Video",
    
    // WhatsApp Section
    waTitle: language === "te" ? "మాతో చాట్ చేయండి" : "Chat with us",
    waDesc: language === "te" ? "మీకు ఏమైనా సందేహాలు ఉంటే నేరుగా మాకు వాట్సాప్ చేయండి." : "If you have any doubts, message us directly on WhatsApp.",
    waBtn: language === "te" ? "వాట్సాప్ (WhatsApp)" : "WhatsApp",
    
    // FAQ Section
    faqTitle: language === "te" ? "తరచుగా అడిగే ప్రశ్నలు (FAQs)" : "Frequently Asked Questions",
  };

 // 🔥 FAQs DATA (6 ACCURATE & PRACTICAL QUESTIONS)
  const faqs = [
    {
      id: "1",
      q: language === "te" ? "ఈ కిసాన్ ఖాతా యాప్ ఎవరి కోసం?" : "Who is this Kisan Khata app for?",
      a: language === "te" 
        ? "ఈ యాప్ రైతులు కోసం ప్రత్యేకం. రోజువారీ కూలీల హాజరు, పంట ఖర్చులు, మరియు అమ్మకాల లెక్కలు సులభంగా వేసుకోవడానికి ఇది ఉపయోగపడుతుంది." 
        : "This app is strictly for farmers. It helps you easily track daily labor attendance, crop expenses, and sales records."
    },
    {
      id: "2",
      q: language === "te" ? "ఇంటర్నెట్ లేకపోయినా యాప్ పనిచేస్తుందా?" : "Does the app work without the internet?",
      a: language === "te" 
        ? "అవును, పనిచేస్తుంది! ఇంటర్నెట్ లేనప్పుడు కూడా మీరు లెక్కలు నమోదు చేసుకోవచ్చు. అవి మీ ఫోన్ లో భద్రంగా ఉంటాయి. నెట్ ఆన్ చేయగానే ఆటోమాటిక్ గా క్లౌడ్ (Cloud) లోకి సింక్ అవుతాయి." 
        : "Yes, it works! You can enter your records even without the internet. They are saved securely on your phone and automatically synced to the cloud when you connect to the internet."
    },
    {
  id: "3",
  q: language === "te" ? "కూలీల హాజరు మరియు జీతాలు ఎలా లెక్కించాలి?" : "How to calculate labor attendance and wages?",
  a: language === "te" 
    ? "'కూలీల హాజరు' సెక్షన్‌లో రోజువారీ అటెండెన్స్ వేయండి. ఆ తర్వాత 'కూలీల చెల్లింపులు' సెక్షన్‌లో మీరు ఇచ్చే నగదును నమోదు చేస్తే, మొత్తం పని దినాలకు ఇంకా ఎంత బాకీ ఉందో యాప్ ఆటోమేటిక్ గా లెక్కిస్తుంది." 
    : "Mark daily attendance in the 'Worker Attendance' section. Then, enter the amounts paid in the 'Worker Payments' section; the app will automatically calculate the remaining balance based on the total days worked."
},

    {
  id: "4",
  q: language === "te" ? "పంట లాభనష్టాలు ఎలా తెలుసుకోవాలి?" : "How to check crop profit and loss?",
  a: language === "te" 
    ? "మీరు నమోదు చేసే 'పెట్టుబడి ఖర్చులు' మరియు 'పంట అమ్మకాలు' ఆధారంగా, మీ లాభనష్టాల వివరాలను 'వ్యవసాయ నివేదిక' (Farm Report) సెక్షన్ లో చార్ట్ రూపంలో క్లియర్ గా చూడవచ్చు." 
    : "Based on the 'Expenses' and 'Crop Sales' you enter, you can clearly check your profit or loss details in the 'Farm Report' section via visual charts."
},
{
  id: "5",
  q: language === "te" ? "రిపోర్ట్స్ పీడీఎఫ్ (PDF) లో డౌన్‌లోడ్ చేయవచ్చా?" : "Can I download reports in PDF format?",
  a: language === "te" 
    ? "అవును, 'వ్యవసాయ నివేదిక' (Farm Report) లోనే మీ లాభనష్టాలు మరియు ఇతర డేటాను PDF రూపంలో డౌన్‌లోడ్ చేసుకొని షేర్ చేయవచ్చు లేదా ప్రింట్ తీసుకోవచ్చు." 
    : "Yes, within the 'Farm Report' section, you can download your profit/loss and all other data in PDF format to share or print."
},

    {
      id: "6",
      q: language === "te" ? "నా ఫోన్ పోతే నా వ్యవసాయ డేటా పోతుందా?" : "Will I lose my data if I lose my phone?",
      a: language === "te" 
        ? "ఖచ్చితంగా పోదు! మీ డేటా అంతా ఆన్లైన్ లో సురక్షితంగా ఉంటుంది. కొత్త ఫోన్ లో మీ పాత మొబైల్ నంబర్ తో లాగిన్ అవ్వగానే, మీ లెక్కలన్నీ ఆటోమేటిక్ గా వచ్చేస్తాయి." 
        : "Absolutely not! Your data is safely backed up online. Just login with your same mobile number on a new phone, and all your records will be restored automatically."
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
    const message = language === "te" ? "హలో కిసాన్ ఖాతా సపోర్ట్, నాకు ఒక సహాయం కావాలి." : "Hello Kisan Khata Support, I need some help.";
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