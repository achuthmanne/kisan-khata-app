import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View
} from "react-native";

import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";

const { width } = Dimensions.get("window");

/* ---------------- TRANSLATIONS ---------------- */
type TranslationKeys = {
  title: string; subtitle: string; hourly: string; daily: string;
  humidity: string; wind: string; rainChance: string; uv: string;
  adviceTitle: string; locating: string; loadingData: string;
  permissionDenied: string; noData: string; retry: string; lastUpdated: string;
};

const translations: Record<"te" | "en", TranslationKeys> = {
  te: {
    title: "వాతావరణం", subtitle: "తాజా వాతావరణ సమాచారం", hourly: "గంటల వారీగా", daily: "5 రోజుల వాతావరణం",
    humidity: "తేమ", wind: "గాలి వేగం", rainChance: "వర్షం అవకాశం", uv: "UV ఇండెక్స్",
    adviceTitle: "వ్యవసాయ సూచన", locating: "లొకేషన్ వెతుకుతోంది...", loadingData: "వాతావరణ డేటా పొందుతున్నాం...",
    permissionDenied: "లొకేషన్ పర్మిషన్ ఇవ్వలేదు. దయచేసి సెట్టింగ్స్ లో ఆన్ చేయండి.", noData: "వాతావరణ సమాచారం దొరకలేదు",
    retry: "మళ్ళీ ప్రయత్నించండి", lastUpdated: "చివరి అప్‌డేట్: "
  },
  en: {
    title: "Weather", subtitle: "Latest Weather Updates", hourly: "Hourly Forecast", daily: "5-Day Forecast",
    humidity: "Humidity", wind: "Wind", rainChance: "Rain Chance", uv: "UV Index",
    adviceTitle: "Agri Advice", locating: "Locating you...", loadingData: "Fetching weather data...",
    permissionDenied: "Location permission denied. Please enable it in settings.", noData: "Weather data not available",
    retry: "Try Again", lastUpdated: "Last Updated: "
  },
};

const WEATHER_CACHE_KEY = "ADVANCED_WEATHER_CACHE_PRO_MAX";
const TRANSLATION_CACHE_KEY = "LOCATION_TRANSLATION_DICT";
const CACHE_TIME = 15 * 60 * 1000; 

/* ---------------- HELPERS ---------------- */
const getCurrentFormattedTime = () => {
  const now = new Date();
  const d = now.getDate().toString().padStart(2, '0');
  const m = (now.getMonth() + 1).toString().padStart(2, '0');
  const y = now.getFullYear();
  let hrs = now.getHours();
  const mins = now.getMinutes().toString().padStart(2, '0');
  const ampm = hrs >= 12 ? 'PM' : 'AM';
  hrs = hrs % 12 || 12;
  return `${d}/${m}/${y}, ${hrs}:${mins} ${ampm}`;
};

// 🔥 PRO FIX: Backend లో తెలుగు హార్డ్‌కోడ్ అయినా సరే ఇంగ్లీష్ కి మారుస్తుంది
const getDisplayDay = (day: string, currentLang: string) => {
  if (currentLang === "te" || !day) return day;
  const dict: Record<string, string> = {
    "ఆది": "Sun", "సోమ": "Mon", "మంగళ": "Tue", "బుధ": "Wed", "గురు": "Thu", "శుక్ర": "Fri", "శని": "Sat",
    "ఆదివారం": "Sunday", "సోమవారం": "Monday", "మంగళవారం": "Tuesday", "బుధవారం": "Wednesday", "గురువారం": "Thursday", "శుక్రవారం": "Friday", "శనివారం": "Saturday",
    "ఈరోజు": "Today", "రేపు": "Tomorrow"
  };
  return dict[day.trim()] || day;
};

const getDisplayCondition = (cond: string, currentLang: string) => {
  if (currentLang === "te" || !cond) return cond;
  const dict: Record<string, string> = {
    "తేలికపాటి వర్షం": "Light Rain", "భారీ వర్షం": "Heavy Rain", "మేఘావృతం": "Cloudy", "పాక్షికంగా మేఘావృతం": "Partly Cloudy",
    "ఎండ": "Sunny", "ప్రశాంతం": "Clear", "వర్షం": "Rain", "ఉరుములతో కూడిన వర్షం": "Thunderstorms", "పొగమంచు": "Foggy"
  };
  return dict[cond.trim()] || cond;
};


