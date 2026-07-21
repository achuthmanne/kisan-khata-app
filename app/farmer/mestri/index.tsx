// app/farmer/attendance.tsx

import AppEmptyState from "@/components/AppEmptyState";
import SmoothBottomSheet from "@/components/ui/SmoothBottomSheet";
import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";
import { useStore } from "@/store/useStore";
import { executeOfflineSafeRead, executeOfflineSafeWrite } from "@/utils/offlineHelper";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
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

export default function AttendanceScreen() {
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  const [language, setLanguage] = useState<"te" | "en">("te");
  
  // 🔥 Read from Global Store instantly
  const mestris = useStore((state) => state.mestris);
  const isInitializing = useStore((state) => state.isInitializing);
  
  // Loading is strictly when Zustand is initializing AND we have no cached data
  const loading = isInitializing && mestris.length === 0;
  const [search, setSearch] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [deleteItem, setDeleteItem] = useState<any>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const isScreenFocused = useIsFocused();
  const [activeSession, setActiveSession] = useState("");
  const [pastMestris, setPastMestris] = useState<any[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedPastMestris, setSelectedPastMestris] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

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

  useFocusEffect(
    useCallback(() => {
      // Only fetch past mestris for imports, since current mestris are handled by Zustand
      const loadPastMestris = async () => {
        try {
          const userPhone = await AsyncStorage.getItem("USER_PHONE");
          if (!userPhone) return;

          // Retrieve active session dynamically to avoid waiting for a separate fetch if we just need the local storage one
          const session = await AsyncStorage.getItem("ACTIVE_SESSION");
          if (!session) return;
          
          setActiveSession(session);

          const pastSnap = await executeOfflineSafeRead(firestore()
            .collection("users")
            .doc(userPhone)
            .collection("mestris")
            .where("session", "!=", session)
            , true, true);
          
          if (!pastSnap.empty) {
            const pastList = pastSnap.docs.map((doc: any) => ({ id: doc.id, ...(doc.data() as any) }));
            const uniquePast: any[] = [];
            const seenKeys = new Set();
            
            for (let m of pastList) {
              // Create a unique key using phone if available, otherwise use name
              const key = m.phone ? `phone_${m.phone}` : `name_${m.name?.trim().toLowerCase()}`;
              
              if (!seenKeys.has(key)) {
                seenKeys.add(key);
                uniquePast.push(m);
              }
            }
            setPastMestris(uniquePast);
          } else {
            setPastMestris([]);
          }
        } catch(err) { console.log("Past fetch error", err); }
      };

      loadPastMestris();
    }, [])
  );

  // 🔥 CORE LOGIC: Check if Mestri has Attendance or Payments
  const checkHasRecords = async (mestriId: string) => {
    try {
      const phone = await AsyncStorage.getItem("USER_PHONE");
      if (!phone || !activeSession) return false;

      // 1. Check Attendance
      const attSnap = await executeOfflineSafeRead(firestore()
        .collection("users").doc(phone)
        .collection("mestris").doc(mestriId)
        .collection("attendance")
        .where("session", "==", activeSession)
        .limit(1) 
        , true);

      if (!attSnap.empty) return true;

      // 2. Check Payments
      const paySnap = await executeOfflineSafeRead(firestore()
        .collection("users").doc(phone)
        .collection("payments")
        .where("mestriId", "==", mestriId)
        .where("session", "==", activeSession)
        .limit(1)
        , true);

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

  const toggleSelectPastMestri = (id: string) => {
    setSelectedPastMestris(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleImportPastMestris = async () => {
    if (selectedPastMestris.length === 0) return;
    setImporting(true);
    try {
      const userPhone = await AsyncStorage.getItem("USER_PHONE");
      if (!userPhone || !activeSession) return;
      const batch = firestore().batch();
      const mestriRef = firestore().collection("users").doc(userPhone).collection("mestris");
      
      selectedPastMestris.forEach(id => {
        const m = pastMestris.find(x => x.id === id);
        if (m) {
          const newRef = mestriRef.doc();
          batch.set(newRef, {
            name: m.name || "",
            phone: m.phone || "",
            village: m.village || "",
            session: activeSession,
            createdAt: firestore.FieldValue.serverTimestamp()
          });
        }
      });
      
      await executeOfflineSafeWrite(batch.commit());
      setShowImportModal(false);
      setSelectedPastMestris([]);
    } catch (e) {
      console.log("Import Error", e);
      setErrorMsg(language === "te" ? "దిగుమతి విఫలమైంది!" : "Import Failed!");
      setShowErrorModal(true);
    } finally {
      setImporting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteItem) return;

    try {
      setActionLoading(true);
      const userPhone = (await AsyncStorage.getItem("USER_PHONE")) ?? "";

      if (!userPhone || !activeSession) return;

      const mestriRef = firestore()
        .collection("users")
        .doc(userPhone)
        .collection("mestris")
        .doc(deleteItem.id);

      await executeOfflineSafeWrite(mestriRef.delete()); 

      setShowDeleteModal(false);
      setDeleteItem(null);

    } catch (e) {
      console.log("Delete error:", e);
      setErrorMsg(language === "te" ? "తొలగించడం విఫలమైంది! ఇంటర్నెట్ చెక్ చేసి మళ్ళీ ప్రయత్నించండి." : "Failed to delete! Please check your connection.");
      setShowErrorModal(true);
    } finally {
      setActionLoading(false);
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
          ListHeaderComponent={
            (search.trim().length === 0 && pastMestris.length > 0) ? (
              <View style={styles.importSuggestionCard}>
                <View style={styles.importIconBg}>
                  <Ionicons name="time-outline" size={28} color="#D97706" />
                </View>
                <AppText style={styles.importTitle} language={language}>
                  {language === "te" ? "పాత సాగు సంవత్సరాల మేస్త్రీలు" : "Past Seasons Mestris"}
                </AppText>
                <AppText style={styles.importSub} language={language}>
                  {language === "te" 
                    ? "మీరు గతంలో పని చేసిన మేస్త్రీలను మళ్ళీ ఈ సంవత్సరానికి వాడుకోవాలనుకుంటున్నారా?" 
                    : "Do you want to reuse the mestris you worked with in previous seasons?"}
                </AppText>
                <TouchableOpacity activeOpacity={0.8} style={styles.importBtn} onPress={() => setShowImportModal(true)}>
                  <AppText style={styles.importBtnText} language={language}>
                    {language === "te" ? "పాత మేస్త్రీలను ఎంచుకోండి" : "Select Past Mestris"}
                  </AppText>
                </TouchableOpacity>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <AppEmptyState
              iconName={search.trim().length > 0 ? "search-outline" : "people-outline"}
              title={
                search.trim().length > 0
                  ? language === "te" ? "ఏమి దొరకలేదు" : "Not Found"
                  : language === "te" ? "కొత్త మేస్త్రీలు లేరు" : "No New Mestris"
              }
              subtitle={
                search.trim().length > 0
                  ? language === "te" ? "మీ శోధనకు సరిపడే ఫలితాలు లేవు" : "No results match your search"
                  : language === "te" ? "+ బటన్ నొక్కి కొత్త మేస్త్రీలను చేర్చండి" : "Tap + button to add new mestris"
              }
              language={language}
              marginTop={mestris.length === 0 && pastMestris.length === 0 ? 60 : 20} 
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

      {/* 🔄 IMPORT PAST MESTRIS MODAL */}
      <SmoothBottomSheet visible={showImportModal} onClose={() => setShowImportModal(false)}>
        <View style={{ maxHeight: 600, width: '100%', padding: 0 }}>
          <View style={{ padding: 20, paddingBottom: 15, borderBottomWidth: 1, borderColor: "#E5E7EB", width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9FAFB', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
            <AppText style={{ fontSize: 18, fontWeight: '600', color: '#111827' }} language={language}>
              {language === "te" ? "పాత మేస్త్రీలను ఎంచుకోండి" : "Select Past Mestris"}
            </AppText>
            <TouchableOpacity onPress={() => setShowImportModal(false)}>
              <Ionicons name="close-circle" size={28} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
            
            <FlatList
              data={pastMestris}
              keyExtractor={item => item.id}
              style={{ width: '100%' }}
              contentContainerStyle={{ padding: 20 }}
              renderItem={({item}) => {
                const isSelected = selectedPastMestris.includes(item.id);
                return (
                  <TouchableOpacity 
                    style={[styles.importRow, isSelected && styles.importRowSelected]} 
                    onPress={() => toggleSelectPastMestri(item.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.importRowLeft}>
                      <View style={[styles.avatar, { backgroundColor: getColor(item.id), width: 38, height: 38, borderRadius: 19 }]}>
                         <AppText style={{ color: '#fff', fontWeight: '600', fontSize: 14 }} language={language}>{item.name?.charAt(0)}</AppText>
                      </View>
                      <View style={{ marginLeft: 12 }}>
                        <AppText style={{ fontSize: 15, fontWeight: '600', color: '#111827' }} language={language}>{item.name}</AppText>
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

            <View style={{ paddingHorizontal: 20, paddingBottom: 10, paddingTop: 10, backgroundColor: "#fff" }}>
              <TouchableOpacity 
                style={[styles.importSubmitBtn, selectedPastMestris.length === 0 && { opacity: 0.5 }]} 
                disabled={selectedPastMestris.length === 0 || importing}
                onPress={handleImportPastMestris}
              >
                {importing ? <ActivityIndicator color="#fff" /> : (
                  <AppText style={styles.importSubmitBtnText} language={language}>
                    {language === "te" ? `ఎంచుకున్న ${selectedPastMestris.length} మందిని జతచేయి` : `Import ${selectedPastMestris.length} Selected`}
                  </AppText>
                )}
              </TouchableOpacity>
            </View>
          </View>
      </SmoothBottomSheet>

      {/* 🔒 CANNOT DELETE WARNING MODAL */}
      <Modal visible={showCannotDeleteModal} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.modalOverlayStandard}>
          <View style={styles.modalContentStandard}>
            <View style={styles.modalIconBgStandardWarning}>
              <Ionicons name="lock-closed" size={36} color="#F59E0B" />
            </View>
            <AppText style={styles.modalTitleStandardWarning} language={language}>
              {language === "te" ? "తొలగించడం కుదరదు!" : "Cannot Delete!"}
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
  modalButtonsStandard: { flexDirection: "row", gap: 12, justifyContent: "center", width: "100%" },
  modalCancelBtn: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#F1F5F9", alignItems: "center" },
  modalConfirmBtn: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#EF4444", alignItems: "center" },
  modalCancelText: { color: "#64748B", fontWeight: "500" },
  modalConfirmText: { color: "white", fontWeight: "500" },
  modalIconBg: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#f5e8e8", justifyContent: "center", alignItems: "center", marginBottom: 10 },
  modalTitleStandardWarning: { fontSize: 20, fontWeight: "500", color: "#F59E0B", marginVertical: 10, textAlign: "center" },
  modalWarningBtnStandard: { paddingVertical: 12, paddingHorizontal: 32, borderRadius: 12, backgroundColor: "#F59E0B", alignItems: "center" },
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
  importSubmitBtn: { backgroundColor: '#16A34A', width: '100%', alignSelf: 'center', paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  importSubmitBtnText: { color: 'white', fontWeight: '600', fontSize: 15, fontFamily: "Mandali" },
});