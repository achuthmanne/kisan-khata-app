import AppEmptyState from "@/components/AppEmptyState";
import { executeOfflineSafeRead, executeOfflineSafeWrite, executeOfflineSafeFetch } from "@/utils/offlineHelper";
 
import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import React, { useCallback, useEffect, useState, useRef } from "react";
import { useStore } from "@/store/useStore";
import {
  ActivityIndicator,
  FlatList,
  Linking,
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

export default function OwnersList() {

  const router = useRouter();

  const owners = useStore((state) => state.owners);
  const isInitializing = useStore((state) => state.isInitializing);
  const loading = isInitializing && owners.length === 0;
  const data = owners;
  const [language, setLanguage] = useState<"te" | "en">("te");
  const [activeSession, setActiveSession] = useState("");
  const [pastOwners, setPastOwners] = useState<any[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedPastOwners, setSelectedPastOwners] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  const [search, setSearch] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [deleteItem, setDeleteItem] = useState<any>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const isScreenFocused = useIsFocused();

  // 🔥 LOCK LOGIC & MODERN UI STATES
  const [actionLoading, setActionLoading] = useState(false);
  const [showCannotDeleteModal, setShowCannotDeleteModal] = useState(false);
  
  const isMounted = useRef(true);

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
    isMounted.current = true;
    AsyncStorage.getItem("APP_LANG").then(l => { if (l && isMounted.current) setLanguage(l as any); });
    return () => { 
      isMounted.current = false;
      ExpoSpeechRecognitionModule.stop(); 
    };
  }, []);

  /* ---------------- LOAD DATA ---------------- */
  useEffect(() => {
    isMounted.current = true;

    const loadPastOwners = async () => {
      try {
        const phone = await AsyncStorage.getItem("USER_PHONE");
        const session = await AsyncStorage.getItem("ACTIVE_SESSION");
        if (!phone || !session) return;
        
        setActiveSession(session);

        const pastSnap = await executeOfflineSafeRead(firestore()
          .collection("users")
          .doc(phone)
          .collection("owners")
          .where("session", "!=", session), true
        );
            
        if (!pastSnap.empty) {
          const pastList = pastSnap.docs.map((doc: any) => ({ id: doc.id, ...(doc.data() as any) }));
          const uniquePast: any[] = [];
          const phones = new Set();
          for (let o of pastList) {
            if (o.phone && !phones.has(o.phone)) {
              phones.add(o.phone);
              uniquePast.push(o);
            }
          }
          if (isMounted.current) setPastOwners(uniquePast);
        }
      } catch(err) { console.log("Past fetch error", err); }
    };

    loadPastOwners();

    return () => { 
      isMounted.current = false;
    };
  }, []);

  /* ---------------- FILTER & COLORS ---------------- */
  const filtered = data.filter(item =>
    item.ownerName?.toLowerCase().includes(search.toLowerCase())
  );

  const colors = ["#22C55E","#3B82F6","#F59E0B","#EF4444","#8B5CF6"];
  const getColor = (id: string) => colors[id.charCodeAt(0) % colors.length];

  const handleCall = (phone: string) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`);
  };

  // 🔥 CORE LOGIC: CHECK FOR ENTRIES TO LOCK EDIT/DELETE
  const checkHasRecords = async (ownerId: string) => {
    try {
      const phone = await AsyncStorage.getItem("USER_PHONE");
      if (!phone || !activeSession) return false;

      const entriesSnap = await executeOfflineSafeRead(firestore()
        .collection("users").doc(phone)
        .collection("owners").doc(ownerId)
        .collection("entries")
        .where("session", "==", activeSession)
        .limit(1), true
        );

      return !entriesSnap.empty; 
    } catch (error) {
      console.log("Error checking records", error);
      return true; 
    }
  };

  const handleEditClick = async (item: any) => {
    setActionLoading(true);
    const hasRecords = await checkHasRecords(item.id);
    if (isMounted.current) setActionLoading(false);

    router.push({
      pathname: "/farmer/owners/add-owner",
      params: {
        editId: item.id,
        name: item.ownerName,
        phone: item.phone,
        village: item.village,
        hasRecords: hasRecords ? "true" : "false" 
      }
    });
  };

  const handleDeleteClick = async (item: any) => {
    setActionLoading(true);
    const hasRecords = await checkHasRecords(item.id);
    if (isMounted.current) setActionLoading(false);

    if (hasRecords) {
      if (isMounted.current) setShowCannotDeleteModal(true); 
    } else {
      if (isMounted.current) {
        setDeleteItem(item);
        setShowDeleteModal(true); 
      }
    }
  };

  const toggleSelectPastOwner = (id: string) => {
    setSelectedPastOwners(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleImportPastOwners = async () => {
    if (selectedPastOwners.length === 0) return;
    setImporting(true);
    try {
      const phone = await AsyncStorage.getItem("USER_PHONE");
      if (!phone || !activeSession) return;
      const batch = firestore().batch();
      const ownerRef = firestore().collection("users").doc(phone).collection("owners");
      
      selectedPastOwners.forEach(id => {
        const o = pastOwners.find(x => x.id === id);
        if (o) {
          const newRef = ownerRef.doc();
          batch.set(newRef, {
            ownerName: o.ownerName || "",
            phone: o.phone || "",
            village: o.village || "",
            session: activeSession,
            createdAt: firestore.FieldValue.serverTimestamp()
          });
        }
      });
      
      await executeOfflineSafeWrite(batch.commit());
      setShowImportModal(false);
      setSelectedPastOwners([]);
    } catch (e) {
      console.log("Import Error", e);
    } finally {
      setImporting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteItem) return;
    const phone = await AsyncStorage.getItem("USER_PHONE");
    if (!phone) return;

    setShowDeleteModal(false);

    try {
      await executeOfflineSafeWrite(firestore()
        .collection("users")
        .doc(phone)
        .collection("owners")
        .doc(deleteItem.id)
        .delete());
    } catch (e) {
      console.log("Delete Error:", e);
    }
    if (isMounted.current) setDeleteItem(null);
  };

  // MODERN MENU STYLES
  const optionsStyles = {
    optionsContainer: {
      borderRadius: 14, paddingVertical: 5, paddingHorizontal: 0, width: 150,
      backgroundColor: "#fff", shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15, shadowRadius: 12, elevation: 8, marginTop: 25, 
    }
  };

  const ShimmerRow = () => (
    <View style={styles.row}>
      <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ width: 42, height: 42, borderRadius: 21 }} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ width: "60%", height: 14, borderRadius: 6 }} />
        <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ width: "40%", height: 12, borderRadius: 6, marginTop: 6 }} />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      {actionLoading && (
        <View style={styles.actionLoadingOverlay}>
          <ActivityIndicator size="large" color="#16A34A" />
        </View>
      )}

      {/* 🔥 PRO FIX: CLARITY IN HEADER FOR FARMERS */}
      <AppHeader
        title={language === "te" ? "యంత్రాల లెక్కలు" : "Machinery Accounts"}
        subtitle={language === "te" ? "దుక్కి, కోత లాంటి పనులు చేసిన యజమానులు" : "Owners who did works in field"}
        language={language}
      />

      {(!loading && data.length === 0) ? null : (
        <View style={[styles.searchContainer, isFocused && styles.searchFocused]}>
          <Ionicons name="search-outline" size={20} color={isFocused ? "#16A34A" : "#9CA3AF"} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={language === "te" ? "ట్రాక్టర్ యజమాని పేరు వెతకండి..." : "Search tractor owner..."}
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
        <View style={{ paddingVertical: 10 }}>
          <ShimmerRow /><ShimmerRow /><ShimmerRow />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled" 
          keyboardDismissMode="on-drag"
          contentContainerStyle={[
            { paddingVertical: 10, paddingBottom: 100 },
            filtered.length === 0 && { flexGrow: 1, justifyContent: 'center' }
          ]}
          ListEmptyComponent={
            <View>
              {(search.trim().length === 0 && pastOwners.length > 0) && (
                <View style={styles.importSuggestionCard}>
                  <View style={styles.importIconBg}>
                    <Ionicons name="time-outline" size={28} color="#D97706" />
                  </View>
                  <AppText style={styles.importTitle} language={language}>
                    {language === "te" ? "పాత సాగు సంవత్సరాల ఓనర్లు" : "Past Seasons Owners"}
                  </AppText>
                  <AppText style={styles.importSub} language={language}>
                    {language === "te" 
                      ? "మీరు గతంలో పని చేయించుకున్న యజమానులను మళ్ళీ ఈ సంవత్సరానికి వాడుకోవాలనుకుంటున్నారా?" 
                      : "Do you want to reuse the vehicle owners you worked with in previous seasons?"}
                  </AppText>
                  <TouchableOpacity activeOpacity={0.8} style={styles.importBtn} onPress={() => setShowImportModal(true)}>
                    <AppText style={styles.importBtnText} language={language}>
                      {language === "te" ? "పాత ఓనర్లను ఎంచుకోండి" : "Select Past Owners"}
                    </AppText>
                  </TouchableOpacity>
                </View>
              )}
              <AppEmptyState
                iconName={search.trim().length > 0 ? "search-outline" : "tractor"}
                title={
                  search.trim().length > 0
                    ? language === "te" ? "ఏమి దొరకలేదు" : "Not Found"
                    : language === "te" ? "కొత్త యజమాని ఎవరూ లేరు" : "No New Owners Added"
                }
                subtitle={
                  search.trim().length > 0
                    ? language === "te" ? "మీ శోధనకు సరిపడే ఫలితాలు లేవు" : "No results match your search"
                    : language === "te" ? "మీ పొలంలో ట్రాక్టర్/వాహనంతో పని చేసిన వాళ్ళని '+' నొక్కి యాడ్ చేయండి" : "Tap '+' to add tractor/vehicle owners who worked in your field"
                }
                language={language}
                marginTop={data.length === 0 && pastOwners.length === 0 ? 40 : 10}
              />
            </View>
          }
          renderItem={({ item }) => {
            const color = getColor(item.id);

            return (
              <View style={styles.row}>
                <TouchableOpacity
                  style={styles.left}
                  activeOpacity={0.8}
                  onPress={() => {
                    router.push({
                      pathname: "/farmer/owners/owner-work", // 🔥 Next screen for entering works
                      params: {
                        ownerId: item.id,
                        name: item.ownerName,
                        phone: item.phone,
                        village: item.village
                      }
                    });
                  }}
                >
                  <View style={[styles.avatar, { backgroundColor: color }]}>
                    <AppText style={styles.avatarText}>{item.ownerName?.charAt(0)?.toUpperCase()}</AppText>
                  </View>

                  <View style={styles.details}>
                    <AppText style={styles.name}>{item.ownerName}</AppText>
                    <AppText style={styles.phone}>+91 - {item.phone || "----"}</AppText>
                    <AppText style={styles.sub}>{item.village || "----"}</AppText>
                  </View>
                </TouchableOpacity>

                <View style={styles.right}>
                  <TouchableOpacity style={styles.callBtn} onPress={() => handleCall(item.phone)}>
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
                          <AppText style={styles.menuTextEdit} language={language}>{language === "te" ? "మార్చు" : "Edit"}</AppText>
                        </View>
                      </MenuOption>
                      <View style={styles.menuDivider} />
                      <MenuOption onSelect={() => handleDeleteClick(item)}>
                        <View style={styles.modernMenuItem}>
                          <Ionicons name="trash-outline" size={18} color="#EF4444" />
                          <AppText style={styles.menuTextDelete} language={language}>{language === "te" ? "తొలగించు" : "Delete"}</AppText>
                        </View>
                      </MenuOption>
                    </MenuOptions>
                  </Menu>
                </View>
              </View>
            );
          }}
        />
      )}

      <TouchableOpacity activeOpacity={0.8}
        style={styles.addBtn}
        onPress={() => router.push("/farmer/owners/add-owner")}
      >
        <LinearGradient colors={["#16A34A","#166534"]} style={styles.addGradient}>
           <Ionicons name="add" size={30} color="#fff" />
         </LinearGradient>
      </TouchableOpacity>

      {/* 🔄 IMPORT PAST OWNERS MODAL */}
      <Modal visible={showImportModal} transparent animationType="slide" statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '80%', width: '90%', padding: 0, paddingBottom: 20 }]}>
            <View style={{ padding: 20, paddingBottom: 15, borderBottomWidth: 1, borderColor: "#E5E7EB", width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9FAFB', borderTopLeftRadius: 25, borderTopRightRadius: 25 }}>
              <AppText style={{ fontSize: 18, fontWeight: '600', color: '#111827' }} language={language}>
                {language === "te" ? "పాత ఓనర్లను ఎంచుకోండి" : "Select Past Owners"}
              </AppText>
              <TouchableOpacity onPress={() => setShowImportModal(false)}>
                <Ionicons name="close-circle" size={28} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={pastOwners}
              keyExtractor={item => item.id}
              style={{ width: '100%' }}
              contentContainerStyle={{ padding: 20 }}
              renderItem={({item}) => {
                const isSelected = selectedPastOwners.includes(item.id);
                return (
                  <TouchableOpacity 
                    style={[styles.importRow, isSelected && styles.importRowSelected]} 
                    onPress={() => toggleSelectPastOwner(item.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.importRowLeft}>
                      <View style={[styles.avatar, { backgroundColor: getColor(item.id), width: 38, height: 38, borderRadius: 19 }]}>
                         <AppText style={{ color: '#fff', fontWeight: '600', fontSize: 14 }} language={language}>{item.ownerName?.charAt(0)}</AppText>
                      </View>
                      <View style={{ marginLeft: 12 }}>
                        <AppText style={{ fontSize: 15, fontWeight: '600', color: '#111827' }} language={language}>{item.ownerName}</AppText>
                        <AppText style={{ fontSize: 13, color: '#6B7280' }} language={language}>{item.phone} • {item.village}</AppText>
                      </View>
                    </View>
                    <Ionicons 
                      name={isSelected ? "checkbox" : "square-outline"} 
                      size={26} 
                      color={isSelected ? "#16A34A" : "#D1D5DB"} 
                    />
                  </TouchableOpacity>
                );
              }}
            />

            <TouchableOpacity 
              style={[styles.importSubmitBtn, selectedPastOwners.length === 0 && { opacity: 0.5 }]} 
              disabled={selectedPastOwners.length === 0 || importing}
              onPress={handleImportPastOwners}
            >
              {importing ? <ActivityIndicator color="#fff" /> : (
                <AppText style={styles.importSubmitBtnText} language={language}>
                  {language === "te" ? `ఎంచుకున్న ${selectedPastOwners.length} మందిని జతచేయి` : `Import ${selectedPastOwners.length} Selected`}
                </AppText>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showDeleteModal} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconBg}>
              <Ionicons name="trash-outline" size={36} color="#e44830" />
            </View>
            <AppText style={styles.modalTitleStandard} language={language}>{language === "te" ? "తొలగించాలా?" : "Delete Entry?"}</AppText>
            <AppText style={styles.modalSubStandard} language={language}>{language === "te" ? "ఈ యజమాని అకౌంట్ ని పూర్తిగా తొలగించాలా?" : "Are you sure you want to delete this owner account?"}</AppText>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowDeleteModal(false)}>
                <AppText style={styles.modalCancelText}>{language === "te" ? "వద్దు" : "Cancel"}</AppText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={confirmDelete}>
                <AppText style={styles.modalConfirmText}>{language === "te" ? "తొలగించు" : "Delete"}</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showCannotDeleteModal} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.modalOverlayStandard}>
          <View style={styles.modalContentStandard}>
            <View style={styles.modalIconBgStandardWarning}>
              <Ionicons name="lock-closed" size={36} color="#F59E0B" />
            </View>
            <AppText style={styles.modalTitleStandardWarning} language={language}>{language === "te" ? "తొలగించడం కుదరదు" : "Cannot Delete"}</AppText>
            <AppText style={styles.modalSubStandard} language={language}>
              {language === "te"
                ? "ఈ ఓనర్ కు సంబంధించి పనుల వివరాలు ఇప్పటికే మీ అకౌంట్లో రికార్డ్ అయ్యాయి. కావున వీరిని తొలగించడం కుదరదు."
                : "This owner has existing work records logged. Therefore, they cannot be deleted."}
            </AppText>
            <View style={styles.modalButtonsStandard}>
              <TouchableOpacity activeOpacity={0.8} style={styles.modalWarningBtnStandard} onPress={() => setShowCannotDeleteModal(false)}>
                <AppText style={styles.modalWarningTextStandard} language={language}>{language === "te" ? "అర్థమైంది" : "Got It"}</AppText>
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
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 14, marginHorizontal: 20, marginVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor:"#E5E7EB", borderRadius: 12, backgroundColor:"#ffffff", justifyContent: "space-between" },
  left: { flexDirection: "row", alignItems: "center", flex: 1 },
  avatar: { width: 42, height: 42, borderRadius: 21, justifyContent: "center", alignItems: "center", marginRight: 12 },
  avatarText: { color: "#fff", fontWeight: "600" },
  details: { flex: 1 },
  name: { fontSize: 15, fontWeight: "600" },
  phone: { fontSize: 12, color: "#16A34A" },
  sub: { fontSize: 12, color: "#6B7280" },
  right: { flexDirection: "row", alignItems: "center", gap: 8 },
  callBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#ECFDF5", justifyContent: "center", alignItems: "center" },
  addBtn: { position: "absolute", bottom: 30, right: 20 },
  addGradient: { width: 60, height: 60, borderRadius: 30, justifyContent: "center", alignItems: "center", elevation: 5, shadowColor: "#000", shadowOffset:{width:0, height:2}, shadowOpacity:0.2, shadowRadius:4 },
  modernMenuItem: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 14, gap: 10 },
  menuTextEdit: { fontSize: 14, color: "#1E293B", fontWeight: "500" },
  menuTextDelete: { fontSize: 14, color: "#EF4444", fontWeight: "500" },
  menuDivider: { height: 1, backgroundColor: "#F1F5F9", marginHorizontal: 10 },
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
  importSuggestionCard: { backgroundColor: "#FEF3C7", marginHorizontal: 20, borderRadius: 16, padding: 20, alignItems: "center", marginTop: 20, borderWidth: 1, borderColor: "#FDE68A", elevation: 2, shadowColor: "#D97706", shadowOpacity: 0.1, shadowRadius: 8 },
  importIconBg: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#FDE68A", justifyContent: "center", alignItems: "center", marginBottom: 12 },
  importTitle: { fontSize: 16, fontWeight: "600", color: "#92400E", marginBottom: 6 },
  importSub: { fontSize: 13, color: "#B45309", textAlign: "center", marginBottom: 16, lineHeight: 20, fontFamily: "Mandali" },
  importBtn: { backgroundColor: "#D97706", paddingVertical: 12, width: "90%", borderRadius: 12, alignItems: "center", justifyContent: "center" },
  importBtnText: { color: "white", fontWeight: "600", fontSize: 14, fontFamily: "Mandali" },
  importRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 10, backgroundColor: '#F9FAFB' },
  importRowSelected: { borderColor: '#16A34A', backgroundColor: '#F0FDF4' },
  importRowLeft: { flexDirection: 'row', alignItems: 'center' },
  importSubmitBtn: { backgroundColor: '#16A34A', width: '90%', alignSelf: 'center', paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  importSubmitBtnText: { color: 'white', fontWeight: '600', fontSize: 15, fontFamily: "Mandali" },
});