// app/farmer/mestripayments/payment-summary.tsx

import AppEmptyState from "@/components/AppEmptyState";
import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Image } from "expo-image";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
  Modal,
  TextInput,
  ScrollView,
  Animated,
  Dimensions
} from "react-native";
import ShimmerPlaceholder from "react-native-shimmer-placeholder";

export default function PaymentSummary() {
  const { ids, crop, work, id, name, village } = useLocalSearchParams();
  const router = useRouter();
  const [focused, setFocused] = useState("");
  const [data, setData] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<"te" | "en">("te");
  const [modeModal, setModeModal] = useState(false);
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | "both" | "">("");
  
  // 🔥 SPLIT PAYMENTS STATE
  const [splitCash, setSplitCash] = useState("");
  const [splitUpi, setSplitUpi] = useState("");
  
  // 🔥 PROOFS STATE (Images + PDF)
  type Proof = { uri: string, type: "image" | "pdf", name?: string };
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [photoModal, setPhotoModal] = useState(false);

  const [morningRate, setMorningRate] = useState("");
  const [eveningRate, setEveningRate] = useState("");
  const [fullRate, setFullRate] = useState("");
  const [showModal, setShowModal] = useState(false);

  /* ---------------- LOAD LANGUAGE ---------------- */
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem("APP_LANG").then(l => {
        if (l) setLanguage(l as any);
      });
    }, [])
  );

  /* ---------------- LOAD DATA ---------------- */
  const loadData = async () => {
    setLoading(true);
    try {
        const userPhone = await AsyncStorage.getItem("USER_PHONE");
        if (!userPhone) return;
        const userDoc = await firestore()
          .collection("users")
          .doc(userPhone)
          .get();

        const activeSession = userDoc.data()?.activeSession;
        if (!activeSession) return;

        const selectedIds = JSON.parse(ids as string);
        const snap = await firestore()
          .collection("users")
          .doc(userPhone)
          .collection("mestris")
          .doc(id as string)
          .collection("attendance")
          .where("session", "==", activeSession) 
          .get();

        const list = snap.docs
          .map(d => ({ id: d.id, ...(d.data() as any) }))
          .filter(item => selectedIds.includes(item.id))
          .sort((a, b) => {
            const parseDate = (dStr: string) => {
              if (!dStr) return 0;
              const parts = dStr.split("/");
              if (parts.length === 3) {
                return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
              }
              return 0;
            };
            return parseDate(b.date) - parseDate(a.date);
          });

        setData(list);
    } catch (err) {
        console.log("Error loading payment summary:", err);
    } finally {
        setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  /* ---------------- CALCULATIONS ---------------- */
  const totalMorning = data.reduce((sum, item) => sum + (item.morning || 0), 0);
  const totalEvening = data.reduce((sum, item) => sum + (item.evening || 0), 0);
  const totalFull = data.reduce((sum, item) => sum + (item.full || 0), 0);
  const totalWorkers = totalMorning + totalEvening + totalFull;
  const totalDays = data.length;
  
  // 🔥 FETCHING ACRES FROM FIRESTORE DATA
  const totalAcres = data.reduce((sum, item) => sum + (Number(item.acresWorked) || Number(item.acres) || 0), 0);

  const colors = ["#06B6D4","#84CC16","#F97316","#6366F1","#EC4899"];
  const workColor = colors[(work as string).charCodeAt(0) % colors.length];
  
  const safeNumber = (val: any) => {
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  };

  const amount =
    totalMorning * safeNumber(morningRate) +
    totalEvening * safeNumber(eveningRate) +
    totalFull * safeNumber(fullRate);

  const formattedAmount = amount.toLocaleString("en-IN");

  let rateErrorMsg = "";
  if (totalMorning > 0 && !morningRate) rateErrorMsg = language === "te" ? "ఉదయం కూలీ రేటు ఎంటర్ చేయండి" : "Enter morning rate";
  else if (totalEvening > 0 && !eveningRate) rateErrorMsg = language === "te" ? "మధ్యాహ్నం కూలీ రేటు ఎంటర్ చేయండి" : "Enter afternoon rate";
  else if (totalFull > 0 && !fullRate) rateErrorMsg = language === "te" ? "రోజంతా కూలీ రేటు ఎంటర్ చేయండి" : "Enter full day rate";
  else if (amount <= 0 && data.length > 0) rateErrorMsg = language === "te" ? "మొత్తం అమౌంట్ సున్నా ఉండకూడదు" : "Total amount cannot be zero";

  /* ---------------- UPLOAD OPTIONS (CAMERA, GALLERY, PDF) ---------------- */
  const handleCamera = async () => {
    setPhotoModal(false);
    if (proofs.length >= 2) return;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.2, 
    });
    if (!result.canceled) setProofs(prev => [...prev, { uri: result.assets[0].uri, type: "image" }]);
  };

  const handleGallery = async () => {
    setPhotoModal(false);
    if (proofs.length >= 2) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.2,
    });
    if (!result.canceled) setProofs(prev => [...prev, { uri: result.assets[0].uri, type: "image" }]);
  };

  const handlePDF = async () => {
    setPhotoModal(false);
    if (proofs.length >= 2) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setProofs(prev => [...prev, { uri: result.assets[0].uri, type: "pdf", name: result.assets[0].name }]);
      }
    } catch (e) {
      console.log(e);
    }
  };

  const removeProof = (index: number) => {
    setProofs(prev => prev.filter((_, i) => i !== index));
  };

  /* ---------------- SHIMMERS ---------------- */
  const SummaryShimmer = () => (
    <View style={styles.shimmerSummary}>
      <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ height: 14, width: 100, borderRadius: 6, alignSelf: "center" }} />
      <View style={{ flexDirection: "row", marginTop: 10 }}>
        <ShimmerPlaceholder LinearGradient={LinearGradient} style={styles.shimmerBox} />
        <ShimmerPlaceholder LinearGradient={LinearGradient} style={styles.shimmerBox} />
      </View>
    </View>
  );

  const CardShimmer = () => (
    <View style={styles.shimmerCard}>
      <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ height: 12, width: 120, borderRadius: 6 }} />
      <View style={styles.divider} />
      <View style={styles.valuesContainer}>
        <ShimmerPlaceholder LinearGradient={LinearGradient} style={styles.shimmerSmall} />
        <ShimmerPlaceholder LinearGradient={LinearGradient} style={styles.shimmerSmall} />
        <ShimmerPlaceholder LinearGradient={LinearGradient} style={styles.shimmerSmall} />
      </View>
      <View style={styles.divider} />
      {/* MATCHED WITH BOTTOM ROW UI */}
      <View style={styles.bottomRow}>
        <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ height: 12, width: 80, borderRadius: 6 }} />
        <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ height: 12, width: 80, borderRadius: 6 }} />
      </View>
    </View>
  );

  const renderItem = ({ item }: any) => {
    const total = (item.morning || 0) + (item.evening || 0) + (item.full || 0);
    const acres = item.acresWorked || item.acres || 0; // 🔥 Fetching Acres

    return (
      <View style={[styles.card, { borderColor: workColor }]}>
        <View style={styles.topRow}>
          <View style={styles.dateWrap}>
            <Ionicons name="calendar-outline" size={16} color="#6B7280" />
            <AppText style={styles.dateText} language={language}>{item.date}</AppText>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.valuesContainer}>
          <View style={styles.valueBox}>
            <Ionicons name="sunny-outline" size={14} color="#F59E0B" />
            <AppText style={styles.label} language={language}>{language === "te" ? "ఉదయం" : "Morning"}</AppText>
            <AppText style={styles.value}>{item.morning || 0}</AppText>
          </View>
          <View style={styles.valueBox}>
            <Ionicons name="partly-sunny-outline" size={14} color="#3B82F6" />
            <AppText style={styles.label} language={language}>{language === "te" ? "మధ్యాహ్నం" : "Afternoon"}</AppText>
            <AppText style={styles.value}>{item.evening || 0}</AppText>
          </View>
          <View style={styles.valueBox}>
            <Ionicons name="moon-outline" size={14} color="#8B5CF6" />
            <AppText style={styles.label} language={language}>{language === "te" ? "రోజంతా" : "Full day"}</AppText>
            <AppText style={styles.value}>{item.full || 0}</AppText>
          </View>
        </View>
        <View style={styles.divider} />
        
        {/* 🔥 PERFECTLY MATCHED BOTTOM ROW */}
        <View style={styles.bottomRow}>
          <AppText style={[styles.totalText, { color: workColor }]} language={language}>
            {language === "te" ? "మొత్తం కూలీలు" : "Total Workers"}: {total}
          </AppText>
          
          {acres > 0 && (
            <AppText style={[styles.totalText, { color: "#4B5563" }]} language={language}>
              {language === "te" ? "మొత్తం ఎకరాలు" : "Total Acres"}: <AppText style={{ color: "#111827" }}>{acres}</AppText>
            </AppText>
          )}
        </View>

      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      <AppHeader
        title={language === "te" ? "చెల్లింపు వివరాలు" : "Payment Summary"}
        subtitle={language === "te" ? "ఎంపిక చేసిన హాజరు" : "Selected Attendance"}
        language={language}
      />

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 80} 
      >
        <View style={styles.summaryCard}>
          <AppText style={styles.summaryTitle} language={language}>
            {language === "te" ? "సారాంశం" : "Summary"}
          </AppText>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Ionicons name="calendar-number-outline" size={16} color="#6B7280" />
              <AppText style={styles.summaryLabel} language={language}>{language === "te" ? "మొత్తం రోజులు" : "Total Days"}</AppText>
              <AppText style={styles.summaryValue}>{totalDays}</AppText>
            </View>
            <View style={styles.verticalDivider} />
            <View style={styles.summaryItem}>
              <Ionicons name="people-outline" size={16} color="#6B7280" />
              <AppText style={styles.summaryLabel} language={language}>{language === "te" ? "మొత్తం కార్మికులు" : "Total Workers"}</AppText>
              <AppText style={styles.summaryValue}>{totalWorkers}</AppText>
            </View>
          </View>
        </View>

        {loading ? (
          <View style={{ flex: 1 }}>
            <SummaryShimmer />
            <CardShimmer />
            <CardShimmer />
          </View>
        ) : (
          <FlatList
            data={data}
            keyExtractor={(item, index) => item.id || index.toString()}
            style={{ flex: 1 }} 
            contentContainerStyle={[
              { paddingBottom: 200 }, 
              data.length === 0 && { flexGrow: 1, justifyContent: 'center' }
            ]}
            ListEmptyComponent={
              <AppEmptyState
                iconName="wallet-outline"
                title={language === "te" ? "హాజరు ఎంచుకోలేదు" : "No Attendance Selected"}
                subtitle={language === "te" ? "చెల్లింపు చేయడానికి ముందు హాజరును ఎంచుకోండి" : "Please select attendance to make a payment"}
                language={language}
              />
            }
            renderItem={renderItem}
            ListFooterComponent={
              data.length > 0 ? (
                <View style={styles.footer}>
                  <View style={[styles.ratesBox, { borderColor: workColor }]}>
                    <AppText style={styles.sectionTitle} language={language}>
                      {language === "te" ? "కూలీ రేట్లు నమోదు చేయండి" : "Enter Daily Rates"}
                    </AppText>
                    <View style={styles.inputRow}>
                      <View style={[styles.inputBox, { borderColor: focused === "morning" ? workColor : "#E5E7EB", opacity: totalMorning > 0 ? 1 : 0.5 }]}>
                        <Ionicons name="sunny-outline" size={16} color={totalMorning > 0 ? "#F59E0B" : "#9CA3AF"} />
                        <AppText style={styles.rs}>₹</AppText>
                        <TextInput
                          value={morningRate}
                          onChangeText={setMorningRate}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor={'#9CA3AF'}
                          cursorColor={workColor}
                          style={styles.inputText}
                          onFocus={() => setFocused("morning")}
                          onBlur={() => setFocused("")}
                          editable={totalMorning > 0}
                        />
                      </View>
                      <View style={[styles.inputBox, { borderColor: focused === "evening" ? workColor : "#E5E7EB", opacity: totalEvening > 0 ? 1 : 0.5 }]}>
                        <Ionicons name="partly-sunny-outline" size={16} color={totalEvening > 0 ? "#3B82F6" : "#9CA3AF"} />
                        <AppText style={styles.rs}>₹</AppText>
                        <TextInput
                          value={eveningRate}
                          onChangeText={setEveningRate}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor={'#9CA3AF'}
                          cursorColor={workColor}
                          style={styles.inputText}
                          onFocus={() => setFocused("evening")}
                          onBlur={() => setFocused("")}
                          editable={totalEvening > 0}
                        />
                      </View>
                      <View style={[styles.inputBox, { borderColor: focused === "full" ? workColor : "#E5E7EB", opacity: totalFull > 0 ? 1 : 0.5 }]}>
                        <Ionicons name="moon-outline" size={16} color={totalFull > 0 ? "#8B5CF6" : "#9CA3AF"} />
                        <AppText style={styles.rs}>₹</AppText>
                        <TextInput
                          value={fullRate}
                          onChangeText={setFullRate}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor={'#9CA3AF'}
                          cursorColor={workColor}
                          style={styles.inputText}
                          onFocus={() => setFocused("full")}
                          onBlur={() => setFocused("")}
                          editable={totalFull > 0}
                        />
                      </View>
                    </View>
                  </View>

                  <View style={styles.totalBox}>
                    <AppText style={styles.totalLabel} language={language}>
                      {language === "te" ? "మొత్తం చెల్లించాల్సిన మొత్తం:" : "Total Payable Amount:"}
                    </AppText>
                    <AppText style={styles.totalValue}>
                      ₹ {formattedAmount}
                    </AppText>
                  </View>

                  {/* INLINE RATE ERROR */}
                  {rateErrorMsg ? (
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10, marginHorizontal: 25, gap: 5 }}>
                      <Ionicons name="alert-circle" size={16} color="#DC2626" />
                      <AppText style={{ color: "#DC2626", fontSize: 13, fontWeight: "600", flex: 1 }} language={language}>
                        {rateErrorMsg}
                      </AppText>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    disabled={!!rateErrorMsg}
                    activeOpacity={0.9}
                    onPress={() => {
                      setModeModal(true);
                    }}
                    style={[styles.inlineConfirmWrapper, { opacity: rateErrorMsg ? 0.6 : 1 }]}
                  >
                    <LinearGradient colors={rateErrorMsg ? ["#9CA3AF", "#6B7280"] : ["#2E7D32", "#1B5E20"]} style={styles.confirmBtn}>
                      <Ionicons name={rateErrorMsg ? "lock-closed-outline" : "checkmark-circle-outline"} size={18} color="#fff" />
                      <AppText style={styles.confirmText} language={language}>
                        {language === "te" ? "లెక్కలు భద్రపరచండి" : "Save Payment Record"}
                      </AppText>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              ) : null
            }
          />
        )}
      </KeyboardAvoidingView>

      {/* MODE MODAL */}
      <Modal visible={modeModal} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.modalOverlayStandard}>
          <View style={[styles.modalContentStandard, { padding: 0, overflow: 'hidden', maxHeight: '90%' }]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, alignItems: "center" }}>
              <View style={[styles.modalIconBgStandardInfo, { backgroundColor: workColor + "20" }]}>
                <Ionicons name="wallet-outline" size={34} color={workColor} />
              </View>

              <AppText style={[styles.modalTitleStandardInfo, { color: "#1F2937" }]} language={language}>
                {language === "te" ? "మీరు " : "How did you pay "}
                <AppText style={{ color: workColor, fontWeight: "600" }}>{name}</AppText>
                {language === "te" ? " కి ఎలా చెల్లించారు?" : "?"}
              </AppText>

              <AppText style={[styles.modalSubStandard, { color: '#DC2626', fontWeight: '500', marginBottom: 15 }]} language={language}>
                {language === "te" 
                  ? "గమనిక: ఇది కేవలం మీ లెక్కల కోసం మాత్రమే. యాప్ ద్వారా డబ్బులు కట్ అవ్వవు." 
                  : "Note: This is only for your records. No money will be deducted from the app."}
              </AppText>

              <TouchableOpacity style={styles.radioRow} activeOpacity={0.8} onPress={() => setPaymentMode("cash")}>
                <View style={[styles.radioOuter, { borderColor: workColor }]}>
                  {paymentMode === "cash" && <View style={[styles.radioInner, { backgroundColor: workColor }]} />}
                </View>
                <Ionicons name="cash-outline" size={20} color={workColor} />
                <AppText style={styles.radioText} language={language}>{language === "te" ? "నగదు (Cash)" : "Cash"}</AppText>
              </TouchableOpacity>

              <TouchableOpacity style={styles.radioRow} activeOpacity={0.8} onPress={() => setPaymentMode("upi")}>
                <View style={[styles.radioOuter, { borderColor: workColor }]}>
                  {paymentMode === "upi" && <View style={[styles.radioInner, { backgroundColor: workColor }]} />}
                </View>
                <Ionicons name="phone-portrait-outline" size={20} color={workColor} />
                <AppText style={styles.radioText} language={language}>{language === "te" ? "ఫోన్ పే / గూగుల్ పే (UPI)" : "PhonePe / GPay (UPI)"}</AppText>
              </TouchableOpacity>

              <TouchableOpacity style={styles.radioRow} activeOpacity={0.8} onPress={() => setPaymentMode("both")}>
                <View style={[styles.radioOuter, { borderColor: workColor }]}>
                  {paymentMode === "both" && <View style={[styles.radioInner, { backgroundColor: workColor }]} />}
                </View>
                <Ionicons name="swap-horizontal-outline" size={20} color={workColor} />
                <AppText style={styles.radioText} language={language}>{language === "te" ? "రెండూ (Cash + UPI)" : "Both (Cash + UPI)"}</AppText>
              </TouchableOpacity>

              {paymentMode === "both" && (
                <View style={{ width: "100%", marginTop: 20 }}>
                  <View style={styles.splitBox}>
                    <View style={styles.splitInputWrap}>
                      <AppText style={styles.splitLabel} language={language}>{language === "te" ? "క్యాష్ ఎంత?" : "Cash Amount"}</AppText>
                      <View style={styles.splitInputInner}>
                        <AppText style={styles.rs}>₹</AppText>
                        <TextInput 
                          keyboardType="numeric" 
                          style={styles.inputText} 
                          value={splitCash} 
                          onChangeText={setSplitCash} 
                          placeholder="0" 
                          placeholderTextColor={'#9CA3AF'}
                        />
                      </View>
                    </View>
                    <View style={styles.splitInputWrap}>
                      <AppText style={styles.splitLabel} language={language}>{language === "te" ? "యూపీఐ ఎంత?" : "UPI Amount"}</AppText>
                      <View style={styles.splitInputInner}>
                        <AppText style={styles.rs}>₹</AppText>
                        <TextInput 
                          keyboardType="numeric" 
                          style={styles.inputText} 
                          value={splitUpi} 
                          onChangeText={setSplitUpi} 
                          placeholder="0" 
                          placeholderTextColor={'#9CA3AF'}
                        />
                      </View>
                    </View>
                  </View>
                  
                  {(splitCash !== "" || splitUpi !== "") && (safeNumber(splitCash) + safeNumber(splitUpi) !== amount) && (
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, paddingHorizontal: 5, gap: 5 }}>
                      <Ionicons name="information-circle" size={16} color="#DC2626" />
                      <AppText style={{ color: "#DC2626", fontSize: 12, fontWeight: "500", flex: 1 }} language={language}>
                        {language === "te" ? `క్యాష్, యూపీఐ రెండూ కలిపితే మొత్తం ₹ ${formattedAmount} కి సమానం అవ్వాలి.` : `Sum of Cash & UPI must equal ₹ ${formattedAmount}.`}
                      </AppText>
                    </View>
                  )}
                </View>
              )}

              {/* UPLOAD PROOFS (Max 2) */}
              <View style={styles.proofsContainer}>
                <AppText style={styles.proofsTitle} language={language}>{language === "te" ? "ఆధారాలు (Proofs) - Max 2" : "Upload Proofs - Max 2"}</AppText>
                <View style={styles.imagesRow}>
                  {proofs.map((proof, idx) => (
                    <View key={idx} style={styles.imagePreviewWrap}>
                      {proof.type === "image" ? (
                        <Image source={{ uri: proof.uri }} style={styles.imagePreview} contentFit="cover" />
                      ) : (
                        <View style={[styles.imagePreview, { backgroundColor: "#FEE2E2", justifyContent: "center", alignItems: "center" }]}>
                          <Ionicons name="document-text" size={28} color="#DC2626" />
                        </View>
                      )}
                      <TouchableOpacity style={styles.removeImageBtn} onPress={() => removeProof(idx)}>
                        <Ionicons name="close-circle" size={24} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {proofs.length < 2 && (
                    <TouchableOpacity style={[styles.addImageBtn, { borderColor: workColor }]} onPress={() => setPhotoModal(true)}>
                      <Ionicons name="cloud-upload-outline" size={24} color={workColor} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={[styles.modalButtonsStandard, { marginTop: 20 }]}>
                <TouchableOpacity
                  disabled={!paymentMode || (paymentMode === "both" && (safeNumber(splitCash) + safeNumber(splitUpi) !== amount))}
                  activeOpacity={0.9}
                  style={[styles.modalInfoBtnStandard, { backgroundColor: (!paymentMode || (paymentMode === "both" && (safeNumber(splitCash) + safeNumber(splitUpi) !== amount))) ? "#D1D5DB" : workColor }]}
                  onPress={() => { 
                    setModeModal(false); 
                    setShowModal(true); 
                  }}
                >
                  <AppText style={styles.modalInfoTextStandard} language={language}>{language === "te" ? "లెక్క భద్రపరచండి" : "Save Record"}</AppText>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 🔥 NEW BOTTOM SHEET FOR UPLOADS */}
      <Modal visible={photoModal} transparent animationType="slide" statusBarTranslucent>
        <TouchableOpacity style={styles.bottomSheetOverlay} activeOpacity={1} onPress={() => setPhotoModal(false)}>
          <View style={styles.bottomSheetContent}>
            
            {/* Header */}
            <View style={styles.bsHeader}>
              <View style={styles.bsHeaderLeft}>
                <View style={styles.bsIconBg}>
                  <Ionicons name="cloud-upload" size={22} color={workColor} />
                </View>
                <AppText style={styles.bsTitle} language={language}>
                  {language === "te" ? "ఆధారం అప్లోడ్ చేయండి" : "Upload Proof"}
                </AppText>
              </View>
              <TouchableOpacity onPress={() => setPhotoModal(false)} hitSlop={{top:10, bottom:10, left:10, right:10}}>
                <Ionicons name="close" size={26} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Options */}
            <TouchableOpacity style={styles.bsOption} activeOpacity={0.8} onPress={handleCamera}>
              <View style={[styles.bsOptionIcon, { backgroundColor: "#EFF6FF" }]}>
                <Ionicons name="camera" size={24} color="#3B82F6" />
              </View>
              <View>
                <AppText style={styles.bsOptionTitle} language={language}>{language === "te" ? "కెమెరా ద్వారా" : "Take Photo"}</AppText>
                <AppText style={styles.bsOptionSub} language={language}>{language === "te" ? "ఇప్పుడే ఫోటో తీయండి" : "Capture a live photo"}</AppText>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#D1D5DB" style={{ marginLeft: "auto" }} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.bsOption} activeOpacity={0.8} onPress={handleGallery}>
              <View style={[styles.bsOptionIcon, { backgroundColor: "#F0FDF4" }]}>
                <Ionicons name="images" size={24} color="#16A34A" />
              </View>
              <View>
                <AppText style={styles.bsOptionTitle} language={language}>{language === "te" ? "గ్యాలరీ నుండి" : "Gallery"}</AppText>
                <AppText style={styles.bsOptionSub} language={language}>{language === "te" ? "పాత ఫోటో ఎంచుకోండి" : "Choose an existing photo"}</AppText>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#D1D5DB" style={{ marginLeft: "auto" }} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.bsOption} activeOpacity={0.8} onPress={handlePDF}>
              <View style={[styles.bsOptionIcon, { backgroundColor: "#FEF2F2" }]}>
                <Ionicons name="document-text" size={24} color="#DC2626" />
              </View>
              <View>
                <AppText style={styles.bsOptionTitle} language={language}>{language === "te" ? "PDF డాక్యుమెంట్" : "PDF Document"}</AppText>
                <AppText style={styles.bsOptionSub} language={language}>{language === "te" ? "రసీదు ఫైల్ ఎంచుకోండి" : "Upload a receipt file"}</AppText>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#D1D5DB" style={{ marginLeft: "auto" }} />
            </TouchableOpacity>

          </View>
        </TouchableOpacity>
      </Modal>

      {/* SUCCESS CONFIRM MODAL */}
      <Modal visible={showModal} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.modalOverlayStandard}>
          <View style={styles.modalContentStandard}>
            <View style={[styles.modalIconBgStandardInfo, { backgroundColor: workColor + "20" }]}>
              <Ionicons name="shield-checkmark-outline" size={36} color={workColor} />
            </View>
            <AppText style={[styles.modalTitleStandardInfo, { color: workColor }]} language={language}>{language === "te" ? "చెల్లింపు నిర్ధారణ" : "Confirm Record"}</AppText>
            <AppText style={[styles.modalSubStandard, { marginBottom: 10 }]} language={language}>{language === "te" ? "ఈ లెక్కను మీ యాప్ లో భద్రపరచాలా?" : "Do you want to save this record?"}</AppText>
            
            <AppText style={[styles.modalAmount, { color: workColor, marginBottom: 20 }]}>₹ {formattedAmount}</AppText>
            
            <View style={styles.modalButtonsStandard}>
              <TouchableOpacity style={styles.modalCancelBtnStandard} onPress={() => setShowModal(false)}>
                <AppText style={styles.modalCancelTextStandard} language={language}>{language === "te" ? "వద్దు" : "Cancel"}</AppText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalInfoBtnStandard, { backgroundColor: workColor }]}
                activeOpacity={0.8}
                onPress={() => {
                  setShowModal(false);
                  // 🔥 PASSING totalAcres VIA ROUTER
                  router.push({
                    pathname: "/farmer/mestripayments/payment-success",
                    params: { 
                      ids, id, name, village, crop, work, 
                      totalDays, totalWorkers, totalAcres, // 🔥 NEW ADDITION
                      totalMorning, totalEvening, totalFull, 
                      morningRate, eveningRate, fullRate, amount, paymentMode,
                      splitCash: paymentMode === "both" ? splitCash : 0,
                      splitUpi: paymentMode === "both" ? splitUpi : 0,
                      proofs: JSON.stringify(proofs) 
                    }
                  });
                }}
              >
                <AppText style={styles.modalInfoTextStandard} language={language}>{language === "te" ? "కొనసాగించు" : "Proceed"}</AppText>
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
  summaryCard: { marginHorizontal: 20, marginTop: 12, padding: 16, borderRadius: 14, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e9ecf3" },
  summaryTitle: { fontSize: 13, color: "#16A34A", fontWeight: "600", marginBottom: 10, textAlign: 'center' },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryItem: { alignItems: "center", flex: 1 },
  summaryLabel: { fontSize: 12, color: "#6B7280" },
  summaryValue: { fontSize: 18, fontWeight: "700", color: "#111827", marginTop: 4 },
  verticalDivider: { width: 1, height: "80%", backgroundColor: "#E5E7EB", alignSelf: "center" },
  card: { marginHorizontal: 20, marginVertical: 6, padding: 14, borderWidth: 1, borderRadius: 14, backgroundColor: "#fff" },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dateWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  dateText: { fontSize: 13, color: "#374151" },
  divider: { height: 1, backgroundColor: "#F3F4F6", marginVertical: 10 },
  valuesContainer: { flexDirection: "row", justifyContent: "space-between" },
  valueBox: { alignItems: "center", flex: 1 },
  label: { fontSize: 11, color: "#6B7280", marginTop: 4 },
  value: { fontSize: 15, fontWeight: "600", marginTop: 2, color: "#111827" },
  
  // 🔥 UPDATED BOTTOM ROW STYLES
  bottomRow: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  
  totalText: { fontSize: 13, fontWeight: "600" },
  footer: { marginTop: 10, paddingBottom: 20 },
  ratesBox: { marginHorizontal: 20, padding: 14, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1 },
  sectionTitle: { fontSize: 13, fontWeight: "600", marginBottom: 10 },
  inputRow: { flexDirection: "row" },
  inputBox: { flex: 1, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 10, marginHorizontal: 4, backgroundColor: "#FAFAFA" },
  inputText: { flex: 1, fontSize: 14, fontWeight: "600", color: "#111827" },
  rs: { marginLeft: 4, marginRight: 2, fontSize: 13, color: "#374151" },
  totalBox: { marginHorizontal: 20, marginTop: 12, padding: 16, borderRadius: 14, backgroundColor: "#ffffff", alignItems: "center", borderWidth: 1, borderColor: "#eaebee" },
  totalLabel: { fontSize: 12, color: "#6B7280" },
  totalValue: { fontSize: 24, fontWeight: "700", color: "#16A34A", marginTop: 5 },
  
  inlineConfirmWrapper: { marginHorizontal: 20, marginTop: 16, borderRadius: 16, overflow: "hidden" },
  confirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15, borderRadius: 16 },
  confirmText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  
  modalOverlayStandard: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 999 },
  modalContentStandard: { width: "85%", backgroundColor: "white", borderRadius: 24, padding: 24, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 15 },
  modalSubStandard: { textAlign: "center", color: "#64748B", marginTop: 8, marginBottom: 25, fontSize: 14, lineHeight: 22 },
  modalButtonsStandard: { flexDirection: "row", gap: 12, width: '100%' },
  modalIconBgStandardInfo: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#DBEAFE", justifyContent: "center", alignItems: "center", marginBottom: 12 },
  modalTitleStandardInfo: { fontSize: 20, fontWeight: "600", color: "#2563EB", marginTop: 10, textAlign: "center" },
  modalInfoBtnStandard: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#3B82F6", alignItems: "center", justifyContent: "center" },
  modalInfoTextStandard: { color: "white", fontWeight: "600", fontSize: 16 },
  modalCancelBtnStandard: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  modalCancelTextStandard: { color: "#4B5563", fontWeight: "600", fontSize: 16 },
  modalAmount: { fontSize: 28, fontWeight: "800", marginTop: 15, textAlign: 'center' },
  
  shimmerSummary: { marginHorizontal: 20, marginTop: 12, padding: 16, borderRadius: 14, backgroundColor: "#fff" },
  shimmerBox: { flex: 1, height: 40, borderRadius: 8, marginHorizontal: 4 },
  shimmerCard: { marginHorizontal: 20, marginVertical: 6, padding: 14, borderRadius: 14, backgroundColor: "#fff" },
  shimmerSmall: { width: 50, height: 20, borderRadius: 6 },
  radioRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16, width: "100%", paddingHorizontal: 10 },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, justifyContent: "center", alignItems: "center" },
  radioInner: { width: 12, height: 12, borderRadius: 6 },
  radioText: { fontSize: 15, fontWeight: "600", color: "#111827" },
  
  splitBox: { flexDirection: "row", gap: 15, width: "100%", backgroundColor: "#F3F4F6", padding: 15, borderRadius: 14 },
  splitInputWrap: { flex: 1 },
  splitLabel: { fontSize: 12, fontWeight: "600", color: "#4B5563", marginBottom: 6 },
  splitInputInner: { flexDirection: 'row', alignItems: 'center', backgroundColor: "#fff", borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 10, paddingHorizontal: 10, height: 44 },
  
  proofsContainer: { width: "100%", marginTop: 25, paddingHorizontal: 10 },
  proofsTitle: { fontSize: 13, fontWeight: "600", color: "#4B5563", marginBottom: 12 },
  imagesRow: { flexDirection: "row", gap: 15 },
  addImageBtn: { width: 60, height: 60, borderRadius: 12, borderWidth: 1, borderStyle: "dashed", justifyContent: "center", alignItems: "center", backgroundColor: "#FAFAFA" },
  imagePreviewWrap: { width: 60, height: 60, borderRadius: 12 },
  imagePreview: { width: "100%", height: "100%", borderRadius: 12 },
  removeImageBtn: { position: "absolute", top: -8, right: -8, backgroundColor: "#fff", borderRadius: 12 },

  // BOTTOM SHEET
  bottomSheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  bottomSheetContent: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, elevation: 15 },
  bsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  bsHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bsIconBg: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F0FDF4", justifyContent: 'center', alignItems: 'center' },
  bsTitle: { fontSize: 18, fontWeight: '600', color: "#111827" },
  bsOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F3F4F6", gap: 15 },
  bsOptionIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  bsOptionTitle: { fontSize: 15, fontWeight: '600', color: "#1F2937", marginBottom: 2 },
  bsOptionSub: { fontSize: 12, color: "#6B7280" },
});