import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useState, useRef, useEffect } from "react";
import {
  Dimensions,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
  Linking,
  FlatList,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import AppText from "../components/AppText";
import { useLanguage } from "@/context/LanguageContext";

const { width } = Dimensions.get("window");

const SLIDES = [
  {
    id: "1",
    image: require("../assets/images/f1.png"),
    titleTe: "100% సురక్షితమైన ఖాతా",
    titleEn: "100% Secure Ledger",
    descTe: "మీ పొలం లెక్కలు సులువుగా రాసుకోండి.",
    descEn: "Easily track your farm expenses."
  },
  {
    id: "2",
    image: require("../assets/images/f2.png"),
    titleTe: "ఆఫ్‌లైన్ లో కూడా",
    titleEn: "Works Offline",
    descTe: "ఇంటర్నెట్ లేకపోయినా యాప్ పనిచేస్తుంది.",
    descEn: "No signal in the field? No problem."
  },
  {
    id: "3",
    image: require("../assets/images/f3.png"),
    titleTe: "పనులు & రిమైండర్లు",
    titleEn: "Tasks & Reminders",
    descTe: "ఏ రోజు ఏం పని చేయాలో మర్చిపోరు.",
    descEn: "Never forget your daily farm activities."
  },
  {
    id: "4",
    image: require("../assets/images/f4.png"),
    titleTe: "అగ్రి కనెక్ట్",
    titleEn: "Agri Connect",
    descTe: "ట్రాక్టర్లు, కూలీలను సులువుగా మాట్లాడుకోండి.",
    descEn: "Hire tractors and labor easily."
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { language, changeLanguage } = useLanguage();
  
  const [agreed, setAgreed] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  // Auto-scroll logic
  useEffect(() => {
    const timer = setInterval(() => {
      const nextIndex = (currentIndex + 1) % SLIDES.length;
      setCurrentIndex(nextIndex);
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    }, 3000); // 3 seconds per slide

    return () => clearInterval(timer);
  }, [currentIndex]);

  const handleGetStarted = async () => {
    if (!agreed) return;
    
    // Save that user has completed onboarding
    await AsyncStorage.setItem("HAS_SEEN_ONBOARDING", "true");
    
    // Ensure the selected language is saved correctly
    await AsyncStorage.setItem("APP_LANG", language);
    
    // Route to login
    router.replace("/login");
  };

  const openTerms = () => {
    Linking.openURL("https://sites.google.com/view/kisankhata-terms");
  };

  const renderSlide = ({ item }: { item: typeof SLIDES[0] }) => {
    return (
      <View style={styles.slideCard}>
        <View style={{ position: "relative", width: width, alignItems: "center" }}>
          <Image 
            source={item.image} 
            style={styles.slideImage} 
            contentFit="contain" 
            transition={500} 
          />
          <LinearGradient
            colors={["rgba(255, 255, 255, 0)", "rgba(255, 255, 255, 1)"]}
            style={{
              position: "absolute",
              bottom: 20,
              left: 0,
              right: 0,
              height: 50,
            }}
          />
        </View>
        <AppText style={styles.slideTitle} language={language}>
          {language === "te" ? item.titleTe : item.titleEn}
        </AppText>
        <AppText style={styles.slideDesc} language={language}>
          {language === "te" ? item.descTe : item.descEn}
        </AppText>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        
        {/* --- 1. TOP: LANGUAGE SELECTOR (Mimicking Profile Screen) --- */}
        <View style={styles.header}>
          <AppText style={styles.langTitle} language={language}>
            {language === "te" ? "భాషను ఎంచుకోండి" : "Select Language"}
          </AppText>
          <View style={styles.languageGrid}>
            <TouchableOpacity
              onPress={() => changeLanguage("te")}
              style={[
                styles.langOption,
                language === "te" && styles.langOptionActive,
              ]}
              activeOpacity={0.8}
            >
              <View style={[styles.radio, language === "te" && styles.radioActive]}>
                {language === "te" && <View style={styles.radioInner} />}
              </View>
              <AppText style={[styles.langOptionText, language === "te" && styles.langOptionTextActive]} language="te">
                తెలుగు
              </AppText>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => changeLanguage("en")}
              style={[
                styles.langOption,
                language === "en" && styles.langOptionActive,
              ]}
              activeOpacity={0.8}
            >
              <View style={[styles.radio, language === "en" && styles.radioActive]}>
                {language === "en" && <View style={styles.radioInner} />}
              </View>
              <AppText style={[styles.langOptionText, language === "en" && styles.langOptionTextActive]} language="en">
                English
              </AppText>
            </TouchableOpacity>
          </View>
        </View>

        {/* --- 2. MIDDLE: AUTO SCROLL CAROUSEL --- */}
        <View style={styles.carouselContainer}>
          <FlatList
            ref={flatListRef}
            data={SLIDES}
            renderItem={renderSlide}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScrollToIndexFailed={(info) => {
              const wait = new Promise(resolve => setTimeout(resolve, 500));
              wait.then(() => {
                flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
              });
            }}
            onMomentumScrollEnd={(event) => {
              const newIndex = Math.round(event.nativeEvent.contentOffset.x / width);
              setCurrentIndex(newIndex);
            }}
          />
          
          {/* Dots Indicator */}
          <View style={styles.dotsContainer}>
            {SLIDES.map((_, index) => (
              <View 
                key={index} 
                style={[
                  styles.dot, 
                  currentIndex === index && styles.dotActive
                ]} 
              />
            ))}
          </View>
        </View>

        {/* --- 3. BOTTOM: TERMS AND GET STARTED --- */}
        <View style={styles.bottomSection}>
          <TouchableOpacity 
            style={styles.checkboxRow} 
            onPress={() => setAgreed(!agreed)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, agreed && styles.checkboxActive]}>
              {agreed && <Ionicons name="checkmark" size={16} color="white" />}
            </View>
            <View style={styles.termsTextContainer}>
              <AppText style={styles.termsText} language={language}>
                {language === "te" ? "నేను అంగీకరిస్తున్నాను " : "I agree to the "}
              </AppText>
              <TouchableOpacity onPress={openTerms} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <AppText style={styles.termsLink} language={language}>
                  {language === "te" ? "నియమ నిబంధనలు & గోప్యతా విధానానికి" : "Terms & Privacy Policy"}
                </AppText>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, !agreed && styles.disabledBtn]} 
            disabled={!agreed} 
            onPress={handleGetStarted}
            activeOpacity={0.8}
          >
            <AppText style={styles.buttonText} language={language}>
              {language === "te" ? "ప్రారంభించండి" : "Get Started"}
            </AppText>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 40 : 20,
    paddingBottom: 20,
    justifyContent: "space-between",
  },
  
  // Header / Language Selector
  header: {
    marginTop: 10,
  },
  langTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 16,
    textAlign: "center",
  },
  languageGrid: {
    flexDirection: "row",
    gap: 12,
  },
  langOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    backgroundColor: "white",
  },
  langOptionActive: {
    borderColor: "#1B5E20",
    backgroundColor: "#F0FDF4",
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  radioActive: {
    borderColor: "#1B5E20",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#1B5E20",
  },
  langOptionText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#4B5563",
  },
  langOptionTextActive: {
    color: "#1B5E20",
    fontWeight: "600",
  },

  // Carousel
  carouselContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 10,
  },
  slideCard: {
    width: width - 40,
    justifyContent: "center",
    alignItems: "center",
  },
  slideImage: {
    width: width,
    height: width * 0.65,
    marginBottom: 20,
  },
  slideTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
    textAlign: "center",
  },
  slideDesc: {
    fontSize: 16,
    color: "#4B5563",
    textAlign: "center",
    lineHeight: 26,
    paddingHorizontal: 20,
    paddingBottom: 5,
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#D1D5DB",
  },
  dotActive: {
    backgroundColor: "#1B5E20",
  },

  // Bottom Section
  bottomSection: {
    marginTop: "auto",
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    backgroundColor: "#fff",
  },
  checkboxActive: {
    backgroundColor: "#1B5E20",
    borderColor: "#1B5E20",
  },
  termsTextContainer: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    flex: 1,
  },
  termsText: {
    fontSize: 14,
    color: "#4B5563",
  },
  termsLink: {
    fontSize: 14,
    color: "#1B5E20", 
    fontWeight: "600",
    borderBottomWidth: 1,
    borderBottomColor: "#1B5E20",
  },
  button: { 
    height: 55, 
    borderRadius: 22, 
    backgroundColor: "#1B5E20", 
    justifyContent: "center", 
    alignItems: "center", 
    marginTop: 20 
  },
  disabledBtn: { 
    backgroundColor: "#D1D5DB" 
  },
  buttonText: { 
    color: "#FFF", 
    fontWeight: "600", 
    fontSize: 18, 
    letterSpacing: 0.5 
  },
});
