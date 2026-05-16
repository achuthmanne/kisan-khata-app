import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";
import AppEmptyState from "@/components/AppEmptyState"; // 🔥 మన గ్లోబల్ కాంపోనెంట్
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from "react-native";
import { Menu, MenuOption, MenuOptions, MenuTrigger } from "react-native-popup-menu"; // 🔥 NEW PREMIUM MENU
import ShimmerPlaceholder from "react-native-shimmer-placeholder";

export default function VehiclesScreen() {

  const router = useRouter();

  const [data, setData] = useState<any[]>([]);
  const [grouped, setGrouped] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<"te" | "en">("te");

  // 🔥 NEW STATES FOR PREMIUM UI & LOCK LOGIC
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [typeModalVisible, setTypeModalVisible] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCannotDeleteModal, setShowCannotDeleteModal] = useState(false);

  /* ---------------- LOAD ---------------- */

  useEffect(() => {
    AsyncStorage.getItem("APP_LANG").then((l) => {
      if (l) setLanguage(l as any);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      let unsubscribe: any;

      const load = async () => {
        setLoading(true);

        const phone = await AsyncStorage.getItem("USER_PHONE");
        if (!phone) {
          setLoading(false);
          return;
        }

        const userDoc = await firestore().collection("users").doc(phone).get();
        const activeSession = userDoc.data()?.activeSession;

        if (!activeSession) {
          setLoading(false);
          return;
        }

        unsubscribe = firestore()
          .collection("users")
          .doc(phone)
          .collection("vehicles")
          .where("session", "==", activeSession)
          .where("createdAt", "!=", null)  
          .orderBy("createdAt", "desc")
          .onSnapshot((snap) => {

          if (!snap || !snap.docs) {
            setLoading(false);
            return;
          }

          const list: any[] = [];
          const group: any = {};

          snap.forEach(doc => {
            const d: any = doc.data();
            if (!d) return; 

            list.push({ id: doc.id, ...d });

            const type = d.type || "Others";
            if (!group[type]) group[type] = [];
            group[type].push({ id: doc.id, ...d });
          });

          setData(list);
          setGrouped(group);
          setLoading(false);
        });
      };

      load();
      return () => unsubscribe && unsubscribe();

    }, [])
  );

  /* ---------------- COLOR ---------------- */
  const typeColors: any = {
    tractor: "#16A34A",   // Green
    jcb: "#F59E0B",       // Orange/Yellow
    harvester: "#3B82F6", // Blue
    tiller: "#f4581a",    // Purple
    bullock: "#A16207",   // Brown
    truck: "#ad44ef",     // Red
    auto: "#06B6D4",      // Cyan
    pickup: "#6366F1",    // Indigo
    ace: "#EC4899",       // Pink
  };

  const getColor = (type: string) => {
    const label = type?.toLowerCase() || "";
    if (label.includes("tractor") || label.includes("ట్రాక్టర్")) return typeColors.tractor;
    if (label.includes("jcb") || label.includes("backhoe") || label.includes("జెసిబి")) return typeColors.jcb;
    if (label.includes("harvester") || label.includes("హార్వెస్టర్")) return typeColors.harvester;
    if (label.includes("tiller") || label.includes("టిల్లర్")) return typeColors.tiller;
    if (label.includes("bullock") || label.includes("బండి") || label.includes("ఎద్దుల")) return typeColors.bullock;
    if (label.includes("truck") || label.includes("tipper") || label.includes("trailer") || 
        label.includes("లారీ") || label.includes("టిప్పర్") || label.includes("ట్రైలర్")) return typeColors.truck;
    if (label.includes("auto") || label.includes("ఆటో")) return typeColors.auto;
    if (label.includes("pickup") || label.includes("bolero") || label.includes("పికప్") || label.includes("బొలెరో")) return typeColors.pickup;
    if (label.includes("ace") || label.includes("ఏస్") || label.includes("ఏనుగు")) return typeColors.ace;
    return "#520b33"; 
  };

  /* ---------------- SHIMMER ---------------- */
  const VehicleShimmer = () => (
    <View style={styles.shimmerCard}>
      <ShimmerPlaceholder LinearGradient={LinearGradient} shimmerColors={["#E5E7EB", "#F3F4F6", "#E5E7EB"]} style={styles.shimmerBar} />
      <View style={styles.shimmerContent}>
        <ShimmerPlaceholder LinearGradient={LinearGradient} shimmerColors={["#E5E7EB", "#F3F4F6", "#E5E7EB"]} style={styles.shimmerTitle} />
        <ShimmerPlaceholder LinearGradient={LinearGradient} shimmerColors={["#E5E7EB", "#F3F4F6", "#E5E7EB"]} style={styles.shimmerSub} />
        <ShimmerPlaceholder LinearGradient={LinearGradient} shimmerColors={["#E5E7EB", "#F3F4F6", "#E5E7EB"]} style={styles.shimmerPlate} />
      </View>
      <ShimmerPlaceholder LinearGradient={LinearGradient} shimmerColors={["#E5E7EB", "#F3F4F6", "#E5E7EB"]} style={styles.shimmerMenu} />
    </View>
  );

  const formatDisplay = (num: string) => {
    const match = num.match(/^([A-Z]{2})(\d{2})([A-Z]{2})(\d{4})$/);
    return match ? `${match[1]} ${match[2]} ${match[3]} ${match[4]}` : num;
  };

  // 🔥 CORE LOGIC: CHECK IF VEHICLE HAS FARMERS OR DRIVERS
  const checkVehicleHasRecords = async (vehicleId: string) => {
    try {
      const phone = await AsyncStorage.getItem("USER_PHONE");
      if (!phone) return false;

      const vehicleRef = firestore()
        .collection("users").doc(phone)
        .collection("vehicles").doc(vehicleId);

      // 1. రైతులు ఎవరైనా ఉన్నారా?
      const farmersSnap = await vehicleRef.collection("farmers").limit(1).get();
      if (!farmersSnap.empty) return true;

      // 2. డ్రైవర్లు ఎవరైనా ఉన్నారా?
      const driversSnap = await vehicleRef.collection("drivers").limit(1).get();
      if (!driversSnap.empty) return true;

      return false; // ఎవరూ లేకపోతే False
    } catch (error) {
      console.log("Error checking vehicle records", error);
      return true; // సేఫ్టీ కోసం లాక్
    }
  };

  // 🔥 Handle Edit Menu Click
  const handleEditClick = async (vehicle: any) => {
    setActionLoading(true);
    const hasRecords = await checkVehicleHasRecords(vehicle.id);
    setActionLoading(false);

    router.push({
      pathname: "/farmer/add-vehicle",
      params: {
        vehicleId: vehicle.id,
        name: vehicle.nickname,
        type: vehicle.type,
        number: vehicle.number || "",
        hasRecords: hasRecords ? "true" : "false" // 🔥 Flag పంపుతున్నాం
      }
    });
  };

  // 🔥 Handle Delete Menu Click
  const handleDeleteClick = async (vehicle: any) => {
    setActionLoading(true);
    const hasRecords = await checkVehicleHasRecords(vehicle.id);
    setActionLoading(false);

    if (hasRecords) {
      setShowCannotDeleteModal(true); // 🔒 రికార్డ్స్ ఉంటే లాక్
    } else {
      setSelectedItem(vehicle);
      setShowDeleteModal(true); // 🗑️ లేకపోతే డిలీట్
    }
  };

  // 🔥 MODERN MENU STYLES
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

      {/* ACTION LOADING OVERLAY */}
      {actionLoading && (
        <View style={styles.actionLoadingOverlay}>
          <ActivityIndicator size="large" color="#16A34A" />
        </View>
      )}

      <AppHeader
        title={language === "te" ? "నా వాహనాలు" : "My Vehicles"} 
        subtitle={
          language === "te" 
            ? "మీ వ్యవసాయ వాహనాల వివరాలు ఇక్కడ చూడండి" 
            : "Manage all your farming vehicles here"
        }
        language={language}
      />

      <FlatList
        data={loading ? ["1","2","3","4"] : Object.keys(grouped)}
        keyExtractor={(item, index) => loading ? index.toString() : item}
        contentContainerStyle={[
          { paddingBottom: 120 },
          !loading && Object.keys(grouped).length === 0 && { flexGrow: 1, justifyContent: 'center' }
        ]}

        ListEmptyComponent={
          !loading && Object.keys(grouped).length === 0 ? (
            <AppEmptyState
              iconName="tractor" 
              title={language === "te" ? "వాహనాలు లేవు" : "No Vehicles Yet"}
              subtitle={language === "te" ? "మీ వాహనాలను చేర్చడానికి + బటన్ నొక్కండి" : "Tap + button to add your vehicles"}
              language={language}
            />
          ) : null
        }

        renderItem={({ item }) => {

          if (loading) return <VehicleShimmer />;

          const vehicles = grouped[item];

          return (
            <View>
              {vehicles.map((v: any) => (
                <TouchableOpacity
                  key={v.id}
                  activeOpacity={0.7}
                  style={styles.card}
                  onPress={() => {
                    setSelectedVehicle(v);
                    setTypeModalVisible(true);
                  }}
                >
                  <View style={[styles.cardBar, { backgroundColor: getColor(v.type)}]} />

                  <View style={styles.cardInfo}>
                    <AppText style={styles.cardTitle}>{v.nickname}</AppText>
                    <AppText style={styles.cardSub}>
                      {language === "te" ? "రకం" : "Type"}: {v.type}
                    </AppText>

                    {v.number && (
                      <View style={styles.plate}>
                        <AppText style={styles.plateText}>{formatDisplay(v.number)}</AppText>
                      </View>
                    )}
                  </View>

                  {/* 🔥 NEW POPUP MENU */}
                  <Menu>
                    <MenuTrigger style={styles.menuBtn}>
                      <Ionicons name="ellipsis-vertical" size={18} color="#9CA3AF" />
                    </MenuTrigger>

                    <MenuOptions customStyles={optionsStyles}>
                      <MenuOption onSelect={() => handleEditClick(v)}>
                        <View style={styles.modernMenuItem}>
                          <Ionicons name="create-outline" size={18} color="#2563EB" />
                          <AppText style={styles.menuTextEdit} language={language}>
                            {language === "te" ? "మార్చు" : "Edit"}
                          </AppText>
                        </View>
                      </MenuOption>
                      
                      <View style={styles.menuDivider} />

                      <MenuOption onSelect={() => handleDeleteClick(v)}>
                        <View style={styles.modernMenuItem}>
                          <Ionicons name="trash-outline" size={18} color="#EF4444" />
                          <AppText style={styles.menuTextDelete} language={language}>
                            {language === "te" ? "తొలగించు" : "Delete"}
                          </AppText>
                        </View>
                      </MenuOption>
                    </MenuOptions>
                  </Menu>

                </TouchableOpacity>
              ))}

            </View>
          );
        }}
      />

      {/* 🔴 STANDARD DELETE MODAL */}
      <Modal visible={showDeleteModal} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.overlay}>
          <View style={styles.deleteBox}>
            <View style={styles.iconBg}>
              <Ionicons name="trash-outline" size={36} color="#DC2626" />
            </View>

            <AppText style={styles.deleteTitle}>
              {language === "te" ? "వాహనాన్ని తొలగించాలా?" : "Delete Vehicle?"}
            </AppText>
            
            <AppText style={styles.deleteSub}>
              {language === "te" 
                ? "ఈ వాహనం వివరాలు శాశ్వతంగా తొలగించబడతాయి." 
                : "This vehicle details will be permanently removed."}
            </AppText>

            <View style={styles.deleteBtns}>
              <TouchableOpacity activeOpacity={0.8}
                style={styles.cancelBtn}
                onPress={() => setShowDeleteModal(false)}
              >
                <AppText style={styles.cancelBtnText}>
                  {language === "te" ? "వద్దు" : "Cancel"}
                </AppText>
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.8}
                style={styles.deleteBtn}
                onPress={async () => {
                  const phone = await AsyncStorage.getItem("USER_PHONE");
                  if (!phone || !selectedItem) return;

                  try {
                    const docRef = firestore()
                      .collection("users")
                      .doc(phone)
                      .collection("vehicles")
                      .doc(selectedItem.id);

                    // 🔥 INSTANT UI REMOVE
                    setGrouped((prev: any) => {
                      const newGroup = { ...prev };
                      Object.keys(newGroup).forEach((type) => {
                        newGroup[type] = newGroup[type].filter(
                          (item: any) => item.id !== selectedItem.id
                        );
                        if (newGroup[type].length === 0) {
                          delete newGroup[type];
                        }
                      });
                      return newGroup;
                    });

                    setShowDeleteModal(false);

                    // 🔥 FIRESTORE DELETE
                    await docRef.delete();
                  } catch (e) {
                    console.log(e);
                  }
                }}
              >
                <AppText style={styles.deleteBtnText}>
                  {language === "te" ? "అవును" : "Delete"}
                </AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 🔒 CANNOT DELETE WARNING MODAL */}
      <Modal visible={showCannotDeleteModal} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.overlay}>
          <View style={styles.deleteBox}>
            <View style={[styles.iconBg, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="lock-closed" size={36} color="#F59E0B" />
            </View>
            <AppText style={styles.deleteTitle} language={language}>
              {language === "te" ? "తొలగించడం కుదరదు" : "Cannot Delete"}
            </AppText>
            <AppText style={[styles.deleteSub, { lineHeight: 22 }]} language={language}>
              {language === "te"
                ? "ఈ వాహనానికి సంబంధించి రైతులు లేదా డ్రైవర్ల వివరాలు ఇప్పటికే నమోదు అయ్యాయి. కావున ఈ వాహనాన్ని తొలగించడం కుదరదు."
                : "This vehicle has associated farmers or drivers. Therefore, it cannot be deleted."}
            </AppText>
            <View style={[styles.deleteBtns, { justifyContent: 'center' }]}>
              <TouchableOpacity activeOpacity={0.8}
                style={[styles.cancelBtn, { flex: 1, backgroundColor: '#F59E0B' }]} 
                onPress={() => setShowCannotDeleteModal(false)}
              >
                <AppText style={{ color: 'white', fontWeight: '600' }} language={language}>
                  {language === "te" ? "అర్థమైంది" : "Got It"}
                </AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 🚀 PREMIUM "CHOOSE WORK TYPE" MODAL */}
      {selectedVehicle && (
        <Modal visible={typeModalVisible} transparent animationType="fade" statusBarTranslucent>
          <TouchableWithoutFeedback onPress={() => setTypeModalVisible(false)}>
            <View style={styles.overlay}>
              <TouchableWithoutFeedback>
                <View style={styles.premiumModalBox}>

                  <AppText style={styles.premiumModalTitle}>
                    {language === "te" ? "పని ఎంపిక చేసుకోండి" : "Choose Work Type"}
                  </AppText>
                  
                  <AppText style={styles.premiumModalSub}>
                    {language === "te" ? "మీరు ఎవరి పనులను నమోదు చేయాలి అనుకుంటున్నారు?" : "Whose records do you want to manage?"}
                  </AppText>

                  {/* 🚜 FARMER */}
                  <TouchableOpacity activeOpacity={0.7}
                    style={styles.premiumSelectCard}
                    onPress={() => {
                      setTypeModalVisible(false);
                      router.push({
                        pathname: "/farmer/vechile-farmers/farmers", // (Change this to vehicle-farmers if renamed)
                        params: {
                          id: selectedVehicle.id,
                          name: selectedVehicle.nickname,
                          number: selectedVehicle.number || "",
                          type: selectedVehicle.type
                        }
                      });
                    }}
                  >
                    <View style={[styles.premiumIconBox, { backgroundColor: "#DCFCE7" }]}>
                      <Ionicons name="people" size={24} color="#16A34A" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText style={styles.premiumCardTitle}>
                        {language === "te" ? "రైతుల పనులు" : "Farmer Works"}
                      </AppText>
                      <AppText style={styles.premiumCardSub}>
                        {language === "te"
                          ? "రైతుల పొలాల్లో చేసిన పనులు"
                          : "Works done in farmer fields"}
                      </AppText>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                  </TouchableOpacity>

                  {/* 👷 DRIVER */}
                  <TouchableOpacity activeOpacity={0.7}
                      style={styles.premiumSelectCard}
                      onPress={() => {
                        setTypeModalVisible(false);
                        router.push({
                          pathname: "/farmer/vechile-drivers/drivers",
                          params: {
                            id: selectedVehicle.id,
                            name: selectedVehicle.nickname,
                            number: selectedVehicle.number || "",
                            type: selectedVehicle.type
                          }
                        });
                      }}
                    >
                    <View style={[styles.premiumIconBox, { backgroundColor: "#DBEAFE" }]}>
                      <Ionicons name="person" size={24} color="#2563EB" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText style={styles.premiumCardTitle}>
                        {language === "te" ? "డ్రైవర్ పనులు" : "Driver Works"}
                      </AppText>
                      <AppText style={styles.premiumCardSub}>
                        {language === "te"
                          ? "డ్రైవర్ల హాజరు మరియు పనులు"
                          : "Manage driver attendance"}
                      </AppText>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                  </TouchableOpacity>

                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}

      {/* ADD BUTTON */}
      <TouchableOpacity activeOpacity={0.8}
        style={styles.addBtn}
        onPress={() => router.push("/farmer/vechiles/add-vehicle")}
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

  card: {
    marginHorizontal: 16,
    marginVertical: 6,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",  
    borderWidth: 1,
    borderColor: "#E5E7EB"
  },
  cardBar: {
    width: 4,
    alignSelf: "stretch",
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12
  },
  cardInfo: { flex: 1, marginLeft: 15 },
  cardTitle: { fontSize: 16, fontWeight: "600", color: "#111827" },
  cardSub: { fontSize: 12, color: "#6B7280", marginTop: 2 },

  plate: {
    marginTop: 6,
    alignSelf: "flex-start",  
    backgroundColor: "#FACC15",
    paddingHorizontal: 8,      
    paddingVertical: 3,        
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#EAB308"
  },
  plateText: {
    fontSize: 11,              
    fontWeight: "700",
    letterSpacing: 1,
    color: "#111827"
  },
  
  // NEW MENU STYLES
  menuBtn: {
    justifyContent: "center",
    alignItems: "center",
    padding: 6,
    borderRadius: 10,
    width: 32,
    height: 32,
    backgroundColor: "#F3F4F6"
  },
  modernMenuItem: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 14, gap: 10 },
  menuTextEdit: { fontSize: 14, color: "#1E293B", fontWeight: "500" },
  menuTextDelete: { fontSize: 14, color: "#EF4444", fontWeight: "500" },
  menuDivider: { height: 1, backgroundColor: "#F1F5F9", marginHorizontal: 10 },

  shimmerCard: {
    marginHorizontal: 16,
    marginVertical: 6,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB"
  },
  shimmerBar: { width: 4, height: "100%", borderRadius: 2 },
  shimmerContent: { flex: 1, marginLeft: 12 },
  shimmerTitle: { height: 16, width: "55%", borderRadius: 6 },
  shimmerSub: { height: 12, width: "35%", marginTop: 6, borderRadius: 6 },
  shimmerPlate: { height: 18, width: 100, marginTop: 8, borderRadius: 6 },
  shimmerMenu: { width: 32, height: 32, borderRadius: 10 },

  // MODALS
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)"
  },
  actionLoadingOverlay: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(255,255,255,0.7)", justifyContent: "center", alignItems: "center", zIndex: 1000 },
  
  deleteBox: {
    width: "80%",
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 20,
    alignItems: "center",
    elevation: 10
  },
  iconBg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center"
  },
  deleteTitle: { fontSize: 18, fontWeight: "600", marginTop: 12, color: '#111827' },
  deleteSub: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20
  },
  deleteBtns: { flexDirection: "row", marginTop: 20, gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 12, backgroundColor: "#F1F5F9", borderRadius: 12, alignItems: "center" },
  deleteBtn: { flex: 1, paddingVertical: 12, backgroundColor: "#DC2626", borderRadius: 12, alignItems: "center" },
  cancelBtnText: { fontWeight: "600", color: "#475569" },
  deleteBtnText: { fontWeight: "600", color: "#fff" },

  // PREMIUM CHOOSE WORK MODAL
  premiumModalBox: {
    width: "85%",
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 20,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  premiumModalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  premiumModalSub: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 20,
  },
  premiumSelectCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
    backgroundColor: "#F9FAFB"
  },
  premiumIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14
  },
  premiumCardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937"
  },
  premiumCardSub: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 3
  },

  addBtn: { position: "absolute", bottom: 30, right: 20 },
  addGradient: { width: 60, height: 60, borderRadius: 30, justifyContent: "center", alignItems: "center", elevation: 5, shadowColor: "#000", shadowOffset:{width:0, height:2}, shadowOpacity:0.2, shadowRadius:4 }
});