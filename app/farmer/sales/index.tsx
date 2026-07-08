// app/farmer/sales/index.tsx

import AppHeader from "@/components/AppHeader";
import { useStore } from "@/store/useStore";
import { executeOfflineSafeRead, executeOfflineSafeWrite, executeOfflineSafeFetch } from "@/utils/offlineHelper";

import AppText from "@/components/AppText";
import AppEmptyState from "@/components/AppEmptyState"; 
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState, useMemo } from "react";
import {
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
  TextInput 
} from "react-native";
import { Menu, MenuOption, MenuOptions, MenuTrigger } from "react-native-popup-menu"; 
import ShimmerPlaceholder from "react-native-shimmer-placeholder";

// 🔥 REANIMATED IMPORTS
import Animated, { useSharedValue, useAnimatedProps, withTiming, Easing } from "react-native-reanimated";

Animated.addWhitelistedNativeProps({ text: true, value: true });
const AnimatedText = Animated.createAnimatedComponent(TextInput);

// 🔥 PRO FIX 1: Format worklet
const formatIndianCurrency = (val: number) => {
  'worklet';
  let numStr = Math.floor(val).toString();
  if (numStr.length <= 3) return numStr;
  let lastThree = numStr.slice(-3);
  let otherNumbers = numStr.slice(0, -3);
  let formattedOther = "";
  while (otherNumbers.length > 2) {
    formattedOther = "," + otherNumbers.slice(-2) + formattedOther;
    otherNumbers = otherNumbers.slice(0, -2);
  }
  return otherNumbers + formattedOther + "," + lastThree;
};

