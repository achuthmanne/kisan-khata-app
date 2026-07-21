//vechile farmer
import AppEmptyState from "@/components/AppEmptyState";
import SmoothBottomSheet from "@/components/ui/SmoothBottomSheet";
import { executeOfflineSafeRead, executeOfflineSafeWrite, executeOfflineSafeFetch } from "@/utils/offlineHelper";

import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
  View,
  ToastAndroid
} from "react-native";
import { Menu, MenuOption, MenuOptions, MenuTrigger } from "react-native-popup-menu";
import ShimmerPlaceholder from "react-native-shimmer-placeholder";

export default function VehicleDetails() {

  const router = useRouter();
  const { id, name, number, type } = useLocalSearchParams();
  const isMounted = useRef(true); // 🔥 PRO FIX: Memory leak protection

  const vehicleNumber = Array.isArray(number) ? number[0] : number;
  const vehicleType = Array.isArray(type) ? type[0] : type;

  const vehicleFarmersMap = useStore(state => state.vehicleFarmers);
  const data = vehicleFarmersMap[id as string] || [];
  const initVehicleFarmersListener = useStore(state => state.initVehicleFarmersListener);
  const unsubVehicleFarmers = useStore(state => state.unsubVehicleFarmers);

  const [loading, setLoading] = useState(vehicleFarmersMap[id as string] === undefined);
  const [language, setLanguage] = useState<"te" | "en">("te");
  const [activeSession, setActiveSession] = useState("");

  const [search, setSearch] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [deleteItem, setDeleteItem] = useState<any>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const isScreenFocused = useIsFocused();

  const [pastFarmers, setPastFarmers] = useState<any[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedPastFarmers, setSelectedPastFarmers] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  // 🔥 NEW STATES FOR LOGIC
  const [actionLoading, setActionLoading] = useState(false);
  const [showCannotDeleteModal, setShowCannotDeleteModal] = useState(false);

  useSpeechRecognitionEvent("result", (event) => {
    if (!isScreenFocused || !isMounted.current) return;
    if (event.results && event.results.length > 0) {
      setSearch(event.results[0].transcript);
    }
  });

  useSpeechRecognitionEvent("end", () => {
    if (isMounted.current) setIsListening(false);
  });

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
    AsyncStorage.getItem("APP_LANG").then((l) => {
      if (l && isMounted.current) setLanguage(l as any);
    });

    return () => {
      isMounted.current = false;
      ExpoSpeechRecognitionModule.stop();
    };
  }, []);

  /* ---------------- LOAD ---------------- */

  useFocusEffect(
    useCallback(() => {
      let isMountedLocal = true;

      const load = async () => {
        try {
          const phone = await AsyncStorage.getItem("USER_PHONE");
          if (!phone) return;

          setLoading(true);

          const userDoc = await executeOfflineSafeRead(firestore()
            .collection("users")
            .doc(phone), true
            );

          const session = userDoc.data()?.activeSession;

          if (!session) {
            if (isMountedLocal) {
              setLoading(false);
            }
            return;
          }
          
          if (isMountedLocal) setActiveSession(session); 

          initVehicleFarmersListener(id as string, phone, session);
          if (isMountedLocal) setLoading(false);

          // 🔥 Fetch past farmers quietly on mount (0 reads due to noBackgroundSync)
          loadPastFarmers(phone, session);
        } catch (error) {
          console.log("Loading Error: ", error);
          if (isMountedLocal) setLoading(false);
        }
      };

      load();

      return () => {
        isMountedLocal = false;
        // Optional: unsubVehicleFarmers(id as string); 
        // We let Zustand keep it alive for snappy back navigation
      };
    }, [id])
  );

  // 🔥 NEW FUNCTION: Fetch past farmers ONLY on mount
  const loadPastFarmers = async (userPhone: string, currentSession: string) => {
    try {
      const pastVehiclesSnap = await executeOfflineSafeRead(firestore()
        .collection("users")
        .doc(userPhone)
        .collection("vehicles")
        .where("session", "!=", currentSession), true, true // fastCache=true, noBackgroundSync=true
      );
        
      const fetchPromises = pastVehiclesSnap.docs.map((vDoc: any) => 
        executeOfflineSafeRead(vDoc.ref.collection("farmers"), true, true) // noBackgroundSync=true
      );
      
      const snaps = await Promise.all(fetchPromises);
      const uniquePast: any[] = [];
      const phones = new Set();
      
      snaps.forEach((snap: any) => {
        snap.docs.forEach((doc: any) => {
          const f = { id: doc.id, ...(doc.data() as any) };
          const key = f.phone ? f.phone.trim() : f.farmerName?.trim().toLowerCase();
          
          if (key && !phones.has(key)) {
            const currentFarmers = useStore.getState().vehicleFarmers[id as string] || [];
            const existsInCurrent = currentFarmers.some(curr => 
              (curr.phone && f.phone && curr.phone === f.phone) || 
              (!curr.phone && !f.phone && curr.farmerName?.trim().toLowerCase() === f.farmerName?.trim().toLowerCase())
            );

            if (!existsInCurrent) {
              phones.add(key);
              uniquePast.push(f);
            }
          }
        });
      });
      
      if (isMounted.current) {
        setPastFarmers(uniquePast);
      }
    } catch(err) { 
      console.log("Past fetch error", err); 
    }
  };

  /* ---------------- FILTER ---------------- */
  const filtered = data.filter(item =>
    item.farmerName?.toLowerCase().includes(search.toLowerCase()) || 
    item.village?.toLowerCase().includes(search.toLowerCase()) // ఊరి పేరుతో కూడా వెతికే ఛాన్స్ ఇచ్చాను
  );

  /* ---------------- COLORS ---------------- */
  const colors = ["#22C55E","#3B82F6","#F59E0B","#EF4444","#8B5CF6"];

  const getColor = (id: string) => {
    return colors[id.charCodeAt(0) % colors.length];
  };

  /* ---------------- IMPORT PAST ---------------- */
  const toggleSelectPastFarmer = (id: string) => {
    setSelectedPastFarmers(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleImportPastFarmers = async () => {
    if (selectedPastFarmers.length === 0) return;
    setImporting(true);
    try {
      const phone = await AsyncStorage.getItem("USER_PHONE");
      if (!phone || !activeSession || !id) return;
      const batch = firestore().batch();
      const farmerRef = firestore().collection("users").doc(phone).collection("vehicles").doc(id as string).collection("farmers");
      
      selectedPastFarmers.forEach((fid: any) => {
        const f = pastFarmers.find(x => x.id === fid);
        if (f) {
          const newRef = farmerRef.doc();
          batch.set(newRef, {
            farmerName: f.farmerName || "",
            phone: f.phone || "",
            village: f.village || "",
            session: activeSession,
            createdAt: firestore.FieldValue.serverTimestamp()
          });
        }
      });
      
      await executeOfflineSafeWrite(batch.commit());
      setShowImportModal(false);
      setSelectedPastFarmers([]);
    } catch (e) {
      console.log("Import Error", e);
    } finally {
      setImporting(false);
    }
  };

  /* ---------------- CALL ---------------- */
  const handleCall = (phone: string) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`);
  };

  // 🔥 CORE LOGIC: Check if Farmer has Work Records
  const checkHasRecords = async (farmerId: string) => {
    try {
      const phone = await AsyncStorage.getItem("USER_PHONE");
      if (!phone || !activeSession || !id) return false;

      const workSnap = await executeOfflineSafeRead(firestore()
        .collection("users").doc(phone)
        .collection("vehicles").doc(id as string)
        .collection("works").doc(farmerId)
        .collection("entries")
        .where("session", "==", activeSession)
        .limit(1), true
        );

      return !workSnap.empty;
    } catch (error) {
      console.log("Error checking records", error);
      return true; // సేఫ్టీ కోసం
    }
  };

  // 🔥 Edit Action
  const handleEditClick = async (item: any) => {
    setActionLoading(true);
    const hasRecords = await checkHasRecords(item.id);
    if (!isMounted.current) return;
    setActionLoading(false);

    router.push({
      pathname: "/farmer/vechile-farmers/add-farmers",
      params: {
        vehicleId: id,
        editId: item.id,
        name: item.farmerName,
        phone: item.phone,
        village: item.village,
        hasRecords: hasRecords ? "true" : "false" 
      }
    });
  };

  // 🔥 Delete Action
  const handleDeleteClick = async (item: any) => {
    setActionLoading(true);
    const hasRecords = await checkHasRecords(item.id);
    if (!isMounted.current) return;
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

    const phone = await AsyncStorage.getItem("USER_PHONE");
    if (!phone) return;

    setShowDeleteModal(false);

    try {
      await executeOfflineSafeWrite(firestore()
        .collection("users")
        .doc(phone)
        .collection("vehicles")
        .doc(id as string)
        .collection("farmers")
        .doc(deleteItem.id)
        .delete());
    } catch (e) {
      console.log(e);
    }

    if (isMounted.current) setDeleteItem(null);
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

  /* ---------------- SHIMMER ---------------- */
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

      {/* ACTION LOADING OVERLAY */}
      {actionLoading && (
        <View style={styles.actionLoadingOverlay}>
          <ActivityIndicator size="large" color="#16A34A" />
        </View>
      )}

      <AppHeader
        title={language === "te" ? "రైతుల జాబితా" : "Farmers List"}
        subtitle={
          vehicleNumber && vehicleNumber.trim() !== ""
            ? `${name || vehicleType} | ${vehicleNumber}` 
            : `${name || vehicleType || (language === "te" ? "వాహన వివరాలు" : "Vehicle Details")}`
        }
        language={language}
      />

      {/* SEARCH BAR */}
      {(!loading && data.length === 0) ? null : (
        <View style={[styles.searchContainer, isFocused && styles.searchFocused]}>
          <Ionicons name="search-outline" size={20} color={isFocused ? "#16A34A" : "#9CA3AF"} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={language === "te" ? "రైతును వెతకండి..." : "Search farmer..."}
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

      {/* LIST */}
      {loading ? (
        <View style={{ paddingVertical: 10 }}>
          <ShimmerRow />
          <ShimmerRow />
          <ShimmerRow />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            { paddingVertical: 10, paddingBottom: 100 },
            filtered.length === 0 && { flexGrow: 1, justifyContent: 'center' }
          ]}
          ListEmptyComponent={
            <View>
              {(search.trim().length === 0 && pastFarmers.length > 0) && (
                <View style={styles.importSuggestionCard}>
                  <View style={styles.importIconBg}>
                    <Ionicons name="time-outline" size={28} color="#D97706" />
                  </View>
                  <AppText style={styles.importTitle} language={language}>
                    {language === "te" ? "పాత సాగు సంవత్సరాల రైతులు" : "Past Seasons Farmers"}
                  </AppText>
                  <AppText style={styles.importSub} language={language}>
                    {language === "te" 
                      ? "మీరు గతంలో పని చేసిన రైతులను మళ్ళీ ఈ సంవత్సరానికి వాడుకోవాలనుకుంటున్నారా?" 
                      : "Do you want to reuse the farmers you worked with in previous seasons?"}
                  </AppText>
                  <TouchableOpacity activeOpacity={0.8} style={styles.importBtn} onPress={() => setShowImportModal(true)}>
                    <AppText style={styles.importBtnText} language={language}>
                      {language === "te" ? "పాత రైతులను ఎంచుకోండి" : "Select Past Farmers"}
                    </AppText>
                  </TouchableOpacity>
                </View>
              )}
              <View style={{ marginTop: search.trim().length === 0 ? 10 : 40 }}>
                <AppEmptyState
                  iconName={search.trim().length > 0 ? "search-outline" : "people-outline"}
                  title={
                    search.trim().length > 0
                      ? (language === "te" ? "ఏమి దొరకలేదు" : "Not Found")
                      : (language === "te" ? "రైతులు లేరు" : "No Farmers Added")
                  }
                  subtitle={
                    search.trim().length > 0
                      ? (language === "te" ? "మీ శోధనకు సరిపడే ఫలితాలు లేవు" : "No results match your search")
                      : (language === "te" ? "+ బటన్ నొక్కి రైతులను చేర్చండి" : "Tap + button to add farmers")
                  }
                  language={language}
                />
              </View>
            </View>
          }
          renderItem={({ item }) => {
            const color = getColor(item.id);

            return (
              <View style={styles.row}>
                {/* LEFT */}
                <TouchableOpacity
                  style={styles.left}
                  activeOpacity={0.8}
                  onPress={() => {
                    router.push({
                      pathname: "/farmer/vechile-farmers/farmer-work",
                      params: {
                        vehicleId: id,
                        farmerId: item.id,
                        name: item.farmerName,
                        phone: item.phone,
                        village: item.village
                      }
                    });
                  }}
                >
                  <View style={[styles.avatar, { backgroundColor: color }]}>
                    <AppText style={styles.avatarText}>
                      {item.farmerName?.charAt(0)?.toUpperCase()}
                    </AppText>
                  </View>

                  <View style={styles.details}>
                    {/* 🔥 PRO FIX: numberOfLines for long names & villages */}
                    <AppText style={styles.name} numberOfLines={1} ellipsizeMode="tail">
                      {item.farmerName}
                    </AppText>
                    <AppText style={styles.phone}>+91 - {item.phone || "----"}</AppText>
                    <AppText style={styles.sub} numberOfLines={1} ellipsizeMode="tail">
                      {item.village || "----"}
                    </AppText>
                  </View>
                </TouchableOpacity>

                {/* RIGHT */}
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
            );
          }}
        />
      )}

      {/* ADD BUTTON */}
      <TouchableOpacity activeOpacity={0.8}
        style={styles.addBtn}
        onPress={() =>
          router.push({
            pathname: "/farmer/vechile-farmers/add-farmers",
            params: { vehicleId: id }
          })
        }
      >
        <LinearGradient colors={["#16A34A","#166534"]} style={styles.addGradient}>
           <Ionicons name="add" size={30} color="#fff" />
         </LinearGradient>
      </TouchableOpacity>

      {/* 🔄 IMPORT PAST FARMERS MODAL */}
      <SmoothBottomSheet visible={showImportModal} onClose={() => setShowImportModal(false)}>
        <View style={{ maxHeight: 600, width: '100%', padding: 0 }}>
          <View style={{ padding: 20, paddingBottom: 15, borderBottomWidth: 1, borderColor: "#E5E7EB", width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9FAFB', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
            <AppText style={{ fontSize: 18, fontWeight: '600', color: '#111827' }} language={language}>
              {language === "te" ? "పాత రైతులను ఎంచుకోండి" : "Select Past Farmers"}
            </AppText>
            <TouchableOpacity onPress={() => setShowImportModal(false)}>
              <Ionicons name="close-circle" size={28} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
            
            <FlatList
              data={pastFarmers}
              keyExtractor={item => item.id}
              style={{ width: '100%' }}
              contentContainerStyle={{ padding: 20 }}
              renderItem={({item}) => {
                const isSelected = selectedPastFarmers.includes(item.id);
                return (
                  <TouchableOpacity 
                    style={[styles.importRow, isSelected && styles.importRowSelected]} 
                    onPress={() => toggleSelectPastFarmer(item.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.importRowLeft}>
                      <View style={[styles.avatar, { marginRight: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: getColor(item.id) }]}>
                        <AppText style={styles.avatarText}>{item.farmerName?.charAt(0)?.toUpperCase()}</AppText>
                      </View>
                      <View style={{ flex: 1 }}>
                        <AppText style={{ fontSize: 15, fontWeight: '600', color: '#111827' }} language={language}>{item.farmerName}</AppText>
                        <AppText style={{ fontSize: 13, color: '#6B7280' }} language={language}>{item.village ? `${item.village} • ` : ''}+91 - {item.phone || "----"}</AppText>
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
                style={[styles.importSubmitBtn, selectedPastFarmers.length === 0 && { opacity: 0.5 }]} 
                disabled={selectedPastFarmers.length === 0 || importing}
                onPress={handleImportPastFarmers}
              >
                {importing ? <ActivityIndicator color="#fff" /> : (
                  <AppText style={styles.importSubmitBtnText} language={language}>
                    {language === "te" ? `ఎంచుకున్న ${selectedPastFarmers.length} రైతులను జతచేయి` : `Import ${selectedPastFarmers.length} Selected`}
                  </AppText>
                )}
              </TouchableOpacity>
            </View>
          </View>
      </SmoothBottomSheet>

      {/* 🔴 STANDARD DELETE MODAL */}
      <Modal visible={showDeleteModal} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.modalOverlayStandard}>
          <View style={styles.modalContentStandard}>
            <View style={styles.modalIconBgStandard}>
              <Ionicons name="trash-outline" size={36} color="#e44830" />
            </View>
            <AppText style={styles.modalTitleStandard} language={language}>
              {language === "te" ? "తొలగించాలా?" : "Delete Entry?"}
            </AppText>
            <AppText style={styles.modalSubStandard} language={language}>
              {language === "te" ? "ఈ వివరాన్ని తొలగించాలా?" : "Are you sure you want to delete this record?"}
            </AppText>
            <View style={styles.modalButtonsStandard}>
              <TouchableOpacity style={styles.modalCancelBtnStandard} onPress={() => setShowDeleteModal(false)}>
                <AppText style={styles.modalCancelTextStandard}>{language === "te" ? "వద్దు" : "Cancel"}</AppText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtnStandard} onPress={confirmDelete}>
                <AppText style={styles.modalConfirmTextStandard}>
                  {language === "te" ? "తొలగించు" : "Delete"}
                </AppText>
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
              {language === "te" ? "తొలగించడం కుదరదు!" : "Cannot Delete!"}
            </AppText>
            <AppText style={styles.modalSubStandard} language={language}>
              {language === "te"
                ? "ఈ రైతుకి సంబంధించి పని వివరాలు ఇప్పటికే రికార్డ్ అయ్యాయి. కావున వారిని తొలగించడం కుదరదు."
                : "This farmer has existing work records. Therefore, they cannot be deleted."}
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

    </SafeAreaView>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  searchContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#F9FAFB", marginHorizontal: 20, marginTop: 15, marginBottom: 0, paddingHorizontal: 12, height: 50, borderRadius: 8, borderWidth: 1, borderColor: "#E5E7EB" },
  searchFocused: { borderColor: "#16A34A", backgroundColor: "#FFFFFF" },
  searchInput: { flex: 1, height: "100%", marginLeft: 10, fontSize: 15, paddingTop: 0, paddingBottom: 0, textAlignVertical: "center", color: "#1F2937", fontFamily: "Mandali", includeFontPadding: false },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 14, marginHorizontal: 20, marginVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor:"#E5E7EB", borderRadius: 12, backgroundColor:"#ffffff", justifyContent: "space-between" },
  left: { flexDirection: "row", alignItems: "center", flex: 1, paddingRight: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21, justifyContent: "center", alignItems: "center", marginRight: 12 },
  avatarText: { color: "#fff", fontWeight: "600" },
  details: { flex: 1 },
  name: { fontSize: 15, fontWeight: "600" },
  phone: { fontSize: 12, color: "#16A34A" },
  sub: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  right: { flexDirection: "row", alignItems: "center", gap: 8 },
  callBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#ECFDF5", justifyContent: "center", alignItems: "center" },
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
  deleteBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: "#DC2626", alignItems: "center", justifyContent: 'center' },
  
  // UNIFIED PREMIUM MODAL CLASSES
  modalOverlayStandard: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 999 },
  modalContentStandard: { width: "80%", backgroundColor: "white", borderRadius: 25, padding: 25, alignItems: "center" },
  modalTitleStandard: { fontSize: 20, fontWeight: "500", color: "#e2431f", marginVertical: 10 },
  modalSubStandard: { textAlign: "center", color: "#64748B", marginBottom: 25 },
  modalButtonsStandard: { flexDirection: "row", gap: 12, justifyContent: "center", width: "100%" },
  modalCancelBtnStandard: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#F1F5F9", alignItems: "center" },
  modalConfirmBtnStandard: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#EF4444", alignItems: "center" },
  modalCancelTextStandard: { color: "#64748B", fontWeight: "500" },
  modalConfirmTextStandard: { color: "white", fontWeight: "500" },
  modalIconBgStandard: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#f5e8e8", justifyContent: "center", alignItems: "center", marginBottom: 10 },
  modalTitleStandardWarning: { fontSize: 20, fontWeight: "500", color: "#F59E0B", marginVertical: 10, textAlign: "center" },
  modalWarningBtnStandard: { paddingVertical: 12, paddingHorizontal: 32, borderRadius: 12, backgroundColor: "#F59E0B", alignItems: "center" },
  modalWarningTextStandard: { color: "white", fontWeight: "500" },
  modalIconBgStandardWarning: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#FEF3C7", justifyContent: "center", alignItems: "center", marginBottom: 10 },
  importSuggestionCard: { backgroundColor: "#FEF3C7", marginHorizontal: 16, borderRadius: 16, padding: 20, alignItems: "center", marginTop: 20, borderWidth: 1, borderColor: "#FDE68A", elevation: 2, shadowColor: "#D97706", shadowOpacity: 0.1, shadowRadius: 8 },
  importIconBg: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#FDE68A", justifyContent: "center", alignItems: "center", marginBottom: 12 },
  importTitle: { fontSize: 16, fontWeight: "600", color: "#92400E", marginBottom: 6 },
  importSub: { fontSize: 13, color: "#B45309", textAlign: "center", marginBottom: 16, lineHeight: 20, fontFamily: "Mandali" },
  importBtn: { backgroundColor: "#D97706", paddingVertical: 12, width: "90%", borderRadius: 12, alignItems: "center", justifyContent: "center" },
  importBtnText: { color: "white", fontWeight: "600", fontSize: 14, fontFamily: "Mandali" },
  importRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, paddingLeft: 0, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 10, backgroundColor: '#F9FAFB', overflow: 'hidden' },
  importRowSelected: { borderColor: '#16A34A', backgroundColor: '#F0FDF4' },
  importRowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  importSubmitBtn: { backgroundColor: '#16A34A', width: '100%', alignSelf: 'center', paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  importSubmitBtnText: { color: 'white', fontWeight: '600', fontSize: 15, fontFamily: "Mandali" },
});