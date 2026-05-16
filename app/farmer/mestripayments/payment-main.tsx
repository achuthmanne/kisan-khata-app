// app/farmer/payment-work-history.tsx

import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";
import AppEmptyState from "@/components/AppEmptyState"; // 🔥 మన గ్లోబల్ కాంపోనెంట్
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View
} from "react-native";
import ShimmerPlaceholder from "react-native-shimmer-placeholder";

export default function PaymentWorkHistory() {

  const { id, crop, work, name, village } = useLocalSearchParams();
  const router = useRouter();

  const [data, setData] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState<"te" | "en">("te");
  const [infoVisible, setInfoVisible] = useState(true);

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

    const userDoc = await firestore()
      .collection("users")
      .doc(userPhone)
      .get();

    const activeSession = userDoc.data()?.activeSession;
    if (!activeSession) return;

    setLoading(true);

    try{
      // 🔥 STEP 1: GET ALL ATTENDANCE
      const snap = await firestore()
        .collection("users")
        .doc(userPhone)
        .collection("mestris")
        .doc(id as string)
        .collection("attendance")
        .where("session", "==", activeSession) // 🔥 ADD THIS
        .get();

      // 🔥 STEP 2: GET PAID IDS
      const paymentSnap = await firestore()
        .collection("users")
        .doc(userPhone)
        .collection("payments")
        .where("mestriId", "==", id)
        .where("crop", "==", crop)
        .where("work", "==", work)
        .get();

      let paidIds: string[] = [];

      paymentSnap.docs.forEach(doc => {
        const data = doc.data();
        paidIds.push(...(data.selectedAttendanceIds || []));
      });

      // 🔥 STEP 3: FILTER DATA
      const list = snap.docs
        .map(d => ({ id: d.id, ...(d.data() as any) }))
        .filter(item =>
          item.crop?.trim().toLowerCase() === (crop as string)?.trim().toLowerCase() &&
          item.work?.trim().toLowerCase() === (work as string)?.trim().toLowerCase() &&
          !paidIds.includes(item.id) // 🔥 MAIN LOGIC
        );

      setData(list);

      // డేటా లేకపోతే ఇన్ఫో మోడల్ చూపించవద్దు
      if (list.length === 0) {
        setInfoVisible(false); 
      }
    }catch(e){
      console.log("Error loading data:", e);
    }finally{
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setSelected([]); // 🔥 RESET
      loadData();
    }, [])
  );

  /* ---------------- SELECT LOGIC ---------------- */
  const toggleSelect = (itemId: string) => {
    setSelected(prev =>
      prev.includes(itemId)
        ? prev.filter(i => i !== itemId)
        : [...prev, itemId]
    );
  };

  /* ---------------- WORK COLOR ---------------- */
  const colors = ["#06B6D4","#84CC16","#F97316","#6366F1","#EC4899"];
  const workColor = colors[(work as string).charCodeAt(0) % colors.length];

  useEffect(() => {
    const check = async () => {
      const seen = await AsyncStorage.getItem("PAYMENT_INFO_SEEN");

      if (!seen) {
        setInfoVisible(true);
        await AsyncStorage.setItem("PAYMENT_INFO_SEEN", "1");
      }
    };

    check();
  }, []);

  //shimmer
  const ShimmerCard = () => (
    <View style={styles.shimmerCard}>
      {/* TOP */}
      <View style={styles.topRow}>
        <ShimmerPlaceholder
          LinearGradient={LinearGradient}
          style={{ width: 100, height: 14, borderRadius: 6 }}
        />
        <ShimmerPlaceholder
          LinearGradient={LinearGradient}
          style={{ width: 20, height: 20, borderRadius: 10 }}
        />
      </View>

      {/* DIVIDER */}
      <View style={styles.divider} />

      {/* VALUES */}
      <View style={styles.valuesContainer}>
        <ShimmerPlaceholder LinearGradient={LinearGradient} style={styles.shimmerValue} />
        <ShimmerPlaceholder LinearGradient={LinearGradient} style={styles.shimmerValue} />
        <ShimmerPlaceholder LinearGradient={LinearGradient} style={styles.shimmerValue} />
      </View>

      {/* TOTAL */}
      <View style={{ alignItems: "center", marginTop: 10 }}>
        <ShimmerPlaceholder
          LinearGradient={LinearGradient}
          style={{ width: 80, height: 14, borderRadius: 6 }}
        />
      </View>
    </View>
  );

  /* ---------------- UI ---------------- */
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      <AppHeader
        title={language === "te" ? "చెల్లింపు ఎంపిక" : "Select Payment"}
        subtitle={language === "te" ? "పని హాజరు" : "Work Attendance"}
        language={language}
      />

      <View style={styles.topInfoBox}>
        <AppText style={styles.mainTitle} language={language}>
          {name}
        </AppText>
        <AppText style={styles.subTitle} language={language}>
          {crop} | {work}
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
          data={data}
          keyExtractor={(item, index) => item.id || index.toString()}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
          contentContainerStyle={[
            { paddingBottom: 120 },
            // 🔥 సెంటర్ లోకి రావడానికి లాజిక్
            data.length === 0 && { flexGrow: 1, justifyContent: 'center' }
          ]}

          /* 🔥 OUR NEW GLOBAL EMPTY STATE COMPONENT */
          ListEmptyComponent={
            <AppEmptyState
              iconName="checkmark-done-circle-outline"
              title={language === "te" ? "అన్ని చెల్లింపులు పూర్తయ్యాయి 🎉" : "All Payments Cleared 🎉"}
              subtitle={language === "te" ? "ఈ పని కోసం అన్ని రోజులకు చెల్లింపులు పూర్తయ్యాయి" : "All attendance for this work has been paid"}
              onRetry={() => router.back()} // మోడల్ బదులు ఇక్కడే బటన్ పెట్టాం
              retryText={language === "te" ? "వెనుకకు వెళ్ళండి" : "Go Back"}
              language={language}
            />
          }

          renderItem={({ item }) => {
            const isSelected = selected.includes(item.id);

            const total =
              (item.morning || 0) +
              (item.evening || 0) +
              (item.full || 0);

            return (
              <TouchableOpacity
                style={[
                  styles.card,
                  {
                    borderColor: isSelected ? workColor : "#E5E7EB",
                    backgroundColor: isSelected ? workColor + "12" : "#fff"
                  }
                ]}
                activeOpacity={0.7}
                onPress={() => toggleSelect(item.id)}
              >
                {/* TOP */}
                <View style={styles.topRow}>
                  <View style={styles.dateWrap}>
                    <Ionicons name="calendar-outline" size={16} color="#6B7280" />
                    <AppText style={styles.dateText} language={language}>
                      {item.date}
                    </AppText>
                  </View>

                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={20} color={workColor} />
                  )}
                </View>

                {/* DIVIDER */}
                <View style={styles.divider} />

                {/* VALUES */}
                <View style={styles.valuesContainer}>
                  <View style={styles.valueBox}>
                    <Ionicons name="sunny-outline" size={14} color="#F59E0B" />
                    <AppText style={styles.label} language={language}>
                      {language === "te" ? "ఉదయం" : "Morning"}
                    </AppText>
                    <AppText style={styles.value}>
                      {item.morning || 0}
                    </AppText>
                  </View>

                  <View style={styles.valueBox}>
                    <Ionicons name="partly-sunny-outline" size={14} color="#3B82F6" />
                    <AppText style={styles.label} language={language}>
                      {language === "te" ? "మధ్యాహ్నం" : "Afternoon"}
                    </AppText>
                    <AppText style={styles.value}>
                      {item.evening || 0}
                    </AppText>
                  </View>

                  <View style={styles.valueBox}>
                    <Ionicons name="moon-outline" size={14} color="#8B5CF6" />
                    <AppText style={styles.label} language={language}>
                      {language === "te" ? "రోజంతా" : "Full day"}
                    </AppText>
                    <AppText style={styles.value}>
                      {item.full || 0}
                    </AppText>
                  </View>
                </View>

                {/* DIVIDER */}
                <View style={styles.divider} />

                {/* TOTAL */}
                <View style={styles.bottomRow}>
                  <AppText style={[styles.totalText, { color: workColor }]} language={language}>
                    {language === "te" ? "మొత్తం" : "Total"}: {total}
                  </AppText>
                </View>

              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* HOW TO USE MODAL (Onboarding Info) */}
      {infoVisible && (
        <View style={styles.overlay}>
          <View style={styles.modalBox}>

            {/* ICON */}
            <View style={styles.iconBg}>
              <Ionicons name="information-circle" size={36} color="#16A34A" />
            </View>

            {/* TITLE */}
            <AppText style={styles.modalTitle} language={language}>
              {language === "te" ? "ఎలా ఉపయోగించాలి?" : "How to use?"}
            </AppText>

            {/* MESSAGE */}
            <AppText style={styles.modalSub} language={language}>
              {language === "te"
                ? "మీరు చెల్లించాలనుకునే తేదీలను ఎంచుకోండి"
                : "Select the attendance dates you want to pay for"}
            </AppText>

            {/* BUTTON */}
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.okBtn}
              onPress={() => setInfoVisible(false)}
            >
              <AppText style={styles.okText} language={language}>
                {language === "te" ? "సరే" : "OK"}
              </AppText>
            </TouchableOpacity>

          </View>
        </View>
      )}

      {selected.length > 0 && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            router.push({
              pathname: "/farmer/mestripayments/payment-summary",
              params: {
                ids: JSON.stringify(selected),
                crop,
                work,
                id,
                name,
                village
              }
            });
          }}
          style={styles.confirmWrapper}
        >
          <LinearGradient
            colors={["#2E7D32", "#1B5E20"]}
            style={styles.confirmBtn}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
            <AppText style={styles.confirmText} language={language}>
              {language === "te" ? "నిర్ధారించండి" : "Confirm Selection"}
            </AppText>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F7F6" },

  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },

  date: {
    fontSize: 13,
    marginLeft: 6
  },

  valuesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10
  },

  valueItem: {
    flex: 1
  },

  total: {
    marginTop: 8,
    fontWeight: "600"
  },
  card: {
    marginHorizontal: 20,
    marginVertical: 6,
    padding: 14,
    borderWidth: 1,
    borderRadius: 14,
    backgroundColor: "#fff"
  },
  confirmWrapper: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    borderRadius: 14,
    overflow: "hidden"
  },

  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14
  },

  confirmText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600"
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },

  dateWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },

  dateText: {
    fontSize: 13,
    color: "#374151"
  },

  divider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 10
  },

  valuesContainer: {
    flexDirection: "row",
    justifyContent: "space-between"
  },

  valueBox: {
    alignItems: "center",
    flex: 1
  },

  label: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 4
  },

  value: {
    fontSize: 15,
    fontWeight: "600",
    marginTop: 2,
    color: "#111827"
  },

  bottomRow: {
    marginTop: 10,
    alignItems: "center"
  },
  shimmerCard: {
    marginHorizontal: 20,
    marginVertical: 6,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#fff"
  },

  shimmerValue: {
    width: 50,
    height: 20,
    borderRadius: 6
  },
  totalText: {
    fontSize: 13,
    fontWeight: "600",
  },

  topInfoBox: {
    marginHorizontal: 20,
    marginTop: 12,
    padding: 14,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB"
  },

  mainTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    textAlign: "center"
  },
  subTitle: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 4,
    textAlign: "center"
  },
  overlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center"
  },

  modalBox: {
    width: "80%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    alignItems: "center"
  },

  iconBg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#DCFCE7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10
  },

  modalTitle: {
    fontSize: 16,
    fontWeight: "600"
  },

  modalSub: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 6
  },

  okBtn: {
    marginTop: 16,
    backgroundColor: "#16A34A",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 10
  },

  okText: {
    color: "#fff",
    fontWeight: "600"
  },
});