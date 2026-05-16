import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { useEffect, useState } from "react";
import {
  Modal,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View
} from "react-native";

export default function BookingEntry() {
  const router = useRouter();
  const [language, setLanguage] = useState<"te" | "en">("te");
  const [hasMachines, setHasMachines] = useState(false);
  const [machineCount, setMachineCount] = useState(0);

     useEffect(() => {
        AsyncStorage.getItem("APP_LANG").then(l => { if (l) setLanguage(l as any); });
    }, []);

  useEffect(() => {
  const load = async () => {
    const phone = await AsyncStorage.getItem("USER_PHONE");
    if (!phone) return;

    return firestore()
      .collection("machines")
      .where("userId", "==", phone)
      .onSnapshot((snap) => {
        setMachineCount(snap.size); // 🔥 COUNT
      });
  };

  let unsubscribe: any;

  load().then((unsub) => {
    unsubscribe = unsub;
  });

  return () => {
    if (unsubscribe) unsubscribe();
  };
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
  <AppText style={styles.title}>
    {language === "te" ? "మీరు ఎవరు?" : "Who are you?"}
  </AppText>

  <AppText style={styles.subtitle}>
    {language === "te" ? "మీ పాత్రను ఎంచుకోండి" : "Select your role"}
  </AppText>

  {/* OWNER */}
<TouchableOpacity
  activeOpacity={0.85}
  style={styles.card}
  onPress={() => router.push("/farmer/bookings/add-machine")}
>
  <View style={styles.iconBoxGreen}>
    <MaterialCommunityIcons name="tractor-variant" size={28} color="#16A34A" />
  </View>

  <View style={{ flex: 1 }}>
    <AppText style={styles.cardTitle}>
      {language === "te" ? "యజమాని" : "Owner"}
    </AppText>

    <AppText style={styles.cardSub}>
      {language === "te"
        ? "మీ యంత్రాన్ని జోడించండి"
        : "Add your machine"}
    </AppText>
  </View>

  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
</TouchableOpacity>
{machineCount > 0 && (
  <TouchableOpacity activeOpacity={0.7}
    style={styles.viewBtn}
    onPress={() => router.push("/farmer/bookings/my-machines")}
  >
    <Ionicons name="eye-outline" size={18} color="#2563EB" />

    <AppText style={styles.viewBtnText}>
      {language === "te"
        ? `మీ యంత్రాలు చూడండి (${machineCount})`
        : `View My Machines (${machineCount})`}
    </AppText>
  </TouchableOpacity>
)}
  {/* FARMER */}
  <TouchableOpacity
    activeOpacity={0.85}
    style={styles.card}
    onPress={() => router.push("/farmer/bookings/find-machines")}
  >
    <View style={styles.iconBoxOrange}>
      <Ionicons name="person-outline" size={26} color="#F59E0B" />
    </View>

    <View style={{ flex: 1 }}>
      <AppText style={styles.cardTitle}>
        {language === "te" ? "రైతు" : "Farmer"}
      </AppText>
      <AppText style={styles.cardSub}>
        {language === "te" ? "సమీప యంత్రాలను కనుగొనండి" : "Find nearby machines"}
      </AppText>
    </View>

    <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
  </TouchableOpacity>

</View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F4F6F5"
  },
container: {
  flex: 1,
  marginTop: 50,
  padding: 20
},
  

  title: {
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 4
  },

  subtitle: {
    textAlign: "center",
    color: "#6B7280",
    marginBottom: 20
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12
  },
viewBtn: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  paddingVertical: 12,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: "#DBEAFE",
  backgroundColor: "#EFF6FF",
  marginBottom: 16
},

viewBtnText: {
  marginLeft: 6,
  color: "#2563EB",
  fontWeight: "600"
},
  iconBoxGreen: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#DCFCE7",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12
  },

  iconBoxOrange: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#FEF3C7",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12
  },

  cardTitle: {
    fontSize: 15,
    fontWeight: "600"
  },
  // పాత స్టైల్స్ కింద ఇవి యాడ్ చెయ్యి
  cancelBtn: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    // కావాలనుకుంటే బోర్డర్ ఇవ్వొచ్చు లేదా ప్లెయిన్ గా ఉంచొచ్చు
    backgroundColor: "#bf0505", 
  },

  cancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff", // Grey color for cancel
    fontFamily: "Mandali"
  },

  cardSub: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2
  }
});