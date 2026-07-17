import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppText from '@/components/AppText';

export default function CalculatorHub() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets.top, Platform.OS === "android" ? (StatusBar.currentHeight || 20) : 20);

  const [language, setLanguage] = useState<'te' | 'en'>('te');

  useEffect(() => {
    const loadLang = async () => {
      const saved = await AsyncStorage.getItem('APP_LANG');
      if (saved === 'te' || saved === 'en') {
        setLanguage(saved);
      }
    };
    loadLang();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      
      {/* FIXED HEADER BANNER */}
      <View style={{ paddingTop: safeTop, backgroundColor: '#F6F7F6' }}>
        <View style={styles.heroBanner}>
          <LinearGradient colors={["#6366F1", "#4338CA"]} start={{x:0, y:0}} end={{x:1, y:1}} style={styles.heroGradient}>
            
            {/* Watermark */}
            <View style={{position: 'absolute', right: -15, bottom: -15, opacity: 0.15, transform: [{ rotate: "-25deg" }]}}>
              <Ionicons name="calculator" size={130} color="white" />
            </View>

            {/* Title */}
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
              <View style={styles.heroIconBadge}>
                <MaterialCommunityIcons name="math-compass" size={22} color="#4338CA" />
              </View>
              <AppText style={styles.heroTitle} language={language}>
                {language === "te" ? "స్మార్ట్ క్యాలిక్యులేటర్స్" : "Smart Calculators"}
              </AppText>
            </View>

            <AppText style={styles.heroSubtitle} language={language}>
              {language === "te" 
                ? "మీ రోజువారీ వ్యవసాయ మరియు ఆర్థిక లెక్కలను చాలా సులువుగా మరియు ఖచ్చితంగా చేసుకోండి." 
                : "Perform your daily farming and financial calculations easily and accurately."}
            </AppText>
          </LinearGradient>
        </View>
      </View>

      {/* SCROLLING CARDS */}
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* 1. VADDI LEKKALA CALCULATOR (వడ్డీ లెక్కలు) */}
        <View style={{ overflow: 'hidden', borderRadius: 24, marginBottom: 20 }}>
          <LinearGradient colors={["#0D9488", "#0F766E"]} start={{x:0, y:0}} end={{x:1, y:1}} style={styles.massiveCard}>
            
            {/* Watermark */}
            <View style={{position: 'absolute', right: -25, bottom: -25, opacity: 0.15}}>
              <MaterialCommunityIcons name="hand-coin" size={130} color="white" />
            </View>

            <View style={styles.cardTopRow}>
              <View style={styles.cardIconCircle}>
                <MaterialCommunityIcons name="bank-outline" size={28} color="#0F766E" />
              </View>
              <View style={[styles.cardTag, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
                <AppText style={styles.cardTagText} language={language}>{language === "te" ? "ఆర్థిక లెక్కలు" : "Financials"}</AppText>
              </View>
            </View>
            
            <AppText style={styles.massiveCardTitle} language={language}>
              {language === 'te' ? 'వడ్డీ లెక్కలు' : 'Interest Calculator'}
            </AppText>
            <AppText style={styles.massiveCardDesc} language={language}>
              {language === 'te' 
                ? 'అప్పులు, వడ్డీలు, నెలవారీ వాయిదాలు (EMI) మరియు లావాదేవీలను ఖచ్చితంగా లెక్కించండి.' 
                : 'Calculate loans, interest rates, EMIs, and transactions accurately.'}
            </AppText>
            
            <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/farmer/calculators/interest')} style={styles.actionRow}>
              <AppText style={styles.actionText} language={language}>{language === "te" ? "లెక్కించండి" : "Calculate Now"}</AppText>
              <Ionicons name="arrow-forward" size={18} color="white" />
            </TouchableOpacity>
          </LinearGradient>
        </View>

        {/* 2. REAL CALCULATOR (సాధారణ క్యాలిక్యులేటర్) */}
        <View style={{ overflow: 'hidden', borderRadius: 24, marginBottom: 20 }}>
          <LinearGradient colors={["#8B5CF6", "#6D28D9"]} start={{x:0, y:0}} end={{x:1, y:1}} style={styles.massiveCard}>
            
            {/* Watermark */}
            <View style={{position: 'absolute', right: -10, bottom: -15, opacity: 0.15}}>
              <MaterialCommunityIcons name="abacus" size={140} color="white" />
            </View>

            <View style={styles.cardTopRow}>
              <View style={[styles.cardIconCircle, { backgroundColor: "#EDE9FE" }]}>
                <MaterialCommunityIcons name="calculator-variant-outline" size={28} color="#6D28D9" />
              </View>
              <View style={[styles.cardTag, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
                <AppText style={styles.cardTagText} language={language}>{language === "te" ? "సాధారణ లెక్కలు" : "Basic Math"}</AppText>
              </View>
            </View>
            
            <AppText style={styles.massiveCardTitle} language={language}>
              {language === 'te' ? 'సాధారణ క్యాలిక్యులేటర్' : 'Standard Calculator'}
            </AppText>
            <AppText style={styles.massiveCardDesc} language={language}>
              {language === 'te' 
                ? 'కూడికలు, తీసివేతలు, హెచ్చవేతలు మరియు రోజువారీ సాధారణ లెక్కల కోసం వాడండి.' 
                : 'Use for daily basic calculations like addition, subtraction, and multiplication.'}
            </AppText>
            
            <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/farmer/calculators/standard')} style={styles.actionRow}>
              <AppText style={styles.actionText} language={language}>{language === "te" ? "లెక్కించండి" : "Calculate Now"}</AppText>
              <Ionicons name="arrow-forward" size={18} color="white" />
            </TouchableOpacity>
          </LinearGradient>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { 
    flex: 1, 
    backgroundColor: '#F6F7F6' 
  },
  scrollContainer: { 
    padding: 16,
    paddingTop: 10,
    paddingBottom: 40
  },

  // HERO BANNER
  heroBanner: { margin: 16, marginTop: 10, borderRadius: 24, overflow: 'hidden' },
  heroGradient: { padding: 24, paddingTop: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center", marginRight: 12 },
  heroIconBadge: { width: 36, height: 36, borderRadius: 12, backgroundColor: "white", justifyContent: "center", alignItems: "center", marginRight: 12 },
  heroTitle: { fontSize: 24, color: "white", fontFamily: "Mandali" },
  heroSubtitle: { fontSize: 14, color: "#E0E7FF", lineHeight: 22, marginTop: 10, fontFamily: "Mandali" },

  // MASSIVE CARDS
  massiveCard: { padding: 24, minHeight: 220, justifyContent: 'flex-end' },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  cardIconCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#CCFBF1", justifyContent: "center", alignItems: "center" },
  cardTag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  cardTagText: { color: "white", fontSize: 13, fontFamily: "Mandali" },
  massiveCardTitle: { fontSize: 22, color: "white", marginBottom: 8, fontFamily: "Mandali" },
  massiveCardDesc: { fontSize: 14, color: "rgba(255,255,255,0.9)", lineHeight: 22, marginBottom: 24, fontFamily: "Mandali" },
  
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
    fontSize: 14,
    fontFamily: "Mandali"
  }
});