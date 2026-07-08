import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";

const { width } = Dimensions.get("window");

/* ---------------- TRANSLATIONS ---------------- */
const translations = {
  te: {
    title: "పంట ధరలు",
    subtitle: "తాజా పంట ధరలు",
    search: "పంట పేరుతో వెతకండి...",
    ap: "ఆంధ్రప్రదేశ్",
    ts: "తెలంగాణ",
    noData: "సమాచారం దొరకలేదు",
    retry: "మళ్ళీ ప్రయత్నించండి",
    noResults: "మీరు వెతికిన పంట దొరకలేదు",
    min: "కనిష్ట",
    max: "గరిష్ట",
    lastUpdated: "చివరి అప్‌డేట్: " // 🔥 NEW
  },
  en: {
    title: "Crop Prices",
    subtitle: "Latest Crop Prices",
    search: "Search by crop name...",
    ap: "Andhra Pradesh",
    ts: "Telangana",
    noData: "Market data not available",
    retry: "Try Again",
    noResults: "No crops found for your search",
    min: "Min",
    max: "Max",
    lastUpdated: "Last Updated: " // 🔥 NEW
  },
};

/* ---------------- DYNAMIC MARKET TRANSLATOR (GOOGLE API) ---------------- */
const applyMarketTranslations = async (data: any[], lang: string) => {
  if (lang === "en") return data; 

  let dict: any = {};
  try {
    const cachedStr = await AsyncStorage.getItem("MARKET_TRANS_DICT");
    if (cachedStr) dict = JSON.parse(cachedStr);
  } catch (e) {}

  let updated = false;
  const uniqueMarkets = [...new Set(data.map(item => item.market))];
  const missingMarkets = uniqueMarkets.filter(m => !dict[m]);

  if (missingMarkets.length > 0) {
    await Promise.all(missingMarkets.map(async (market) => {
      try {
        const hasAPMC = /APMC/i.test(market);
        const cleanText = market.replace(/APMC/ig, "").trim(); 
        
        let translated = cleanText;
        if (cleanText) {
          const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=te&dt=t&q=${encodeURIComponent(cleanText)}`);
          const parsed = await res.json();
          translated = parsed[0][0][0];
        }
        
        dict[market] = hasAPMC ? `${translated} APMC` : translated;
        updated = true;
      } catch (e) {
        dict[market] = market;
      }
    }));

    if (updated) {
      await AsyncStorage.setItem("MARKET_TRANS_DICT", JSON.stringify(dict));
    }
  }

  return data.map(item => ({
    ...item,
    translated_market: dict[item.market] || item.market
  }));
};

/* ---------------- PRO CROP DICTIONARY (AUTO-TRANSLATE) ---------------- */
const cropTranslations: Record<string, string> = {
  // Cereals & Millets
  "paddy(dhan)(common)": "వరి (సాధారణం)",
  "paddy(dhan)(A grade)": "వరి (A గ్రేడ్)",
  "paddy": "వరి",
  "maize": "మొక్కజొన్న",
  "jowar": "జొన్నలు",
  "bajra": "సజ్జలు",
  "ragi": "రాగులు",
  "wheat": "గోధుమలు",
  "barley": "బార్లీ (యవలు)",
  "korra": "కొర్రలు",
  "arikelu": "అరికెలు",
  "samalu": "సామలు",
  "udalu": "ఊదలు",
  "andukorra": "అండుకొర్రలు",
  // Pulses
  "red gram": "కందులు",
  "green gram": "పెసలు",
  "black gram": "మినుములు",
  "bengal gram": "శనగలు",
  "horse gram": "ఉలవలు",
  "cowpea": "అలసందలు",
  "peas": "బఠాణీలు",
  "soyabean": "సోయాబీన్",
  "lentil": "మసూర్ పప్పు",
  "rajma": "రాజ్మా",
  // Oil Seeds
  "cotton": "పత్తి",
  "groundnut": "వేరుశనగ (పల్లీలు)",
  "sunflower": "సూర్యకాంతి గింజలు",
  "sesamum": "నువ్వులు",
  "castor seed": "ఆముదాలు",
  "mustard": "ఆవాలు",
  "safflower": "కుసుమలు",
  "palm oil": "పామాయిల్ గెలలు",
  "linseed": "అవిసె గింజలు",
  "niger seed": "గిజిలి గింజలు",
  // Commercial Crops
  "sugarcane": "చెరకు",
  "tobacco": "పొగాకు",
  "jute": "జనపనార",
  "mesta": "గోగునార",
  // Spices
  "turmeric": "పసుపు",
  "dry chillies": "ఎండుమిర్చి",
  "green chilli": "పచ్చిమిర్చి",
  "garlic": "వెల్లుల్లి",
  "ginger": "అల్లం",
  "coriander seeds": "ధనియాలు",
  "tamarind": "చింతపండు",
  "black pepper": "మిరియాలు",
  "ajwain": "వాము",
  "fenugreek": "మెంతులు",
  "clove": "లవంగాలు",
  "cardamom": "యాలకులు",
  "cinnamon": "దాల్చిన చెక్క",
  // Vegetables
  "tomato": "టమాటా",
  "onion": "ఉల్లిపాయ",
  "potato": "బంగాళదుంప",
  "brinjal": "వంకాయ",
  "bhendi": "బెండకాయ",
  "cabbage": "క్యాబేజీ",
  "cauliflower": "కాలిఫ్లవర్",
  "bitter gourd": "కాకరకాయ",
  "bottle gourd": "సొరకాయ",
  "Ridgeguard": "బీరకాయ",
  "Snakeguard": "పొట్లకాయ",
  "carrot": "క్యారెట్",
  "drumstick": "మునక్కాయ",
  "beans": "చిక్కుడు",
  "capsicum": "బెంగళూరు మిర్చి",
  "Radish": "ముల్లంగి",
  "sweet potato": "చిలగడదుంప",
  "colocasia": "చామగడ్డ",
  "cucumber": "దోసకాయ",
  "ivy gourd": "దొండకాయ",
  "cluster beans": "గోరుచిక్కుడు",
  "beetroot": "బీట్‌రూట్",
  // Leafy Vegetables
  "spinach": "పాలకూర",
  "amaranthus": "తోటకూర",
  "gongura": "గోంగూర",
  "coriander leaves": "కొత్తిమీర",
  "mint leaves": "పుదీనా",
  "curry leaves": "కరివేపాకు",
  "methi leaves": "మెంతికూర",
  // Fruits
  "mango": "మామిడి",
  "banana": "అరటి",
  "lemon": "నిమ్మ",
  "coconut": "కొబ్బరి",
  "papaya": "బొప్పాయి",
  "guava": "జామ",
  "Mousambi": "బత్తాయి",
  "pomegranate": "దానిమ్మ",
  "grapes": "ద్రాక్ష",
  "watermelon": "పుచ్చకాయ",
  "sapota": "సపోటా",
  "custard apple": "సీతాఫలం",
  "pineapple": "అనాస",
  "jackfruit": "పనస",
  "muskmelon": "కర్బూజ",
  "apple": "ఆపిల్",
  // Plantation & Floriculture
  "cashew nut": "జీడిమామిడి",
  "areca nut": "వక్కలు",
  "betel leaves": "తమలపాకులు",
  "coffee beans": "కాఫీ గింజలు",
  "cocoa beans": "కోకో గింజలు",
  "marigold": "బంతి పూలు",
  "jasmine": "మల్లె పూలు",
  "rose": "గులాబీ పూలు",
  "chrysanthemum": "చామంతి",
  "crossandra": "కనకాంబరాలు",
  "tuberose": "నిత్యమల్లె",
  "silk cocoon": "పట్టు గూళ్లు"
};

const CACHE_KEY = "ADVANCED_MARKET_CACHE";
const CACHE_TIME = 10 * 60 * 1000; // 10 mins

export default function MarketScreen() {
  const [language, setLanguage] = useState<"te" | "en">("te");
  const t = translations[language];

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [prices, setPrices] = useState<any[]>([]);
  const [filteredPrices, setFilteredPrices] = useState<any[]>([]);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"AP" | "TS">("AP");

  // 🔥 Search Focus & Mic States
  const [isFocused, setIsFocused] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const isScreenFocused = useIsFocused();

  const shimmerAnim = useRef(new Animated.Value(0)).current;

  /* ---------------- LOAD DATA & LANG ---------------- */
  useEffect(() => {
    const init = async () => {
      const lang = await AsyncStorage.getItem("APP_LANG");
      if (lang) setLanguage(lang as "te" | "en");
      fetchRealtimePrices(false);
    };
    init();
  }, [language]);

  /* ---------------- SHIMMER ANIMATION ---------------- */
  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
          Animated.timing(shimmerAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [loading]);

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, width],
  });

  /* ---------------- FETCH PRICES (ROBUST FALLBACK LOGIC) ---------------- */
  const fetchRealtimePrices = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(false);

      let cachedData: any[] | null = null;
      let parsedCache = null;

      // 🔥 1. Read existing cache first safely
      try {
        const cachedStr = await AsyncStorage.getItem(CACHE_KEY);
        if (cachedStr) {
          parsedCache = JSON.parse(cachedStr);
          cachedData = parsedCache.data;
        }
      } catch (cacheErr) {
        console.log("Cache Read Error:", cacheErr);
      }

      // 🔥 2. If not forcing refresh, and cache is fresh, use it immediately
      if (!forceRefresh && parsedCache && cachedData && (Date.now() - parsedCache.timestamp < CACHE_TIME)) {
        const finalData = await applyMarketTranslations(cachedData, language);
        setPrices(finalData);
        applyFilters(finalData, searchQuery, activeTab);
        setLoading(false);
        return;
      }

      // 🔥 3. Try to fetch from API
      try {
        const response = await fetch("https://us-central1-agrisnap-9b487.cloudfunctions.net/getAdvancedPrices");
        
        if (!response.ok) throw new Error("Cloud Function API Failed");

        const data = await response.json();
        
        // 🔥 CRITICAL FIX: If API returns empty data (e.g. holiday), DO NOT overwrite cache!
        if (Array.isArray(data) && data.length > 0) {
          const finalData = await applyMarketTranslations(data, language);
          setPrices(finalData);
          applyFilters(finalData, searchQuery, activeTab);
          
          // Save valid data to cache
          await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data }));
        } else {
          // If API returns empty array, force fallback to cache
          throw new Error("API returned empty data"); 
        }

      } catch (apiErr) {
        console.log("API Fetch Error, Falling back to cache:", apiErr);
        
        // 🔥 4. API FAILED OR EMPTY: FALLBACK TO CACHE PERMANENTLY! (Crash Protection)
        if (cachedData && Array.isArray(cachedData) && cachedData.length > 0) {
          const finalData = await applyMarketTranslations(cachedData, language);
          setPrices(finalData);
          applyFilters(finalData, searchQuery, activeTab);
        } else {
          // Only show error if no cache exists at all
          setError(true);
        }
      }

    } catch (err) {
      console.log("Overall Flow Error:", err);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchRealtimePrices(true);
  };

  // 🔥 Speech Recognition Logic
  useSpeechRecognitionEvent("result", (event) => {
    if (!isScreenFocused || !isListening) return;
    if (event.results && event.results.length > 0) {
      setSearchQuery(event.results[0].transcript);
    }
  });

  useSpeechRecognitionEvent("end", () => setIsListening(false));

  const handleVoiceSearch = async () => {
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!result.granted) return;

    setIsListening(true);
    ExpoSpeechRecognitionModule.start({
      lang: language === "te" ? "te-IN" : "en-US",
      interimResults: true,
    });
  };

  useEffect(() => {
    if (!isScreenFocused) {
      ExpoSpeechRecognitionModule.stop();
      setIsListening(false);
    }
    return () => {
      ExpoSpeechRecognitionModule.stop();
    };
  }, [isScreenFocused]);

  /* ---------------- FILTERING LOGIC ---------------- */
  useEffect(() => {
    applyFilters(prices, searchQuery, activeTab);
  }, [searchQuery, activeTab, prices]);

  const applyFilters = (data: any[], query: string, tab: "AP" | "TS") => {
    const stateFilter = tab === "AP" ? "Andhra Pradesh" : "Telangana";
    
    let filtered = data.filter((item) => item.state === stateFilter);

    if (query.trim() !== "") {
      const q = query.toLowerCase();
      filtered = filtered.filter((item) => {
        const engName = item.commodity?.toLowerCase() || "";
        const telName = getTranslatedCropName(engName);
        return engName.includes(q) || telName.includes(q);
      });
    }

    setFilteredPrices(filtered);
  };

  const getTranslatedCropName = (rawName: string) => {
    const cleanName = rawName.toLowerCase().trim();
    if (language === "te") {
      if (cropTranslations[cleanName]) return cropTranslations[cleanName];
      for (const [key, value] of Object.entries(cropTranslations)) {
        if (cleanName.includes(key)) return value;
      }
    }
    return rawName.replace(/\(.*?\)/g, "").trim().replace(/\b\w/g, c => c.toUpperCase());
  };

  /* ---------------- COMPONENTS ---------------- */

  const ShimmerSkeleton = () => (
    <View style={styles.listContent}>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <View key={i} style={[styles.shimmerBox, { height: 110, borderRadius: 16, marginBottom: 12, width: "100%" }]} />
      ))}
      <Animated.View style={[styles.shimmerOverlay, { transform: [{ translateX: shimmerTranslate }] }]}>
        <LinearGradient
          colors={["transparent", "rgba(255,255,255,0.6)", "transparent"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );

  const renderPriceCard = ({ item }: { item: any }) => {
    const cropName = getTranslatedCropName(item.commodity);
    const trend = item.modal_price > item.prevPrice ? "up" : item.modal_price < item.prevPrice ? "down" : "same";

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <AppText style={styles.cropName} language={language}>{cropName}</AppText>
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color="#6B7280" />
              <AppText style={styles.marketName} language={language}>
                {item.translated_market || item.market}
              </AppText>
            </View>
          </View>

          <View style={styles.priceContainer}>
            <View style={styles.trendRow}>
              <AppText style={styles.mainPrice} language={language}>₹{Number(item.modal_price).toLocaleString("en-IN")}</AppText>
              {trend === "up" && <Ionicons name="arrow-up" size={16} color="#16A34A" style={styles.trendIcon} />}
              {trend === "down" && <Ionicons name="arrow-down" size={16} color="#DC2626" style={styles.trendIcon} />}
            </View>
            <AppText style={styles.quintalText} language={language}>
              {language === "te" ? "/ క్వింటాల్" : "/ Quintal"}
            </AppText>
          </View>
        </View>

        {/* 🔥 NEW: LAST UPDATED TIMESTAMP BADGE */}
        <View style={styles.lastUpdateBadge}>
           <Ionicons name="time-outline" size={12} color="#059669" />
           <AppText style={styles.lastUpdateText} language={language}>
             {t.lastUpdated} {item.arrival_date || "N/A"}
           </AppText>
        </View>

        {/* Min & Max Row */}
        <View style={styles.cardBottom}>
          <View style={styles.minMaxBox}>
            <AppText style={styles.minMaxLabel} language={language}>{t.min}</AppText>
            <AppText style={styles.minMaxVal} language={language}>₹{Number(item.min_price).toLocaleString("en-IN")}</AppText>
          </View>
          <View style={styles.divider} />
          <View style={styles.minMaxBox}>
            <AppText style={styles.minMaxLabel} language={language}>{t.max}</AppText>
            <AppText style={styles.minMaxVal} language={language}>₹{Number(item.max_price).toLocaleString("en-IN")}</AppText>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <AppHeader title={t.title} subtitle={t.subtitle} language={language} />

      {/* 🔥 TABS & SEARCH BAR (Always visible) */}
      <View style={styles.stickyHeader}>
        {/* TABS */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === "AP" && styles.activeTabBtn]} 
            onPress={() => setActiveTab("AP")}
            activeOpacity={0.8}
          >
            <AppText style={[styles.tabText, activeTab === "AP" && styles.activeTabText]} language={language}>{t.ap}</AppText>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === "TS" && styles.activeTabBtn]} 
            onPress={() => setActiveTab("TS")}
            activeOpacity={0.8}
          >
            <AppText style={[styles.tabText, activeTab === "TS" && styles.activeTabText]} language={language}>{t.ts}</AppText>
          </TouchableOpacity>
        </View>

        {/* 🔥 CLEAN & MINIMAL SEARCH BAR */}
        <View style={[styles.searchContainer, isFocused && styles.searchFocused]}>
          <Ionicons name="search-outline" size={20} color={isFocused ? "#16A34A" : "#9CA3AF"} />

          <TextInput
            style={styles.searchInput}
            placeholder={t.search}
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            cursorColor="#16A34A"
            selectionColor="#16A34A40"
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />

          {searchQuery.length > 0 ? (
            <TouchableOpacity 
              onPress={() => setSearchQuery("")} 
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              onPress={handleVoiceSearch} 
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialCommunityIcons 
                name={isListening ? "microphone" : "microphone-outline"} 
                size={22} 
                color={isListening ? "#EF4444" : (isFocused ? "#16A34A" : "#9CA3AF")} 
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 🔥 CONTENT AREA */}
      {loading && !refreshing && prices.length === 0 ? (
        <ShimmerSkeleton />
      ) : error ? (
        <View style={styles.centerContainer}>
          <View style={styles.errorIconBg}>
            <Ionicons name="analytics-outline" size={50} color="#9CA3AF" />
          </View>
          <AppText style={styles.errorText} language={language}>{t.noData}</AppText>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchRealtimePrices(true)}>
            <AppText style={styles.retryText} language={language}>{t.retry}</AppText>
          </TouchableOpacity>
        </View>
      ) : filteredPrices.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons 
            name={searchQuery.trim().length > 0 ? "search-outline" : "calendar-outline"} 
            size={50} 
            color="#D1D5DB" 
          />
          <AppText style={[styles.errorText, { marginTop: 16 }]} language={language}>
            {searchQuery.trim().length > 0 
              ? t.noResults
              : (language === "te" 
                  ? `ఈరోజు ${activeTab === "AP" ? "ఆంధ్రప్రదేశ్" : "తెలంగాణ"} మార్కెట్ డేటా ఇంకా అప్‌డేట్ కాలేదు` 
                  : `Today's market data for ${activeTab === "AP" ? "Andhra Pradesh" : "Telangana"} is not updated yet`)}
          </AppText>
        </View>
      ) : (
        <FlatList
          data={filteredPrices}
          keyExtractor={(item, index) => `${item.market}-${item.commodity}-${index}`}
          renderItem={renderPriceCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled" 
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#2E7D32"]} />}
        />
      )}
    </SafeAreaView>
  );
}

/* ---------------- STYLES (Clean, Flat, Pro-Level) ---------------- */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F7F6" },
  stickyHeader: {
    backgroundColor: "#F6F7F6",
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 10,
    zIndex: 10,
  },
  
  // TABS
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#E5E7EB",
    borderRadius: 14,
    padding: 4,
    marginBottom: 15,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  activeTabBtn: {
    backgroundColor: "#1B5E20", 
  },
  tabText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "600",
  },
  activeTabText: {
    color: "#ffffff", 
    fontWeight: "600",
  },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 12,
    height: 50, 
    borderRadius: 8, 
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  searchFocused: {
    borderColor: "#16A34A",
    backgroundColor: "#FFFFFF",
  },
  searchInput: {
    flex: 1,
    height: "100%",
    marginLeft: 10,
    fontSize: 15,
    paddingTop: 0,
    paddingBottom: 0,
    textAlignVertical: "center",
    color: "#1F2937",
    fontFamily: "Mandali",
    includeFontPadding: false,
  },

  // LIST & CARDS
  listContent: { paddingHorizontal: 20, paddingBottom: 80, paddingTop: 10 },
  card: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  cropName: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  marketName: {
    fontSize: 13,
    color: "#6B7280",
    marginLeft: 4,
  },
  priceContainer: {
    alignItems: "flex-end",
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  mainPrice: {
    fontSize: 22,
    fontWeight: "600",
    color: "#1B5E20",
  },
  trendIcon: {
    marginLeft: 4,
    marginTop: 2,
  },
  quintalText: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
  },

  // 🔥 NEW: LAST UPDATED BADGE
  lastUpdateBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5", // Light green background
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  lastUpdateText: {
    fontSize: 11,
    color: "#059669",
    marginLeft: 4,
    fontFamily: "Mandali",
  },
  
  // MIN/MAX BOTTOM ROW
  cardBottom: {
    flexDirection: "row",
    backgroundColor: "#F8FAF9",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  minMaxBox: {
    flex: 1,
    alignItems: "center",
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: "#E5E7EB",
  },
  minMaxLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 2,
  },
  minMaxVal: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4B5563",
  },

  // ERROR & SHIMMER
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    marginTop: -50,
  },
  errorIconBg: {
    width: 90, height: 90, borderRadius: 45, backgroundColor: "#F3F4F6",
    justifyContent: "center", alignItems: "center", marginBottom: 16,
  },
  errorText: { fontSize: 16, fontWeight: "600", color: "#4B5563", textAlign: "center", marginBottom: 20 },
  retryBtn: { backgroundColor: "#2E7D32", paddingHorizontal: 30, paddingVertical: 12, borderRadius: 14 },
  retryText: { color: "white", fontSize: 15, fontWeight: "600" },
  shimmerBox: { backgroundColor: "#E5E7EB", overflow: "hidden" },
  shimmerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "transparent" },
});