const getAdviceConfig = (type: string, lang: string) => {
  switch (type) {
    case 'danger':
      return {
        boxStyle: styles.adviceDanger,
        icon: "warning",
        color: "#DC2626",
        title: lang === "te" ? "ప్రమాద హెచ్చరిక" : "Danger Alert",
        textColor: "#7F1D1D"
      };
    case 'warning':
      return {
        boxStyle: styles.adviceWarning,
        icon: "alert-circle",
        color: "#D97706",
        title: lang === "te" ? "వాతావరణ హెచ్చరిక" : "Weather Warning",
        textColor: "#92400E"
      };
    case 'info':
      return {
        boxStyle: styles.adviceInfo,
        icon: "information-circle",
        color: "#2563EB",
        title: lang === "te" ? "వ్యవసాయ సలహా" : "Agri Advice",
        textColor: "#1E3A8A"
      };
    case 'success':
    default:
      return {
        boxStyle: styles.adviceSuccess,
        icon: "checkmark-circle",
        color: "#15803D",
        title: lang === "te" ? "మంచి సమయం" : "Perfect Weather",
        textColor: "#14532D"
      };
  }
};

export default function WeatherScreen() {

  const [language, setLanguage] = useState<"te" | "en">("te");
  const t = translations[language];

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false); 
  const [refreshing, setRefreshing] = useState(false);

  const [exactLocation, setExactLocation] = useState("");
  const [currentWeather, setCurrentWeather] = useState<any>(null);
  const [hourlyData, setHourlyData] = useState<any[]>([]);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [lastUpdated, setLastUpdated] = useState(""); 

  const shimmerAnim = useRef(new Animated.Value(0)).current;

  // 🔥 1. భాష మారినప్పుడల్లా పక్కాగా అప్‌డేట్ అవ్వడానికి
  useFocusEffect(
    useCallback(() => {
      const loadLang = async () => {
        const lang = await AsyncStorage.getItem("APP_LANG");
        if (lang === "te" || lang === "en") setLanguage(lang);
      };
      loadLang();
    }, [])
  );

  useEffect(() => {
    fetchRealtimeWeather(false, language); // 🔥 భాష పక్కాగా పాస్ చేస్తున్నాం
  }, [language]);

  /* ---------------- SHIMMER ANIMATION EFFECT ---------------- */
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
    inputRange: [0, 1], outputRange: [-width, width],
  });

  const translateLocation = async (text: string, lang: string) => {
    if (!text || text === "Location") return lang === "te" ? "లొకేషన్ దొరకలేదు" : "Location Not Found";
    if (lang === "en") return text; // English కి అయితే ఉన్నది ఉన్నట్లు ఇచ్చేయ్
    try {
      const cachedDictString = await AsyncStorage.getItem(TRANSLATION_CACHE_KEY);
      const dict = cachedDictString ? JSON.parse(cachedDictString) : {};
      if (dict[text]) return dict[text];
      
      const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=te&dt=t&q=${encodeURIComponent(text)}`);
      const data = await res.json();
      const translatedText = data[0][0][0];
      
      dict[text] = translatedText;
      await AsyncStorage.setItem(TRANSLATION_CACHE_KEY, JSON.stringify(dict));
      return translatedText;
    } catch (e) {
      return text;
    }
  };

  /* ---------------- ROBUST FETCH WITH STRICT LANGUAGE BINDING ---------------- */
  const fetchRealtimeWeather = async (forceRefresh = false, currentLang = language) => {
    let parsedCache: any = null; 

    try {
      setLoading(true);
      setError(false);

      try {
        const cachedWeather = await AsyncStorage.getItem(WEATHER_CACHE_KEY);
        if (cachedWeather) parsedCache = JSON.parse(cachedWeather);
      } catch (e) { console.log("Cache Read Error", e) }

      // క్యాచ్ టైమ్ మరియు క్యాచ్ లాంగ్వేజ్ పక్కాగా మ్యాచ్ అయితేనే క్యాచ్ వాడాలి
      if (!forceRefresh && parsedCache && parsedCache.lang === currentLang && (Date.now() - parsedCache.timestamp < CACHE_TIME)) {
        setExactLocation(parsedCache.data.translatedLocation);
        setCurrentWeather(parsedCache.data.current);
        setHourlyData(parsedCache.data.hourly || []);
        setDailyData(parsedCache.data.daily || []);
        setLastUpdated(parsedCache.lastUpdated || "");
        setLoading(false);
        return;
      }

      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        throw new Error("LOCATION_DENIED");
      }

      let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const lat = location.coords.latitude;
      const lon = location.coords.longitude;

      // 🔥 PRO FIX: Get precise Village name from OS Geocoder instead of District/Mandal
      let osCity = "";
      try {
        const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
        if (geo && geo.length > 0) {
          const g = geo[0];
          const isValid = (s?: string | null) => s && s.length > 2 && !s.includes('+') && !/\d/.test(s);
          osCity = (isValid(g.name) ? g.name : null) || (isValid(g.street) ? g.street : null) || g.city || g.subregion || g.district || "";
        }
      } catch (e) {}

      const response = await fetch(
        `https://us-central1-agrisnap-9b487.cloudfunctions.net/getAdvancedWeather?lat=${lat}&lon=${lon}&lang=${currentLang}`
      );

      if (!response.ok) throw new Error("API_FAILED");

      const data = await response.json();

      // OS City నే ఫస్ట్ ప్రయారిటీ (ఇది ఇంగ్లీష్ లోనే ఉంటుంది కాబట్టి)
      let baseLoc = osCity || data.exactLocation || data.current?.name || "Location";
      
      const finalTranslatedLocation = await translateLocation(baseLoc, currentLang);
      const currentTime = getCurrentFormattedTime();

      setExactLocation(finalTranslatedLocation);
      setCurrentWeather(data.current);
      setHourlyData(data.hourly || []);
      setDailyData(data.daily || []);
      setLastUpdated(currentTime);

      await AsyncStorage.setItem(
        WEATHER_CACHE_KEY,
        JSON.stringify({
          timestamp: Date.now(),
          lang: currentLang, // పక్కాగా ప్రస్తుత భాషనే క్యాచ్ లో వేస్తున్నాం
          lastUpdated: currentTime,
          data: { translatedLocation: finalTranslatedLocation, current: data.current, hourly: data.hourly, daily: data.daily }
        })
      );

    } catch (err: any) {
      console.log("Weather Flow Error:", err.message);
      
      if (parsedCache && parsedCache.data) {
        setExactLocation(parsedCache.data.translatedLocation);
        setCurrentWeather(parsedCache.data.current);
        setHourlyData(parsedCache.data.hourly || []);
        setDailyData(parsedCache.data.daily || []);
        setLastUpdated(parsedCache.lastUpdated || "");
        
        if (err.message === "LOCATION_DENIED") {
           Alert.alert(currentLang === "te" ? "పర్మిషన్ అవసరం" : "Permission Required", translations[currentLang as "te" | "en"].permissionDenied);
        }
      } else {
        setError(true);
      }

    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchRealtimeWeather(true, language); // 🔥 Force refresh with strict language
  };

  /* ---------------- SHIMMER UI COMPONENT ---------------- */
  const ShimmerSkeleton = () => (
    <View style={styles.scrollContent}>
      {/* 📍 EXACT LOCATION */}
      <View style={styles.headerRow}>
        <View style={[styles.shimmerBox, { width: 180, height: 40, borderRadius: 12, marginBottom: 8 }]} />
      </View>

      {/* 🌡️ MAIN WEATHER */}
      <View style={styles.mainWeatherBox}>
        <View style={[styles.shimmerBox, { width: 85, height: 85, borderRadius: 45, marginBottom: 10 }]} />
        <View style={[styles.shimmerBox, { width: 140, height: 80, borderRadius: 12, marginBottom: 5 }]} />
        <View style={[styles.shimmerBox, { width: 160, height: 24, borderRadius: 8 }]} />
      </View>

      {/* 🌍 AGRI ADVICE */}
      <View style={[styles.shimmerBox, { height: 160, borderRadius: 16, marginBottom: 25, width: "100%" }]} />

      {/* 📊 WEATHER GRID */}
      <View style={styles.gridContainer}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={[styles.shimmerBox, { width: (width - 52) / 2, height: 100, borderRadius: 16 }]} />
        ))}
      </View>

      {/* ⏱️ HOURLY FORECAST */}
      <View style={styles.section}>
        <View style={[styles.shimmerBox, { width: 120, height: 24, borderRadius: 8, marginBottom: 12 }]} />
        <View style={{ flexDirection: "row", gap: 12, overflow: "hidden" }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={[styles.shimmerBox, { width: 75, height: 110, borderRadius: 16 }]} />
          ))}
        </View>
      </View>

      {/* 📅 5-DAY FORECAST */}
      <View style={styles.section}>
        <View style={[styles.shimmerBox, { width: 140, height: 24, borderRadius: 8, marginBottom: 12 }]} />
        <View style={styles.dailyBox}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={[styles.dailyRow, i === 5 && { borderBottomWidth: 0 }]}>
               <View style={[styles.shimmerBox, { width: 60, height: 20, borderRadius: 6 }]} />
               <View style={[styles.shimmerBox, { width: 26, height: 26, borderRadius: 13 }]} />
               <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={[styles.shimmerBox, { width: 35, height: 20, borderRadius: 6 }]} />
                  <View style={[styles.shimmerBox, { width: 35, height: 20, borderRadius: 6 }]} />
               </View>
            </View>
          ))}
        </View>
      </View>

      {/* OVERLAY */}
      <Animated.View style={[styles.shimmerOverlay, { transform: [{ translateX: shimmerTranslate }] }]}>
        <LinearGradient
          colors={["transparent", "rgba(255,255,255,0.7)", "transparent"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <AppHeader title={t.title} subtitle={t.subtitle} language={language} />

      {loading && !refreshing ? (
        <ShimmerSkeleton />
      ) : error ? (
        <View style={styles.errorContainer}>
          <View style={styles.errorIconBg}>
            <Ionicons name="cloud-offline" size={50} color="#9CA3AF" />
          </View>
          <AppText style={styles.errorText} language={language}>{t.noData}</AppText>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchRealtimeWeather(true, language)}>
            <AppText style={styles.retryText} language={language}>{t.retry}</AppText>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView 
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#2E7D32"]} />}
          contentContainerStyle={styles.scrollContent}
        >
          {/* 📍 EXACT LOCATION & LAST UPDATED */}
          <View style={styles.headerRow}>
            <View style={styles.locationBox}>
              <Ionicons name="location-sharp" size={18} color="#2E7D32" />
              <AppText style={styles.locationText} language={language}>
                {exactLocation}
              </AppText>
            </View>

            {lastUpdated ? (
              <View style={styles.lastUpdateBadge}>
                <Ionicons name="time-outline" size={12} color="#059669" />
                <AppText style={styles.lastUpdateText} language={language}>
                  {t.lastUpdated}{lastUpdated}
                </AppText>
              </View>
            ) : null}
          </View>

          {/* 🌡️ MAIN WEATHER */}
          <View style={styles.mainWeatherBox}>
            <Ionicons name={currentWeather?.icon || "partly-sunny"} size={85} color={currentWeather?.color || "#F59E0B"} />
            <AppText style={styles.mainTemp} language={language}>{currentWeather?.temp}°C</AppText>
            <AppText style={styles.mainCondition} language={language}>{getDisplayCondition(currentWeather?.condition, language)}</AppText>
          </View>

          {/* 🌍 AGRI ADVICE */}
          {(() => {
            const adviceConf = getAdviceConfig(currentWeather?.adviceType || (currentWeather?.isGood ? 'success' : 'warning'), language);
            return (
              <View style={[styles.adviceBox, adviceConf.boxStyle]}>
                <View style={styles.adviceHeader}>
                  <Ionicons 
                    name={adviceConf.icon as any} 
                    size={20} 
                    color={adviceConf.color} 
                  />
                  <AppText style={[styles.adviceTitle, { color: adviceConf.color }]} language={language}>
                    {adviceConf.title}
                  </AppText>
                </View>
                <AppText style={[styles.adviceText, { color: adviceConf.textColor }]} language={language}>
                  {currentWeather?.advice}
                </AppText>

                <View style={{ marginTop: 12, paddingTop: 12, paddingBottom: 4, borderTopWidth: 1, borderTopColor: `${adviceConf.color}30` }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <Ionicons name="information-circle-outline" size={14} color={adviceConf.textColor} style={{ marginTop: 2, marginRight: 6, opacity: 0.8 }} />
                    <AppText style={{ flex: 1, fontSize: 13, color: adviceConf.textColor, opacity: 0.85, lineHeight: 24, paddingBottom: 4, marginTop: -2 }} language={language}>
                      {language === "te" 
                        ? "గమనిక: ఇవి కేవలం వాతావరణ అంచనాల ఆధారంగా ఇస్తున్న సూచనలు. ప్రస్తుత సమయాన్ని, మీ పొలం పరిస్థితిని బట్టి మీరు సొంతగా నిర్ణయం తీసుకోండి." 
                        : "Note: These are suggestions based on weather estimates. Please use your own judgment based on the current time and your farm's condition."}
                    </AppText>
                  </View>
                </View>
              </View>
            );
          })()}
          {/* 📊 WEATHER GRID */}
          <View style={styles.gridContainer}>
            <View style={styles.gridBox}>
              <Ionicons name="water" size={24} color="#3B82F6" />
              <AppText style={styles.gridLabel} language={language}>{t.humidity}</AppText>
              <AppText style={styles.gridValue} language={language}>{currentWeather?.humidity}%</AppText>
            </View>
            <View style={styles.gridBox}>
              <Ionicons name="umbrella" size={24} color="#3B82F6" />
              <AppText style={styles.gridLabel} language={language}>{t.rainChance}</AppText>
              <AppText style={styles.gridValue} language={language}>{currentWeather?.rainChance}%</AppText>
            </View>
            <View style={styles.gridBox}>
              <Ionicons name="navigate" size={24} color="#0D9488" />
              <AppText style={styles.gridLabel} language={language}>{t.wind}</AppText>
              <AppText style={styles.gridValue} language={language}>{currentWeather?.wind} km/h</AppText>
            </View>
            <View style={styles.gridBox}>
              <Ionicons name="sunny" size={24} color="#F59E0B" />
              <AppText style={styles.gridLabel} language={language}>{t.uv}</AppText>
              <AppText style={styles.gridValue} language={language}>{currentWeather?.uv}</AppText>
            </View>
          </View>

          {/* ⏱️ HOURLY FORECAST */}
          {hourlyData.length > 0 && (
            <View style={styles.section}>
              <AppText style={styles.sectionTitle} language={language}>{t.hourly}</AppText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hourlyScroll}>
                {hourlyData.map((item, index) => (
                  <View key={index} style={styles.hourlyCard}>
                    <AppText style={styles.hourlyTime} language={language}>{item.time}</AppText>
                    <Ionicons name={item.icon} size={28} color={item.color || "#F59E0B"} style={{ marginVertical: 8 }} />
                    <AppText style={styles.hourlyTemp} language={language}>{item.temp}°</AppText>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* 📅 5-DAY FORECAST */}
          {dailyData.length > 0 && (
            <View style={styles.section}>
              <AppText style={styles.sectionTitle} language={language}>{t.daily}</AppText>
              <View style={styles.dailyBox}>
                {dailyData.map((item, index) => (
                  <View key={index} style={[styles.dailyRow, index === dailyData.length - 1 && { borderBottomWidth: 0 }]}>
                    {/* 🔥 PRO FIX: ఇంగ్లీష్ అయితే 'Mon', 'Tue' లాగా ఆటోమేటిక్ గా మారుతుంది */}
                    <AppText style={styles.dailyDay} language={language}>{getDisplayDay(item.day, language)}</AppText>
                    <Ionicons name={item.icon} size={22} color={item.color || "#6B7280"} />
                    <View style={styles.dailyTemps}>
                      <AppText style={styles.dailyMin} language={language}>{item.min}°</AppText>
                      <AppText style={styles.dailyMax} language={language}>{item.max}°</AppText>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F7F6" },
  scrollContent: { padding: 20, paddingBottom: 60 },
  shimmerBox: { backgroundColor: "#E5E7EB", overflow: "hidden" },
  shimmerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "transparent" },
  errorContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40 },
  errorIconBg: { width: 90, height: 90, borderRadius: 45, backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  errorText: { fontSize: 18, fontWeight: "600", color: "#4B5563", textAlign: "center", marginBottom: 20 },
  retryBtn: { backgroundColor: "#2E7D32", paddingHorizontal: 30, paddingVertical: 12, borderRadius: 14 },
  retryText: { color: "white", fontSize: 15, fontWeight: "600" },
  headerRow: { flexDirection: "column", alignItems: "flex-start", marginBottom: 20 },
  locationBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#E8F5E9", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, marginBottom: 8 },
  locationText: { fontSize: 14, color: "#1B5E20", fontWeight: "600", marginLeft: 6 },
  lastUpdateBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#F1F5F9", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: "#E2E8F0" },
  lastUpdateText: { fontSize: 11, color: "#475569", marginLeft: 4, fontFamily: "Mandali" },
  mainWeatherBox: { alignItems: "center", justifyContent: "center", marginBottom: 25 },
  mainTemp: { fontSize: 70, color: "#1F2937", fontWeight: "bold", includeFontPadding: false, marginTop: 5 },
  mainCondition: { fontSize: 20, color: "#4B5563", marginTop: -5 },
  adviceBox: { padding: 16, borderRadius: 16, marginBottom: 25, borderWidth: 1 },
  adviceSuccess: { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" },
  adviceDanger: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  adviceWarning: { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" },
  adviceInfo: { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" },
  adviceHeader: { flexDirection: "row", alignItems: "center", justifyContent: "flex-start", marginBottom: 8 },
  adviceTitle: { fontSize: 18, fontWeight: "600", marginLeft: 6, flexShrink: 1, top: -1 }, // slightly adjust top if Telugu font renders low
  adviceText: { fontSize: 16, lineHeight: 26 },
  gridContainer: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 12, marginBottom: 25 },
  gridBox: { width: (width - 52) / 2, backgroundColor: "white", padding: 16, borderRadius: 16, alignItems: "center", borderWidth: 1, borderColor: "#E5E7EB" },
  gridLabel: { fontSize: 13, color: "#6B7280", marginTop: 8, marginBottom: 4 },
  gridValue: { fontSize: 16, fontWeight: "bold", color: "#1F2937" },
  section: { marginBottom: 25 },
  sectionTitle: { fontSize: 18, fontWeight: "600", color: "#1F2937", marginBottom: 12 },
  hourlyScroll: { gap: 12 },
  hourlyCard: { backgroundColor: "white", paddingVertical: 14, paddingHorizontal: 18, borderRadius: 16, alignItems: "center", borderWidth: 1, borderColor: "#E5E7EB" },
  hourlyTime: { fontSize: 13, color: "#6B7280" },
  hourlyTemp: { fontSize: 16, fontWeight: "bold", color: "#1F2937" },
  dailyBox: { backgroundColor: "white", borderRadius: 16, paddingHorizontal: 16, borderWidth: 1, borderColor: "#E5E7EB" },
  dailyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  dailyDay: { flex: 1, fontSize: 15, color: "#1F2937", fontWeight: "600" },
  dailyTemps: { flex: 1, flexDirection: "row", justifyContent: "flex-end", gap: 12 },
  dailyMin: { fontSize: 15, color: "#6B7280" },
  dailyMax: { fontSize: 15, fontWeight: "bold", color: "#1F2937" },
});