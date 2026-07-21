//vechile drivers work history
import AppEmptyState from "@/components/AppEmptyState";
import { executeOfflineSafeRead, executeOfflineSafeWrite, executeOfflineSafeFetch } from "@/utils/offlineHelper";

import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import { useFocusEffect } from "@react-navigation/native";
import * as DocumentPicker from "expo-document-picker";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/store/useStore";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal, Platform,
  SafeAreaView, ScrollView, StatusBar,
  StyleSheet, TextInput, TouchableOpacity,
  View
} from "react-native";
import ShimmerPlaceHolder from "react-native-shimmer-placeholder";
import SmoothBottomSheet from "@/components/ui/SmoothBottomSheet";
import { WebView } from "react-native-webview";

type WorkItem = {
  id: string;
  work: string;
  date: string;
  acres?: string;
  payableAmount?: string;
  advanceAmount?: string;
  finalAmount?: string;
  notes?: string;
  paymentStatus?: string;
  createdAt?: any;
  proofs?: any[];
  paymentMode?: string;
  splitCash?: string;
  splitUpi?: string;
};

export default function DriverHistory() {

  const router = useRouter();
  const { vehicleId, driverId, name, phone, paymentType, monthlySalary } = useLocalSearchParams();
  const isMounted = useRef(true); // 🔥 PRO FIX: Memory leak protection

  // 🔥 URL Params Array లాగా వస్తే క్రాష్ అవ్వకుండా
  const dName = Array.isArray(name) ? name[0] : name;
  const dPhone = Array.isArray(phone) ? phone[0] : phone;
  const vId = Array.isArray(vehicleId) ? vehicleId[0] : vehicleId;
  const dId = Array.isArray(driverId) ? driverId[0] : driverId;
  const dPaymentType = Array.isArray(paymentType) ? paymentType[0] : paymentType;
  const dMonthlySalary = Array.isArray(monthlySalary) ? monthlySalary[0] : monthlySalary;

  const driverWorksMap = useStore(state => state.driverWorks);
  const data = driverWorksMap[`${vId as string}_${dId as string}`] || [];
  const initDriverWorksListener = useStore(state => state.initDriverWorksListener);
  const unsubDriverWorks = useStore(state => state.unsubDriverWorks);

  const [loading, setLoading] = useState(driverWorksMap[`${vId as string}_${dId as string}`] === undefined);
  const [language, setLanguage] = useState<"te" | "en">("te");
  const [expanded, setExpanded] = useState<string | null>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [statusId, setStatusId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<"pending" | "paid">("paid");
  
  const [lockBalance, setLockBalance] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | "both" | "">("");
  const [splitCash, setSplitCash] = useState("");
  const [splitUpi, setSplitUpi] = useState("");
  const [proofs, setProofs] = useState<{uri: string; type: string; name?: string}[]>([]);
  const [photoModal, setPhotoModal] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [viewerProof, setViewerProof] = useState<{url: string, type: string} | null>(null);

  /* ---------------- LOAD ---------------- */

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isMountedLocal = true;

      const load = async () => {
        const lang = await AsyncStorage.getItem("APP_LANG");
        if (lang && isMountedLocal) setLanguage(lang as any);

        const userPhone = await AsyncStorage.getItem("USER_PHONE");
        if (!userPhone || !vId || !dId) {
            if (isMountedLocal) setLoading(false);
            return;
        }

        // 🔥 1. FETCH ACTIVE SESSION
        const userDoc = await executeOfflineSafeRead(firestore().collection("users").doc(userPhone), true);
        const activeSession = userDoc.data()?.activeSession;

        if (!activeSession) {
          if (isMountedLocal) setLoading(false);
          return;
        }

        // 🔥 2. SESSION BASED QUERY WITH ZUSTAND
        initDriverWorksListener(vId as string, dId as string, userPhone, activeSession);
        if (isMountedLocal) setLoading(false);
      };

      load();
      return () => {
        isMountedLocal = false;
        unsubDriverWorks(`${vId as string}_${dId as string}`);
      };
    }, [vId, dId])
  );

  const handleDelete = async () => {
    const userPhone = await AsyncStorage.getItem("USER_PHONE");
    if (!userPhone || !deleteId || !vId || !dId) return;

    try {
        await executeOfflineSafeWrite(firestore()
        .collection("users")
        .doc(userPhone)
        .collection("vehicles")
        .doc(vId)
        .collection("drivers")
        .doc(dId)
        .collection("entries")
        .doc(deleteId)
        .delete());
    } catch (e) {
        console.log("Delete error", e);
    }

    if (isMounted.current) setDeleteId(null);
  };

  // Old handleStatusUpdate is disabled
  const handleStatusUpdate_OLD = async () => {

    const userPhone = await AsyncStorage.getItem("USER_PHONE");
    if (!userPhone || !statusId || !vId || !dId) return;

    try {
        await executeOfflineSafeWrite(firestore()
        .collection("users")
        .doc(userPhone)
        .collection("vehicles")
        .doc(vId)
        .collection("drivers")
        .doc(dId)
        .collection("entries")
        .doc(statusId)
        .update({
            paymentStatus: newStatus
        }));
    } catch (e) {
        console.log("Update error", e);
    }

    if (isMounted.current) setStatusId(null);
  };

  
  const handleConfirmLock = async () => {
    const userPhone = await AsyncStorage.getItem("USER_PHONE");
    if (!userPhone || !statusId || !vId || !dId) return;

    // Validation
    const safeNum = (v: any) => isNaN(Number(v)) ? 0 : Number(v);
    if (lockBalance > 0 && paymentMode === "both") {
      if (safeNum(splitCash) + safeNum(splitUpi) !== lockBalance) return;
    }
    if (lockBalance > 0 && !paymentMode) return;

    setIsLocking(true);

    try {
      // 1. Upload Proofs
      let uploadedProofs: { url: string, type: string, name?: string }[] = [];
      if (proofs.length > 0) {
        for (let i = 0; i < proofs.length; i++) {
            const proof = proofs[i];
            const ext = proof.type === "pdf" ? "pdf" : "jpg";
            const fileName = `proof_${Date.now()}_${i}.${ext}`;
            const refPath = `users/${userPhone}/vehicles/${vId}/drivers/${dId}/entries/${statusId}/proofs/${fileName}`;
            const reference = storage().ref(refPath);
            let uploadUri = proof.uri;
            if (proof.type === "image" && uploadUri.startsWith('file://')) {
              uploadUri = uploadUri.replace('file://', '');
            }
            await reference.putFile(uploadUri);
            const url = await reference.getDownloadURL();
            uploadedProofs.push({ url, type: proof.type, name: proof.name || "" });
        }
      }

      await executeOfflineSafeWrite(firestore()
        .collection("users")
        .doc(userPhone)
        .collection("vehicles")
        .doc(vId)
        .collection("drivers")
        .doc(dId)
        .collection("entries")
        .doc(statusId)
        .update({
            paymentStatus: newStatus,
            paymentMode: lockBalance > 0 ? paymentMode : null,
            splitCash: paymentMode === "both" ? splitCash : null,
            splitUpi: paymentMode === "both" ? splitUpi : null,
            proofs: uploadedProofs.length > 0 ? uploadedProofs : null,
        }));
    } catch (e) {
        console.log("Update error", e);
    } finally {
        if (isMounted.current) {
            setIsLocking(false);
            setStatusId(null);
        }
    }
  };

  /* ---------------- GROUP BY WORK ---------------- */
  const grouped = Object.values(
    data.reduce<Record<string, { work: string; list: WorkItem[] }>>((acc, item) => {
      const w = item.work || "Unknown";
      if (!acc[w]) acc[w] = { work: w, list: [] };
      acc[w].list.push(item);
      return acc;
    }, {})
  );
  
  const cropColors = [
    "#16A34A", "#2563EB", "#F59E0B", "#DC2626",
    "#8B5CF6", "#14B8A6", "#F97316"
  ];

  const getCropColor = (work: string) => {
    let hash = 0;
    for (let i = 0; i < work.length; i++) {
      hash = work.charCodeAt(i) + ((hash << 5) - hash);
    }
    return cropColors[Math.abs(hash) % cropColors.length];
  };

  const ShimmerCard = () => {
    return (
      <View style={styles.cropCard}>
        <View style={{ flexDirection: "row", alignItems: "center", padding: 16 }}>
          <ShimmerPlaceHolder LinearGradient={LinearGradient} style={{ width: 4, height: 30, borderRadius: 4 }} />
          <ShimmerPlaceHolder LinearGradient={LinearGradient} style={{ width: 120, height: 14, marginLeft: 10, borderRadius: 6 }} />
        </View>
        <View style={{ padding: 14 }}>
          <ShimmerPlaceHolder LinearGradient={LinearGradient} style={{ width: "60%", height: 14, borderRadius: 6, marginBottom: 8 }} />
          <ShimmerPlaceHolder LinearGradient={LinearGradient} style={{ width: "90%", height: 12, borderRadius: 6, marginBottom: 6 }} />
          <ShimmerPlaceHolder LinearGradient={LinearGradient} style={{ width: "80%", height: 12, borderRadius: 6, marginBottom: 6 }} />
        </View>
      </View>
    );
  };

  /* ---------------- UI ---------------- */
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      <AppHeader
        title={language === "te" ? "పనుల చరిత్ర" : "Work History"}
        subtitle={language === "te" ? "ఖాతా వివరాలు" : "Account Details"}
        language={language}
      />

      {/* 🔥 INFO BOX (ONLY SHOWS IF THERE IS DATA) */}
      {!loading && data.length > 0 && (
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={20} color="#0284C7" />
          <AppText style={styles.infoText} language={language}>
            {language === "te" 
              ? "గమనిక: పనికి సంబంధించిన చెల్లింపు పూర్తయిన తర్వాత దాన్ని లాక్ చేయండి. లాక్ చేసిన తర్వాత రికార్డును తొలగించడం కుదరదు." 
              : "Note: Mark as paid once the payment is completed. Locked records cannot be deleted."}
          </AppText>
        </View>
      )}
 
      {loading ? (
        <View style={{ padding: 10 }}>
          <ShimmerCard />
          <ShimmerCard />
          <ShimmerCard />
        </View>
      ) : (
        <FlatList
          data={grouped}
          keyExtractor={(item: any) => item.work} 
          contentContainerStyle={[
            { padding: 16, paddingBottom: 120 },
            grouped.length === 0 && { flexGrow: 1, justifyContent: 'center' }
          ]}

          ListEmptyComponent={
            <AppEmptyState
              iconName="clipboard-outline"
              title={language === "te" ? "పనులు లేవు" : "No Works Found"}
              subtitle={language === "te" ? "పనులను చేర్చడానికి + బటన్ నొక్కండి" : "Tap + button to add work"}
              language={language}
            />
          }

          renderItem={({ item }: any) => {
            const isOpen = expanded === item.work;

            return (
              <View style={styles.cropCard}>

                {/* WORK HEADER */}
                <TouchableOpacity activeOpacity={0.7}
                  style={[styles.cropHeader, { alignItems: "center" }]}
                  onPress={() => setExpanded(isOpen ? null : item.work)}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", flex: 1, paddingRight: 10 }}>
                    <View style={{
                      width: 4, height: 50, borderRadius: 4,
                      backgroundColor: getCropColor(item.work), marginRight: 10
                    }} />
                    <View style={{ flex: 1 }}>
                      {/* 🔥 PRO FIX: Truncate long work names */}
                      <AppText style={styles.cropTitle} numberOfLines={1} ellipsizeMode="tail">
                        {item.work}
                      </AppText>
                      <AppText style={styles.cropCount}>
                        {language === "te" ? `${item.list.length} పనులు` : `${item.list.length} Works`}
                      </AppText>
                    </View>
                  </View>

                  {/* 🔥 PRO FIX: PREMIUM CHEVRON BACKGROUND */}
                  <View style={{ width: 32, height: 32, borderRadius: 20, backgroundColor: "#e9e9e9", justifyContent: "center", alignItems: "center" }}>
                    <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={18} color="#4B5563" />
                  </View>
                </TouchableOpacity>

                {/* EXPAND */}
                {isOpen && item.list.map((work: any) => {
                  const amount = Number(work.finalAmount?.toString().replace(/,/g, "") || 0);
                  const isPaid = work.paymentStatus === "paid"; // 🔥 Check if Paid

                  return (
                    <View key={work.id} style={[styles.workCard]}>

                      {/* TOP */}
                      <View style={[styles.rowBetween, { alignItems:'flex-start'}]}>
                        <View>
                          <AppText style={styles.date}>{work.date}</AppText>
                          {work.customerName ? (
                            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                               <Ionicons name="person-outline" size={15} color="#4B5563" style={{ marginRight: 6 }} />
                               <AppText style={{ fontFamily: "Mandali", fontSize: 16, color: "#1F2937", fontWeight: "600" }}>
                                 {work.customerName}
                               </AppText>
                             </View>
                          ) : null}
                        </View>
                        <AppText style={[styles.statusText, { color: isPaid ? "#16A34A" : "#DC2626" }]}>
                          {isPaid
                            ? (language === "te" ? "పూర్తయింది" : "Done (Locked)")
                            : (language === "te" ? "పూర్తి కాలేదు" : "Pending")}
                        </AppText>
                      </View>

                      {/* WORK DETAILS (ACRES / HOURS) */}
                      {(work.workMode === "hourly" || work.workMode === "acres") && (
                        <View style={{ backgroundColor: "#F3F4F6", padding: 10, borderRadius: 8, marginTop: 10 }}>
                          {work.workMode === "hourly" ? (
                            <View style={{ gap: 4 }}>
                              <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
                                <Ionicons name="time-outline" size={14} color="#4B5563" style={{ marginRight: 4 }} />
                                <AppText style={{ fontFamily: "Mandali", fontSize: 14, color: "#4B5563" }}>
                                  {language === "te" ? `పని సమయం: ` : `Work Time: `} 
                                  <AppText style={{ fontWeight: "600", color: "#1F2937" }}>
                                    {work.startTimeRaw ? new Date(work.startTimeRaw).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "--:--"} - {work.endTimeRaw ? new Date(work.endTimeRaw).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "--:--"}
                                  </AppText>
                                </AppText>
                              </View>
                              
                              {work.hasBreak && (
                                <>
                                  {work.breaksRaw && work.breaksRaw.length > 0 ? (
                                    work.breaksRaw.map((b: any, idx: number) => (
                                      <View key={idx} style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginTop: 2 }}>
                                        <Ionicons name="cafe-outline" size={14} color="#EF4444" style={{ marginRight: 4 }} />
                                        <AppText style={{ fontFamily: "Mandali", fontSize: 14, color: "#EF4444" }}>
                                          {language === "te" ? (work.breaksRaw.length > 1 ? `బ్రేక్ ${idx+1} (-): ` : "బ్రేక్ సమయం (-): ") : (work.breaksRaw.length > 1 ? `Break ${idx+1} (-): ` : "Break Time (-): ")}
                                          <AppText style={{ fontWeight: "600", color: "#EF4444" }}>
                                            {b.startTimeRaw ? new Date(b.startTimeRaw).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "--:--"} - {b.endTimeRaw ? new Date(b.endTimeRaw).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "--:--"}
                                          </AppText>
                                        </AppText>
                                      </View>
                                    ))
                                  ) : (
                                    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginTop: 2 }}>
                                      <Ionicons name="cafe-outline" size={14} color="#EF4444" style={{ marginRight: 4 }} />
                                      <AppText style={{ fontFamily: "Mandali", fontSize: 14, color: "#EF4444" }}>
                                        {language === "te" ? "బ్రేక్ సమయం (-): " : "Break Time (-): "}
                                        <AppText style={{ fontWeight: "600", color: "#EF4444" }}>
                                          {work.breakStartTimeRaw ? new Date(work.breakStartTimeRaw).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "--:--"} - {work.breakEndTimeRaw ? new Date(work.breakEndTimeRaw).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "--:--"}
                                        </AppText>
                                      </AppText>
                                    </View>
                                  )}
                                </>
                              )}

                              <View style={{ height: 1, backgroundColor: "#E5E7EB", marginVertical: 4 }} />
                              
                              <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
                                <Ionicons name="checkmark-circle" size={14} color="#16A34A" style={{ marginRight: 4 }} />
                                <AppText style={{ fontFamily: "Mandali", fontSize: 14, color: "#16A34A" }}>
                                  {language === "te" ? `అసలు పని: ` : `Actual Work: `} 
                                  <AppText style={{ fontWeight: "600", color: "#16A34A" }}>{work.totalHoursStr}</AppText>
                                </AppText>
                              </View>
                            </View>
                          ) : (
                            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
                              <Ionicons name="map-outline" size={14} color="#4B5563" style={{ marginRight: 4 }} />
                              <AppText style={{ fontFamily: "Mandali", fontSize: 14, color: "#4B5563" }}>
                                {language === "te" ? `విస్తీర్ణం: ` : `Area: `}
                                <AppText style={{ fontWeight: "600", color: "#1F2937" }}>{work.acresWorked} {language === "te" ? "ఎకరాలు" : "Acres"}</AppText>
                              </AppText>
                            </View>
                          )}
                        </View>
                      )}

                      {/* DETAILS */}
                      <View style={[styles.detailsGrid, { marginTop: 15 }]}>
                        <View style={styles.detailItem}>
                          <View style={styles.leftPart}>
                            <Ionicons name="cash-outline" size={14} color="#6B7280" />
                            <AppText style={styles.label}>{language === "te" ? "కూలి:" : "Wage:"}</AppText>
                          </View>
                          <AppText style={styles.value}>₹ {Number(work.payableAmount || 0).toLocaleString("en-IN")}</AppText>
                        </View>

                        <View style={styles.detailItem}>
                          <View style={styles.leftPart}>
                            <Ionicons name="wallet-outline" size={14} color="#6B7280" />
                            <AppText style={styles.label}>{language === "te" ? "అడ్వాన్స్:" : "Advance:"}</AppText>
                          </View>
                          <AppText style={styles.value}>₹ {Number(work.advanceAmount || 0).toLocaleString("en-IN")}</AppText>
                        </View>
                      </View>

                      {/* PAYMENT STATUS TOGGLE */}
                      <View style={styles.statusRow}>
                        <AppText style={[styles.statusText, { color: isPaid ? "#16A34A" : "#DC2626" }]}>
                          {isPaid
                            ? (language === "te" ? "చెల్లింపు పూర్తయింది" : "Payment Done (Locked)")
                            : (language === "te" ? "డబ్బులు ఇవ్వాలి" : "Payment Pending")}
                        </AppText>
                        <TouchableOpacity
                          activeOpacity={isPaid ? 1 : 0.8}
                          disabled={isPaid}
                          style={[styles.toggle, { backgroundColor: isPaid ? "#16A34A" : "#DC2626", opacity: isPaid ? 0.6 : 1 }]}
                          onPress={() => {
                            if (isPaid) return;
                            setStatusId(work.id);
                            setNewStatus("paid");
                            setLockBalance(amount);
                            setPaymentMode("");
                            setSplitCash("");
                            setSplitUpi("");
                            setProofs([]);
                          }}
                        >
                          <View style={[styles.toggleCircle, { alignSelf: isPaid ? "flex-end" : "flex-start" }]} />
                        </TouchableOpacity>
                      </View>

                      {/* FINAL + DELETE */}
                      <View style={styles.bottomRow}>
                        <AppText style={[styles.finalAmount, isPaid && {color: "#16A34A"}]}>₹ {amount.toLocaleString("en-IN")}</AppText>
                        
                        {isPaid ? (
                          <View style={[styles.deleteBtn, { backgroundColor: '#DCFCE7' }]}>
                             <Ionicons name="lock-closed" size={16} color="#16A34A" />
                          </View>
                        ) : (
                          <TouchableOpacity activeOpacity={0.7} style={styles.deleteBtn} onPress={() => setDeleteId(work.id)}>
                            <Ionicons name="trash" size={16} color="#DC2626" />
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* PAYMENT DETAILS (IF PAID) */}
                      {isPaid && work.paymentMode && (
                        <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#E5E7EB" }}>
                          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: work.paymentMode === "both" ? 6 : 0 }}>
                            <Ionicons name="card-outline" size={16} color="#4B5563" style={{ marginRight: 6 }} />
                            <AppText style={{ fontSize: 13, color: "#4B5563", fontFamily: "Mandali", fontWeight: "600" }}>
                              {language === "te" ? "చెల్లింపు విధానం:" : "Payment Mode:"} 
                              <AppText style={{ color: "#1F2937" }}>
                                {work.paymentMode === "cash" ? (language === "te" ? " నగదు" : " Cash") : work.paymentMode === "upi" ? (language === "te" ? " ఆన్‌లైన్ పే" : " UPI") : (language === "te" ? " నగదు + ఆన్‌లైన్ పే" : " Cash + UPI")}
                              </AppText>
                            </AppText>
                          </View>
                          {work.paymentMode === "both" && (
                            <View style={{ flexDirection: "row", gap: 16, marginLeft: 22 }}>
                              <AppText style={{ fontSize: 13, color: "#6B7280", fontFamily: "Mandali" }}>
                                {language === "te" ? "నగదు" : "Cash"}: <AppText style={{ color: "#1F2937", fontWeight: "600" }}>₹{work.splitCash || 0}</AppText>
                              </AppText>
                              <AppText style={{ fontSize: 13, color: "#6B7280", fontFamily: "Mandali" }}>
                                {language === "te" ? "ఆన్‌లైన్" : "UPI"}: <AppText style={{ color: "#1F2937", fontWeight: "600" }}>₹{work.splitUpi || 0}</AppText>
                              </AppText>
                            </View>
                          )}
                        </View>
                      )}

                      {/* UPLOADED PROOFS IN APP VIEWER */}
                      {isPaid && work.proofs && work.proofs.length > 0 && (
                        <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#E5E7EB" }}>
                          <AppText style={{ fontSize: 13, color: "#6B7280", fontFamily: "Mandali", marginBottom: 8 }}>
                            {language === "te" ? "ఆధారాలు (Proofs):" : "Attached Proofs:"}
                          </AppText>
                          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                            {work.proofs.map((p: any, idx: number) => (
                              <TouchableOpacity key={idx} activeOpacity={0.8} onPress={() => setViewerProof({ url: p.url, type: p.type })}>
                                {p.type === "image" ? (
                                  <Image source={{ uri: p.url }} style={{ width: 60, height: 60, borderRadius: 8, borderWidth: 1, borderColor: "#E5E7EB" }} contentFit="cover" />
                                ) : (
                                  <View style={{ width: 60, height: 60, borderRadius: 8, backgroundColor: "#FEE2E2", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#FCA5A5" }}>
                                    <Ionicons name="document-text" size={24} color="#DC2626" />
                                  </View>
                                )}
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      )}

                      {/* NOTES */}
                      {work.notes ? (
                        <View style={styles.notesBox}>
                          <Ionicons name="document-text-outline" size={14} color="#6B7280" style={{ marginTop: 2 }} />
                          <AppText style={styles.notesText} numberOfLines={2} ellipsizeMode="tail">{work.notes}</AppText>
                        </View>
                      ) : null}

                      

                    </View>
                  );
                })}

                      {/* GROUP WHATSAPP SHARE BUTTON */}
                      <View style={{ padding: 14, borderTopWidth: 1, borderTopColor: "#E5E7EB", backgroundColor: "#F9FAFB" }}>
                        <TouchableOpacity
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: "#E5F6EB",
                            paddingVertical: 10,
                            borderRadius: 8,
                          }}
                          activeOpacity={0.8}
                          onPress={() => {
                            let msg = `🚜 *Kisan Khata - ${item.work} Report*\n\n`;
                            
                            item.list.forEach((work: any, index: number) => {
                              msg += `*${index + 1}. రైతు పేరు:* ${work.customerName || 'N/A'}\n`;
                              msg += `📅 *తేదీ:* ${work.date}\n`;
                              
                              if (work.workMode === "hourly") {
                                const st = work.startTimeRaw ? new Date(work.startTimeRaw).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "--:--";
                                const et = work.endTimeRaw ? new Date(work.endTimeRaw).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "--:--";
                                msg += `⏰ *సమయం:* ${st} - ${et}\n`;
                                if (work.hasBreak) {
                                  if (work.breaksRaw && work.breaksRaw.length > 0) {
                                    work.breaksRaw.forEach((b: any, idx: number) => {
                                      const bs = b.startTimeRaw ? new Date(b.startTimeRaw).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "--:--";
                                      const be = b.endTimeRaw ? new Date(b.endTimeRaw).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "--:--";
                                      msg += `☕ *${work.breaksRaw.length > 1 ? `బ్రేక్ ${idx+1}` : "బ్రేక్ సమయం"} (-):* ${bs} - ${be}\n`;
                                    });
                                  } else {
                                    const bs = work.breakStartTimeRaw ? new Date(work.breakStartTimeRaw).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "--:--";
                                    const be = work.breakEndTimeRaw ? new Date(work.breakEndTimeRaw).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "--:--";
                                    msg += `☕ *బ్రేక్ సమయం (-):* ${bs} - ${be}\n`;
                                  }
                                }
                                msg += `⏱️ *అసలు పని (గంటలు):* ${work.totalHoursStr || '0'}\n`;
                              } else {
                                msg += `📏 *విస్తీర్ణం:* ${work.acresWorked || 0} ఎకరాలు\n`;
                              }
                              
                              const wage = Number(work.payableAmount || 0);
                              const adv = Number(work.advanceAmount || 0);
                              const amt = Number(work.finalAmount?.toString().replace(/,/g, "") || 0);
                              
                              msg += `💵 *కూలి:* ₹${wage.toLocaleString("en-IN")}\n`;
                              if (adv > 0) {
                                msg += `✂️ *అడ్వాన్స్ కటింగ్:* ₹${adv.toLocaleString("en-IN")}\n`;
                              }
                              msg += `💰 *ఇవ్వాల్సిన బ్యాలెన్స్ (నెట్):* ₹${amt.toLocaleString("en-IN")}\n`;
                              
                              const isPaid = work.paymentStatus === "paid";
                              if (isPaid) {
                                  msg += `✅ *స్టేటస్:* చెల్లింపు పూర్తయింది (Paid)\n`;
                                  if (work.paymentMode) {
                                      let pMode = work.paymentMode === "cash" ? (language === "te" ? "నగదు" : "Cash") : work.paymentMode === "upi" ? (language === "te" ? "ఆన్‌లైన్ పే" : "UPI") : (language === "te" ? "నగదు + ఆన్‌లైన్ పే" : "Cash + UPI");
                                      msg += `- ${language === "te" ? "విధానం" : "Mode"}: ${pMode}\n`;
                                      if (work.paymentMode === "both") {
                                          msg += `  • ${language === "te" ? "నగదు" : "Cash"}: ₹${work.splitCash || 0}\n`;
                                          msg += `  • ${language === "te" ? "ఆన్‌లైన్ పే" : "UPI"}: ₹${work.splitUpi || 0}\n`;
                                      }
                                  }
                              } else {
                                  msg += `❌ *స్టేటస్:* పూర్తి కాలేదు (Pending)\n`;
                              }

                              if (work.proofs && work.proofs.length > 0) {
                                  msg += `📎 *ఆధారాలు (Proofs):*\n`;
                                  work.proofs.forEach((p: any, idx: number) => {
                                      msg += `  ${idx + 1}. ${p.url}\n`;
                                  });
                              }
                              if (work.notes) {
                                  msg += `📝 *నోట్స్:* ${work.notes}\n`;
                              }
                              msg += `\n`; // blank line between entries
                            });
                            
                            Linking.openURL(`whatsapp://send?text=${encodeURIComponent(msg.trim())}`);
                          }}
                        >
                          <Ionicons name="logo-whatsapp" size={20} color="#16A34A" />
                          <AppText style={{ color: "#16A34A", fontWeight: "600", marginLeft: 8, fontSize: 14, fontFamily: "Mandali" }}>
                            {language === "te" ? "వాట్సాప్ లో షేర్ చేయండి" : "Share on WhatsApp"}
                          </AppText>
                        </TouchableOpacity>
                      </View>

              </View>
            );
          }}
        />
      )}

      {/* FAB */}
      <TouchableOpacity activeOpacity={0.8}
        style={styles.addBtn}
        onPress={() =>
          router.push({
            pathname: "/farmer/vechile-drivers/add-driverwork",    
            params: { 
              vehicleId: vId, 
              driverId: dId,
              paymentType: dPaymentType,
              monthlySalary: dMonthlySalary
            }
          })
        }
      >
        <LinearGradient colors={["#16A34A","#166534"]} style={styles.addGradient}>
          <Ionicons name="add" size={30} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
      
      
      {/* LOCK MODAL */}
      <Modal visible={!!statusId} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.modalOverlayStandard}>
          <View style={[styles.modalContentStandard, { padding: 0, overflow: 'hidden', maxHeight: '90%' }]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, alignItems: "center", width: '100%' }}>
              <View style={[styles.modalIconBgStandard, { backgroundColor: "#DCFCE7" }]}>
                <Ionicons name="wallet-outline" size={34} color="#16A34A" />
              </View>

              <AppText style={[styles.modalTitleStandard, { color: "#1F2937" }]}>
                {language === "te" ? "చెల్లింపు నిర్ధారణ" : "Confirm Payment"}
              </AppText>

              {lockBalance > 0 ? (
                <>
                  <AppText style={[styles.modalSubStandard, { marginBottom: 15 }]}>
                    {language === "te" 
                      ? `మీరు బ్యాలెన్స్ ₹${lockBalance} కి ఎలా చెల్లించారు?` 
                      : `How did you pay the balance ₹${lockBalance}?`}
                  </AppText>

                  <View style={{ flexDirection: "row", backgroundColor: "#F3F4F6", borderRadius: 12, padding: 4, width: "100%", marginTop: 5, marginBottom: 10 }}>
                    <TouchableOpacity
                      style={[{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center", justifyContent: "center" }, paymentMode === "cash" && { backgroundColor: "#16A34A", elevation: 2, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } }]}
                      onPress={() => setPaymentMode("cash")}
                    >
                      <AppText style={[{ fontSize: 14, color: "#6B7280", fontWeight: "500", fontFamily: "Mandali" }, paymentMode === "cash" && { color: "#ffffff", fontWeight: "600" }]}>
                        {language === "te" ? "నగదు" : "Cash"}
                      </AppText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center", justifyContent: "center" }, paymentMode === "upi" && { backgroundColor: "#16A34A", elevation: 2, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } }]}
                      onPress={() => setPaymentMode("upi")}
                    >
                      <AppText style={[{ fontSize: 14, color: "#6B7280", fontWeight: "500", fontFamily: "Mandali" }, paymentMode === "upi" && { color: "#ffffff", fontWeight: "600" }]}>
                        {language === "te" ? "ఆన్‌లైన్ పే" : "Online Pay"}
                      </AppText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center", justifyContent: "center" }, paymentMode === "both" && { backgroundColor: "#16A34A", elevation: 2, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } }]}
                      onPress={() => setPaymentMode("both")}
                    >
                      <AppText style={[{ fontSize: 14, color: "#6B7280", fontWeight: "500", fontFamily: "Mandali" }, paymentMode === "both" && { color: "#ffffff", fontWeight: "600" }]}>
                        {language === "te" ? "రెండూ" : "Both"}
                      </AppText>
                    </TouchableOpacity>
                  </View>

                  {paymentMode === "both" && (
                    <View style={{ width: "100%", marginTop: 20 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", width: "100%" }}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <AppText style={{ fontSize: 12, color: "#4B5563", marginBottom: 6, fontFamily: "Mandali" }}>{language === "te" ? "క్యాష్ ఎంత?" : "Cash Amount"}</AppText>
                          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: "#fff", borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 10, paddingHorizontal: 10, height: 44 }}>
                            <AppText style={{ fontSize: 16, color: "#6B7280", marginRight: 5 }}>₹</AppText>
                            <TextInput keyboardType="numeric" style={{ flex: 1, fontSize: 16, color: "#1F2937", fontFamily: "Mandali", paddingVertical: 0 }} value={splitCash} onChangeText={setSplitCash} placeholder="0" placeholderTextColor={'#9CA3AF'} />
                          </View>
                        </View>
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <AppText style={{ fontSize: 12, color: "#4B5563", marginBottom: 6, fontFamily: "Mandali" }}>{language === "te" ? "యూపీఐ ఎంత?" : "UPI Amount"}</AppText>
                          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: "#fff", borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 10, paddingHorizontal: 10, height: 44 }}>
                            <AppText style={{ fontSize: 16, color: "#6B7280", marginRight: 5 }}>₹</AppText>
                            <TextInput keyboardType="numeric" style={{ flex: 1, fontSize: 16, color: "#1F2937", fontFamily: "Mandali", paddingVertical: 0 }} value={splitUpi} onChangeText={setSplitUpi} placeholder="0" placeholderTextColor={'#9CA3AF'} />
                          </View>
                        </View>
                      </View>
                      
                      {(splitCash !== "" || splitUpi !== "") && ((isNaN(Number(splitCash))?0:Number(splitCash)) + (isNaN(Number(splitUpi))?0:Number(splitUpi)) !== lockBalance) && (
                        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, paddingHorizontal: 5, gap: 5 }}>
                          <Ionicons name="information-circle" size={16} color="#DC2626" />
                          <AppText style={{ color: "#DC2626", fontSize: 12, fontWeight: "500", flex: 1 }}>
                            {language === "te" ? `క్యాష్, యూపీఐ రెండూ కలిపితే మొత్తం ₹${lockBalance} కి సమానం అవ్వాలి.` : `Sum of Cash & UPI must equal ₹${lockBalance}.`}
                          </AppText>
                        </View>
                      )}
                    </View>
                  )}
                </>
              ) : (
                <AppText style={[styles.modalSubStandard, { marginBottom: 15 }]}>
                  {language === "te" 
                    ? `బ్యాలెన్స్ ₹0 కాబట్టి, చెల్లింపు విధానం అవసరం లేదు. ఈ నెలను లాక్ చేయాలా?` 
                    : `Balance is ₹0. No payment method required. Do you want to lock this month?`}
                </AppText>
              )}

              {/* UPLOAD PROOFS */}
              <View style={{ width: "100%", marginTop: 20, marginBottom: 25 }}>
                <AppText style={{ fontSize: 13, color: "#6B7280", marginBottom: 12, fontWeight: "600", fontFamily: "Mandali" }}>{language === "te" ? "ఆధారాలు (Proofs) - Max 2" : "Upload Proofs - Max 2"}</AppText>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                  {proofs.map((proof, idx) => (
                    <View key={idx} style={{ position: "relative" }}>
                      {proof.type === "image" ? (
                        <Image source={{ uri: proof.uri }} style={{ width: 70, height: 70, borderRadius: 10, backgroundColor: "#E5E7EB" }} contentFit="cover" />
                      ) : (
                        <View style={[{ width: 70, height: 70, borderRadius: 10, backgroundColor: "#E5E7EB" }, { backgroundColor: "#FEE2E2", justifyContent: "center", alignItems: "center" }]}>
                          <Ionicons name="document-text" size={28} color="#DC2626" />
                        </View>
                      )}
                      <TouchableOpacity style={{ position: "absolute", top: -8, right: -8, backgroundColor: "#fff", borderRadius: 12 }} onPress={() => setProofs(prev => prev.filter((_, i) => i !== idx))}>
                        <Ionicons name="close-circle" size={24} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {proofs.length < 2 && (
                    <TouchableOpacity style={[{ width: 70, height: 70, borderRadius: 10, backgroundColor: "#E5E7EB" }, { backgroundColor: "#F0FDF4", borderWidth: 1, borderColor: "#16A34A", borderStyle: "dashed", justifyContent: "center", alignItems: "center" }]} onPress={() => setPhotoModal(true)}>
                      <Ionicons name="cloud-upload-outline" size={24} color="#16A34A" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.modalButtonsStandard}>
                <TouchableOpacity style={styles.modalCancelBtnStandard} onPress={() => setStatusId(null)} disabled={isLocking}>
                  <AppText style={styles.modalCancelTextStandard}>{language === "te" ? "రద్దు చేయి" : "Cancel"}</AppText>
                </TouchableOpacity>
                <TouchableOpacity 
                  activeOpacity={0.9} 
                  onPress={handleConfirmLock}
                  disabled={isLocking || (lockBalance > 0 && !paymentMode) || (lockBalance > 0 && paymentMode === "both" && ((isNaN(Number(splitCash))?0:Number(splitCash)) + (isNaN(Number(splitUpi))?0:Number(splitUpi)) !== lockBalance))}
                  style={[styles.modalConfirmBtnStandard, { backgroundColor: (isLocking || (lockBalance > 0 && !paymentMode) || (lockBalance > 0 && paymentMode === "both" && ((isNaN(Number(splitCash))?0:Number(splitCash)) + (isNaN(Number(splitUpi))?0:Number(splitUpi)) !== lockBalance))) ? "#D1D5DB" : "#16A34A" }]}
                >
                  {isLocking ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <AppText style={styles.modalConfirmTextStandard}>{language === "te" ? "లాక్ చేయి" : "Lock Payment"}</AppText>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* PHOTO UPLOAD MODAL */}
      <SmoothBottomSheet visible={photoModal} onClose={() => setPhotoModal(false)}>
        <View style={{ padding: 24, paddingBottom: 0 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#EFF6FF", justifyContent: "center", alignItems: "center", marginRight: 12 }}>
                <Ionicons name="cloud-upload" size={22} color="#2563EB" />
              </View>
              <AppText style={{ fontSize: 18, fontWeight: "600", color: "#1F2937", fontFamily: "Mandali" }}>
                {language === "te" ? "ఆధారం అప్లోడ్ చేయండి" : "Upload Proof"}
              </AppText>
            </View>
            <TouchableOpacity onPress={() => setPhotoModal(false)} hitSlop={{top:10, bottom:10, left:10, right:10}}>
              <Ionicons name="close" size={26} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F9FAFB", padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: "#F3F4F6" }} activeOpacity={0.8} onPress={async () => {
            setPhotoModal(false);
            if (proofs.length >= 2) return;
            const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.2 });
            if (!result.canceled) setProofs(prev => [...prev, { uri: result.assets[0].uri, type: "image" }]);
          }}>
            <View style={[{ width: 48, height: 48, borderRadius: 12, justifyContent: "center", alignItems: "center", marginRight: 16 }, { backgroundColor: "#EFF6FF" }]}><Ionicons name="camera" size={24} color="#3B82F6" /></View>
            <View>
              <AppText style={{ fontSize: 16, fontWeight: "600", color: "#1F2937", fontFamily: "Mandali" }}>{language === "te" ? "కెమెరా ద్వారా" : "Take Photo"}</AppText>
              <AppText style={{ fontSize: 13, color: "#6B7280", marginTop: 2, fontFamily: "Mandali" }}>{language === "te" ? "ఇప్పుడే ఫోటో తీయండి" : "Capture a live photo"}</AppText>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F9FAFB", padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: "#F3F4F6" }} activeOpacity={0.8} onPress={async () => {
            setPhotoModal(false);
            if (proofs.length >= 2) return;
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.2 });
            if (!result.canceled) setProofs(prev => [...prev, { uri: result.assets[0].uri, type: "image" }]);
          }}>
            <View style={[{ width: 48, height: 48, borderRadius: 12, justifyContent: "center", alignItems: "center", marginRight: 16 }, { backgroundColor: "#F0FDF4" }]}><Ionicons name="images" size={24} color="#16A34A" /></View>
            <View>
              <AppText style={{ fontSize: 16, fontWeight: "600", color: "#1F2937", fontFamily: "Mandali" }}>{language === "te" ? "గ్యాలరీ నుండి" : "Gallery"}</AppText>
              <AppText style={{ fontSize: 13, color: "#6B7280", marginTop: 2, fontFamily: "Mandali" }}>{language === "te" ? "పాత ఫోటో ఎంచుకోండి" : "Choose an existing photo"}</AppText>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F9FAFB", padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: "#F3F4F6" }} activeOpacity={0.8} onPress={async () => {
            setPhotoModal(false);
            if (proofs.length >= 2) return;
            try {
              const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
              if (!result.canceled && result.assets && result.assets.length > 0) {
                setProofs(prev => [...prev, { uri: result.assets[0].uri, type: "pdf", name: result.assets[0].name }]);
              }
            } catch(e){}
          }}>
            <View style={[{ width: 48, height: 48, borderRadius: 12, justifyContent: "center", alignItems: "center", marginRight: 16 }, { backgroundColor: "#FEF2F2" }]}><Ionicons name="document-text" size={24} color="#DC2626" /></View>
            <View>
              <AppText style={{ fontSize: 16, fontWeight: "600", color: "#1F2937", fontFamily: "Mandali" }}>{language === "te" ? "PDF డాక్యుమెంట్" : "PDF Document"}</AppText>
              <AppText style={{ fontSize: 13, color: "#6B7280", marginTop: 2, fontFamily: "Mandali" }}>{language === "te" ? "రసీదు ఫైల్ ఎంచుకోండి" : "Upload a receipt file"}</AppText>
            </View>
          </TouchableOpacity>
        </View>
      </SmoothBottomSheet>

      
      {/* FULLSCREEN PROOF VIEWER MODAL */}
      <Modal visible={!!viewerProof} transparent animationType="fade" statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "center", alignItems: "center" }}>
          
          <TouchableOpacity 
            style={{ position: "absolute", top: Platform.OS === 'ios' ? 50 : 30, right: 20, zIndex: 10, padding: 10, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 30 }} 
            onPress={() => setViewerProof(null)}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>

          {viewerProof?.type === "image" ? (
            <Image 
              source={{ uri: viewerProof.url }} 
              style={{ width: "95%", height: "80%", borderRadius: 10 }} 
              contentFit="contain" 
            />
          ) : viewerProof?.type === "pdf" ? (
            <View style={{ width: "95%", height: "80%", borderRadius: 10, overflow: 'hidden', backgroundColor: "#fff" }}>
              <WebView 
                source={{ uri: Platform.OS === 'android' ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(viewerProof.url)}` : viewerProof.url }} 
                style={{ flex: 1 }} 
                startInLoadingState={true}
              />
            </View>
          ) : null}

        </View>
      </Modal>



      {/* DELETE MODAL */}
      <Modal visible={!!deleteId} transparent animationType="fade">
        <View style={styles.modalOverlayStandard}>
          <View style={styles.modalContentStandard}>
            <View style={styles.modalIconBgStandard}>
              <Ionicons name="trash-outline" size={36} color="#e44830" />
            </View>
            <AppText style={styles.modalTitleStandard}>{language === "te" ? "తొలగించాలా?" : "Delete Work?"}</AppText>
            <AppText style={styles.modalSubStandard}>
              {language === "te" ? "ఈ పనిని తొలగించాలనుకుంటున్నారా?" : "Are you sure you want to delete this work?"}
            </AppText>
            <View style={styles.modalButtonsStandard}>
              <TouchableOpacity activeOpacity={0.8} style={styles.modalCancelBtnStandard} onPress={() => setDeleteId(null)}>
                <AppText style={styles.modalCancelTextStandard}>{language === "te" ? "రద్దు చేయి" : "Cancel"}</AppText>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.8} style={styles.modalConfirmBtnStandard} onPress={handleDelete}>
                <AppText style={styles.modalConfirmTextStandard}>{language === "te" ? "తొలగించు" : "Delete"}</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      


    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" }, // Lighter background for premium look
  
  infoBanner: {
    flexDirection: "row",
    backgroundColor: "#DBEAFE", 
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#BFDBFE"
  },
  infoText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: "#1E3A8A",
    lineHeight: 22,
    fontFamily: "Mandali"
  },

  cropCard: { backgroundColor: "#fff", borderRadius: 16, marginBottom: 12, overflow: "hidden", borderWidth: 1, borderColor: "#E5E7EB", marginHorizontal: 4 },
  cropHeader: { flexDirection: "row", justifyContent: "space-between", padding: 16, backgroundColor: "#F9FAFB" },
  cropTitle: { fontSize: 20, fontWeight: "600", color: "#111827" },
  cropCount: { fontSize: 15, color: "#6B7280", marginTop: 2 },
  detailItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  leftPart: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: { fontSize: 12, color: "#6B7280" },
  value: { fontSize: 12, fontWeight: "600", color: "#111827", textAlign: "right" },
  detailsGrid: { marginTop: 10, gap: 8 },
  bottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 },
  finalAmount: { fontSize: 17, fontWeight: "600", color: "#111827" },
  deleteBtn: { backgroundColor: "#FEE2E2", padding: 8, borderRadius: 10 },
  notesBox: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#E5E7EB" },
  notesText: { fontSize: 14, color: "#374151", flex: 1, lineHeight: 24 },
  workCard: { padding: 14, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between" },
  date: { fontSize: 12, color: "#6B7280" },
  addBtn: { position: "absolute", bottom: 30, right: 20 },
  addGradient: { width: 60, height: 60, borderRadius: 30, justifyContent: "center", alignItems: "center", elevation: 5, shadowColor: "#000", shadowOffset:{width:0, height:2}, shadowOpacity:0.2, shadowRadius:4 },
  statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  statusText: { fontSize: 12, fontWeight: "600" },
  toggle: { width: 40, height: 20, borderRadius: 20, padding: 2, justifyContent: "center" },
  toggleCircle: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#fff" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", zIndex: 999 },
  modalBox: { backgroundColor: "#fff", padding: 24, borderRadius: 20, width: "80%", alignItems: "center", elevation: 10 },
  modalTitleText: { marginTop: 10, fontSize: 18, fontWeight: "600", color: "#111827", textAlign: "center" }, // Changed to avoid clash with other modalTitle
  modalSub: { fontSize: 13, color: "#6B7280", marginTop: 8, textAlign: "center", lineHeight: 20 },
  modalRow: { flexDirection: "row", marginTop: 20, gap: 12 }, // 🔥 PRO FIX: Standardized gap
  iconBg: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#FEE2E2", justifyContent: "center", alignItems: "center", marginBottom: 10 },
  iconBg1: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#DCFCE7", justifyContent: "center", alignItems: "center", marginBottom: 10 },
  cancelBtn: { flex: 1, paddingVertical: 12, backgroundColor: "#F1F5F9", borderRadius: 12, alignItems: "center" },
  deleteConfirmBtn: { flex: 1, paddingVertical: 12, backgroundColor: "#16A34A", borderRadius: 12, alignItems: "center" },
  deleteConfirmBtn1: { flex: 1, padding: 12, backgroundColor: "#DC2626", borderRadius: 12, alignItems: "center" },
  
  // UNIFIED PREMIUM MODAL CLASSES
  modalOverlayStandard: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 999 },
  modalContentStandard: { width: "80%", backgroundColor: "white", borderRadius: 25, padding: 25, alignItems: "center" },
  modalTitleStandard: { fontSize: 20, fontWeight: "500", color: "#e2431f", marginVertical: 10 },
  modalSubStandard: { textAlign: "center", color: "#64748B", marginBottom: 25 },
  modalButtonsStandard: { flexDirection: "row", gap: 10 },
  modalCancelBtnStandard: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" },
  modalConfirmBtnStandard: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center" },
  modalCancelTextStandard: { color: "#64748B", fontWeight: "500" },
  modalConfirmTextStandard: { color: "white", fontWeight: "500" },
  modalIconBgStandard: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#f5e8e8", justifyContent: "center", alignItems: "center", marginBottom: 10 },
});