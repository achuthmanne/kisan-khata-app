// app/farmer/payment-details.tsx

import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";
import AppEmptyState from "@/components/AppEmptyState"; 
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View
} from "react-native";
import ShimmerPlaceholder from "react-native-shimmer-placeholder";

export default function PaymentDetails() {

  const { id, name, village } = useLocalSearchParams();
  const router = useRouter();

  const [grouped, setGrouped] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<"te" | "en">("te");

  const [openCrops, setOpenCrops] = useState<any>({});
  const [openWorks, setOpenWorks] = useState<any>({});

  useFocusEffect(
    useCallback(() => {
      const loadLang = async () => {
        const lang = await AsyncStorage.getItem("APP_LANG");
        if (lang) setLanguage(lang as any);
      };
      loadLang();
    }, [])
  );

  /* ---------------- LOAD DATA ---------------- */
  const loadData = async () => {
    setLoading(true);
    try {
      const userPhone = await AsyncStorage.getItem("USER_PHONE");
      if (!userPhone) return;

      const userDoc = await firestore()
        .collection("users")
        .doc(userPhone)
        .get();

      const activeSession = userDoc.data()?.activeSession;
      if (!activeSession) {
        setGrouped({});
        return;
      }

      const snap = await firestore()
        .collection("users")
        .doc(userPhone)
        .collection("mestris")
        .doc(id as string)
        .collection("attendance")
        .where("session", "==", activeSession) 
        .get();

      // Fetch payments to handle old records that don't have isPaid: true
      const paymentsSnap = await firestore()
        .collection("users")
        .doc(userPhone)
        .collection("payments")
        .where("mestriId", "==", id)
        .where("session", "==", activeSession)
        .get();

      let paidIds: string[] = [];
      paymentsSnap.docs.forEach(p => {
        const data = p.data();
        if (data.selectedAttendanceIds && Array.isArray(data.selectedAttendanceIds)) {
          paidIds.push(...data.selectedAttendanceIds);
        }
      });

      const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      const unpaidList = list.filter((item: any) => !paidIds.includes(item.id));

      const cropGroup: any = {};

      unpaidList.forEach(item => {
        const crop = item.crop || "Other";
        const work = item.work || "Other";

        if (!cropGroup[crop]) cropGroup[crop] = {};
        if (!cropGroup[crop][work]) cropGroup[crop][work] = [];

        cropGroup[crop][work].push(item);
      });

      setGrouped(cropGroup);
      
    } catch (error) {
      console.log("Error loading payment details:", error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  /* ---------------- SHIMMER ---------------- */
  const ShimmerCard = () => (
    <View style={styles.shimmerCard}>
      <ShimmerPlaceholder
        LinearGradient={LinearGradient}
        style={{ height: 14, width: "40%", borderRadius: 6 }}
      />
      <ShimmerPlaceholder
        LinearGradient={LinearGradient}
        style={{ height: 12, width: "60%", marginTop: 10, borderRadius: 6 }}
      />
    </View>
  );

  /* ---------------- TOGGLE ---------------- */
  const toggleCrop = (crop: string) => {
    setOpenCrops((prev: any) => ({ ...prev, [crop]: !prev[crop] }));
  };

  const toggleWork = (key: string) => {
    setOpenWorks((prev: any) => ({ ...prev, [key]: !prev[key] }));
  };

  /* ---------------- COLORS ---------------- */
  const cropColors = ["#22C55E","#3B82F6","#F59E0B","#EF4444","#8B5CF6"];
  const workColors = ["#06B6D4","#84CC16","#F97316","#6366F1","#EC4899"];

  const getCropColor = (c: string) =>
    cropColors[c.charCodeAt(0) % cropColors.length];

  const getWorkColor = (w: string) =>
    workColors[w.charCodeAt(0) % workColors.length];

  /* ---------------- UI ---------------- */
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      <AppHeader
        title={language === "te" ? "పని వివరాలు" : "Work Details"}
        subtitle={language === "te" ? "చెల్లింపు ఎంపిక" : "Payment Selection"}
        language={language}
      />

      {/* 🔥 UX: Simple and Clean Top Info Box */}
      <View style={styles.topInfoBox}>
        <AppText style={styles.mainTitle} language={language} numberOfLines={1} ellipsizeMode="tail">
          {name}
        </AppText>
        
        <AppText style={styles.subTitle} language={language} numberOfLines={1} ellipsizeMode="tail">
          {village}
        </AppText>
      </View>

      {/* LIST */}
      {loading ? (
        <View style={{ paddingTop: 10 }}>
          <ShimmerCard />
          <ShimmerCard />
          <ShimmerCard />
        </View>
      ) : (
        <FlatList
          data={Object.keys(grouped)}
          keyExtractor={(item) => item}
          contentContainerStyle={[
            { paddingBottom: 100 },
            Object.keys(grouped).length === 0 && { flexGrow: 1, justifyContent: 'center' }
          ]}
          showsVerticalScrollIndicator={false}

          /* 🔥 OUR NEW GLOBAL EMPTY STATE COMPONENT */
          ListEmptyComponent={
            <AppEmptyState
              iconName="folder-open-outline"
              title={language === "te" ? "డేటా లేదు" : "No Data"}
              subtitle={language === "te" ? "ఈ మేస్త్రీకి సంబంధించి ఇంకా ఎలాంటి పని వివరాలు నమోదు కాలేదు" : "No work details found for this mestri yet"}
              language={language}
            />
          }

          renderItem={({ item }) => {
            const cropColor = getCropColor(item);
            const isCropOpen = openCrops[item];
            const works = grouped[item];
            const workCount = Object.keys(works).length; 
            
            return (
              <View>

                {/* 🌾 CROP */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[styles.crop, { borderLeftColor: cropColor }]}
                  onPress={() => toggleCrop(item)}
                >
                  <View style={styles.cropLeft}>
                    <AppText style={styles.cropName} language={language} numberOfLines={1} ellipsizeMode="tail">
                      {item}
                    </AppText>
                    <AppText style={styles.cropDays} language={language}>
                      {workCount} {language === "te" ? "పనులు" : "Works"}
                    </AppText>
                  </View>

                  <View style={styles.iconCircle}>
                    <Ionicons
                      name={isCropOpen ? "chevron-up" : "chevron-down"}
                      size={20}
                      color="#6B7280"
                    />
                  </View>
                </TouchableOpacity>

                {/* 🔹 WORKS */}
                {isCropOpen && Object.keys(works).map(work => {

                  const key = item + "_" + work;
                  const isWorkOpen = openWorks[key];
                  const workColor = getWorkColor(work);
                  const workData = works[work];
                  const workDays = workData.length;

                  return (
                    <View key={work}>
                      <TouchableOpacity
                        style={[styles.work, { borderLeftColor: workColor }]}
                        onPress={() => {
                          router.push({
                            pathname: "/farmer/mestripayments/payment-main",
                            params: {
                              id,
                              crop: item,
                              work,
                              name,
                              village
                            }
                          });
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={styles.workLeft}>
                          <AppText style={styles.workName} language={language} numberOfLines={1} ellipsizeMode="tail">
                            {work}
                          </AppText>

                          <AppText style={styles.workDays} language={language}>
                            {workDays} {language === "te" ? "రోజులు" : "Days"}
                          </AppText>
                        </View>

                        <Ionicons name="arrow-forward-circle" size={24} color={workColor} />
                      </TouchableOpacity>
                    </View>
                  );
                })}

              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({

  safe: { flex: 1, backgroundColor: "#F9FAFB" },

 topInfoBox: {
    marginHorizontal: 20,
    marginTop: 12,
    padding: 14,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between" 
  },
  
  mainTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  
  subTitle: {
    fontSize: 14, // కొద్దిగా సైజ్ పెంచాను
    color: "#6B7280",
    fontWeight: "500" // కొద్దిగా థిక్ గా కనపడటానికి
    // marginTop తీసేశాను బ్రో, అప్పుడే రెండు ఒకే లైన్ లో పర్ఫెక్ట్ గా ఉంటాయి
  },
  crop: {
    marginHorizontal: 20,
    marginTop: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderLeftWidth: 5,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 3,
  },

  work: {
    marginHorizontal: 20,
    marginLeft: 35, // Indented for hierarchy
    marginTop: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center" 
  },
  
  cropLeft: {
    flexDirection: "column",
    justifyContent: "center" 
  },

  workLeft: {
    flexDirection: "column",
    justifyContent: "center" 
  },

  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center"
  },

  shimmerCard: {
    marginHorizontal: 20,
    marginVertical: 8,
    padding: 18,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB"
  },
  
  cropName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937"
  },

  cropDays: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 4,
    fontWeight: "500"
  },

  workName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151"
  },

  workDays: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
    fontWeight: "500"
  },
});