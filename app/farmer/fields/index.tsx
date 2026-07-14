// app/farmer/fields/index.tsx

import AppEmptyState from "@/components/AppEmptyState";
import { executeOfflineSafeRead, executeOfflineSafeWrite, executeOfflineSafeFetch } from "@/utils/offlineHelper";
import { useStore } from "@/store/useStore";

import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Dimensions,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { PieChart } from "react-native-chart-kit";
import { Menu, MenuOption, MenuOptions, MenuTrigger } from "react-native-popup-menu";

// 🔥 REANIMATED
import Animated, { Easing, FadeInDown, useAnimatedProps, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);
const screenWidth = Dimensions.get("window").width;

const PREM_COLORS = [
  "#10B981", "#3B82F6", "#F59E0B", "#8B5CF6", 
  "#EC4899", "#06B6D4", "#F97316", "#84CC16", 
  "#6366F1", "#14B8A6", "#F43F5E", "#EAB308"
];

export default function FieldsScreen() {
  const router = useRouter();
  
  // 🔥 Read from Global Store instantly
  const data = useStore((state) => state.fields);
  const landsData = useStore((state) => state.lands);
  const completedData = useStore((state) => state.completedFields);
  const isInitializing = useStore((state) => state.isInitializing);

  const [language, setLanguage] = useState<"te" | "en">("te");
  const [totalAcres, setTotalAcres] = useState(0);
  const [ownAcres, setOwnAcres] = useState(0);
  const [rentAcres, setRentAcres] = useState(0);
  const [cropStats, setCropStats] = useState<any[]>([]);
  
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [cantDeleteVisible, setCantDeleteVisible] = useState(false); // 🔥 NEW: Warning Modal State
  const [actionLoading, setActionLoading] = useState(false); // 🔥 NEW: Loading while checking usage
  
  const [showAddOptionsModal, setShowAddOptionsModal] = useState(false);
  const [showReusePickerModal, setShowReusePickerModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false); 
  const [soilStats, setSoilStats] = useState<any[]>([]); 
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const animatedAcres = useSharedValue(0);

  useEffect(() => {
    // 🔥 PRO FIX: Speed up animation for small integers to remove "hesitation"
    const isSmallInt = totalAcres % 1 === 0 && totalAcres <= 15;
    animatedAcres.value = withTiming(totalAcres, {
        duration: isSmallInt ? 800 : 1500,
        easing: Easing.out(Easing.quad), 
    });
  }, [totalAcres]);

  const animatedProps = useAnimatedProps(() => {
    const val = animatedAcres.value;
    const formatted = totalAcres % 1 !== 0 ? val.toFixed(1) : Math.round(val).toString();
    return {
        text: formatted,
        value: formatted
    } as any; 
  });

  useEffect(() => {
    AsyncStorage.getItem("APP_LANG").then((l) => { if (l) setLanguage(l as any); });
  }, []);

  // 🔥 Loading state is purely based on Zustand initializing and having empty arrays
  const loading = isInitializing && data.length === 0 && landsData.length === 0;
  
  // 🔥 AUTO-MIGRATION & STATS DERIVATION 🔥
  useEffect(() => {
    let isMounted = true;
    const processStats = async () => {
      // 1. Auto-Migration
      if (landsData.length === 0 && (data.length > 0 || completedData.length > 0)) {
        // Only run migration if there are literally no lands in DB but fields exist
        try {
          const phone = await AsyncStorage.getItem("USER_PHONE");
          const userDoc = await executeOfflineSafeRead(firestore().collection("users").doc(phone as string), true);
          const activeSession = userDoc.data()?.activeSession;
          
          const landsSnap = await executeOfflineSafeRead(firestore().collection("users").doc(phone as string).collection("lands").where("session", "==", activeSession), true);
          if (landsSnap.empty) {
             console.log("RUNNING SILENT MIGRATION TO LANDS...");
             const migStats = new Map();
             const allDocs = [...data, ...completedData];
             allDocs.forEach(item => {
               const key = item.nickname || item.id;
               const acres = Number(item.acres) || 0;
               if (!migStats.has(key)) {
                 migStats.set(key, { ...item, capacity: acres });
               } else {
                 const existing = migStats.get(key);
                 if (acres > existing.capacity) existing.capacity = acres;
               }
             });
             
             const batch = firestore().batch();
             migStats.forEach((stat, key) => {
               const newLandRef = firestore().collection("users").doc(phone as string).collection("lands").doc();
               batch.set(newLandRef, {
                 session: activeSession,
                 nickname: stat.nickname || key,
                 acres: stat.capacity,
                 type: stat.type || "own",
                 soilType: stat.soilType || "",
                 rent: stat.rent || 0,
                 createdAt: firestore.FieldValue.serverTimestamp()
               });
             });
             await executeOfflineSafeWrite(batch.commit());
             console.log("MIGRATION COMPLETE!");
             return; // State will update automatically via listener
          }
        } catch (e) {
           console.log("Migration error:", e);
        }
      }

      // 2. Derive Dashboard Stats purely from Lands
      let t = 0, o = 0, r = 0;
      const sMap: any = {};
      landsData.forEach(land => {
         const acres = Number(land.acres) || 0;
         t += acres;
         if (land.type === "own") o += acres;
         else r += acres;
         const sName = land.soilType || "Others";
         if (!sMap[sName]) sMap[sName] = 0;
         sMap[sName] += acres;
      });

      // 3. Derive Crop Stats purely from Active Crops
      const cMap: any = {};
      data.forEach(item => {
         const cName = item.crop || "Others";
         if (!cMap[cName]) cMap[cName] = 0;
         cMap[cName] += (Number(item.acres) || 0);
      });

      if (isMounted) {
         setTotalAcres(parseFloat(t.toFixed(2)));
         setOwnAcres(parseFloat(o.toFixed(2)));
         setRentAcres(parseFloat(r.toFixed(2)));
         
         const PREM_COLORS = ["#6366F1", "#EC4899", "#F59E0B", "#10B981", "#8B5CF6", "#14B8A6"];
         setSoilStats(Object.keys(sMap).map((name, index) => ({
            name, population: parseFloat(sMap[name].toFixed(2)),
            color: PREM_COLORS[(index + 4) % PREM_COLORS.length],
            legendFontColor: "#475569", legendFontSize: 12
         })));

         setCropStats(Object.keys(cMap).map((name, index) => ({
            name, population: parseFloat(cMap[name].toFixed(2)),
            color: PREM_COLORS[index % PREM_COLORS.length],
            legendFontColor: "#475569", legendFontSize: 12
         })));
      }
    };

    processStats();
    return () => { isMounted = false; };
  }, [landsData, data, completedData]);

  const PremiumDonutChart = ({ chartData, title }: any) => {
    const totalPop = chartData.reduce((a: any, b: any) => a + Number(b.population), 0);
    const safeData = totalPop > 0 ? chartData : [{ name: "No Data", population: 1, color: "#E5E7EB" }];

    return (
      <Animated.View entering={FadeInDown.delay(500)} style={styles.chartBox}>
        <AppText style={styles.sectionTitle}>{title}</AppText>
        <View style={styles.chartRowWrapper}>
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <PieChart
              data={safeData.map((d: any) => ({ ...d, name: "" }))}
              width={screenWidth / 2}
              height={200}
              chartConfig={{ color: (opacity = 1) => `rgba(0,0,0, ${opacity})` }}
              accessor={"population"}
              backgroundColor={"transparent"}
              paddingLeft={"48"}
              hasLegend={false}
              absolute
            />
            <View style={styles.donutHole}>
              <AppText style={styles.donutText}>
                {Math.round((totalPop / (totalAcres || 1)) * 100) || 0}%
              </AppText>
            </View>
          </View>
          <View style={styles.modernLegendContainer}>
            <ScrollView style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
              {chartData.map((item: any, index: number) => {
                const perc = Math.round((Number(item.population) / (totalAcres || 1)) * 100) || 0;
                return (
                  <View key={index} style={styles.modernLegendRow}>
                    <View style={[styles.modernDot, { backgroundColor: item.color }]} />
                    <View style={styles.modernTextWrapper}>
                      <AppText style={styles.modernNameText} numberOfLines={1}>{item.name}</AppText>
                      <AppText style={styles.modernValueText}>
                        {perc}% | {item.population} {language==='te'? "ఎకరాలు" : 'Acres'}
                      </AppText>
                      <View style={styles.modernUnderline}>
                         <View style={[styles.modernFill, { width: `${perc}%`, backgroundColor: item.color }]} />
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Animated.View>
    );
  };

  const ownershipData = [
    { name: language === "te" ? "సొంతం (%)" : "Own (%)", population: ownAcres, color: "#10B981", legendFontColor: "#475569", legendFontSize: 12 },
    { name: language === "te" ? "కౌలు (%)" : "Rent (%)", population: rentAcres, color: "#F59E0B", legendFontColor: "#475569", legendFontSize: 12 }
  ];

  const safeOwnershipData = (ownAcres + rentAcres) > 0 
    ? ownershipData.map((d: any) => ({ ...d, name: "" })) 
    : [{ population: 1, color: "#E5E7EB", name: "" }];

  const safeCropStats = totalAcres > 0 && cropStats.length > 0
    ? cropStats.map((d: any) => ({ ...d, name: "" }))
    : [{ population: 1, color: "#E5E7EB", name: "" }];

  const ShimmerLoader = () => {
    const opacity = useSharedValue(0.4);
    
    useEffect(() => {
      opacity.value = withRepeat(withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true);
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

    return (
      <Animated.View style={[{ width: '100%', marginTop: 10 }, animatedStyle]}>
        {/* Main Stats Card Shimmer */}
        <View style={{ marginHorizontal: 16, height: 230, backgroundColor: '#E2E8F0', borderRadius: 24, marginBottom: 16 }} />
        
        {/* First Chart Box Shimmer */}
        <View style={{ marginHorizontal: 16, height: 230, backgroundColor: '#E2E8F0', borderRadius: 24, marginBottom: 20 }} />

        {/* List Title Shimmer */}
        <View style={{ marginHorizontal: 20, height: 24, width: '45%', backgroundColor: '#E2E8F0', borderRadius: 8, marginBottom: 16 }} />

        {/* List Items Shimmer */}
        <View style={{ paddingHorizontal: 16 }}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.shimmerCard}>
              <View style={styles.shimmerSideBar} />
              <View style={styles.shimmerContent}>
                <View style={styles.shimmerLineTitle} />
                <View style={styles.shimmerLineSub} />
              </View>
              <View style={styles.shimmerRight}>
                <View style={[styles.shimmerMenuCircle, { backgroundColor: '#E2E8F0' }]} />
              </View>
            </View>
          ))}
        </View>
      </Animated.View>
    );
  };

  const optionsStyles = {
    optionsContainer: {
      borderRadius: 14, paddingVertical: 5, paddingHorizontal: 0, width: 150, backgroundColor: "#fff",
      shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8, marginTop: 25, 
    }
  };

  // 🔥 POWERFUL LOGIC: Check if Crop is used anywhere before Editing or Deleting
  const checkCropUsage = async (item: any) => {
    try {
      const phone = await AsyncStorage.getItem("USER_PHONE");
      const userDoc = await executeOfflineSafeRead(firestore().collection("users").doc(phone!), true);
      const activeSession = userDoc.data()?.activeSession;

      const land = landsData.find(l => l.id === item.landId) || landsData.find(l => l.nickname === item.nickname);
      const nick = land?.nickname || item.nickname;
      
      const fullCropName = nick ? `${item.crop} - ${nick}` : item.crop;
      const baseCropName = item.crop;

      const checkCollection = async (collRef: any) => {
        const snap1 = await executeOfflineSafeRead(collRef.where("crop", "==", fullCropName).limit(1), true);
        if (!snap1.empty) return true;
        if (fullCropName !== baseCropName) {
           const snap2 = await executeOfflineSafeRead(collRef.where("crop", "==", baseCropName).limit(1), true);
           if (!snap2.empty) return true;
        }
        return false;
      };

      // 1. Check Expenses
      if (await checkCollection(firestore().collection("users").doc(phone!).collection("expenses"))) return true;

      // 2. Check Sales
      if (await checkCollection(firestore().collection("users").doc(phone!).collection("sales"))) return true;

      // 3. Check Locker Documents
      if (await checkCollection(firestore().collection("users").doc(phone!).collection("locker"))) return true;

      // 4. Check Reminders
      if (await checkCollection(firestore().collection("users").doc(phone!).collection("reminders"))) return true;

      // 5. Collection Group Checks for nested entries (Works & Attendance)
      try {
        if (await checkCollection(firestore().collectionGroup("entries"))) return true;
      } catch(e) {} 

      try {
        if (await checkCollection(firestore().collectionGroup("attendance"))) return true;
      } catch(e) {}

      return false; // Not used anywhere!
    } catch (e) {
      console.log("Usage Check Error:", e);
      return false;
    }
  };

  // 🔥 MODIFIED: Edit Click Handler
  const handleEditClick = async (item: any) => {
    setActionLoading(true);
    const isUsed = await checkCropUsage(item);
    setActionLoading(false);

    const land = landsData.find(l => l.id === item.landId) || landsData.find(l => l.nickname === item.nickname);

    let maxAcres = "";
    if (land) {
      const landCrops = data.filter(c => c.landId === land.id || (c.nickname && c.nickname === land.nickname));
      const usedAcres = parseFloat(landCrops.reduce((sum, c) => sum + Number(c.acres || 0), 0).toFixed(2));
      const remainingAcres = Math.max(0, parseFloat((Number(land.acres) - usedAcres).toFixed(2)));
      maxAcres = parseFloat((remainingAcres + Number(item.acres || 0)).toFixed(2)).toString();
    }

    router.push({ 
      pathname: "/farmer/fields/add-field", 
      params: { 
        editId: JSON.stringify(item.ids || [item.id]),
        crop: item.crop || "",
        landId: land?.id || item.landId || "",
        nickname: land?.nickname || item.nickname || "",
        acres: item.acres?.toString() || "",
        maxAcres: maxAcres,
        isUsed: isUsed ? "true" : "false" // 🔥 Sending lock status to Edit Screen
      } 
    });
  };

  // 🔥 MODIFIED: Delete Click Handler
  const handleDeleteClick = async (item: any) => {
    setActionLoading(true);
    const isUsed = await checkCropUsage(item);
    setActionLoading(false);

    setSelectedItem(item);
    if (isUsed) {
      setCantDeleteVisible(true); // 🔥 BLOCK DELETE!
    } else {
      setDeleteVisible(true);     // Allow Delete
    }
  };

  const handleEndCrop = async (item: any) => {
    try {
      setActionLoading(true);
      const phone = await AsyncStorage.getItem("USER_PHONE");
      const batch = firestore().batch();
      const ids = item.ids || [item.id];
      ids.forEach((id: string) => {
         batch.update(firestore().collection("users").doc(phone!).collection("fields").doc(id), {
           status: "completed",
           endedAt: firestore.FieldValue.serverTimestamp()
         });
      });
      await executeOfflineSafeWrite(batch.commit());
    } catch (e) {
      console.log(e);
    } finally {
      setActionLoading(false);
      setSelectedItem(null);
    }
  };

  const handleEndCropFromPicker = (item: any, remainingAcres?: number) => {
    setShowReusePickerModal(false);
    const itemToReplace = (remainingAcres === 0 && item.activeItem) ? item.activeItem : (item.latestItem || item);
    handleReUseLand(itemToReplace, remainingAcres);
  };

  const handleReUseLand = (item: any, remainingAcres?: number) => {
    setShowAddOptionsModal(false);
    setShowReusePickerModal(false);
    router.push({
      pathname: "/farmer/fields/add-field",
      params: {
        landId: item.id, // 🔥 CRITICAL
        nickname: item.nickname,
        maxAcres: remainingAcres?.toString() || item.acres?.toString() || "",
        defaultAcres: remainingAcres?.toString() || item.acres?.toString() || "",
      }
    });
  };

  const handleDeleteLandClick = (land: any) => {
    const hasCrops = data.some(c => c.landId === land.id || c.nickname === land.nickname) || completedData.some(c => c.landId === land.id || c.nickname === land.nickname);
    if (hasCrops) {
       setErrorMsg(language === "te" ? "ముందుగా ఈ భూమిలోని పంటలను తొలగించండి!" : "Delete all crops in this land first!");
       setShowErrorModal(true);
       return;
    }
    setSelectedItem(land);
    setDeleteVisible(true);
  };

  const handleDelete = async () => {
    if (isDeleting) return;
    try {
      setIsDeleting(true);
      const phone = await AsyncStorage.getItem("USER_PHONE");
      if (phone && selectedItem) {
        // If it doesn't have a crop field, it's a Land!
        const collectionName = selectedItem.crop ? "fields" : "lands";
        const batch = firestore().batch();
        const ids = selectedItem.ids || [selectedItem.id];
        ids.forEach((id: string) => {
           batch.delete(firestore().collection("users").doc(phone).collection(collectionName).doc(id));
        });
        await executeOfflineSafeWrite(batch.commit());
      }
    } catch (e: any) { 
      console.log("Delete error", e);
      setErrorMsg(language === "te" ? "తొలగించడం విఫలమైంది! ఇంటర్నెట్ చెక్ చేసి మళ్ళీ ప్రయత్నించండి." : "Failed to delete! Please check your connection.");
      setShowErrorModal(true);
    } finally {
      setIsDeleting(false);
      setDeleteVisible(false);
      setSelectedItem(null);
    }
  };

  const getLandStats = () => {
    const stats = new Map();
    
    // First, register all physical lands
    landsData.forEach(land => {
      const key = land.nickname || land.id;
      stats.set(key, { ...land, capacity: Number(land.acres) || 0, activeAcres: 0, latestItem: null, activeItem: null, id: land.id });
    });

    // Then, calculate how much of each land is actively planted
    data.forEach(item => {
      // Find matching land
      // If crop has landId, use it. Otherwise fallback to nickname (for migrated data)
      let matchedKey = null;
      if (item.landId && stats.has(item.landId)) matchedKey = item.landId;
      else if (stats.has(item.nickname)) matchedKey = item.nickname;
      else {
         // Legacy crops that might not match perfectly. Just try to find one.
         const fallback = Array.from(stats.values()).find(s => s.nickname === item.nickname);
         if (fallback) matchedKey = fallback.nickname;
      }

      if (matchedKey) {
        const stat = stats.get(matchedKey);
        stat.activeAcres += (Number(item.acres) || 0);
        stat.activeItem = item;
      }
    });

    // Also track latest completed crop for defaults if needed
    completedData.forEach(item => {
      let matchedKey = null;
      if (item.landId && stats.has(item.landId)) matchedKey = item.landId;
      else if (stats.has(item.nickname)) matchedKey = item.nickname;
      
      if (matchedKey) {
         const stat = stats.get(matchedKey);
         if (!stat.latestItem || item.createdAt > stat.latestItem.createdAt) {
            stat.latestItem = item;
         }
      }
    });

    stats.forEach(stat => {
      stat.remainingAcres = Math.max(0, stat.capacity - stat.activeAcres);
    });

    return Array.from(stats.values());
  };

  const landStats = getLandStats();
  const availableLands = landStats.filter(stat => stat.remainingAcres > 0);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <AppHeader
        title={language === "te" ? "నా పొలాలు" : "My Fields"}
        subtitle={language === "te" ? "విశ్లేషణ & వివరాలు" : "Analytics & Details"}
        language={language}
      />
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        scrollEnabled={!loading && (data.length > 0 || completedData.length > 0 || landsData.length > 0)}
        contentContainerStyle={[
          { paddingBottom: 120 },
          ((data.length === 0 && completedData.length === 0 && landsData.length === 0) || loading) && { flex: 1, justifyContent: 'center', paddingBottom: 0 }
        ]}
      >
        {loading ? (
          <ShimmerLoader />
        ) : (data.length === 0 && completedData.length === 0 && landsData.length === 0) ? (
          <AppEmptyState
            iconName="leaf-outline"
            title={language === "te" ? "పొలాలు లేవు" : "No Fields Added"}
            subtitle={language === "te" 
              ? "మీరు ఇంకా ఏ పొలం వివరాలను జోడించలేదు. కింద ఉన్న '+' బటన్ నొక్కి జోడించండి." 
              : "You haven't added any field details yet. Tap the '+' button to start."}
            language={language}
          />
        ) : (
          <>
             <LinearGradient colors={["#312E81", "#1E1B4B"]} style={styles.mainCard}>
                <AppText style={styles.cardLabel}>{language === "te" ? "మొత్తం సాగు భూమి" : "Total Cultivated Area"}</AppText>
                
                <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 5 }}>
                  <AnimatedTextInput 
                    editable={false}
                    animatedProps={animatedProps}
                    style={{ color: "#fff", fontSize: 32, fontWeight: "600", padding: 0, margin: 0 }}
                  />
                  <AppText style={{fontSize: 18, color: '#C7D2FE', marginLeft: 6}}>
                    {language === "te" ? "ఎకరాలు" : "Acres"}
                  </AppText>
                </View>

                <View style={styles.glassRow}>
                  <View style={styles.glassBox}>
                    <View style={[styles.glassIconBg, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}><Ionicons name="home" size={16} color="#10B981" /></View>
                    <View>
                      <AppText style={styles.glassLabel}>{language === "te" ? "సొంతం" : "Own"}</AppText>
                      <AppText style={styles.glassValue}>{ownAcres} <AppText style={styles.glassUnit}>{language === "te" ? "ఎకరాలు" : "Acres"}</AppText></AppText>
                    </View>
                  </View>

                  <View style={styles.glassBox}>
                    <View style={[styles.glassIconBg, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}><Ionicons name="document-text" size={16} color="#F59E0B" /></View>
                    <View>
                      <AppText style={styles.glassLabel}>{language === "te" ? "కౌలు" : "Rent"}</AppText>
                      <AppText style={styles.glassValue}>{rentAcres} <AppText style={styles.glassUnit}>{language === "te" ? "ఎకరాలు" : "Acres"}</AppText></AppText>
                    </View>
                  </View>
                </View>

                {cropStats.length > 0 && (
                  <>
                    <View style={styles.divider} />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {cropStats.map((item, index) => (
                        <View key={index} style={styles.miniChip}>
                          <View style={[styles.dot, { backgroundColor: item.color }]} />
                          <AppText style={styles.chipText}>{item.name}: {item.population} {language === "te" ? "ఎకరాలు" : "Acres"}</AppText>
                        </View>
                      ))}
                    </ScrollView>
                  </>
                )}
            </LinearGradient>

            <View style={styles.chartsRow}>
                <Animated.View entering={FadeInDown.delay(200)} style={styles.chartBox}>
                  <AppText style={styles.sectionTitle}>{language === "te" ? "భూమి యాజమాన్యం" : "Land Ownership"}</AppText>
                  <View style={styles.semiChartWrapper}>
                    <PieChart
                      data={safeOwnershipData}
                      width={screenWidth * 0.9} height={220}
                      chartConfig={{ color: (opacity = 1) => `rgba(0,0,0, ${opacity})` }}
                      accessor={"population"} backgroundColor={"transparent"} paddingLeft={"88"} hasLegend={false} absolute
                    />
                    <View style={styles.semiHole}>
                        <Ionicons name="location" size={24} color="#6366F1" style={{marginBottom: 4}} />
                        <AppText style={styles.semiValueText}>{totalAcres}</AppText>
                        <AppText style={styles.semiLabelText}>{language === 'te' ? 'మొత్తం ఎకరాలు' : 'Total Acres'}</AppText>
                    </View>
                  </View>
                  <View style={styles.semiLegendRow}>
                    {ownershipData.map((item, index) => (
                      <View key={index} style={styles.semiLegendItem}>
                        <View style={[styles.legendDot, { backgroundColor: item.color, width: 12, height: 12 }]} />
                        <View><AppText style={styles.legendName}>{item.name.replace(" (%)", "")}</AppText></View>
                      </View>
                    ))}
                  </View>
                </Animated.View>

                {cropStats.length > 0 && (
                  <Animated.View entering={FadeInDown.delay(400)} style={styles.chartBox}>
                    <AppText style={styles.sectionTitle}>{language === "te" ? "పంటల వారీగా వివరాలు" : "Crop-wise Distribution"}</AppText>
                    <View style={styles.centerChartWrapper}>
                      <PieChart
                        data={safeCropStats} width={screenWidth - 60} height={200}
                        chartConfig={{ color: (opacity = 1) => `rgba(0,0,0, ${opacity})` }}
                        accessor={"population"} backgroundColor={"transparent"} paddingLeft={(screenWidth / 4).toString()} hasLegend={false}
                      />
                    </View>
                    <View style={styles.gridLegendContainer}>
                      {cropStats.map((item, index) => (
                        <View key={index} style={styles.gridLegendItem}>
                          <View style={[styles.gridDot, { backgroundColor: item.color }]} />
                          <View style={styles.gridTextWrapper}><AppText style={styles.gridName} numberOfLines={1}>{item.name}</AppText></View>
                        </View>
                      ))}
                    </View>
                  </Animated.View>
                )}

                <PremiumDonutChart chartData={soilStats} title={language === "te" ? "నేల రకాల విశ్లేషణ" : "Soil Type Analytics"} />
            </View>

            {landsData.length > 0 && (
              <>
                <AppText style={styles.listHeading}>{language === "te" ? "మీ పొలాలు" : "Your Lands"}</AppText>

                <View style={{ paddingHorizontal: 16 }}>
                  {landsData.map((land, index) => {
                    const landCrops = data.filter(c => c.landId === land.id || (c.nickname && c.nickname === land.nickname));
                    const completedCrops = completedData.filter(c => c.landId === land.id || (c.nickname && c.nickname === land.nickname));
                    
                    const usedAcres = parseFloat(landCrops.reduce((sum, c) => sum + Number(c.acres || 0), 0).toFixed(2));
                    const remainingAcres = Math.max(0, parseFloat((Number(land.acres) - usedAcres).toFixed(2)));
                    
                    // Group Active Crops
                    const groupedLandCrops = Object.values(landCrops.reduce((acc: any, c: any) => {
                        if (!acc[c.crop]) acc[c.crop] = { ...c, acres: parseFloat(c.acres || 0), ids: [c.id] };
                        else {
                            acc[c.crop].acres = parseFloat((acc[c.crop].acres + parseFloat(c.acres || 0)).toFixed(2));
                            acc[c.crop].ids.push(c.id);
                        }
                        return acc;
                    }, {})) as any[];

                    // Group Completed Crops
                    const groupedCompletedCrops = Object.values(completedCrops.reduce((acc: any, c: any) => {
                        if (!acc[c.crop]) acc[c.crop] = { ...c, acres: parseFloat(c.acres || 0), ids: [c.id] };
                        else {
                            acc[c.crop].acres = parseFloat((acc[c.crop].acres + parseFloat(c.acres || 0)).toFixed(2));
                            acc[c.crop].ids.push(c.id);
                        }
                        return acc;
                    }, {})) as any[];
                    
                    return (
                       <View key={land.id} style={{ backgroundColor: "#fff", borderRadius: 16, marginBottom: 20, padding: 16, borderWidth: 1, borderColor: "#E5E7EB" }}>
                          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#F3F4F6", paddingBottom: 12, marginBottom: 12 }}>
                             <View>
                                <AppText style={{ fontSize: 18, fontWeight: "600", color: "#1F2937" }}>{land.nickname}</AppText>
                                <AppText style={{ fontSize: 14, color: "#6B7280", marginTop: 2 }}>
                                   {land.acres} {language === "te" ? "ఎకరాలు" : "Acres"} | {land.type === "own" ? (language === "te" ? "సొంతం" : "Own") : (language === "te" ? `కౌలు (₹${land.rent})` : `Rent (₹${land.rent})`)}
                                </AppText>
                             </View>
                             
                             <Menu>
                                <MenuTrigger style={{ padding: 4 }}>
                                   <Ionicons name="ellipsis-vertical" size={20} color="#9CA3AF" />
                                </MenuTrigger>
                                <MenuOptions customStyles={optionsStyles}>
                                   <MenuOption onSelect={() => handleDeleteLandClick(land)}>
                                      <View style={styles.modernMenuItem}>
                                         <Ionicons name="trash-outline" size={18} color="#EF4444" />
                                         <AppText style={styles.menuTextDelete} language={language}>{language === "te" ? "భూమిని తొలగించు" : "Delete Land"}</AppText>
                                      </View>
                                   </MenuOption>
                                </MenuOptions>
                             </Menu>
                          </View>

                          {/* Active Crops List */}
                          {groupedLandCrops.map(cropItem => {
                             const cropColor = cropStats.find(s => s.name === (cropItem.crop || "Others"))?.color || "#10B981";
                             return (
                             <View key={cropItem.id} style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F9FAFB", padding: 12, borderRadius: 12, marginBottom: 8 }}>
                                <View style={{ width: 8, height: "100%", backgroundColor: cropColor, borderRadius: 4, marginRight: 12 }} />
                                <View style={{ flex: 1 }}>
                                   <AppText style={{ fontSize: 15, fontWeight: "600", color: "#374151" }}>{cropItem.crop}</AppText>
                                   <AppText style={{ fontSize: 13, color: "#6B7280" }}>{cropItem.acres} {language === "te" ? "ఎకరాలు" : "Acres"}</AppText>
                                </View>
                                <Menu>
                                  <MenuTrigger style={{ padding: 8 }}>
                                    {actionLoading && selectedItem?.id === cropItem.id ? (
                                       <Ionicons name="sync" size={18} color="#2563EB" />
                                    ) : (
                                       <Ionicons name="ellipsis-vertical" size={18} color="#9CA3AF" />
                                    )}
                                  </MenuTrigger>
                                  <MenuOptions customStyles={optionsStyles}>
                                    <MenuOption onSelect={() => { setSelectedItem(cropItem); handleEditClick(cropItem); }}>
                                       <View style={styles.modernMenuItem}>
                                          <Ionicons name="create-outline" size={18} color="#2563EB" />
                                          <AppText style={styles.menuTextEdit} language={language}>{language === "te" ? "సవరించు" : "Edit"}</AppText>
                                       </View>
                                    </MenuOption>
                                    <View style={styles.menuDivider} />
                                    <MenuOption onSelect={() => { setSelectedItem(cropItem); handleEndCrop(cropItem); }}>
                                       <View style={styles.modernMenuItem}>
                                          <Ionicons name="checkmark-done-outline" size={18} color="#10B981" />
                                          <AppText style={[styles.menuTextEdit, { color: "#10B981" }]} language={language}>{language === "te" ? "పంట పూర్తయింది" : "End Crop"}</AppText>
                                       </View>
                                    </MenuOption>
                                    <View style={styles.menuDivider} />
                                    <MenuOption onSelect={() => { setSelectedItem(cropItem); handleDeleteClick(cropItem); }}>
                                       <View style={styles.modernMenuItem}>
                                          <Ionicons name="trash-outline" size={18} color="#EF4444" />
                                          <AppText style={styles.menuTextDelete} language={language}>{language === "te" ? "తొలగించు" : "Delete"}</AppText>
                                       </View>
                                    </MenuOption>
                                  </MenuOptions>
                                </Menu>
                             </View>
                             );
                          })}

                          {/* Completed Crops List (Opactiy 0.7) */}
                          {groupedCompletedCrops.length > 0 && groupedCompletedCrops.map(cropItem => (
                             <View key={cropItem.id} style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F3F4F6", padding: 10, borderRadius: 12, marginBottom: 8, opacity: 0.7 }}>
                                <Ionicons name="checkmark-circle" size={20} color="#9CA3AF" style={{ marginRight: 10 }} />
                                <View style={{ flex: 1 }}>
                                   <AppText style={{ fontSize: 14, color: "#4B5563" }}>{cropItem.crop}</AppText>
                                   <AppText style={{ fontSize: 12, color: "#9CA3AF" }}>{cropItem.acres} {language === "te" ? "ఎకరాలు" : "Acres"}</AppText>
                                </View>
                                <Menu>
                                  <MenuTrigger style={{ padding: 8 }}>
                                    {actionLoading && selectedItem?.id === cropItem.id ? (
                                       <Ionicons name="sync" size={18} color="#2563EB" />
                                    ) : (
                                       <Ionicons name="ellipsis-vertical" size={18} color="#9CA3AF" />
                                    )}
                                  </MenuTrigger>
                                  <MenuOptions customStyles={optionsStyles}>
                                    <MenuOption onSelect={() => { setSelectedItem(cropItem); handleEditClick(cropItem); }}>
                                       <View style={styles.modernMenuItem}>
                                          <Ionicons name="create-outline" size={18} color="#2563EB" />
                                          <AppText style={styles.menuTextEdit} language={language}>{language === "te" ? "సవరించు" : "Edit"}</AppText>
                                       </View>
                                    </MenuOption>
                                    <View style={styles.menuDivider} />
                                    <MenuOption onSelect={() => { setSelectedItem(cropItem); handleDeleteClick(cropItem); }}>
                                       <View style={styles.modernMenuItem}>
                                          <Ionicons name="trash-outline" size={18} color="#EF4444" />
                                          <AppText style={styles.menuTextDelete} language={language}>{language === "te" ? "తొలగించు" : "Delete"}</AppText>
                                       </View>
                                    </MenuOption>
                                  </MenuOptions>
                                </Menu>
                             </View>
                          ))}

                          {/* Remaining Acres / Add Crop Button */}
                          {landCrops.length === 0 && completedCrops.length === 0 ? (
                             <TouchableOpacity 
                               style={{ backgroundColor: "#F3F4F6", padding: 14, borderRadius: 12, alignItems: "center", marginTop: 4, borderWidth: 1, borderColor: "#D1D5DB", borderStyle: "dashed" }}
                               onPress={() => router.push({
                                  pathname: "/farmer/fields/add-field",
                                  params: { landId: land.id, nickname: land.nickname, maxAcres: remainingAcres.toString() }
                               })}
                             >
                               <Ionicons name="add-circle-outline" size={24} color="#16A34A" />
                               <AppText style={{ color: "#16A34A", fontSize: 15, fontWeight: "600", marginTop: 4 }}>
                                 {language === "te" ? "పంటను జోడించండి" : "Add Crop"}
                               </AppText>
                             </TouchableOpacity>
                          ) : remainingAcres > 0 ? (
                             <View style={{ backgroundColor: "#FEF3C7", borderRadius: 12, padding: 12, marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: "#FDE68A" }}>
                                <AppText style={{ fontSize: 13, color: "#92400E", flex: 1, marginRight: 10 }}>
                                  {language === "te" ? `ఈ భూమిలో ఇంకా ${remainingAcres} ఎకరాలు ఖాళీగా ఉంది.` : `${remainingAcres} acres available.`}
                                </AppText>
                                <TouchableOpacity 
                                  style={{ backgroundColor: "#F59E0B", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }} 
                                  onPress={() => router.push({
                                     pathname: "/farmer/fields/add-field",
                                     params: { landId: land.id, nickname: land.nickname, maxAcres: remainingAcres.toString() }
                                  })}
                                >
                                  <AppText style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>{language === "te" ? "+ కొత్త పంట" : "+ Add Crop"}</AppText>
                                </TouchableOpacity>
                             </View>
                          ) : null}
                       </View>
                    );
                  })}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* 🔥 PREMIUM DELETE MODAL */}
      <Modal visible={deleteVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconBg}>
              <Ionicons name="trash-outline" size={36} color="#e44830" />
            </View>
            <AppText style={styles.modalTitle}>{language === "te" ? "తొలగించాలా?" : "Delete Field?"}</AppText>
            <AppText style={styles.modalSub}>{language === "te" ? "ఈ రికార్డ్ శాశ్వతంగా తొలగించబడుతుంది" : "This record will be permanently deleted"}</AppText>
            <View style={styles.modalButtons}>
              <TouchableOpacity activeOpacity={0.8} style={styles.modalCancelBtn} onPress={() => setDeleteVisible(false)} disabled={isDeleting}>
                <AppText style={styles.modalCancelText}>{language === "te" ? "వద్దు" : "Cancel"}</AppText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtnStandard} onPress={handleDelete} disabled={isDeleting}>
                <AppText style={styles.modalConfirmTextStandard}>{isDeleting ? (language === "te" ? "తొలగిస్తోంది..." : "Deleting...") : (language === "te" ? "తొలగించు" : "Delete")}</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 🔒 CANNOT DELETE WARNING MODAL */}
      <Modal visible={cantDeleteVisible} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.modalOverlayStandard}>
          <View style={styles.modalContentStandard}>
            <View style={styles.modalIconBgStandardWarning}>
              <Ionicons name="lock-closed" size={36} color="#F59E0B" />
            </View>
            <AppText style={styles.modalTitleStandardWarning} language={language}>
              {language === "te" ? "తొలగించడం కుదరదు!" : "Cannot Delete!"}
            </AppText>
            <AppText style={styles.modalSubStandard} language={language}>
              {language === "te"
                ? "ఈ పొలానికి సంబంధించి కూలీల హాజరు, లేదా ఇతర ఖర్చులు ఇప్పటికే నమోదయ్యాయి. వాటిని తొలగిస్తేనే ఈ పొలం తొలగించబడుతుంది."
                : "This field has associated records (attendance, expenses, or sales). Please delete them first."}
            </AppText>
            <View style={styles.modalButtonsStandard}>
              <TouchableOpacity activeOpacity={0.8}
                style={styles.modalWarningBtnStandard} 
                onPress={() => { setCantDeleteVisible(false); setSelectedItem(null); }}
              >
                <AppText style={styles.modalWarningTextStandard} language={language}>
                  {language === "te" ? "అర్థమైంది" : "Got It"}
                </AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 🔥 GLOBAL ERROR MODAL */}
      <Modal visible={showErrorModal} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.modalOverlayStandard}>
          <View style={styles.modalContentStandard}>
            <View style={[styles.modalIconBgStandardWarning, { backgroundColor: "#FEE2E2" }]}>
              <Ionicons name="warning-outline" size={36} color="#EF4444" />
            </View>
            <AppText style={[styles.modalTitleStandardWarning, { color: "#EF4444" }]} language={language}>
              {language === "te" ? "లోపం జరిగింది" : "Error Occurred"}
            </AppText>
            <AppText style={styles.modalSubStandard} language={language}>
              {errorMsg}
            </AppText>
            <View style={styles.modalButtonsStandard}>
              <TouchableOpacity activeOpacity={0.8}
                style={[styles.modalWarningBtnStandard, { backgroundColor: "#EF4444" }]} 
                onPress={() => setShowErrorModal(false)}
              >
                <AppText style={styles.modalWarningTextStandard} language={language}>
                  {language === "te" ? "సరే" : "OK"}
                </AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <TouchableOpacity activeOpacity={0.9} style={styles.fab} onPress={() => {
        router.push("/farmer/fields/add-land");
      }}>
        <LinearGradient colors={["#16A34A", "#064E3B"]} style={styles.fabGradient}>
          <Ionicons name="add" size={32} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  glassRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, gap: 12 },
  glassBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.1)', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)', gap: 10 },
  glassIconBg: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  glassLabel: { fontSize: 11, color: 'rgba(255, 255, 255, 0.6)', fontWeight: '500', textTransform: 'uppercase' },
  glassValue: { fontSize: 16, color: '#fff', fontWeight: '700' },
  glassUnit: { fontSize: 10, color: 'rgba(255, 255, 255, 0.5)', fontWeight: '400' },
  mainCard: { margin: 16, padding: 20, borderRadius: 24 },
  cardLabel: { color: "#A5B4FC", fontSize: 13, fontWeight: '500', letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.15)", marginVertical: 15 },
  miniChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, marginRight: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  chipText: { color: "#E2E8F0", fontSize: 12, fontWeight: '600' },
  chartRowWrapper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%' },
  chartBox: { backgroundColor: '#fff', padding: 16, borderRadius: 24, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 },
  chartsRow: { paddingHorizontal: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#1E293B', marginBottom: 10 },
  listHeading: { fontSize: 18, fontWeight: '600', color: '#0F172A', marginHorizontal: 20, marginVertical: 15 },
  fieldCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' },
  sideBar: { width: 5, height: '100%' },
  fieldInfo: { flex: 1, padding: 16 },
  cropName: { fontSize: 18, fontWeight: '600', color: '#334155' },
  fieldMeta: { fontSize: 13, color: '#64748B', marginTop: 2 },
  priceContainer: { alignItems: 'flex-end', paddingRight: 10 },
  rentPrice: { fontSize: 16, fontWeight: '600', color: '#166534' },
  rentUnit: { fontSize: 9, color: '#94A3B8', fontWeight: '600' },
  cardRightSection: { flexDirection: 'row', alignItems: 'center', paddingRight: 8, gap: 10 },
  
  menuBtn: { padding: 8, backgroundColor: '#F1F5F9', borderRadius: 10 },
  modernMenuItem: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 14, gap: 10 },
  menuTextEdit: { fontSize: 14, color: "#1E293B", fontWeight: "500" },
  menuTextDelete: { fontSize: 14, color: "#EF4444", fontWeight: "500" },
  menuDivider: { height: 1, backgroundColor: "#F1F5F9", marginHorizontal: 10 },

  bottomSheet: { width: "100%", backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, alignItems: "center", position: "absolute", bottom: 0 },
  bottomSheetLarge: { width: "100%", backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, alignItems: "center", position: "absolute", bottom: 0, maxHeight: "80%" },
  dragHandle: { width: 40, height: 4, backgroundColor: "#E5E7EB", borderRadius: 2, marginBottom: 20 },
  bottomSheetTitle: { fontSize: 20, fontWeight: "600", color: "#1F2937", marginBottom: 20, fontFamily: "Mandali", lineHeight: 32, paddingBottom: 4 },
  sheetOptionBtn: { flexDirection: "row", alignItems: "center", width: "100%", padding: 16, backgroundColor: "#F9FAFB", borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: "#F3F4F6" },
  sheetIconBg: { width: 48, height: 48, borderRadius: 12, justifyContent: "center", alignItems: "center", marginRight: 16 },
  sheetOptionTexts: { flex: 1 },
  sheetOptionTitle: { fontSize: 16, fontWeight: "600", color: "#1F2937", marginBottom: 4, fontFamily: "Mandali", lineHeight: 26, paddingBottom: 4 },
  sheetOptionSub: { fontSize: 13, color: "#6B7280", fontFamily: "Mandali", lineHeight: 20, paddingBottom: 4 },
  sheetCancelBtn: { width: "100%", padding: 16, borderRadius: 16, backgroundColor: "#FEF2F2", alignItems: "center", marginTop: 8 },
  sheetCancelText: { color: "#EF4444", fontSize: 16, fontWeight: "600", fontFamily: "Mandali", textAlign: "center" },
  pickerItem: { flexDirection: "row", alignItems: "center", width: "100%", backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#E5E7EB", overflow: "hidden" },
  pickerCropName: { fontSize: 16, fontWeight: "600", color: "#1F2937", marginBottom: 2, fontFamily: "Mandali", lineHeight: 26, paddingBottom: 4 },
  pickerCropMeta: { fontSize: 13, color: "#6B7280", fontFamily: "Mandali", lineHeight: 20, paddingBottom: 4 },

  fab: { position: "absolute", bottom: 30, right: 20, elevation: 5, shadowColor: '#16A34A', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: {width: 0, height: 4} },
  fabGradient: { width: 64, height: 64, borderRadius: 35, justifyContent: "center", alignItems: "center" },
  
  shimmerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' },
  shimmerSideBar: { width: 5, height: '100%', backgroundColor: '#E2E8F0' },
  shimmerContent: { flex: 1, padding: 16 },
  shimmerLineTitle: { width: '55%', height: 18, backgroundColor: '#E2E8F0', borderRadius: 6, marginBottom: 8 },
  shimmerLineSub: { width: '40%', height: 12, backgroundColor: '#F1F5F9', borderRadius: 6 },
  shimmerRight: { flexDirection: 'row', alignItems: 'center', paddingRight: 10, gap: 10 },
  shimmerPriceBox: { width: 55, height: 30, backgroundColor: '#F1F5F9', borderRadius: 8 },
  shimmerMenuCircle: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#F1F5F9' },
  
  donutHole: { position: 'absolute', width: 90, height: 90, borderRadius: 50, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3 },
  donutText: { fontSize: 14, fontWeight: 'bold', color: '#1E293B' },
  semiChartWrapper: { height: 160, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-start', marginTop: -20 },
  semiHole: { position: 'absolute', bottom: -20, width: 130, height: 125, borderRadius: 75, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9',shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  semiValueText: { fontSize: 22, fontWeight: '800', color: '#1E293B' },
  semiLabelText: { fontSize: 10, color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase' },
  semiLegendRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20, paddingTop: 15 },
  semiLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  legendName: { fontSize: 14, color: '#475569', fontWeight: '500' },
  centerChartWrapper: { alignItems: 'center', justifyContent: 'center', width: '100%', marginBottom: 10 },
  gridLegendContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: 5, marginTop: 10, gap: 10 },
  gridLegendItem: { width: (screenWidth - 100) / 2, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 8, borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  gridDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  gridTextWrapper: { flex: 1 },
  gridName: { fontSize: 13, fontWeight: '600', color: '#334155' },
  modernLegendContainer: { flex: 1, paddingLeft: 10, justifyContent: 'center' },
  modernLegendRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, paddingRight: 5 },
  modernDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6, marginRight: 8 },
  modernTextWrapper: { flex: 1 },
  modernNameText: { marginTop: -7, fontSize: 15, fontWeight: '600', color: '#334155', textTransform: 'capitalize' },
  modernValueText: { fontSize: 11, color: '#64748B', fontWeight: '500', marginTop: 1 },
  modernUnderline: { height: 3, backgroundColor: '#F1F5F9', borderRadius: 1, marginTop: 4, width: '90%' },
  modernFill: { height: '100%', borderRadius: 1, opacity: 0.8 },
  
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center" },
  modalContent: { width: "80%", backgroundColor: "white", borderRadius: 25, padding: 25, alignItems: "center" },
  modalTitle: { fontSize: 20, fontWeight: "500", color: "#e2431f", marginVertical: 10 },
  modalSub: { textAlign: "center", color: "#64748B", marginBottom: 25 },
  modalButtons: { flexDirection: "row", gap: 10 },
  modalOverlayStandard: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 999 },
  modalContentStandard: { width: "85%", backgroundColor: "white", borderRadius: 24, padding: 24, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 15 },
  modalSubStandard: { textAlign: "center", color: "#64748B", marginBottom: 25, fontSize: 14, lineHeight: 22 },
  modalButtonsStandard: { flexDirection: "row", gap: 12, justifyContent: "center", width: "100%" },
  modalCancelBtn: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#F1F5F9", alignItems: "center" },
  modalConfirmBtnStandard: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#EF4444", alignItems: "center" },
  modalCancelText: { color: "#64748B", fontWeight: "500" },
  modalConfirmTextStandard: { color: "white", fontWeight: "500" },
  modalIconBg: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#f5e8e8", justifyContent: "center", alignItems: "center", marginBottom: 10 },
  modalTitleStandardWarning: { fontSize: 20, fontWeight: "500", color: "#F59E0B", marginVertical: 10, textAlign: "center" },
  modalWarningBtnStandard: { paddingVertical: 12, paddingHorizontal: 32, borderRadius: 12, backgroundColor: "#F59E0B", alignItems: "center" },
  modalWarningTextStandard: { color: "white", fontWeight: "500" },
  modalIconBgStandardWarning: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#FEF3C7", justifyContent: "center", alignItems: "center", marginBottom: 10 },
});