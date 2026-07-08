// app/farmer/schemes/index.tsx

import { Ionicons } from "@expo/vector-icons";
import { executeOfflineSafeRead, executeOfflineSafeWrite, executeOfflineSafeFetch } from "@/utils/offlineHelper";
import { useStore } from "@/store/useStore";

import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  FlatList,
  Image,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View
} from "react-native";
import ShimmerPlaceholder from "react-native-shimmer-placeholder";

import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";
import AppEmptyState from "@/components/AppEmptyState";

/* ---------------- TRANSLATIONS ---------------- */
const translations = {
  te: {
    title: "ప్రభుత్వ పథకాలు",
    subtitle: "రైతు సంక్షేమ పథకాలు & రాయితీలు",
    ap: "ఆంధ్రప్రదేశ్",
    ts: "తెలంగాణ",
    noData: "ప్రస్తుతం పథకాలు ఏమీ అందుబాటులో లేవు",
    retry: "మళ్ళీ ప్రయత్నించండి",
    readMore: "పూర్తి వివరాలు",
    errorText: "డేటా తీసుకురావడంలో లోపం జరిగింది"
  },
  en: {
    title: "Govt Schemes",
    subtitle: "Farmer Welfare & Subsidies",
    ap: "Andhra Pradesh",
    ts: "Telangana",
    noData: "No schemes available at the moment",
    retry: "Try Again",
    readMore: "View Details",
    errorText: "Error fetching schemes data"
  },
};

