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
  View,
  Keyboard
} from "react-native";
import { Menu, MenuOption, MenuOptions, MenuTrigger } from "react-native-popup-menu";
import ShimmerPlaceholder from "react-native-shimmer-placeholder";

export default function AttendanceScreen() {
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  const [language, setLanguage] = useState<"te" | "en">("te");
  const [mestris, setMestris] = useState<any[]>([]);
  
  // 🔥 FIX 1: Initial loading must be true to prevent Empty State flash
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [deleteItem, setDeleteItem] = useState<any>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const isScreenFocused = useIsFocused();
  const [activeSession, setActiveSession] = useState("");

  const [actionLoading, setActionLoading] = useState(false);
  const [showCannotDeleteModal, setShowCannotDeleteModal] = useState(false);

  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // 🔥 FIX 2: Voice Search Punctuation Bug
  useSpeechRecognitionEvent("result", (event) => {
    if (!isScreenFocused || !isListening) return;

    if (event.results && event.results.length > 0) {
      const transcript = event.results[0].transcript.replace(/[.,?!]/g, "").trim();
      setSearch(transcript);
    }
  });

  useSpeechRecognitionEvent("end", () => setIsListening(false));

  const handleVoiceSearch = async () => {
    try {
      Keyboard.dismiss(); 
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!result.granted) return;

      setIsListening(true);
      ExpoSpeechRecognitionModule.start({
        lang: language === "te" ? "te-IN" : "en-US",
        interimResults: true,
      });
    } catch (e) {
      console.log("Voice Error:", e);
      setErrorMsg(language === "te" ? "మీ ఫోన్ వాయిస్ రికగ్నిషన్ సపోర్ట్ చేయడం లేదు." : "Voice search is not supported on your device.");
      setShowErrorModal(true);
    }
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

  useEffect(() => {
    const loadLang = async () => {
      const lang = await AsyncStorage.getItem("APP_LANG");
      if (lang) setLanguage(lang as "te" | "en");
    };
    loadLang();
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const loadData = async () => {
      try {
        setLoading(true);
        const userPhone = (await AsyncStorage.getItem("USER_PHONE")) ?? "";
        if (!userPhone) {
          setLoading(false);
          return;
        }

        const userDoc = await firestore().collection("users").doc(userPhone).get();
        const session = userDoc.data()?.activeSession;

        if (!session) {
          setMestris([]);
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
          }, (error) => {
            console.log(error);
            setLoading(false);
          });
      } catch (e) {
        console.log("Load Data Error:", e);
        setLoading(false);
        setErrorMsg(language === "te" ? "డేటా లోడ్ అవ్వలేదు! ఇంటర్నెట్ చెక్ చేయండి." : "Failed to load data! Check connection.");
        setShowErrorModal(true);
      }
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
        .limit(1) 
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

      return false; 
    } catch (error) {
      console.log("Error checking records", error);
      return true; // Safety Lock
    }
  };

  const handleEditClick = async (item: any) => {
    Keyboard.dismiss();
    setActionLoading(true);
    const hasRecords = await checkHasRecords(item.id);
    setActionLoading(false);

    router.push({
      pathname: "/farmer/mestri/edit/[id]",
      params: { id: item.id, hasRecords: hasRecords ? "true" : "false" } 
    });
  };

  const handleDeleteClick = async (item: any) => {
    Keyboard.dismiss();
    setActionLoading(true);
    const hasRecords = await checkHasRecords(item.id);
    setActionLoading(false);

    if (hasRecords) {
      setShowCannotDeleteModal(true); 
    } else {
      setDeleteItem(item);
      setShowDeleteModal(true); 
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
      setErrorMsg(language === "te" ? "తొలగించడం విఫలమైంది! ఇంటర్నెట్ చెక్ చేసి మళ్ళీ ప్రయత్నించండి." : "Failed to delete! Please check your connection.");
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- SEARCH FILTER (ROBUST) ---------------- */
  const cleanSearchTerm = search.replace(/[.,?!]/g, "").trim().toLowerCase();
  const filteredMestris = mestris.filter(item => {
    const dbName = (item.name || "").replace(/[.,?!]/g, "").trim().toLowerCase();
    return dbName.includes(cleanSearchTerm);
  });

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
    const cleanPhone = phone.replace(/\D/g, "");
    const url = `tel:${cleanPhone}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) Linking.openURL(url);
      })
      .catch((err) => console.log(err));
  };

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
    <View style={styles.row}>
      <View style={styles.left}>
        <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ width: 42, height: 42, borderRadius: 21, marginRight: 12 }} />
        <View style={{ flex: 1, gap: 4, marginLeft: 8 }}>
          <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ width: "60%", height: 14, borderRadius: 6 }} />
          <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ width: "40%", height: 12, borderRadius: 6, marginTop: 2 }} />
          <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ width: "30%", height: 12, borderRadius: 6, marginTop: 2 }} />
        </View>
      </View>
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

      {/* 🔥 FIX 4: Header Update */}
      <AppHeader
        title={language === "te" ? "మేస్త్రీల జాబితా" : "Mestri List"}
        subtitle={language === "te" ? "హాజరు నిర్వహణ" : "Manage Attendance"}
        language={language}
      />

      {/* 🔥 HIDE SEARCH BAR IF NO DATA EXISTS */}
      {(!loading && mestris.length === 0) ? null : (
        <View style={[styles.searchContainer, isFocused && styles.searchFocused]}>
          <Ionicons name="search-outline" size={20} color={isFocused ? "#16A34A" : "#9CA3AF"} />
          <TextInput
            ref={inputRef}
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
          keyboardDismissMode="on-drag"
          contentContainerStyle={[
            { padding: 20, paddingBottom: 100 },
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
                onPress={() => {
                  Keyboard.dismiss(); // 🔥 Close Keyboard on navigation
                  router.push({
                    pathname: "/farmer/mestri/[id]",
                    params: { id: item.id }
                  });
                }}
              >
                <View style={[styles.avatar, { backgroundColor: getColor(item.id) }]}>
                  <AppText style={styles.avatarText} language={language}>
                    {item.name?.charAt(0)?.toUpperCase()}
                  </AppText>
                </View>

                <View style={styles.details}>
                  <AppText style={styles.name} language={language} numberOfLines={1} ellipsizeMode="tail">{item.name}</AppText>
                  <AppText style={styles.phone} language={language}>+91 - {item.phone || "----"}</AppText>
                  <AppText style={styles.sub} language={language} numberOfLines={1} ellipsizeMode="tail">{item.village || "----"}</AppText>
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

      <TouchableOpacity activeOpacity={0.9}
        style={styles.addBtn}
        onPress={() => {
          Keyboard.dismiss(); // 🔥 Close Keyboard on plus click
          router.push("/farmer/mestri/add-mestri");
        }}
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
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconBg}>
              <Ionicons name="trash-outline" size={36} color="#e44830" />
            </View>
            <AppText style={styles.modalTitleStandard} language={language}>
              {language === "te" ? "తొలగించాలా?" : "Delete Mestri?"}
            </AppText>
            <AppText style={styles.modalSubStandard} language={language}>
              {language === "te"
                ? "ఈ మేస్త్రీని పూర్తిగా తొలగించాలా?"
                : "Are you sure you want to delete this mestri?"}
            </AppText>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowDeleteModal(false)}>
                <AppText style={styles.modalCancelText} language={language}>{language === "te" ? "వద్దు" : "Cancel"}</AppText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={confirmDelete}>
                <AppText style={styles.modalConfirmText} language={language}>{language === "te" ? "తొలగించు" : "Delete"}</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 🔒 CANNOT DELETE WARNING MODAL */}
      <Modal visible={showCannotDeleteModal} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.modalOverlayStandard}>
          <View style={styles.modalContentStandard}>
            <View style={styles.modalIconBgStandardWarning}>
              <Ionicons name="lock-closed" size={36} color="#F59E0B" />
            </View>
            <AppText style={styles.modalTitleStandardWarning} language={language}>
              {language === "te" ? "తొలగించడం కుదరదు" : "Cannot Delete"}
            </AppText>
            <AppText style={styles.modalSubStandard} language={language}>
              {language === "te"
                ? "ఈ మేస్త్రీకి సంబంధించి హాజరు లేదా చెల్లింపుల రికార్డ్స్ ఇప్పటికే ఉన్నాయి. కావున వారిని తొలగించడం కుదరదు."
                : "This mestri has existing attendance or payment records. Therefore, they cannot be deleted."}
            </AppText>
            <View style={styles.modalButtonsStandard}>
              <TouchableOpacity activeOpacity={0.8}
                style={styles.modalWarningBtnStandard} 
                onPress={() => setShowCannotDeleteModal(false)}
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

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F9FAFB" }, // 🔥 Premium Background Update
  searchContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", marginHorizontal: 20, marginTop: 15, marginBottom: 0, paddingHorizontal: 12, height: 50, borderRadius: 8, borderWidth: 1, borderColor: "#E5E7EB" },
  searchFocused: { borderColor: "#16A34A", backgroundColor: "#FFFFFF" },
  searchInput: { flex: 1, height: "100%", marginLeft: 10, fontSize: 15, paddingTop: 0, paddingBottom: 0, textAlignVertical: "center", color: "#1F2937", fontFamily: "Mandali", includeFontPadding: false },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 14, justifyContent: "space-between", marginVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor:"#E5E7EB", borderRadius: 14, backgroundColor:"#ffffff", shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 3 },
  left: { flexDirection: "row", alignItems: "center", flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", marginRight: 12 },
  avatarText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  details: { flex: 1, gap: 2, marginLeft: 4 },
  right: { flexDirection: "row", alignItems: "center", gap: 8 },
  callBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#ECFDF5", justifyContent: "center", alignItems: "center" },
  name: { fontSize: 15, fontWeight: "600", color: "#111827" },
  sub: { fontSize: 13, color: "#6B7280" },
  phone: { fontSize: 12, color: "#16A34A", fontWeight: '500' },
  addBtn: { position: "absolute", bottom: 30, right: 20, elevation: 5, shadowColor: '#16A34A', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: {width: 0, height: 4} },
  addGradient: { width: 64, height: 64, borderRadius: 32, justifyContent: "center", alignItems: "center" },
  
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
  deleteBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: "#DC2626", alignItems: "center", justifyContent: 'center' },
  
  // UNIFIED PREMIUM MODAL CLASSES
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center" },
  modalContent: { width: "80%", backgroundColor: "white", borderRadius: 25, padding: 25, alignItems: "center" },
  modalTitleStandard: { fontSize: 20, fontWeight: "500", color: "#e2431f", marginVertical: 10 },
  modalButtons: { flexDirection: "row", gap: 10 },
  modalOverlayStandard: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 999 },
  modalContentStandard: { width: "85%", backgroundColor: "white", borderRadius: 24, padding: 24, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 15 },
  modalSubStandard: { textAlign: "center", color: "#64748B", marginBottom: 25, fontSize: 14, lineHeight: 22 },
  modalButtonsStandard: { flexDirection: "row", gap: 12 },
  modalCancelBtn: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#F1F5F9", alignItems: "center" },
  modalConfirmBtn: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#EF4444", alignItems: "center" },
  modalCancelText: { color: "#64748B", fontWeight: "500" },
  modalConfirmText: { color: "white", fontWeight: "500" },
  modalIconBg: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#f5e8e8", justifyContent: "center", alignItems: "center", marginBottom: 10 },
  modalTitleStandardWarning: { fontSize: 20, fontWeight: "500", color: "#F59E0B", marginVertical: 10, textAlign: "center" },
  modalWarningBtnStandard: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#F59E0B", alignItems: "center" },
  modalWarningTextStandard: { color: "white", fontWeight: "500" },
  modalIconBgStandardWarning: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#FEF3C7", justifyContent: "center", alignItems: "center", marginBottom: 10 },
});