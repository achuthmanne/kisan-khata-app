import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { useEffect, useState } from "react";
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export default function BookingEntry() {
  const router = useRouter();
  const [language, setLanguage] = useState<"te" | "en">("te");
  const [machineCount, setMachineCount] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem("APP_LANG").then(l => { if (l) setLanguage(l as any); });
  }, []);

  useEffect(() => {
    let unsubscribe: any;
    const load = async () => {
      const phone = await AsyncStorage.getItem("USER_PHONE");
      if (!phone) return;

      unsubscribe = firestore()
        .collection("machines")
        .where("userId", "==", phone)
        .onSnapshot((snap) => {
          setMachineCount(snap.size); 
        });
    };
    load();
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <AppHeader
        title={language === "te" ? "అగ్రి కనెక్ట్" : "AgriConnect"}
        subtitle={language === "te" ? "మరింత చేరువగా వ్యవసాయం" : "Connecting Agriculture"}
        language={language}
      />

      <View style={styles.container}>
        {/* TITLE */}
        <View style={styles.titleContainer}>
          <AppText style={styles.title}>
            {language === "te" ? "వ్యవసాయ పనులకు స్వాగతం!" : "Welcome to AgriConnect!"}
          </AppText>
          <AppText style={styles.subtitle}>
            {language === "te" ? "మీ అవసరాన్ని బట్టి కింద ఉన్న ఆప్షన్ ఎంచుకోండి" : "Select an option based on your requirement"}
          </AppText>
        </View>

        {/* OWNER CARD */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.card, { borderColor: "#A7F3D0", backgroundColor: "#F0FDF4" }]}
          onPress={() => router.push("/farmer/bookings/add-machine")}
        >
          <View style={[styles.iconBox, { backgroundColor: "#DCFCE7" }]}>
            <MaterialCommunityIcons name="tractor" size={30} color="#16A34A" />
          </View>
          <View style={styles.cardContent}>
            <AppText style={[styles.cardTitle, { color: "#166534" }]}>
              {language === "te" ? "యంత్ర యజమాని" : "Machine Owner"}
            </AppText>
            <AppText style={styles.cardDesc}>
              {language === "te"
                ? "మీ యంత్రాన్ని అద్దెకు ఇవ్వండి లేదా నేరుగా రైతుల పొలాల్లో పనులు చేసి ఆదాయం పొందండి."
                : "Add your machine to rent it out, or accept requests to complete farm work directly."}
            </AppText>
          </View>
          <Ionicons name="chevron-forward-circle" size={24} color="#16A34A" />
        </TouchableOpacity>

        {/* VIEW MACHINES BUTTON (Only shows if they added machines) */}
        {machineCount > 0 && (
          <TouchableOpacity 
            activeOpacity={0.8}
            style={styles.viewBtn}
            onPress={() => router.push("/farmer/bookings/my-machines")}
          >
            <LinearGradient colors={["#2563EB", "#1D4ED8"]} style={styles.viewBtnGradient}>
              <Ionicons name="eye" size={18} color="#fff" />
              <AppText style={styles.viewBtnText}>
                {language === "te"
                  ? `మీరు జోడించిన యంత్రాలు చూడండి (${machineCount})`
                  : `View Your Added Machines (${machineCount})`}
              </AppText>
            </LinearGradient>
          </TouchableOpacity>
        )}

        <View style={styles.dividerBox}>
          <View style={styles.dividerLine} />
          <AppText style={styles.dividerText}>{language === "te" ? "లేదా" : "OR"}</AppText>
          <View style={styles.dividerLine} />
        </View>

        {/* FARMER CARD */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.card, { borderColor: "#FED7AA", backgroundColor: "#FFFBEB" }]}
          onPress={() => router.push("/farmer/bookings/find-machines")}
        >
          <View style={[styles.iconBox, { backgroundColor: "#FEF3C7" }]}>
            <MaterialCommunityIcons name="magnify-scan" size={30} color="#D97706" />
          </View>
          <View style={styles.cardContent}>
            <AppText style={[styles.cardTitle, { color: "#B45309" }]}>
              {language === "te" ? "రైతు" : "Farmer"}
            </AppText>
            <AppText style={styles.cardDesc}>
              {language === "te" 
                ? "మీ పొలం పనుల కోసం చుట్టుపక్కల ఉన్న యంత్రాలను వెతికి ఫోన్ చేయండి." 
                : "Find and contact available machinery nearby for your farm work."}
            </AppText>
          </View>
          <Ionicons name="chevron-forward-circle" size={24} color="#D97706" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F6F7F6"
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 30
  },
  titleContainer: {
    alignItems: "center",
    marginBottom: 30
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 8,
    textAlign: "center"
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    paddingHorizontal: 10,
    lineHeight: 26
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    borderRadius: 20,
    borderWidth: 1.5,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16
  },
  cardContent: {
    flex: 1,
    marginRight: 10
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 6
  },
  cardDesc: {
    fontSize: 13,
    color: "#4B5563",
    lineHeight: 22,
    fontFamily: "Mandali"
  },
  viewBtn: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 20,
    marginTop: 5,
    elevation: 4,
    shadowColor: "#2563EB",
    shadowOpacity: 0.3,
    shadowRadius: 8
  },
  viewBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8
  },
  viewBtnText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 14,
    fontFamily: "Mandali"
  },
  dividerBox: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 15,
    paddingHorizontal: 20
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E7EB"
  },
  dividerText: {
    marginHorizontal: 15,
    color: "#9CA3AF",
    fontSize: 13,
    fontWeight: "600"
  }
});