export default function SalesScreen() {
  const router = useRouter();

  const sales = useStore(state => state.sales);
  const isInitializing = useStore(state => state.isInitializing);
  const loading = isInitializing && sales.length === 0;
  const data = sales;

  const [language, setLanguage] = useState<"te" | "en">("te");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [deleteVisible, setDeleteVisible] = useState(false);

  const { totalIncome, totalQty, cropQty, cropIncome } = useMemo(() => {
    let tIncome = 0;
    let tQty = 0;
    const cropQtyMap: any = {};
    const cropIncomeMap: any = {};

    sales.forEach((d: any) => {
      const qty = Number(d.quantity) || 0;
      const total = Number(d.total) || 0;
      const unit = d.unit || "";

      tIncome += total;
      tQty += qty;

      const key = `${d.crop}_${unit}`;
      cropQtyMap[key] = (cropQtyMap[key] || 0) + qty;
      cropIncomeMap[d.crop] = (cropIncomeMap[d.crop] || 0) + total;
    });

    return { totalIncome: tIncome, totalQty: tQty, cropQty: cropQtyMap, cropIncome: cropIncomeMap };
  }, [sales]);

  const animatedIncome = useSharedValue(0);

  useEffect(() => {
    animatedIncome.value = withTiming(totalIncome, {
        duration: 2000, 
        easing: Easing.out(Easing.exp), 
    });
  }, [totalIncome]);

  const animatedProps = useAnimatedProps(() => {
    const formatted = formatIndianCurrency(animatedIncome.value);
    return {
        text: `₹ ${formatted}`,
        value: `₹ ${formatted}` 
    } as any; 
  });

  const unitMap: any = {
    kg: { en: "Kg", te: "కిలో" },
    gms: { en: "Gms", te: "గ్రా" },
    quintal: { en: "Quintal", te: "క్వింటాల్" },
    ton: { en: "Ton", te: "టన్ను" }
  };

  useEffect(() => {
    let isMounted = true;
    AsyncStorage.getItem("APP_LANG").then((l) => {
      if (l && isMounted) setLanguage(l as any);
    });
    return () => { isMounted = false; };
  }, []);

  const handleDelete = async () => {
    if (!selectedItem?.id) return;
    try {
      const phone = await AsyncStorage.getItem("USER_PHONE");
      if (phone) {
        await executeOfflineSafeWrite(firestore()
          .collection("users")
          .doc(phone)
          .collection("sales")
          .doc(selectedItem.id)
          .delete());
      }
    } catch (e) {
      console.log("Delete error", e);
    } finally {
      setDeleteVisible(false);
      setSelectedItem(null);
    }
  };

  /* ---------------- COLOR & SHIMMERS ---------------- */
  const EmptyShimmer = () => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 100 }}>
      <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ width: 120, height: 120, borderRadius: 60 }} />
      <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ width: 150, height: 18, marginTop: 20, borderRadius: 6 }} />
      <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ width: 220, height: 12, marginTop: 10, borderRadius: 6 }} />
      <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ width: 180, height: 12, marginTop: 6, borderRadius: 6 }} />
    </View>
  );

  const ExpenseShimmerCard = () => (
    <View style={styles.card}>
      <View style={{ width: 4, height: 60, backgroundColor: "#E5E7EB", borderRadius: 2 }} />
      <View style={{ flex: 1, marginLeft: 15 }}>
        <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ height: 16, width: "40%", borderRadius: 6 }} />
        <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ height: 12, width: "60%", marginTop: 6 }} />
      </View>
      <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ width: 60, height: 16, borderRadius: 6 }} />
    </View>
  );

  const colors = ["#10B981", "#3B82F6", "#F59E0B", "#950f45", "#8B5CF6", "#EC4899"];
  const getColor = (crop: string) => {
    const code = crop?.charCodeAt(0) || 0;
    return colors[code % colors.length];
  };

  const optionsStyles = {
    optionsContainer: {
      borderRadius: 14,
      paddingVertical: 5,
      paddingHorizontal: 0,
      width: 150,
      backgroundColor: "#fff",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
      marginTop: 25, 
    }
  };

  /* ---------------- UI ---------------- */

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      <AppHeader
        title={language === "te" ? "నా అమ్మకాలు" : "My Sales"}
        subtitle={language === "te" ? "విక్రయాల చరిత్ర" : "Sales History"}
        language={language}
      />
      
      <FlatList
        data={loading ? [1, 2, 3, 4, 5] : data} 
        keyExtractor={(item, index) => (loading ? index.toString() : item.id.toString())}
        contentContainerStyle={{ 
          paddingBottom: 120,
          flexGrow: 1 
        }}
        showsVerticalScrollIndicator={false}
        
        ListEmptyComponent={
          loading ? (
            <EmptyShimmer />
          ) : ( 
            <AppEmptyState
              iconName="cash-outline"
              title={language === "te" ? "అమ్మకాలు లేవు" : "No Sales Yet"}
              subtitle={language === "te" ? "మీ మొదటి అమ్మకాన్ని నమోదు చేయండి" : "Start adding your first sale"}
              language={language}
              marginTop={60}
            />
          )
        }

        ListHeaderComponent={
          data.length > 0 ? (
            <>
              <LinearGradient
                colors={["#14532d", "#052e16"]}
                style={styles.mainStatsCard}
              >
                <AppText style={styles.statLabel}>
                  {language === "te" ? "మొత్తం ఆదాయం" : "Total Income"}
                </AppText>
                
                {/* 🔥 ANIMATED HERO VALUE */}
                <AnimatedText 
                  editable={false}
                  animatedProps={animatedProps}
                  style={styles.statValue}
                />

                <View style={styles.divider} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {Object.keys(cropQty).map((key) => {
                    const [crop, unit] = key.split("_");
                    return (
                      <View key={key} style={styles.cropChip}>
                        <View style={[styles.dot, { backgroundColor: getColor(crop) }]} />
                        <AppText style={styles.chipText}>
                          {crop}: {cropQty[key]} {unitMap[unit]?.[language] || unit}
                        </AppText>
                      </View>
                    );
                  })}
                </ScrollView>
              </LinearGradient>

              <View style={styles.categorySummary}>
                <AppText style={styles.sectionTitle} language={language}>
                  {language === "te" ? "పంటల వారీగా ఆదాయం" : "Crop-wise Income"}
                </AppText>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false} 
                  style={styles.catScroll}
                  contentContainerStyle={{ paddingRight: 20 }}
                >
                  {Object.keys(cropIncome).map((crop) => (
                    <View key={`income-${crop}`} style={[styles.catBox, { borderColor: getColor(crop) + "40" }]}>
                      <View style={[styles.catIconCircle, { backgroundColor: getColor(crop) + "15" }]}>
                        <Ionicons name="pie-chart" size={16} color={getColor(crop)} />
                      </View>
                      <AppText style={styles.catBoxLabel}>{crop}</AppText>
                      <AppText style={[styles.catBoxValue, { color: getColor(crop) }]}>
                        ₹{cropIncome[crop].toLocaleString("en-IN")}
                      </AppText>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </>
          ) : null
        }

        renderItem={({ item }) => {
          if (loading) {
            return <ExpenseShimmerCard />;
          }

          const color = getColor(item.crop);
          const date = item.createdAt?.toDate?.().toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short"
          }) || "--";

          return (
            <View style={styles.card}>
              <View style={[styles.cardBar, { backgroundColor: color }]} />
              
              <View style={styles.cardInfo}>
                {/* 🔥 CROP NAME */}
                <AppText style={styles.cardCrop}>
                  {item.crop}
                </AppText>

                {/* 🔥 DYNAMIC DESCRIPTION (WRAPS NICELY, NO OVERLAPPING) */}
                {item.description ? (
                  <AppText style={styles.cardDesc}>
                    {item.description}
                  </AppText>
                ) : null}

                {/* 🔥 QTY & DATE */}
                <AppText style={styles.cardCat}>
                  {item.quantity} × ₹{item.rate}  |  {date}
                </AppText>
              </View>

              <View style={styles.cardRight}>
                <AppText style={styles.income}>
                  + ₹{item.total?.toLocaleString("en-IN")}
                </AppText>
                
                <Menu>
                  <MenuTrigger style={styles.menuBtn}>
                    <Ionicons name="ellipsis-vertical" size={18} color="#9CA3AF" />
                  </MenuTrigger>

                  <MenuOptions customStyles={optionsStyles}>
                    <MenuOption onSelect={() => {
                      router.push({ 
                        pathname: "/farmer/sales/add-sale", 
                        params: { 
                          editId: item.id,
                          crop: item.crop || "",
                          desc: item.description || "", 
                          unit: item.unit || "",
                          qty: item.quantity?.toString() || "",
                          rate: item.rate?.toString() || ""
                        } 
                      });
                    }}>
                      <View style={styles.modernMenuItem}>
                        <Ionicons name="create-outline" size={18} color="#2563EB" />
                        <AppText style={styles.menuTextEdit} language={language}>
                          {language === "te" ? "సవరించు" : "Edit"}
                        </AppText>
                      </View>
                    </MenuOption>
                    
                    <View style={styles.menuDivider} />

                    <MenuOption onSelect={() => {
                      setSelectedItem(item);
                      setDeleteVisible(true);
                    }}>
                      <View style={styles.modernMenuItem}>
                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                        <AppText style={styles.menuTextDelete} language={language}>
                          {language === "te" ? "తొలగించు" : "Delete"}
                        </AppText>
                      </View>
                    </MenuOption>
                  </MenuOptions>
                </Menu>
              </View>
            </View>
          );
        }}
      />

      {/* 🔥 PREMIUM DELETE MODAL */}
      <Modal visible={deleteVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.iconBg}>
              <Ionicons name="trash-outline" size={36} color="#e44830" />
            </View>
            <AppText style={styles.modalTitle} language={language}>
              {language === "te" ? "తొలగించాలా?" : "Delete Sale?"}
            </AppText>
            <AppText style={styles.modalSub} language={language}>
              {language === "te"
                ? "ఈ రికార్డ్ శాశ్వతంగా తొలగించబడుతుంది"
                : "This record will be permanently deleted"}
            </AppText>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.cancelBtn}
                onPress={() => setDeleteVisible(false)}
              >
                <AppText style={styles.cancelText} language={language}>
                  {language === "te" ? "వద్దు" : "Cancel"}
                </AppText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleDelete}
              >
                <AppText style={styles.confirmText} language={language}>
                  {language === "te" ? "తొలగించు" : "Delete"}
                </AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ADD BTN */}
      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.addBtn}
        onPress={() => router.push("/farmer/sales/add-sale")}
      >
        <LinearGradient
          colors={["#16A34A","#166534"]}
          style={styles.addGradient}
        >
          <Ionicons name="add" size={30} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

    </SafeAreaView>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({

  safe: { flex: 1, backgroundColor: "#F8FAFC" },

  mainStatsCard: {
    margin: 16,
    padding: 20,
    borderRadius: 20
  },
  
  // NEW MENU STYLES
  menuBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: "#F3F4F6"   
  },
  modernMenuItem: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 14, gap: 10 },
  menuTextEdit: { fontSize: 14, color: "#1E293B", fontWeight: "500" },
  menuTextDelete: { fontSize: 14, color: "#EF4444", fontWeight: "500" },
  menuDivider: { height: 1, backgroundColor: "#F1F5F9", marginHorizontal: 10 },

  // DELETE MODAL
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center" },
  modalContent: { width: "80%", backgroundColor: "white", borderRadius: 25, padding: 25, alignItems: "center" },
  modalTitle: { fontSize: 20, fontWeight: "500", color: "#e2431f", marginVertical: 10 },
  modalSub: { textAlign: "center", color: "#64748B", marginBottom: 25 },
  modalButtons: { flexDirection: "row", gap: 10 },
  cancelBtn: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#F1F5F9", alignItems: "center" },
  confirmBtn: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#EF4444", alignItems: "center" },
  cancelText: { color: "#64748B", fontWeight: "500" },
  confirmText: { color: "white", fontWeight: "500" },
  iconBg: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#f5e8e8", justifyContent: "center", alignItems: "center", marginBottom: 10 },

  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.1)", marginVertical: 15 },
  statLabel: { color: "#bbf7d0", fontSize: 12 },
  statValue: { color: "#fff", fontSize: 28, fontWeight: "600", marginVertical: 2, fontFamily: 'System', padding: 0 },
  
  cropChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginRight: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  chipText: {
    color: "#E5E7EB",
    fontSize: 12
  },
  categorySummary: {
    marginTop: 10,
    marginBottom: 6
  },
  cardRight: {
    flexDirection: "row",        
    alignItems: "center",
    gap: 10                      
  },
  income: {
    color: "#16A34A",
    fontWeight: "600",
    fontSize: 14
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginHorizontal: 16,
    marginBottom: 10,
    color: "#111827"
  },
  catScroll: {
    paddingLeft: 16
  },
  catBox: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 14,
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    width: 110,          
    height: 110,         
    alignItems: "center",
    minWidth: 90
  },
  catIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6
  },
  catBoxLabel: {
    fontSize: 12,
    color: "#6B7280"
  },
  catBoxValue: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 2
  },
  cardInfo: { 
    flex: 1, 
    marginLeft: 10, 
    marginRight: 12 // 🔥 Added Right Margin to avoid hitting the price
  },
  cardCrop: { 
    fontSize: 18, 
    fontWeight: "600", 
    color: "#1F2937",
    flexWrap: "wrap" 
  },
  cardDesc: { 
    fontSize: 13, 
    color: "#64748B", 
    fontWeight: "500", 
    marginTop: 2,
    flexWrap: "wrap", // 🔥 Forces long text to break to next line
    lineHeight: 18
  },
  cardCat: { 
    fontSize: 12, 
    color: "#9CA3AF", 
    marginTop: 6,
    fontWeight: "500"
  },
  card: {
    marginHorizontal: 16,
    marginVertical: 6,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#E5E7EB"
  },
  cardBar: { width: 4, borderRadius: 2 },

  addBtn: { position: "absolute", bottom: 30, right: 20 },
  addGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5
  }
});