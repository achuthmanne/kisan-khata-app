// app/farmer/expenses/index.tsx

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
  FlatList, Modal, SafeAreaView, ScrollView,
  StatusBar, StyleSheet, TouchableOpacity, View
} from "react-native";
import { Menu, MenuOption, MenuOptions, MenuTrigger } from "react-native-popup-menu";
import ShimmerPlaceholder from "react-native-shimmer-placeholder";

// 🔥 REANIMATED తో SUPER SMOOTH COUNT UP
import Animated, { useSharedValue, useAnimatedProps, withTiming, Easing } from "react-native-reanimated";
import { TextInput } from "react-native"; 

Animated.addWhitelistedNativeProps({ text: true, value: true });
const AnimatedText = Animated.createAnimatedComponent(TextInput);

// 🔥 PRO FIX 1: Reanimated UI Thread లో toLocaleString పనిచేయదు, కాబట్టి Custom Worklet
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

export default function ExpensesScreen() {
    const router = useRouter();
    
    const expenses = useStore(state => state.expenses);
    const isInitializing = useStore(state => state.isInitializing);
    const loading = isInitializing && expenses.length === 0;
    const data = expenses;

    const [language, setLanguage] = useState<"te" | "en">("te");
    
    const [deleteVisible, setDeleteVisible] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any>(null);

    const { totalExpense, cropTotals, categoryTotals } = useMemo(() => {
        let total = 0;
        const cropMap: any = {};
        const catMap: any = {};

        expenses.forEach((d: any) => {
            const amt = Number(d.amount) || 0;
            total += amt;
            const crop = d.crop || "Other";
            const category = d.category || "Other";

            cropMap[crop] = (cropMap[crop] || 0) + amt;
            catMap[category] = (catMap[category] || 0) + amt;
        });

        return { totalExpense: total, cropTotals: cropMap, categoryTotals: catMap };
    }, [expenses]);

    // Shared value for Animation
    const animatedAmount = useSharedValue(0);

    // Trigger animation whenever totalExpense changes
    useEffect(() => {
        animatedAmount.value = withTiming(totalExpense, {
            duration: 2000, 
            easing: Easing.out(Easing.exp), 
        });
    }, [totalExpense]);

    const animatedProps = useAnimatedProps(() => {
        const formatted = formatIndianCurrency(animatedAmount.value);
        return {
            text: `₹ ${formatted}`,
            value: `₹ ${formatted}` 
        } as any; 
    });

    // 🔥 REAL-WORLD PRODUCTION FIXED CATEGORY COLOR MAPPING (SUPPORT BOTH LANGUAGES)
    const getColor = (str: string) => {
        if (!str) return "#94A3B8";
        const cleanStr = str.trim();

        const colorMap: { [key: string]: string } = {
            // విత్తనాలు
            "Seeds": "#10B981", "విత్తనాలు": "#10B981",
            // ఎరువులు
            "Fertilizers": "#3B82F6", "ఎరువులు": "#3B82F6",
            // పురుగుల మందులు
            "Pesticides / Sprays": "#EF4444", "పురుగుల మందులు / స్ప్రేలు": "#EF4444",
            // ట్రాక్టర్
            "Tractor / Machinery": "#2563EB", "ట్రాక్టర్ / యంత్రాలు": "#2563EB",
            // కూలీలు
            "Daily Labour": "#F59E0B", "కూలీలు / రోజువారీ పనివారు": "#F59E0B",
            // రవాణా
            "Transport / Auto": "#8B5CF6", "రవాణా / ఆటో కిరాయి": "#8B5CF6",
            // నీరు / మోటార్
            "Water / Motor Repair": "#06B6D4", "నీటి పారుదల / మోటార్ రిపేర్లు": "#06B6D4",
            // కరెంట్ బిల్లు
            "Electricity Bill": "#EAB308", "కరెంట్ బిల్లు": "#EAB308",
            // సంచులు / ప్యాకింగ్
            "Bags / Packaging": "#EC4899", "సంచులు / ప్యాకింగ్ ఖర్చులు": "#EC4899",
            // స్టోరేజ్
            "Storage / Godown": "#64748B", "కోల్డ్ స్టోరేజ్ / గోడౌన్": "#64748B",
            // హమాలీ
            "Hamali / Loading": "#D946EF", "హమాలీ / లోడింగ్ ఖర్చులు": "#D946EF",
            // కౌలు
            "Land Lease / Rent": "#14B8A6", "భూమి కౌలు (Lease)": "#14B8A6",
            // అప్పుల వడ్డీ
            "Loan Interest": "#F43F5E", "అప్పుల వడ్డీ": "#F43F5E",
            // భీమా
            "Crop Insurance": "#059669",  "పంట భీమా": "#059669",
            // మార్కెట్ కమిషన్
            "Market Commission": "#B45309", "మార్కెట్ కమిషన్ (Cess)": "#B45309",
            // ఇతర ఖర్చులు
            "Other Expenses": "#94A3B8", "ఇతర ఖర్చులు (Others)": "#94A3B8"
        };

        // ఒకవేళ మ్యాచ్ దొరికితే ఆ ఫిక్స్‌డ్ కలర్ ఇవ్వు
        if (colorMap[cleanStr]) return colorMap[cleanStr];

        // ఒకవేళ పంట పేరు (Crop Name) అయితే కలర్ కొలైడ్ అవ్వకుండా బ్యూటిఫుల్ డైనమిక్ హ్యాష్ కలర్
        const fallbackColors = ["#06B6D4", "#3B82F6", "#F59E0B", "#950f52", "#8B5CF6", "#EC4899", "#14B8A6"];
        let hash = 0;
        for (let i = 0; i < cleanStr.length; i++) hash = cleanStr.charCodeAt(i) + ((hash << 5) - hash);
        return fallbackColors[Math.abs(hash) % fallbackColors.length];
    };

    const EmptyShimmer = () => (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 100 }}>
        <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ width: 120, height: 120, borderRadius: 60 }} />
        <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ width: 150, height: 18, marginTop: 20, borderRadius: 6 }} />
        <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ width: 220, height: 12, marginTop: 10, borderRadius: 6 }} />
        <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ width: 180, height: 12, marginTop: 6, borderRadius: 6 }} />
      </View>
    );

    const ExpenseShimmerCard = () => (
      <View style={[styles.card, { borderColor: '#F1F5F9' }]}>
        <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ width: 4, height: 40, borderRadius: 2 }} />
        <View style={{ flex: 1, marginLeft: 15 }}>
          <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ height: 18, width: "50%", borderRadius: 6 }} />
          <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ height: 12, width: "70%", marginTop: 8, borderRadius: 4 }} />
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ width: 70, height: 18, borderRadius: 6 }} />
        </View>
      </View>
    );

    useEffect(() => {
        let isMounted = true;
        const loadLang = async () => {
            const lang = await AsyncStorage.getItem("APP_LANG");
            if (lang && isMounted) setLanguage(lang as any);
        };
        loadLang();
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
            .collection("expenses")
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

    const optionsStyles = {
      optionsContainer: {
        borderRadius: 14, paddingVertical: 5, paddingHorizontal: 0, width: 150,
        backgroundColor: "#fff", shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15, shadowRadius: 12, elevation: 8, marginTop: 25, 
      }
    };

    return (
        <SafeAreaView style={styles.safe}>
            <StatusBar barStyle="light-content" />
            <AppHeader
                title={language === "te" ? "నా ఖర్చులు" : "My Expenses"}
                subtitle={language === "te" ? "వ్యయాల చరిత్ర" : "History"}
                language={language}
            />

            <FlatList
              data={loading ? [1, 2, 3, 4, 5] : data} 
              keyExtractor={(item, index) => (loading ? index.toString() : item.id)} 
              contentContainerStyle={{ paddingBottom: 120, flexGrow: 1 }}
              showsVerticalScrollIndicator={false}
                
              ListEmptyComponent={
                loading ? (
                  <EmptyShimmer />
                ) : (
                  <AppEmptyState
                    iconName="receipt-outline"
                    title={language === "te" ? "ఖర్చులు లేవు" : "No Expenses Yet"}
                    subtitle={language === "te" ? "మీ పెట్టుబడిని నమోదు చేయడం ప్రారంభించండి" : "Start tracking your farm investments"}
                    language={language}
                    marginTop={60}
                  />
                )
              }

              ListHeaderComponent={
                  data.length > 0 ? (
                      <>
                          <LinearGradient colors={["#911d10", "#561111"]} style={styles.mainStatsCard}>
                              <AppText style={styles.statLabel}>{language === "te" ? "మొత్తం పెట్టుబడి" : "Total Investment"}</AppText>
                              
                              <AnimatedText 
                                editable={false}
                                animatedProps={animatedProps}
                                style={styles.statValue}
                              />
                              
                              <View style={styles.divider} />
                            {/* ... పైనున్న కోడ్ అలానే ఉంటుంది ... */}
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} >
                                {Object.keys(cropTotals || {}).map((crop) => (
                                    <View key={crop} style={styles.cropChip}>
                                        <View style={[styles.dot, { backgroundColor: getColor(crop) }]} />
                                        {/* 🔥 PRO FIX: Crop name long ఉంటే కట్ అవ్వడానికి */}
                                        <AppText style={styles.chipText} numberOfLines={1} ellipsizeMode="tail">
                                          {crop}: ₹{cropTotals[crop].toLocaleString('en-IN')}
                                        </AppText>
                                    </View>
                                ))}
                            </ScrollView>
                        </LinearGradient>

                        <View style={styles.categorySummary}>
                            <AppText style={styles.sectionTitle} language={language}>
                              {language === "te" ? "రకాల వారీగా ఖర్చులు" : "Expenses by Category"}
                            </AppText>

                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
                                {Object.keys(categoryTotals || {}).map((cat) => {
                                    const color = getColor(cat.trim());
                                    return (
                                        <View key={cat} style={[styles.catBox, { borderColor: color + "30" }]}>
                                            <View style={[styles.catIconCircle, { backgroundColor: color + "12" }]}>
                                                <Ionicons name="pie-chart" size={16} color={color} />
                                            </View>
                                            <AppText style={styles.catBoxLabel} numberOfLines={2} ellipsizeMode="tail">
                                              {cat}
                                            </AppText>
                                            <AppText style={[styles.catBoxValue, { color: "#EF4444" }]} numberOfLines={1}>
                                                - ₹{categoryTotals[cat].toLocaleString("en-IN")}
                                            </AppText>
                                        </View>
                                    );
                                })}
                            </ScrollView>
                        </View>
                      </>
                  ) : null
              }

              renderItem={({ item }) => {
                if (loading) return <ExpenseShimmerCard />;

                const color = getColor(item.category || "default");
                const date = item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : "---";

                return (
                   <View style={styles.card}>
                        <View style={[styles.cardBar, { backgroundColor: color }]} />
                        <View style={styles.cardInfo}>
                            <AppText style={styles.cardCrop}>
                                {item.crop}
                            </AppText>
                            <AppText style={styles.cardCat} numberOfLines={1} ellipsizeMode="tail">
                                {item.category} | {item.date || date}
                            </AppText>
                        </View>
                        <View style={styles.cardRight}>
                            <AppText style={styles.cardAmount} numberOfLines={1} ellipsizeMode="tail">
                                - ₹{item.amount.toLocaleString('en-IN')}
                            </AppText>
                            
                            <Menu>
                              <MenuTrigger style={styles.menuBtn}>
                                <Ionicons name="ellipsis-vertical" size={20} color="#94a3b8" />
                              </MenuTrigger>

                              <MenuOptions customStyles={optionsStyles}>
                                <MenuOption onSelect={() => {
                                  router.push({ 
                                      pathname: "/farmer/expenses/add-expense", 
                                      params: { 
                                        editId: item.id,
                                        amount: item.amount?.toString() || "",
                                        category: item.category || "",
                                        crop: item.crop || "",
                                        date: item.date || "",
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

            {/* PREMIUM DELETE MODAL */}
            <Modal visible={deleteVisible} transparent animationType="fade">
              <View style={styles.overlay}>
                <View style={styles.deleteBox}>
                  <View style={styles.iconBg}>
                    <Ionicons name="trash-outline" size={36} color="#e44830" />
                  </View>
                  <AppText style={styles.deleteTitle} language={language}>
                    {language === "te" ? "తొలగించాలా?" : "Delete Expense?"}
                  </AppText>
                  <AppText style={styles.deleteSub} language={language}>
                    {language === "te"
                      ? "ఈ ఖర్చు వివరాలు శాశ్వతంగా తొలగించబడతాయి."
                      : "This expense record will be permanently deleted."}
                  </AppText>
                  <View style={styles.deleteBtns}>
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
                      activeOpacity={0.85}
                      style={styles.deleteBtn}
                      onPress={handleDelete}
                    >
                      <AppText style={styles.deleteText} language={language}>
                        {language === "te" ? "అవును" : "Delete"}
                      </AppText>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>

            <TouchableOpacity activeOpacity={0.8} style={styles.addBtn} onPress={() => router.push("/farmer/expenses/add-expense")}>
                <LinearGradient colors={["#c53822", "#801515"]} style={styles.addGradient}>
                    <Ionicons name="add" size={32} color="#fff" />
                </LinearGradient>
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: "#F8FAFC" },
    mainStatsCard: { margin: 20, padding: 22, borderRadius: 24, elevation: 5 },
    statLabel: { color: "#f7bbbb", fontSize: 12 },
    statValue: { color: "#fff", fontSize: 32, fontWeight: "600", marginVertical: 2, marginTop: -5, fontFamily: 'System', padding: 0 },
    divider: { height: 1, backgroundColor: "rgba(255,255,255,0.1)", marginVertical: 12},
    dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
    chipText: { color: '#fff', fontSize: 12, flexShrink: 1 },
    // 🔥 cropChip లో maxWidth పెట్టాలి, అప్పుడే అది స్క్రీన్ బయటకి పోకుండా ఆగుతుంది
    cropChip: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      backgroundColor: 'rgba(255,255,255,0.1)', 
      paddingHorizontal: 12, 
      paddingVertical: 6, 
      borderRadius: 12, 
      marginRight: 8,
      maxWidth: 180 // 🔥 ఎక్కువ పొడవు ఉంటే కట్ చేస్తుంది
    },
    
    // 🔥 catBoxLabel లో ప్యాడింగ్ పెంచాలి
    catBoxLabel: { 
      fontSize: 11, 
      color: '#64748b', 
      fontWeight: '500', 
      textAlign: 'center', 
      paddingHorizontal: 8, // 🔥 4 నుంచి 8 కి పెంచాను
      width: '100%'         // 🔥 టెక్స్ట్ సెంటర్ లో ఉండటానికి
    },
    catBox: {
      width: 115,          
      height: 125,         
      backgroundColor: "#fff",
      borderRadius: 16,
      marginRight: 10,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center"
    },
    
    catIconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 6
    },
    catBoxValue: { fontSize: 14, fontWeight: "600", marginTop: 2 },
    categorySummary: { paddingLeft: 20, marginBottom: 20 },
    sectionTitle: { fontSize: 17, fontWeight: '600', color: '#1e293b', marginBottom: 15 },
    catScroll: { flexDirection: 'row' },
    menuBtn: { padding: 6, borderRadius: 10, backgroundColor: "#F3F4F6" },
    card: { 
      marginHorizontal: 20, marginVertical: 6, backgroundColor: "#fff",
      borderRadius: 16, flexDirection: 'row', alignItems: 'center',
      padding: 14, borderWidth: 1, borderColor: "#E5E7EB"   
    },
    cardBar: { width: 4, height: '80%', borderRadius: 2 },
    cardInfo: { flex: 1, marginLeft: 15, paddingRight: 10 }, // 🔥 paddingRight: 10 యాడ్ చేశాను
    cardCrop: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
    cardCat: { fontSize: 12, color: '#64748b', marginTop: 2 },
    cardRight: { alignItems: 'center', flexDirection: 'row', gap: 10, flexShrink: 1 },
    cardAmount: { fontSize: 16, fontWeight: '600', color: '#ef4444', flexShrink: 1 },

    modernMenuItem: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 14, gap: 10 },
    menuTextEdit: { fontSize: 14, color: "#1E293B", fontWeight: "500" },
    menuTextDelete: { fontSize: 14, color: "#EF4444", fontWeight: "500" },
    menuDivider: { height: 1, backgroundColor: "#F1F5F9", marginHorizontal: 10 },

    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center" },
    deleteBox: { width: "80%", backgroundColor: "white", borderRadius: 25, padding: 25, alignItems: "center" },
    iconBg: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#f5e8e8", justifyContent: "center", alignItems: "center", marginBottom: 10 },
    deleteTitle: { fontSize: 20, fontWeight: "500", color: "#e2431f", marginVertical: 10 },
    deleteSub: { textAlign: "center", color: "#64748B", marginBottom: 25 },
    deleteBtns: { flexDirection: "row", gap: 10 },
    cancelBtn: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#F1F5F9", alignItems: "center" },
    cancelText: { color: "#64748B", fontWeight: "500" },
    deleteBtn: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#EF4444", alignItems: "center" },
    deleteText: { color: "white", fontWeight: "500" },

    addBtn: { position: "absolute", bottom: 30, right: 25 },
    addGradient: { width: 64, height: 64, borderRadius: 32, justifyContent: "center", alignItems: "center", elevation: 5 }
});