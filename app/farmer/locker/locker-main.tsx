import React, { useState, useEffect, useCallback } from "react";
import { executeOfflineSafeRead, executeOfflineSafeWrite, executeOfflineSafeFetch } from "@/utils/offlineHelper";
import { useStore } from "@/store/useStore";

import { View, StyleSheet, TouchableOpacity, FlatList, RefreshControl, StatusBar, SafeAreaView, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import ShimmerPlaceholder from "react-native-shimmer-placeholder";

import AppText from "@/components/AppText";
import AppHeader from "@/components/AppHeader";
import AppEmptyState from "@/components/AppEmptyState";

const translations = {
  te: {
    title: "వ్యవసాయ లాకర్",
    subtitle: "మీ విత్తనాలు, మందుల వివరాలు భద్రంగా దాచుకోండి",
    all: "అన్ని",
    seed: "విత్తనాలు",
    fertilizer: "ఎరువులు",
    pesticide: "మందులు",
    other: "డాక్యుమెంట్లు",
    noData: "లాకర్ ఖాళీగా ఉంది",
    emptySubtitle: "కింద ఉన్న ప్లస్ (+) బటన్ నొక్కి మీ విత్తనాల లేదా మందుల వివరాలు దాచుకోండి.",
    errorText: "డేటా తీసుకురావడంలో లోపం జరిగింది",
    delete: "తొలగించు",
    price: "ధర:",
    crop: "పంట:"
  },
  en: {
    title: "Agri Locker",
    subtitle: "Safely store your seeds and pesticides details",
    all: "All",
    seed: "Seeds",
    fertilizer: "Fertilizers",
    pesticide: "Pesticides",
    other: "Documents",
    noData: "Locker is empty",
    emptySubtitle: "Click the plus (+) button below to safely store your farm inputs.",
    errorText: "Error fetching locker data",
    delete: "Delete",
    price: "Price:",
    crop: "Crop:"
  },
};

export default function LockerScreen() {
  const router = useRouter();
  const [language, setLanguage] = useState<"te" | "en">("te");
  const t = translations[language];

  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const items = useStore(state => state.locker);
  const isInitializing = useStore(state => state.isInitializing);
  const loading = isInitializing && items.length === 0;

  const [activeTab, setActiveTab] = useState<"seed" | "fertilizer" | "pesticide" | "other">("seed");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      const checkNewTab = async () => {
        try {
          const newTab = await AsyncStorage.getItem("LOCKER_NEW_TAB");
          if (newTab) {
            setActiveTab(newTab as any);
            await AsyncStorage.removeItem("LOCKER_NEW_TAB");
          }
        } catch (e) {
          console.log("Error reading new tab", e);
        }
      };
      checkNewTab();
    }, [])
  );

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      const lang = await AsyncStorage.getItem("APP_LANG");
      if (lang && isMounted) setLanguage(lang as "te" | "en");
    };
    init();
    return () => { isMounted = false; };
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const deleteItem = async (id: string) => {
    try {
      const phone = await AsyncStorage.getItem("USER_PHONE");
      if (phone) {
        await executeOfflineSafeWrite(firestore().collection("users").doc(phone).collection("locker").doc(id).delete());
      }
    } catch (e) {
      console.log("Error deleting item", e);
    }
  };

  const filteredItems = items.filter((item) => {
    return item.type === activeTab;
  });

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case "seed": return "#16A34A"; // Green
      case "fertilizer": return "#0284C7"; // Blue
      case "pesticide": return "#DC2626"; // Red
      case "other": return "#7C3AED"; // Purple
      default: return "#1F2937"; // Dark Gray for ALL
    }
  };

  const getCategoryBgColor = (cat: string) => {
    switch (cat) {
      case "seed": return "#DCFCE7";
      case "fertilizer": return "#E0F2FE";
      case "pesticide": return "#FEE2E2";
      case "other": return "#F3E8FF";
      default: return "#F3F4F6";
    }
  };

  const getTabStyle = (tab: string) => {
    if (activeTab !== tab) return styles.tabBtn;
    return [styles.tabBtn, { backgroundColor: getCategoryColor(tab) }];
  };

  const getIconForType = (type: string) => {
    switch(type) {
      case "seed": return "leaf-outline";
      case "fertilizer": return "flask-outline";
      case "pesticide": return "bug-outline";
      default: return "document-outline";
    }
  };

  const getPriceSuffix = (type: string) => {
    if (language === "te") {
      switch (type) {
        case "seed": return "/ ప్యాకెట్";
        case "fertilizer": return "/ బస్తా";
        case "pesticide": return "/ డబ్బా";
        default: return "/ వస్తువు";
      }
    } else {
      switch (type) {
        case "seed": return "/ packet";
        case "fertilizer": return "/ bag";
        case "pesticide": return "/ bottle";
        default: return "/ item";
      }
    }
  };

  const ShimmerSkeleton = () => (
    <View style={styles.listContent}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={styles.card}>
          <View style={styles.cardHeader}>
            <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ width: 80, height: 80, borderRadius: 10 }} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ width: "80%", height: 18, borderRadius: 4, marginBottom: 8 }} />
                  <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ width: "50%", height: 14, borderRadius: 4, marginBottom: 8 }} />
                  <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ width: "60%", height: 14, borderRadius: 4 }} />
                </View>
                <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ width: 60, height: 20, borderRadius: 6 }} />
              </View>
              <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ width: "100%", height: 12, borderRadius: 4, marginTop: 12 }} />
            </View>
          </View>
          <View style={styles.cardActions}>
            <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ width: 80, height: 30, borderRadius: 8 }} />
          </View>
        </View>
      ))}
    </View>
  );

  const renderItem = ({ item }: { item: any }) => {
    const dateObj = item.createdAt ? item.createdAt.toDate() : new Date();
    const dateStr = dateObj.toLocaleDateString(language === "te" ? "te-IN" : "en-IN", { day: 'numeric', month: 'short', year: 'numeric' });

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          {(item.imageUrls && item.imageUrls.length > 0) ? (
            <View style={{ flexDirection: "column", gap: 8 }}>
              {item.imageUrls.map((url: string, idx: number) => (
                <TouchableOpacity key={idx} onPress={() => setSelectedImage(url)} activeOpacity={0.8}>
                  <Image source={{ uri: url }} style={{ width: 80, height: item.imageUrls.length > 1 ? 75 : 80, borderRadius: 10, backgroundColor: "#F3F4F6" }} contentFit="cover" transition={300} />
                </TouchableOpacity>
              ))}
            </View>
          ) : item.imageUrl ? (
            <TouchableOpacity onPress={() => setSelectedImage(item.imageUrl)} activeOpacity={0.8}>
              <Image source={{ uri: item.imageUrl }} style={styles.cardImage} contentFit="cover" transition={300} />
            </TouchableOpacity>
          ) : (
            <View style={[styles.iconPlaceholder, { backgroundColor: getCategoryBgColor(item.type) }]}>
              <Ionicons name={getIconForType(item.type)} size={32} color={getCategoryColor(item.type)} />
            </View>
          )}
          
          <View style={styles.cardBody}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1, paddingRight: 10, flexShrink: 1 }}>
                <AppText style={styles.brandTitle} language={language} numberOfLines={2}>{item.brandName || "N/A"}</AppText>
                {item.type !== "other" && item.crop && (
                  <AppText style={styles.cropText} language={language}>{t.crop} <AppText style={{ color: "#1F2937", fontWeight: "600" }}>{item.crop}</AppText></AppText>
                )}
                {item.price ? (
                  <AppText style={styles.priceText} language={language}>{t.price} <AppText style={{ color: "#16A34A", fontWeight: "700" }}>₹{Number(item.price).toLocaleString("en-IN")} <AppText style={{ fontSize: 11, color: "#6B7280", fontWeight: "600" }}>{getPriceSuffix(item.type)}</AppText></AppText></AppText>
                ) : null}
              </View>
              <View style={[styles.dateBadge, { flexShrink: 0 }]}>
                <AppText style={styles.dateText}>{dateStr}</AppText>
              </View>
            </View>
            
            {item.notes ? (
              <AppText style={styles.notesText} language={language} numberOfLines={2}>{item.notes}</AppText>
            ) : null}
          </View>
        </View>
        
        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setDeleteItemId(item.id)}>
            <Ionicons name="trash-outline" size={18} color="#EF4444" />
            <AppText style={[styles.actionText, { color: "#EF4444" }]} language={language}>{t.delete}</AppText>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <AppHeader title={t.title} subtitle={t.subtitle} language={language} onBack={() => router.replace("/farmer/(tabs)")} />

      {!loading && !error && (
        <View style={styles.stickyHeader}>
          <View style={styles.tabContainer}>
            <TouchableOpacity style={getTabStyle("seed")} onPress={() => setActiveTab("seed")}>
              <AppText style={[styles.tabText, activeTab === "seed" && styles.activeTabText]} language={language}>{t.seed}</AppText>
            </TouchableOpacity>
            <TouchableOpacity style={getTabStyle("fertilizer")} onPress={() => setActiveTab("fertilizer")}>
              <AppText style={[styles.tabText, activeTab === "fertilizer" && styles.activeTabText]} language={language}>{t.fertilizer}</AppText>
            </TouchableOpacity>
            <TouchableOpacity style={getTabStyle("pesticide")} onPress={() => setActiveTab("pesticide")}>
              <AppText style={[styles.tabText, activeTab === "pesticide" && styles.activeTabText]} language={language}>{t.pesticide}</AppText>
            </TouchableOpacity>
            <TouchableOpacity style={getTabStyle("other")} onPress={() => setActiveTab("other")}>
              <AppText style={[styles.tabText, activeTab === "other" && styles.activeTabText]} language={language}>{t.other}</AppText>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {loading && !refreshing ? (
        <ShimmerSkeleton />
      ) : error ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <AppEmptyState iconName="cloud-offline-outline" title={t.errorText} onRetry={() => {}} language={language} />
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContent, filteredItems.length === 0 && { flexGrow: 1, justifyContent: "center" }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#16A34A"]} />}
          ListEmptyComponent={
            <AppEmptyState 
              iconName="shield-checkmark-outline" 
              title={t.noData} 
              subtitle={t.emptySubtitle} 
              language={language} 
            />
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity activeOpacity={0.9} style={styles.fab} onPress={() => router.push("/farmer/locker/add")}>
        <LinearGradient colors={["#16A34A", "#064E3B"]} style={styles.fabGradient}>
          <Ionicons name="add" size={32} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      {/* FULL SCREEN IMAGE MODAL */}
      <Modal visible={!!selectedImage} transparent animationType="fade" onRequestClose={() => setSelectedImage(null)}>
        <View style={styles.fullScreenModal}>
          <TouchableOpacity style={styles.closeModalBtn} onPress={() => setSelectedImage(null)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {selectedImage && (
            <Image source={{ uri: selectedImage }} style={styles.fullScreenImage} contentFit="contain" />
          )}
        </View>
      </Modal>

      {/* DELETE ENTRY MODAL */}
      <Modal visible={!!deleteItemId} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.modalOverlayStandard}>
          <View style={styles.modalContentStandard}>
            <View style={[styles.modalIconBgStandard, { backgroundColor: "#FEE2E2" }]}>
              <Ionicons name="trash-outline" size={36} color="#DC2626" />
            </View>
            <AppText style={styles.modalTitleStandard}>{language === "te" ? "తొలగించాలా?" : "Delete Entry?"}</AppText>
            <AppText style={styles.modalSubStandard}>
              {language === "te" 
                ? "ఈ వివరాలను మీరు శాశ్వతంగా తొలగించాలనుకుంటున్నారా?" 
                : "Are you sure you want to permanently delete these details?"}
            </AppText>
            <View style={styles.modalButtonsStandard}>
              <TouchableOpacity activeOpacity={0.8} style={styles.modalCancelBtnStandard} onPress={() => setDeleteItemId(null)}>
                <AppText style={styles.modalCancelTextStandard}>{language === "te" ? "వద్దు" : "Cancel"}</AppText>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.8} style={[styles.modalConfirmBtnStandard, { backgroundColor: "#DC2626" }]} onPress={() => { if(deleteItemId) { deleteItem(deleteItemId); setDeleteItemId(null); } }}>
                <AppText style={styles.modalConfirmTextStandard}>{language === "te" ? "తొలగించు" : "Delete"}</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F7F6" },
  stickyHeader: { backgroundColor: "#F6F7F6", paddingHorizontal: 20, paddingTop: 15, paddingBottom: 5, zIndex: 10 },
  tabContainer: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#E5E7EB", borderRadius: 14, padding: 4, marginBottom: 15 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  tabText: { fontSize: 14, color: "#6B7280", fontWeight: "600" },
  activeTabText: { color: "#ffffff", fontWeight: "600" },
  
  listContent: { paddingHorizontal: 20, paddingBottom: 100, paddingTop: 10 },
  card: { backgroundColor: "#ffffff", borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: "#E5E7EB", overflow: "hidden" },
  cardHeader: { flexDirection: "row", padding: 12 },
  cardImage: { width: 80, height: 80, borderRadius: 10, backgroundColor: "#F3F4F6" },
  iconPlaceholder: { width: 80, height: 80, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  cardBody: { flex: 1, marginLeft: 12, flexShrink: 1 },
  brandTitle: { fontSize: 16, fontWeight: "600", color: "#1F2937", marginBottom: 4, flexShrink: 1 },
  cropText: { fontSize: 13, color: "#6B7280", marginBottom: 2 },
  priceText: { fontSize: 14, color: "#6B7280", marginTop: 2 },
  notesText: { fontSize: 12, color: "#9CA3AF", marginTop: 6, fontStyle: "italic" },
  
  dateBadge: { backgroundColor: "#F3F4F6", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  dateText: { fontSize: 11, fontWeight: "600", color: "#4B5563" },
  
  cardActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, borderTopWidth: 1, borderTopColor: "#F3F4F6", padding: 10, backgroundColor: "#F9FAFB" },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#fff" },
  actionText: { fontSize: 13, fontWeight: "600" },
  
  shimmerCard: { backgroundColor: "#ffffff", borderRadius: 20, marginBottom: 20, overflow: "hidden", borderWidth: 1, borderColor: "#E5E7EB" },
  
  fab: { position: "absolute", bottom: 30, right: 20, elevation: 5, shadowColor: '#16A34A', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: {width: 0, height: 4} },
  fabGradient: { width: 64, height: 64, borderRadius: 35, justifyContent: "center", alignItems: "center" },

  fullScreenModal: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "center", alignItems: "center" },
  fullScreenImage: { width: "100%", height: "80%" },
  closeModalBtn: { position: "absolute", top: 40, right: 20, zIndex: 10, padding: 8, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20 },
  
  modalOverlayStandard: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalContentStandard: { width: "100%", backgroundColor: "#fff", borderRadius: 20, padding: 24, alignItems: "center" },
  modalIconBgStandard: { width: 64, height: 64, borderRadius: 32, justifyContent: "center", alignItems: "center", marginBottom: 16 },
  modalTitleStandard: { fontSize: 20, fontWeight: "600", color: "#1F2937", marginBottom: 8, fontFamily: "Mandali" },
  modalSubStandard: { fontSize: 14, color: "#6B7280", textAlign: "center", marginBottom: 24, fontFamily: "Mandali" },
  modalButtonsStandard: { flexDirection: "row", gap: 12, width: "100%" },
  modalCancelBtnStandard: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: "#F3F4F6", alignItems: "center" },
  modalCancelTextStandard: { color: "#4B5563", fontSize: 16, fontWeight: "600", fontFamily: "Mandali" },
  modalConfirmBtnStandard: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  modalConfirmTextStandard: { color: "#fff", fontSize: 16, fontWeight: "600", fontFamily: "Mandali" },
});
