import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { executeOfflineSafeRead, executeOfflineSafeWrite } from "@/utils/offlineHelper";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View
} from "react-native";
import { createShimmerPlaceholder } from "react-native-shimmer-placeholder";

const Shimmer = createShimmerPlaceholder(LinearGradient);
const { width } = Dimensions.get("window");

import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";

export default function MyMachines() {
  const router = useRouter();
  const [machines, setMachines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<"te" | "en">("te");
  const [deleteModal, setDeleteModal] = useState(false);
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    // 1. Language Load
    AsyncStorage.getItem("APP_LANG").then((l) => {
      if (l) setLanguage(l as any);
    });

    // 2. Real-time Listener Setup
    let unsubscribe: () => void;

    const setupListener = async () => {
      const phone = await AsyncStorage.getItem("USER_PHONE");
      if (!phone) {
        setLoading(false);
        return;
      }

      // Firestore Listener
      unsubscribe = firestore()
        .collection("machines")
        .where("userId", "==", phone)
        .onSnapshot(
          (snap) => {
            if (!snap) {
              setMachines([]);
              setLoading(false);
              return;
            }
            const list = snap.docs.map((doc: any) => ({
              id: doc.id,
              ...doc.data()
            }));

            // Sorting (Latest first)
            list.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            
            setMachines(list);
            setLoading(false);
          },
          (error) => {
            console.log("Firestore error:", error);
            setLoading(false);
          }
        );
    };

    setupListener();

    // 3. Cleanup
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  /* ---------------- DELETE ---------------- */
  const handleDelete = async () => {
    try {
      if (!selectedId) return;

      await executeOfflineSafeWrite(firestore().collection("machines").doc(selectedId).delete());

      setDeleteModal(false);
      setSelectedId(""); 
    } catch (error) {
      console.log("Error deleting machine:", error);
      alert(language === "te" ? "తొలగించడం కుదరలేదు" : "Failed to delete");
    }
  };

  const getImage = (type: string) => {
    if (!type) return require("@/assets/images/John-deere-Tractors..jpg");
    const t = type.toLowerCase();
    
    if (t.includes("mini tractor") || t.includes("మినీ ట్రాక్టర్")) return require("@/assets/images/mini.webp");
    if (t.includes("power tiller") || t.includes("పవర్ టిల్లర్")) return require("@/assets/images/tiller.avif");
    if (t.includes("combine harvester") || t.includes("కంబైన్డ్ హార్వెస్టర్") || t.includes("కోత మిషన్")) return require("@/assets/images/harvester.jpg");
    if (t.includes("paddy transplanter") || t.includes("వరి నాటు యంత్రం")) return require("@/assets/images/vari.png");
    if (t.includes("seed drill") || t.includes("విత్తన గొర్రు") || t.includes("సీడ్ డ్రిల్")) return require("@/assets/images/seeddrill.jpg");
    if (t.includes("tata") || t.includes("ace") || t.includes("ఏస్") || t.includes("ఏనుగు") || t.includes("mini truck")) return require("@/assets/images/tataace.jpg"); 
    if (t.includes("sprayer") || t.includes("స్ప్రేయర్")) return require("@/assets/images/sprayer.jpg");
    if (t.includes("tractor") || t.includes("ట్రాక్టర్")) return require("@/assets/images/John-deere-Tractors..jpg");
    if (t.includes("dozer") || t.includes("డొజర్") || t.includes("bulldozer")) return require("@/assets/images/dozer.avif"); 
    if (t.includes("drone sprayer") || t.includes("డ్రోన్ స్ప్రేయర్")) return require("@/assets/images/drone.jpg");
    if (t.includes("thresher") || t.includes("నూర్పిడి యంత్రం") || t.includes("థ్రెషర్")) return require("@/assets/images/tresher.jpg");
    if (t.includes("baler") || t.includes("గడ్డి కట్టల మిషన్") || t.includes("బేలర్")) return require("@/assets/images/baler.jpg");
    if (t.includes("jcb") || t.includes("జెసిబి") || t.includes("backhoe")) return require("@/assets/images/jcb.webp");
    if (t.includes("auto") || t.includes("ఆటో") || t.includes("trolley") || t.includes("ట్రాలీ") || t.includes("ape") || t.includes("అప్పే")) return require("@/assets/images/auto.webp"); 
    if (t.includes("excavator") || t.includes("poclain") || t.includes("పొక్లెయిన్") || t.includes("ఎక్స్కవేటర్") || t.includes("హిటాచి")) return require("@/assets/images/chain.jpg"); 
    if (t.includes("tipper") || t.includes("టిప్పర్") || t.includes("trolley") || t.includes("ట్రాలీ")) return require("@/assets/images/tataace.jpg");
    if (t.includes("digger") || t.includes("గుంతలు తీసే యంత్రం")) return require("@/assets/images/digger.jpg");
    if (t.includes("laser land leveler") || t.includes("లేజర్ ల్యాండ్ లెవెలర్")) return require("@/assets/images/laser.jpg");
    if (t.includes("chaff cutter") || t.includes("గడ్డి కత్తిరించే యంత్రం")) return require("@/assets/images/chaff.jpg");
    if (t.includes("maize sheller") || t.includes("మొక్కజొన్న వొలిచే యంత్రం")) return require("@/assets/images/maize.jpg");
    
    return require("@/assets/images/John-deere-Tractors..jpg");
  };

  // 🔥 DYNAMIC SERVICE MESSAGES LOGIC 🔥
  const getServiceDetails = (type: string, lang: string) => {
    if (type === "Rent") {
      return {
        text: lang === "te" ? "కేవలం అద్దెకు మాత్రమే అందుబాటులో ఉంది" : "Available for Rent Only",
        icon: "key-outline",
        color: "#D97706", // Amber
        bg: "#FFFBEB"
      };
    }
    if (type === "Work") {
      return {
        text: lang === "te" ? "పొలం పనులు చేసిపెట్టబడును" : "Available for Farm Services",
        icon: "cog-outline",
        color: "#2563EB", // Blue
        bg: "#EFF6FF"
      };
    }
    if (type === "Both") {
      return {
        text: lang === "te" ? "అద్దెకు మరియు పనులకు అందుబాటులో ఉంది" : "Available for Rent & Farm Services",
        icon: "swap-horizontal-outline",
        color: "#7C3AED", // Purple
        bg: "#F5F3FF"
      };
    }
    return null; // For old machines without serviceType
  };

  /* ---------------- RENDERS ---------------- */

  const renderShimmer = () => (
    <View style={styles.card}>
      <Shimmer style={styles.shimmerImage} />
      <View style={{ padding: 15 }}>
        <Shimmer style={styles.shimmerTitle} />
        <Shimmer style={[styles.shimmerTitle, { width: '40%', marginTop: 10 }]} />
      </View>
    </View>
  );

  const renderItem = ({ item }: any) => {
    const serviceInfo = getServiceDetails(item.serviceType, language);

    return (
      <View style={styles.card}>
        {/* 1. TOP IMAGE SECTION */}
        <View style={styles.imageWrapper}>
          <Image source={getImage(item.equipment)} style={styles.image} />
          <View style={styles.badge}>
            <AppText style={styles.badgeText}>
              {language === "te" ? "యాక్టివ్" : "Active"}
            </AppText>
          </View>
        </View>

        {/* 2. DETAILS SECTION */}
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <AppText style={styles.cardTitle}>{item.equipment}</AppText>
          </View>

          {/* 🔥 DYNAMIC SERVICE TYPE MESSAGE 🔥 */}
          {serviceInfo && (
            <View style={[styles.serviceRow, { backgroundColor: serviceInfo.bg, borderColor: serviceInfo.color + '40' }]}>
              <Ionicons name={serviceInfo.icon as any} size={16} color={serviceInfo.color} />
              <AppText style={[styles.serviceText, { color: serviceInfo.color }]}>
                {serviceInfo.text}
              </AppText>
            </View>
          )}

          <View style={styles.infoRow}>
            <View style={styles.locationTag}>
              <Ionicons name="location" size={14} color="#16A34A" />
              <AppText style={styles.locationLabel}>{item.village}</AppText>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="call" size={16} color="#4B5563" />
            <AppText style={styles.infoText}>{item.phone}</AppText>
          </View>

          {/* OPERATIONS TAGS */}
          <View style={styles.tagWrapper}>
            {item.operations?.slice(0, 3).map((op: string, i: number) => (
              <View key={i} style={styles.tag}>
                <AppText style={styles.tagText}>{op}</AppText>
              </View>
            ))}
          </View>

          {/* 3. MODERN ACTION BUTTONS */}
          <View style={styles.actionFooter}>
            <TouchableOpacity 
              activeOpacity={0.7}
              style={[styles.footerBtn, { borderColor: '#E5E7EB' }]}
              onPress={() => router.push({ pathname: "/farmer/bookings/add-machine", params: { machineId: item.id } })}
            >
              <Ionicons name="create-outline" size={18} color="#2563EB" />
              <AppText style={[styles.footerBtnText, { color: '#2563EB' }]}>
                {language === "te" ? "సవరించు" : "Edit"}
              </AppText>
            </TouchableOpacity>

            <TouchableOpacity 
              activeOpacity={0.7}
              style={[styles.footerBtn, { borderColor: '#FEE2E2', backgroundColor: '#FEF2F2' }]}
              onPress={() => { setSelectedId(item.id); setDeleteModal(true); }}
            >
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
              <AppText style={[styles.footerBtnText, { color: '#EF4444' }]}>
                {language === "te" ? "తొలగించు" : "Delete"}
              </AppText>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <AppHeader
        title={language === "te" ? "నా యంత్రాలు" : "My Machines"}
        subtitle={language === "te" ? "మీరు జోడించిన యంత్రాల జాబితా" : "List of machines you added"}
        language={language}
      />

      {loading ? (
        <FlatList
          data={[1, 2, 3]}
          renderItem={renderShimmer}
          keyExtractor={(item) => item.toString()}
          contentContainerStyle={{ padding: 16 }}
        />
      ) : machines.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="tractor" size={80} color="#D1D5DB" />
          <AppText style={styles.emptyText}>
            {language === "te" ? "యంత్రాలు ఏవీ లేవు" : "No machines added yet"}
          </AppText>
          <TouchableOpacity 
            style={styles.addBtn}
            onPress={() => router.push("/farmer/bookings/add-machine")}
          >
            <AppText style={{color: '#fff', fontWeight: '600'}}>
              {language === "te" ? "కొత్తది జోడించండి" : "Add New Machine"}
            </AppText>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={machines}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* DELETE MODAL */}
      <Modal visible={deleteModal} transparent animationType="fade">
        <View style={styles.modalOverlayStandard}>
          <View style={styles.modalContentStandard}>
            <View style={styles.modalIconBgStandard}>
              <Ionicons name="trash-outline" size={36} color="#e44830" />
            </View>
            <AppText style={styles.modalTitleStandard}>
              {language === "te" ? "నిజంగా తొలగించాలా?" : "Are you sure?"}
            </AppText>
            <AppText style={styles.modalSubStandard}>
              {language === "te" ? "ఈ సమాచారం శాశ్వతంగా తొలగించబడుతుంది." : "This machine details will be permanently deleted."}
            </AppText>

            <View style={styles.modalButtonsStandard}>
              <TouchableOpacity activeOpacity={0.8} style={styles.modalCancelBtnStandard} onPress={() => setDeleteModal(false)}>
                <AppText style={styles.modalCancelTextStandard}>{language === "te" ? "వద్దు" : "Cancel"}</AppText>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.8} style={styles.modalConfirmBtnStandard} onPress={handleDelete}>
                <AppText style={styles.modalConfirmTextStandard}>{language === "te" ? "అవును" : "Delete"}</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F3F4F6" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    marginBottom: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  imageWrapper: { width: "100%", height: 250, position: 'relative' },
  image: { width: "100%", height: "100%", resizeMode: "cover" },
  badge: { 
    position: 'absolute', 
    bottom: 10, 
    left: 15, 
    backgroundColor: 'rgba(22, 163, 74, 0.9)', 
    paddingHorizontal: 12, 
    paddingVertical: 4,
    borderRadius: 12 
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  
  content: { padding: 18 },
  headerRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: 6 
  },
  cardTitle: { fontSize: 19, fontWeight: "600", color: "#111827" },

  // 🔥 NEW SERVICE ROW STYLES
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    gap: 6,
    alignSelf: 'flex-start'
  },
  serviceText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: "Mandali",
  },

  locationTag: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 8,
    backgroundColor: '#F0FDF4', 
    paddingVertical: 4, 
    borderRadius: 8 
  },
  locationLabel: { fontSize: 12, color: '#16A34A', marginLeft: 4, fontWeight: '600' },
  
  infoRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  infoText: { fontSize: 14, color: "#4B5563", marginLeft: 8 },
  
  tagWrapper: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    marginTop: 5, 
    marginBottom: 15 
  },
  tag: { 
    backgroundColor: '#F3F4F6', 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 8, 
    marginRight: 8, 
    marginBottom: 5 
  },
  tagText: { fontSize: 11, color: '#4B5563' },

  actionFooter: { 
    flexDirection: 'row', 
    borderTopWidth: 1, 
    borderTopColor: '#F3F4F6', 
    paddingTop: 15,
    justifyContent: 'space-between'
  },
  footerBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    width: '48%' 
  },
  footerBtnText: { 
    fontSize: 14, 
    fontWeight: '600', 
    marginLeft: 8 
  },

  shimmerImage: { width: '100%', height: 250 },
  shimmerTitle: { width: '70%', height: 20, borderRadius: 5, marginTop: 15 },
  
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalBox: { backgroundColor: "#fff", padding: 25, borderRadius: 25, width: "100%", alignItems: "center" },
  modalTitle: { fontSize:20, fontWeight: "600", marginTop: 15 },
  modalSub: { color: '#6B7280', textAlign: 'center', marginTop: 8 },
  modalRow: { flexDirection: "row", marginTop: 25, width: '100%' },
  cancelBtn: { flex: 1, padding: 15, borderRadius: 15, backgroundColor: '#F3F4F6', alignItems: 'center', marginRight: 10 },
  deleteBtn: { flex: 1, padding: 15, borderRadius: 15, backgroundColor: '#EF4444', alignItems: 'center' },
  
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", marginTop: 100 },
  emptyText: { fontSize: 16, color: "#9CA3AF", marginTop: 15 },
  addBtn: { marginTop: 20, backgroundColor: '#16A34A', paddingHorizontal: 25, paddingVertical: 12, borderRadius: 15 },

  // UNIFIED PREMIUM MODAL CLASSES
  modalOverlayStandard: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center" },
  modalContentStandard: { width: "80%", backgroundColor: "white", borderRadius: 25, padding: 25, alignItems: "center" },
  modalTitleStandard: { fontSize: 20, fontWeight: "500", color: "#e2431f", marginVertical: 10 },
  modalSubStandard: { textAlign: "center", color: "#64748B", marginBottom: 25 },
  modalButtonsStandard: { flexDirection: "row", gap: 10 },
  modalCancelBtnStandard: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#F1F5F9", alignItems: "center" },
  modalConfirmBtnStandard: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#EF4444", alignItems: "center" },
  modalCancelTextStandard: { color: "#64748B", fontWeight: "500" },
  modalConfirmTextStandard: { color: "white", fontWeight: "500" },
  modalIconBgStandard: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#f5e8e8", justifyContent: "center", alignItems: "center", marginBottom: 10 },
});