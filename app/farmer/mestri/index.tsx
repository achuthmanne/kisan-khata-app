// app/farmer/attendance.tsx
import AppEmptyState from "@/components/AppEmptyState";
import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { useIsFocused } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList, Linking,
  Modal,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { Menu, MenuOption, MenuOptions, MenuTrigger } from "react-native-popup-menu";
import ShimmerPlaceholder from "react-native-shimmer-placeholder";

export default function AttendanceScreen() {
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  const [language, setLanguage] = useState<"te" | "en">("te");
  const [mestris, setMestris] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [deleteItem, setDeleteItem] = useState<any>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const isScreenFocused = useIsFocused();
  const [activeSession, setActiveSession] = useState("");

  // 🔥 NEW STATES FOR LOGIC
  const [actionLoading, setActionLoading] = useState(false);
  const [showCannotDeleteModal, setShowCannotDeleteModal] = useState(false);

  useSpeechRecognitionEvent("result", (event) => {
    if (!isScreenFocused || !isListening) return;

    if (event.results && event.results.length > 0) {
      setSearch(event.results[0].transcript);
    }
  });

  useSpeechRecognitionEvent("end", () => setIsListening(false));

  const handleVoiceSearch = async () => {
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!result.granted) return;

    setIsListening(true);
    ExpoSpeechRecognitionModule.start({
      lang: language === "te" ? "te-IN" : "en-US",
      interimResults: true,
    });
  };

  useEffect(() => {
    if (!isScreenFocused) {
      ExpoSpeechRecognitionModule.stop();
      setIsListening(false);
    }
    return () => {
      ExpoSpeechRecognitionModule.stop(); 
    };
  }, [isScreenFocused]);

  const filteredMestris = mestris.filter((item) =>
    (item.name || "").toLowerCase().includes(search.trim().toLowerCase())
  );

  useEffect(() => {
    const loadLang = async () => {
      const lang = await AsyncStorage.getItem("APP_LANG");
      if (lang) setLanguage(lang as "te" | "en");
    };
    loadLang();
  }, []);

  useEffect(() => {
    let unsubscribe: any;

    const loadData = async () => {
      const userPhone = (await AsyncStorage.getItem("USER_PHONE")) ?? "";
      if (!userPhone) return;

      setLoading(true);

      const userDoc = await firestore().collection("users").doc(userPhone).get();
      const session = userDoc.data()?.activeSession;

      if (!session) {
        setLoading(false);
        return;
      }

      setActiveSession(session);

      unsubscribe = firestore()
        .collection("users")
        .doc(userPhone)
        .collection("mestris")
        .where("session", "==", session)
        .where("createdAt", "!=", null)
        .orderBy("createdAt", "desc")
        .onSnapshot((snapshot) => {
          if (!snapshot) {
            setMestris([]);
            setLoading(false);
            return;
          }
          const list = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setMestris(list);
          setLoading(false);
        });
    };

    loadData();

    return () => {
      if (unsubscribe) unsubscribe(); 
    };
  }, []); 

  // 🔥 CORE LOGIC: Check if Mestri has Attendance or Payments
  const checkHasRecords = async (mestriId: string) => {
    try {
      const phone = await AsyncStorage.getItem("USER_PHONE");
      if (!phone || !activeSession) return false;

      // 1. Check Attendance
      const attSnap = await firestore()
        .collection("users").doc(phone)
        .collection("mestris").doc(mestriId)
        .collection("attendance")
        .where("session", "==", activeSession)
        .limit(1) // ఒక్క రికార్డ్ ఉన్నా చాలు
        .get();

      if (!attSnap.empty) return true;

      // 2. Check Payments
      const paySnap = await firestore()
        .collection("users").doc(phone)
        .collection("payments")
        .where("mestriId", "==", mestriId)
        .where("session", "==", activeSession)
        .limit(1)
        .get();

      if (!paySnap.empty) return true;

      return false; // ఏమీ లేకపోతే
    } catch (error) {
      console.log("Error checking records", error);
      return true; // సేఫ్టీ కోసం ఎర్రర్ వస్తే true (బ్లాక్) చేస్తాం
    }
  };

  // 🔥 Action: Handle Edit Click
  const handleEditClick = async (item: any) => {
    setActionLoading(true);
    const hasRecords = await checkHasRecords(item.id);
    setActionLoading(false);

    router.push({
      pathname: "/farmer/mestri/edit/[id]",
      // 🔥 Send hasRecords flag to Edit Screen to disable Name Input
      params: { id: item.id, hasRecords: hasRecords ? "true" : "false" } 
    });
  };

  // 🔥 Action: Handle Delete Click
  const handleDeleteClick = async (item: any) => {
    setActionLoading(true);
    const hasRecords = await checkHasRecords(item.id);
    setActionLoading(false);

    if (hasRecords) {
      setShowCannotDeleteModal(true); // రికార్డ్స్ ఉంటే వార్నింగ్
    } else {
      setDeleteItem(item);
      setShowDeleteModal(true); // ఏమీ లేకపోతే డిలీట్ కన్ఫర్మేషన్
    }
  };

  const confirmDelete = async () => {
    if (!deleteItem) return;

    try {
      setLoading(true);
      const userPhone = (await AsyncStorage.getItem("USER_PHONE")) ?? "";

      if (!userPhone || !activeSession) return;

      const mestriRef = firestore()
        .collection("users")
        .doc(userPhone)
        .collection("mestris")
        .doc(deleteItem.id);

      await mestriRef.delete(); 

      setShowDeleteModal(false);
      setDeleteItem(null);

    } catch (e) {
      console.log("Delete error:", e);
    } finally {
      setLoading(false);
    }
  };

  const avatarColors = [
    "#22C55E", "#3B82F6", "#F59E0B", "#EF4444",
    "#8B5CF6", "#14B8A6", "#F97316", "#6366F1",
    "#10B981", "#E11D48"
  ];

  const getColor = (id: string) => {
    const index = id.charCodeAt(0) % avatarColors.length;
    return avatarColors[index];
  };

  const handleCall = (phone: string) => {
    if (!phone) return;
    const url = `tel:${phone}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) Linking.openURL(url);
      })
      .catch((err) => console.log(err));
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

  const ShimmerRow = () => (
    // 🔥 ఒరిజినల్ కార్డ్ కి ఉన్న "styles.row" నే ఇక్కడ కూడా వాడుతున్నాం!
    <View style={styles.row}>
      <View style={styles.left}>
        <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ width: 42, height: 42, borderRadius: 21, marginRight: 12 }} />
        <View style={{ flex: 1, gap: 4, marginLeft: 8 }}>
          <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ width: "60%", height: 14, borderRadius: 6 }} />
          <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ width: "40%", height: 12, borderRadius: 6, marginTop: 2 }} />
          <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ width: "30%", height: 12, borderRadius: 6, marginTop: 2 }} />
        </View>
      </View>
      
      {/* రైట్ సైడ్ లో ఉండే కాల్ బటన్ మరియు మెనూ ఐకాన్ కోసం షిమ్మర్స్ */}
      <View style={styles.right}>
        <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ width: 34, height: 34, borderRadius: 10 }} />
        <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ width: 20, height: 20, borderRadius: 10, marginLeft: 5 }} />
      </View>
    </View>
  );

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
        title={language === "te" ? "మేస్త్రీల నిర్వహణ" : "Mestri Management"}
        subtitle={language === "te" ? "రోజువారీ హాజరు & వివరాలు" : "Daily Attendance & Records"}
        language={language}
      />

      {/* 🔥 HIDE SEARCH BAR IF NO DATA EXISTS */}
      {(!loading && mestris.length === 0) ? null : (
        <View style={[styles.searchContainer, isFocused && styles.searchFocused]}>
          <Ionicons name="search-outline" size={20} color={isFocused ? "#16A34A" : "#9CA3AF"} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={language === "te" ? "మేస్త్రీ పేరుతో వెతకండి..." : "Search by mestri name..."}
            placeholderTextColor="#9CA3AF"
            cursorColor="#16A34A"
            selectionColor="#16A34A40"
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            style={styles.searchInput}
          />
          {search.trim().length > 0 ? (
            <TouchableOpacity onPress={() => setSearch("")} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handleVoiceSearch} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialCommunityIcons 
                name={isListening ? "microphone" : "microphone-outline"} 
                size={22} 
                color={isListening ? "#EF4444" : (isFocused ? "#16A34A" : "#9CA3AF")} 
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      {loading ? (
        // 🔥 FIX: FlatList ki unna same padding ikkada isthe, shimmer exact ga card size ki vastundi!
        <View style={{ padding: 20, paddingTop: 10 }}>
          <ShimmerRow />
          <ShimmerRow />
          <ShimmerRow />
          <ShimmerRow />
        </View>
      ) : (
        <FlatList
          data={filteredMestris}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled" 
          contentContainerStyle={[
            { padding: 20, paddingBottom: 100 },
            // 🔥 సెంటర్ లోకి రావడానికి లాజిక్
            filteredMestris.length === 0 && { flexGrow: 1, justifyContent: 'center' }
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <AppEmptyState
              iconName={search.trim().length > 0 ? "search-outline" : "people-outline"}
              title={
                search.trim().length > 0
                  ? language === "te" ? "ఏమి దొరకలేదు" : "Not Found"
                  : language === "te" ? "మేస్త్రీలు లేరు" : "No Mestris"
              }
              subtitle={
                search.trim().length > 0
                  ? language === "te" ? "మీ శోధనకు సరిపడే ఫలితాలు లేవు" : "No results match your search"
                  : language === "te" ? "+ బటన్ నొక్కి మేస్త్రీలను చేర్చండి" : "Tap + button to add mestris"
              }
              language={language}
              marginTop={mestris.length === 0 ? 0 : 60} 
            />
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <TouchableOpacity
                style={styles.left}
                activeOpacity={0.7}
                onPress={() =>
                  router.push({
                    pathname: "/farmer/mestri/[id]",
                    params: { id: item.id }
                  })
                }
              >
                <View style={[styles.avatar, { backgroundColor: getColor(item.id) }]}>
                  <AppText style={styles.avatarText} language={language}>
                    {item.name?.charAt(0)?.toUpperCase()}
                  </AppText>
                </View>

                <View style={styles.details}>
                  <AppText style={styles.name} language={language}>{item.name}</AppText>
                  <AppText style={styles.phone} language={language}>+91 - {item.phone || "----"}</AppText>
                  <AppText style={styles.sub} language={language}>{item.village || "----"}</AppText>
                </View>
              </TouchableOpacity>

              <View style={styles.right}>
                <TouchableOpacity
                  style={styles.callBtn}
                  onPress={() => handleCall(item.phone || "")}
                >
                  <Ionicons name="call" size={16} color="#16A34A" />
                </TouchableOpacity>

                <Menu>
                  <MenuTrigger style={{ padding: 5 }}>
                    <Ionicons name="ellipsis-vertical" size={20} color="#6B7280" />
                  </MenuTrigger>

                  <MenuOptions customStyles={optionsStyles}>
                    <MenuOption onSelect={() => handleEditClick(item)}>
                      <View style={styles.modernMenuItem}>
                        <Ionicons name="create-outline" size={18} color="#2563EB" />
                        <AppText style={styles.menuTextEdit} language={language}>
                          {language === "te" ? "మార్చు" : "Edit"}
                        </AppText>
                      </View>
                    </MenuOption>
                    
                    <View style={styles.menuDivider} />

                    <MenuOption onSelect={() => handleDeleteClick(item)}>
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
          )}
        />
      )}

      <TouchableOpacity activeOpacity={0.8}
        style={styles.addBtn}
        onPress={() => router.push("/farmer/mestri/add-mestri")}
      >
        <LinearGradient
          colors={["#16A34A","#166534"]}
          style={styles.addGradient}
        >
          <Ionicons name="add" size={30} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      {/* 🔴 STANDARD DELETE CONFIRMATION MODAL */}
      <Modal visible={showDeleteModal} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <View style={styles.iconBgWarning}>
              <Ionicons name="warning" size={36} color="#DC2626" />
            </View>
            <AppText style={styles.modalTitle} language={language}>
              {language === "te" ? "తొలగించాలా?" : "Delete Mestri?"}
            </AppText>
            <AppText style={styles.modalSub} language={language}>
              {language === "te"
                ? "ఈ మేస్త్రీని పూర్తిగా తొలగించాలా?"
                : "Are you sure you want to delete this mestri?"}
            </AppText>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowDeleteModal(false)}>
                <AppText language={language}>{language === "te" ? "వద్దు" : "Cancel"}</AppText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={confirmDelete}>
                <AppText style={{ color: "white", fontWeight: '600' }} language={language}>{language === "te" ? "తొలగించు" : "Delete"}</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 🔒 CANNOT DELETE WARNING MODAL */}
      <Modal visible={showCannotDeleteModal} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <View style={[styles.iconBgWarning, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="lock-closed" size={36} color="#F59E0B" />
            </View>
            <AppText style={styles.modalTitle} language={language}>
              {language === "te" ? "తొలగించడం కుదరదు" : "Cannot Delete"}
            </AppText>
            <AppText style={[styles.modalSub, { lineHeight: 22 }]} language={language}>
              {language === "te"
                ? "ఈ మేస్త్రీకి సంబంధించి హాజరు లేదా చెల్లింపుల రికార్డ్స్ ఇప్పటికే ఉన్నాయి. కావున వారిని తొలగించడం కుదరదు."
                : "This mestri has existing attendance or payment records. Therefore, they cannot be deleted."}
            </AppText>
            <View style={styles.modalBtns}>
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

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F7F6" },
  searchContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#F9FAFB", marginHorizontal: 20, marginTop: 15, marginBottom: 0, paddingHorizontal: 12, height: 50, borderRadius: 8, borderWidth: 1, borderColor: "#E5E7EB" },
  searchFocused: { borderColor: "#16A34A", backgroundColor: "#FFFFFF" },
  searchInput: { flex: 1, height: "100%", marginLeft: 10, fontSize: 15, paddingTop: 0, paddingBottom: 0, textAlignVertical: "center", color: "#1F2937", fontFamily: "Mandali", includeFontPadding: false },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 14, justifyContent: "space-between", marginVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor:"#E5E7EB", borderRadius: 12, backgroundColor:"#ffffff" },
  left: { flexDirection: "row", alignItems: "center", flex: 1 },
  avatar: { width: 42, height: 42, borderRadius: 21, justifyContent: "center", alignItems: "center", marginRight: 12 },
  avatarText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  details: { flex: 1, gap: 4, marginLeft: 8 },
  right: { flexDirection: "row", alignItems: "center", gap: 8 },
  callBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#ECFDF5", justifyContent: "center", alignItems: "center" },
  name: { fontSize: 15, fontWeight: "600", color: "#0F172A", lineHeight: 24 },
  sub: { fontSize: 12, color: "#64748B", lineHeight: 20 },
  phone: { fontSize: 12, color: "#16A34A", lineHeight: 14 },
  addBtn: { position: "absolute", bottom: 30, right: 20 },
  addGradient: { width: 60, height: 60, borderRadius: 30, justifyContent: "center", alignItems: "center", elevation: 5, shadowColor: "#000", shadowOffset:{width:0, height:2}, shadowOpacity:0.2, shadowRadius:4 },
  
  // MENU STYLES
  modernMenuItem: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 14, gap: 10 },
  menuTextEdit: { fontSize: 14, color: "#1E293B", fontWeight: "500" },
  menuTextDelete: { fontSize: 14, color: "#EF4444", fontWeight: "500" },
  menuDivider: { height: 1, backgroundColor: "#F1F5F9", marginHorizontal: 10 },

  // MODAL STYLES
  overlay: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", zIndex: 999 },
  actionLoadingOverlay: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(255,255,255,0.7)", justifyContent: "center", alignItems: "center", zIndex: 1000 },
  modalBox: { width: "80%", backgroundColor: "#fff", borderRadius: 20, padding: 24, alignItems: "center", elevation: 10 },
  iconBgWarning: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#FEE2E2", justifyContent: "center", alignItems: "center", marginBottom: 10 },
  modalTitle: { fontSize: 18, fontWeight: "600", marginTop: 10, color: '#111827' },
  modalSub: { fontSize: 13, color: "#6B7280", textAlign: "center", marginTop: 8 },
  modalBtns: { flexDirection: "row", marginTop: 20, gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: 'center' },
  deleteBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: "#DC2626", alignItems: "center", justifyContent: 'center' }
});