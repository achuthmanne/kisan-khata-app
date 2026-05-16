//payment details
import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";
import AppEmptyState from "@/components/AppEmptyState"; // 🔥 మన గ్లోబల్ కాంపోనెంట్
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
  const [loading, setLoading] = useState(false);
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
    const userPhone = await AsyncStorage.getItem("USER_PHONE");
    if (!userPhone) return;

    setLoading(true);

    const snap = await firestore()
      .collection("users")
      .doc(userPhone)
      .collection("mestris")
      .doc(id as string)
      .collection("attendance")
      .get();

    const list = snap.docs.map(d => d.data());

    const cropGroup: any = {};

    list.forEach(item => {
      const crop = item.crop || "Other";
      const work = item.work || "Other";

      if (!cropGroup[crop]) cropGroup[crop] = {};
      if (!cropGroup[crop][work]) cropGroup[crop][work] = [];

      cropGroup[crop][work].push(item);
    });

    setGrouped(cropGroup);
    setLoading(false);
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
        title={language === "te" ? "చెల్లింపు వివరాలు" : "Payment Details"}
        subtitle={language === "te" ? "పని వివరాలు" : "Work Summary"}
        language={language}
      />

      <View style={styles.topInfoBox}>
        <AppText style={styles.mainTitle} language={language}>
          {name} | {village}
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
            // 🔥 సెంటర్ లో రావడానికి లాజిక్
            Object.keys(grouped).length === 0 && { flexGrow: 1, justifyContent: 'center' }
          ]}

          /* 🔥 OUR NEW GLOBAL EMPTY STATE COMPONENT */
          ListEmptyComponent={
            <AppEmptyState
              iconName="folder-open-outline"
              title={language === "te" ? "డేటా లేదు" : "No Data"}
              subtitle={language === "te" ? "ఈ మేస్త్రీకి సంబంధించి ఇంకా ఎలాంటి పని వివరాలు లేవు" : "No work details found for this mestri yet"}
              language={language}
            />
          }

          renderItem={({ item }) => {
            const cropColor = getCropColor(item);
            const isCropOpen = openCrops[item];
            const works = grouped[item];
            // 🔥 crop total days
            const workCount = Object.keys(works).length; // 🔥 number of works
            
            return (
              <View>

                {/* 🌾 CROP */}
                <TouchableOpacity
                  activeOpacity={0.5}
                  style={[styles.crop, { borderLeftColor: cropColor }]}
                  onPress={() => toggleCrop(item)}
                >
                  <View style={styles.cropLeft}>
                    <AppText style={styles.cropName} language={language}>
                      {item}
                    </AppText>

                    <AppText style={styles.cropDays} language={language}>
                      {workCount} {language === "te" ? "పనులు" : "works"}
                    </AppText>
                  </View>

                  <Ionicons
                    name={isCropOpen ? "chevron-up" : "chevron-down"}
                    size={18}
                    color="#6B7280"
                  />
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
                          <AppText style={styles.workName} language={language}>
                            {work}
                          </AppText>

                          <AppText style={styles.workDays} language={language}>
                            {workDays} {language === "te" ? "రోజులు" : "days"}
                          </AppText>
                        </View>

                        <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
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

  safe: { flex: 1, backgroundColor: "#F6F7F6" },

  crop: {
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,

    borderWidth: 1,
    borderLeftWidth: 4,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    backgroundColor: "#fff",

    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center" 
  },

  work: {
    marginHorizontal: 30,
    marginTop: 6,
    paddingVertical: 12,
    paddingHorizontal: 10,

    borderWidth: 1,
    borderLeftWidth: 3,
    borderColor: "#E5E7EB",
    borderRadius: 8,
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

  shimmerCard: {
    marginHorizontal: 20,
    marginVertical: 6,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#fff",
  },
  
  cropName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827"
  },

  cropDays: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2
  },

  workName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151"
  },

  workDays: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2
  },

  historyBtn: {
    marginHorizontal: 40,
    padding: 8
  },

  topInfoBox: {
    marginHorizontal: 20,
    marginTop: 12,
    padding: 14,
  },

  mainTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    textAlign: "center"
  },

  cropText: {
    fontWeight: "600"
  },
});