export default function SchemesScreen() {
  const router = useRouter();
  const [language, setLanguage] = useState<"te" | "en">("te");
  const t = translations[language];

  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const schemes = useStore(state => state.schemes);
  const isInitializing = useStore(state => state.isInitializing);
  
  const loading = isInitializing && schemes.length === 0;

  const [activeTab, setActiveTab] = useState<"AP" | "TS">("AP");

  useEffect(() => {
    let isMounted = true; 

    const init = async () => {
      const lang = await AsyncStorage.getItem("APP_LANG");
      if (lang && isMounted) setLanguage(lang as "te" | "en");
    };

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  /* ---------------- FILTERING ---------------- */
  const filteredSchemes = schemes.filter(
    (scheme) => scheme.state === activeTab || scheme.state === "BOTH" || scheme.state === "ALL"
  );

  /* ---------------- COMPONENTS ---------------- */
  const ShimmerSkeleton = () => (
    <View style={styles.listContent}>
      {[1, 2].map((i) => (
        <View key={i} style={styles.shimmerCard}>
          <ShimmerPlaceholder 
            LinearGradient={LinearGradient} 
            style={{ height: 180, width: "100%" }} 
          />
          <View style={{ padding: 16 }}>
            <ShimmerPlaceholder 
              LinearGradient={LinearGradient} 
              style={{ height: 20, width: "70%", borderRadius: 4, marginBottom: 10 }} 
            />
            <ShimmerPlaceholder 
              LinearGradient={LinearGradient} 
              style={{ height: 14, width: "90%", borderRadius: 4, marginBottom: 6 }} 
            />
          </View>
        </View>
      ))}
    </View>
  );

  const renderSchemeCard = ({ item }: { item: any }) => {
    let formattedDate = "";
    // 🔥 PRO FIX: Safe Date Parsing
    try {
      if (item.createdAt) {
        const date = item.createdAt.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
        if (!isNaN(date.getTime())) {
          const day = String(date.getDate()).padStart(2, '0');
          const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          formattedDate = `${day} ${months[date.getMonth()]}, ${date.getFullYear()}`;
        }
      }
    } catch (e) {
      console.log("Date error", e);
    }

    return (
      <TouchableOpacity 
        style={styles.card} 
        activeOpacity={0.8}
        onPress={() => router.push(`/farmer/schemes/${item.id}` as any)}
      >
        <View style={styles.imageContainer}>
          <Image 
            source={{ uri: item.bannerImage || "https://via.placeholder.com/400x200?text=AgriConnect" }} 
            style={styles.bannerImage} 
          />
          {formattedDate ? (
            <View style={styles.tagBadge}>
              <AppText style={styles.tagText} language={language}>{formattedDate}</AppText>
            </View>
          ) : null}
        </View>

        <View style={styles.cardContent}>
          <AppText style={styles.schemeTitle} language={language}>{item.title}</AppText>
          <AppText style={styles.schemeDesc} language={language} numberOfLines={2}>
            {item.shortDesc}
          </AppText>

          <View style={styles.cardBottomRow}>
            <AppText style={styles.readMoreText} language={language}>{t.readMore}</AppText>
            <Ionicons name="arrow-forward-circle" size={24} color="#1B5E20" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <AppHeader title={t.title} subtitle={t.subtitle} language={language} />

      {/* 🔥 ట్యాబ్స్ - డేటా ఉన్నప్పుడు మాత్రమే కనిపిస్తాయి */}
      {!loading && !error && filteredSchemes.length > 0 && (
        <View style={styles.stickyHeader}>
          <View style={styles.tabContainer}>
            <TouchableOpacity 
              style={[styles.tabBtn, activeTab === "AP" && styles.activeTabBtn]} 
              onPress={() => setActiveTab("AP")}
            >
              <AppText style={[styles.tabText, activeTab === "AP" && styles.activeTabText]} language={language}>{t.ap}</AppText>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tabBtn, activeTab === "TS" && styles.activeTabBtn]} 
              onPress={() => setActiveTab("TS")}
            >
              <AppText style={[styles.tabText, activeTab === "TS" && styles.activeTabText]} language={language}>{t.ts}</AppText>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 🔥 CONTENT AREA */}
      {loading && !refreshing ? (
        <ShimmerSkeleton />
      ) : error ? (
        /* 🔥 ఎర్రర్ వచ్చినప్పుడు సెంటర్ కి రావడానికి flex: 1 వ్యూ */
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <AppEmptyState
            iconName="cloud-offline-outline"
            title={t.errorText}
            onRetry={() => {}}
            language={language}
          />
        </View>
      ) : filteredSchemes.length === 0 ? (
        /* 🔥 డేటా లేనప్పుడు సెంటర్ కి రావడానికి flex: 1 వ్యూ */
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <AppEmptyState
            iconName="document-text-outline"
            title={t.noData}
            language={language}
          />
        </View>
      ) : (
        <FlatList
          data={filteredSchemes}
          keyExtractor={(item) => item.id}
          renderItem={renderSchemeCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#2E7D32"]} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F7F6" },
  stickyHeader: {
    backgroundColor: "#F6F7F6",
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 5,
    zIndex: 10,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#E5E7EB",
    borderRadius: 14,
    padding: 4,
    marginBottom: 15,
  },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  activeTabBtn: { backgroundColor: "#1B5E20" },
  tabText: { fontSize: 14, color: "#6B7280", fontWeight: "600" },
  activeTabText: { color: "#ffffff", fontWeight: "600" },

  listContent: { paddingHorizontal: 20, paddingBottom: 100, paddingTop: 10 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden", 
  },
  imageContainer: { width: "100%", height: 180, backgroundColor: "#F3F4F6", position: "relative" },
  bannerImage: { width: "100%", height: "100%", resizeMode: "cover" },
  tagBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8
  },
  tagText: { color: "white", fontSize: 12, fontWeight: "600" },
  cardContent: { padding: 16 },
  schemeTitle: { fontSize: 20, fontWeight: "600", color: "#1F2937", marginBottom: 6, lineHeight: 28 },
  schemeDesc: { fontSize: 14, color: "#6B7280", lineHeight: 24, marginBottom: 16 },
  cardBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    paddingTop: 12
  },
  readMoreText: { fontSize: 14, fontWeight: "600", color: "#16A34A" },

  shimmerCard: { backgroundColor: "#ffffff", borderRadius: 20, marginBottom: 20, overflow: "hidden", borderWidth: 1, borderColor: "#E5E7EB" },
});