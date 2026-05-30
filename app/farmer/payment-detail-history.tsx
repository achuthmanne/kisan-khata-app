// app/farmer/mestripayments/history.tsx (లేదా నీ ఫైల్ పేరు)

import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";
import AppEmptyState from "@/components/AppEmptyState"; 
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState, useRef } from "react";
import ShimmerPlaceHolder from "react-native-shimmer-placeholder";
import { LinearGradient } from "expo-linear-gradient";
import { LayoutAnimation, Platform, UIManager, Linking, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { WebView } from "react-native-webview";
import {
  FlatList,
  Modal,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
  RefreshControl
} from "react-native";

/* 🔥 CURRENCY FORMATTER (Indian Style: 1,00,000) */
const formatCurrency = (amount: number | string) => {
  const num = Number(amount) || 0;
  return num.toLocaleString('en-IN');
};

export default function PaymentDetailHistory() {
  const { mestriId, name, village } = useLocalSearchParams();

  const isMounted = useRef(true);

  const [grouped, setGrouped] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false); 
  const [refreshing, setRefreshing] = useState(false); 
  const [activeSession, setActiveSession] = useState("");
  const [language, setLanguage] = useState<"te" | "en">("te");
  
  const [openCrop, setOpenCrop] = useState<string | null>(null);
  const [openWork, setOpenWork] = useState<string | null>(null);

  const [deleteId, setDeleteId] = useState("");
  const [fullScreenImg, setFullScreenImg] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [summary, setSummary] = useState({ payments: 0, days: 0, paidDays: 0 });
  const [status, setStatus] = useState({ label: "", color: "#000" });
  const [modalVisible, setModalVisible] = useState(false);
  const [dateMap, setDateMap] = useState<any>({});

  const cropColors = ["#22C55E", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6"];
  const workColors = ["#06B6D4", "#84CC16", "#F97316", "#6366F1", "#EC4899"];

  const getCropColor = (crop: string) => cropColors[crop.charCodeAt(0) % cropColors.length];
  const getWorkColor = (work: string) => workColors[work.charCodeAt(0) % workColors.length];

  useEffect(() => {
    isMounted.current = true;
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
    return () => { isMounted.current = false; };
  }, []);

  const loadData = async (isRefreshed = false) => {
    try {
      if (!isRefreshed) setLoading(true);
      setError(false);

      const userPhone = await AsyncStorage.getItem("USER_PHONE");
      if (!userPhone) throw new Error("NO_USER");

      const userDoc = await firestore().collection("users").doc(userPhone).get();
      const session = userDoc.data()?.activeSession;

      if (!session) {
        if (isMounted.current) { setLoading(false); setRefreshing(false); }
        return;
      }

      if (isMounted.current) setActiveSession(session);

      const snap = await firestore()
        .collection("users")
        .doc(userPhone)
        .collection("payments")
        .where("mestriId", "==", mestriId)
        .where("session", "==", session)
        .get();

      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      
      if (!list.length) {
        if (isMounted.current) {
          setGrouped({});
          setSummary({ payments: 0, days: 0, paidDays: 0 }); 
          setStatus({ label: "Not Paid", color: "#EF4444" }); 
          setLoading(false);
          setRefreshing(false);
        }
        return;
      }

      const attendanceSnap = await firestore()
        .collection("users")
        .doc(userPhone)
        .collection("mestris")
        .doc(mestriId as string)
        .collection("attendance")
        .where("session", "==", session) 
        .get();

      const totalDays = attendanceSnap.size;
      let totalPayments = 0;
      let paidDays = 0;

      list.forEach((item) => {
        totalPayments += 1;
        paidDays += item.details?.totalDays || 0;
      });

      let newStatus;
      if (paidDays === 0) newStatus = { label: "Not Paid", color: "#EF4444" };
      else if (paidDays < totalDays) newStatus = { label: "Pending", color: "#F59E0B" };
      else newStatus = { label: "Cleared", color: "#22C55E" };

      const promises = list.map(async (item) => {
        const ids = item.selectedAttendanceIds || [];
        if (ids.length === 0) return null;

        const docPromises = ids.map((attId: string) =>
          firestore()
            .collection("users")
            .doc(userPhone)
            .collection("mestris")
            .doc(mestriId as string)
            .collection("attendance")
            .doc(attId)
            .get()
        );

        const docs = await Promise.all(docPromises);
        
        // 🔥 PRO FIX: Safe Date Sorter (Ascending Order 17 -> 19)
        const dates = docs
          .map((d) => d.data()?.date)
          .filter(Boolean)
          .sort((a, b) => {
            const parseSafeDate = (dStr: string) => {
              if (dStr.includes("/")) {
                const [d, m, y] = dStr.split("/");
                return new Date(`${y}-${m}-${d}`).getTime();
              }
              if (dStr.includes("-") && dStr.split("-")[0].length <= 2) {
                const [d, m, y] = dStr.split("-");
                return new Date(`${y}-${m}-${d}`).getTime();
              }
              return new Date(dStr).getTime();
            };
            return parseSafeDate(a) - parseSafeDate(b); 
          });

        return { id: item.id, dates };
      });

      const results = (await Promise.all(promises)).filter(Boolean);
      const finalMap: any = {};
      results.forEach((r: any) => { finalMap[r.id] = r.dates; });

      const group: any = {};
      list.forEach((item) => {
        const crop = item.crop || "Others";
        const work = item.work || "Other";
        if (!group[crop]) group[crop] = {};
        if (!group[crop][work]) group[crop][work] = [];
        group[crop][work].push(item);
      });

      if (isMounted.current) {
        setSummary({ payments: totalPayments, days: totalDays, paidDays: paidDays });
        setStatus(newStatus);
        setDateMap(finalMap);
        setGrouped(group);
      }

    } catch (e) {
      console.log("Details Fetch Error:", e);
      if (isMounted.current) setError(true);
    } finally {
      if (isMounted.current) {
        setLoading(false); 
        setRefreshing(false);
      }
    }
  };

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem("APP_LANG").then((l) => {
        if (l && isMounted.current) setLanguage(l as any);
      });
      loadData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const toggleCrop = (crop: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenCrop((prev) => (prev === crop ? null : crop)); 
    setOpenWork(null); 
  };
  const toggleWork = (key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenWork((prev) => (prev === key ? null : key));
  };

  const handleDelete = async () => {
    const phone = await AsyncStorage.getItem("USER_PHONE");
    if (!phone) return;

    try {
      const db = firestore();
      const docRef = db
        .collection("users")
        .doc(phone)
        .collection("payments")
        .doc(deleteId);

      const doc = await docRef.get();
      const data = doc.data();

      if (data?.session !== activeSession) return;

      // 🔥 FIX: Revert attendance records to unpaid status so they show up again
      const attendanceIds = data?.selectedAttendanceIds || [];
      if (attendanceIds.length > 0) {
        const batch = db.batch();
        attendanceIds.forEach((attId: string) => {
          const attRef = db
            .collection("users")
            .doc(phone)
            .collection("mestris")
            .doc(mestriId as string)
            .collection("attendance")
            .doc(attId);
          batch.update(attRef, {
            isPaid: firestore.FieldValue.delete(),
            paymentId: firestore.FieldValue.delete()
          });
        });
        await batch.commit();
      }

      if (isMounted.current) {
        setSummary((prev) => ({
          payments: prev.payments - 1,
          days: prev.days,
          paidDays: prev.paidDays - (data?.details?.totalDays || 0),
        }));

        setGrouped((prev: any) => {
          const newGroup = { ...prev };
          Object.keys(newGroup).forEach((crop) => {
            Object.keys(newGroup[crop]).forEach((work) => {
              newGroup[crop][work] = newGroup[crop][work].filter(
                (item: any) => item.id !== deleteId
              );
              if (newGroup[crop][work].length === 0) delete newGroup[crop][work];
            });
            if (Object.keys(newGroup[crop]).length === 0) delete newGroup[crop];
          });
          return newGroup;
        });

        setModalVisible(false);
      }

      await docRef.delete();
      loadData(); 

    } catch (e) {
      console.log(e);
    }
  };

  const getStatusText = (label: string) => {
    if (language === "te") {
      if (label === "Cleared") return "చెల్లింపు పూర్తి";
      if (label === "Pending") return "చెల్లింపు పెండింగ్";
      return "చెల్లించలేదు";
    }
    return label;
  };

  const Shimmer = (props: any) => (
    <ShimmerPlaceHolder
      LinearGradient={LinearGradient as any} 
      shimmerColors={["#E5E7EB", "#F3F4F6", "#E5E7EB"]}
      style={{ borderRadius: 6, ...props.style }}
    />
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      <AppHeader
        title={language === "te" ? "చెల్లింపు వివరాలు" : "Payment Details"}
        subtitle={language === "te" ? `సీజన్: ${activeSession}` : `Season: ${activeSession}`}
        language={language}
      />

      {loading && !refreshing ? (
        <>
          <View style={styles.dashboard}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={styles.box}>
                <Shimmer style={{ width: 60, height: 12, marginBottom: 6 }} />
                <Shimmer style={{ width: 40, height: 16 }} />
              </View>
            ))}
          </View>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.shimmerCard}>
              <Shimmer style={{ width: "40%", height: 16, marginBottom: 10 }} />
              <Shimmer style={{ width: "80%", height: 12, marginBottom: 6 }} />
              <Shimmer style={{ width: "60%", height: 12 }} />
            </View>
          ))}
        </>
      ) : error ? (
        <View style={styles.errorContainer}>
          <View style={styles.errorIconBg}>
            <Ionicons name="cloud-offline" size={50} color="#9CA3AF" />
          </View>
          <AppText style={styles.errorText} language={language}>
            {language === "te" ? "సర్వర్ కి కనెక్ట్ అవ్వలేకపోయాం" : "Failed to connect to server"}
          </AppText>
          <TouchableOpacity style={styles.retryBtn} onPress={() => loadData(false)}>
            <AppText style={styles.retryText} language={language}>
              {language === "te" ? "మళ్ళీ ప్రయత్నించండి" : "Try Again"}
            </AppText>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.dashboard}>
            <View style={styles.box}>
              <AppText style={styles.label} language={language}>{language === "te" ? "చెల్లింపులు" : "Payments"}</AppText>
              <AppText style={styles.value}>{summary.payments}</AppText>
            </View>
            <View style={styles.dividerVertical} />
            <View style={styles.box}>
              <AppText style={styles.label} language={language}>{language === "te" ? "రోజులు" : "Days"}</AppText>
              <AppText style={styles.value}>{`${summary.paidDays} / ${summary.days}`}</AppText>
            </View>
            <View style={styles.dividerVertical} />
            <View style={styles.box}>
              <AppText style={styles.label} language={language}>{language === "te" ? "స్థితి" : "Status"}</AppText>
              <AppText
                style={[styles.value, { color: status.color }]}
                language={language}
              >
                {getStatusText(status.label)}
              </AppText>
            </View>
          </View>

          <FlatList
            data={Object.keys(grouped)}
            keyExtractor={(item) => item}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#16A34A"]} />}
            contentContainerStyle={[
              { paddingBottom: 100 },
              Object.keys(grouped).length === 0 && { flexGrow: 1, justifyContent: 'center' }
            ]}
            ListEmptyComponent={
              <AppEmptyState
                iconName="wallet-outline"
                title={language === "te" ? "చెల్లింపులు లేవు" : "No Payments"}
                subtitle={language === "te" ? "ఈ మేస్త్రీకి ఇంకా ఎలాంటి చెల్లింపులు జరగలేదు" : "No payments found for this mestri"}
                language={language}
              />
            }
            renderItem={({ item: crop }) => {
              const cropData = grouped[crop];
              
              const isCropOpen = openCrop === crop; 
              const workCount = Object.keys(cropData).length;

              return (
                <View>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={[styles.cropHeader, { borderLeftWidth: 5, borderLeftColor: getCropColor(crop) }]}
                    onPress={() => toggleCrop(crop)}
                  >
                    <View>
                      <AppText style={styles.cropName} language={language}>{crop}</AppText>
                      <AppText style={styles.cropSub} language={language}>
                        {language === "te" ? `${workCount} ${workCount === 1 ? "పని" : "పనులు"}` : `${workCount} ${workCount === 1 ? "work" : "works"}`}
                      </AppText>
                    </View>
                    <View style={styles.chevronBg}>
                      <Ionicons name={isCropOpen ? "chevron-up" : "chevron-down"} size={20} color="#4B5563" />
                    </View>
                  </TouchableOpacity>

                  {isCropOpen && Object.keys(cropData).map((work) => {
                    const workData = cropData[work];
                    const key = `${crop}_${work}`;
                    
                    const isWorkOpen = openWork === key;
                    const workColor = getWorkColor(work);

                    return (
                      <View key={work}>
                        <TouchableOpacity
                          activeOpacity={0.8}
                          style={[styles.workHeader, { borderLeftWidth: 4, borderLeftColor: workColor, borderWidth: 1, borderColor: "#E5E7EB" }]}
                          onPress={() => toggleWork(key)}
                        >
                          <View>
                            <AppText style={styles.workName} language={language}>{work}</AppText>
                            <AppText style={styles.workSub} language={language}>
                              {language === "te" ? `${workData.length} చెల్లింపులు` : `${workData.length} ${workData.length === 1 ? "payment" : "payments"}`}
                            </AppText>
                          </View>
                          <View style={styles.chevronBgSmall}>
                            <Ionicons name={isWorkOpen ? "chevron-up" : "chevron-down"} size={16} color="#6B7280" />
                          </View>
                        </TouchableOpacity>

                        {isWorkOpen && workData.map((entry: any) => {
                          const dateObj = entry.createdAt?.toDate();
                          const dates = dateMap[entry.id] || [];
                          const fromDate = dates[0];
                          const toDate = dates[dates.length - 1];
                          const totalAcres = entry.details?.totalAcres || 0; // 🔥 Fetching Total Acres saved in DB

                          const missingDates: string[] = [];
                          if (dates.length > 1) {
                            const parseD = (dStr: string) => {
                              const parts = dStr.split("/");
                              if (parts.length === 3) return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`);
                              return new Date();
                            };
                            
                            const start = parseD(fromDate);
                            const end = parseD(toDate);
                            let current = new Date(start);
                            current.setDate(current.getDate() + 1);
                            
                            let loops = 0;
                            while (current < end && loops < 100) {
                              const dStr = `${current.getDate().toString().padStart(2, '0')}/${(current.getMonth() + 1).toString().padStart(2, '0')}/${current.getFullYear()}`;
                              if (!dates.includes(dStr)) {
                                missingDates.push(dStr);
                              }
                              current.setDate(current.getDate() + 1);
                              loops++;
                            }
                          }

                          const labels = {
                            morning: language === "te" ? "ఉదయం" : "Morning",
                            evening: language === "te" ? "సాయంత్రం" : "Evening",
                            full: language === "te" ? "పూర్తి రోజు" : "Full Day",
                            days: language === "te" ? "రోజులు" : "Days",
                            workers: language === "te" ? "కూలీలు" : "Workers",
                            amount: language === "te" ? "మొత్తం నగదు" : "Total Amount"
                          };

                          const getPaymentModeLabel = (mode: string) => {
                            if (!mode) return "";
                            const m = mode.toLowerCase();
                            if (language === "te") {
                              if (m === "cash") return "క్యాష్";
                              if (m === "upi") return "యూపీఐ";
                              if (m === "both") return "రెండూ";
                            } else {
                              if (m === "cash") return "Cash";
                              if (m === "upi") return "UPI";
                              if (m === "both") return "Both";
                            }
                            return mode.charAt(0).toUpperCase() + mode.slice(1);
                          };

                          return (
                            <View key={entry.id} style={[styles.card, { borderLeftWidth: 4, borderLeftColor: workColor, borderColor: workColor + "30" }]}>
                              <View style={styles.topRow}>
                                <View style={styles.dateBox}>
                                  <Ionicons name="calendar-outline" size={14} color={workColor} />
                                  <AppText style={styles.dateText} language={language}>{dateObj?.toLocaleDateString("en-GB")}</AppText>
                                  <Ionicons name="time-outline" size={14} color={workColor} style={{ marginLeft: 10 }} />
                                  <AppText style={styles.dateText} language={language}>{dateObj?.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</AppText>
                                </View>
                                <View style={styles.modeBox}>
                                  <Ionicons name="wallet-outline" size={14} color={workColor} />
                                  <AppText style={styles.modeText} language={language}>{getPaymentModeLabel(entry.paymentMode)}</AppText>
                                </View>
                              </View>

                              {/* 🔥 NEW ACRES DISPLAY (Below Date, perfectly aligned) */}
                              {totalAcres > 0 && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                  <Ionicons name="expand-outline" size={14} color="#6B7280" />
                                  <AppText style={{ fontSize: 11, color: "#4B5563", marginLeft: 6, fontWeight: '500' }} language={language}>
                                    {language === "te" ? "మొత్తం ఎకరాలు:" : "Total Acres:"} <AppText style={{ color: "#111827", fontWeight: '700' }}>{totalAcres}</AppText>
                                  </AppText>
                                </View>
                              )}

                              <View style={styles.divider} />
                              
                              {dates.length > 0 && (
                                <View style={{ marginTop: 6 }}>
                                  <AppText style={{ fontSize: 12, color: "#6B7280", textAlign: 'center' }} language={language}>
                                    {fromDate} → {toDate}
                                  </AppText>
                                  {missingDates.length > 0 && (
                                    <View style={{ backgroundColor: "#FEF2F2", padding: 6, borderRadius: 6, marginTop: 4, marginHorizontal: 10 }}>
                                      <AppText style={{ fontSize: 11, color: "#DC2626", textAlign: 'center' }} language={language}>
                                        {language === "te" ? `సెలవు / పని లేదు: ${missingDates.join(", ")}` : `Holidays / No Work: ${missingDates.join(", ")}`}
                                      </AppText>
                                    </View>
                                  )}
                                </View>
                              )}
                              
                              <View style={styles.row}>
                                <View style={styles.rowLeft}>
                                  <Ionicons name="sunny-outline" size={14} color="#F59E0B" />
                                  <AppText style={styles.label} language={language}>{labels.morning}</AppText>
                                </View>
                                <AppText style={styles.valueText} language={language}>
                                  {entry.details.morning} × ₹{formatCurrency(entry.details.mRate)} = ₹{formatCurrency(entry.details.morning * entry.details.mRate)}
                                </AppText>
                              </View>

                              <View style={styles.row}>
                                <View style={styles.rowLeft}>
                                  <Ionicons name="partly-sunny-outline" size={14} color="#6366F1" />
                                  <AppText style={styles.label} language={language}>{labels.evening}</AppText>
                                </View>
                                <AppText style={styles.valueText} language={language}>
                                  {entry.details.evening} × ₹{formatCurrency(entry.details.eRate)} = ₹{formatCurrency(entry.details.evening * entry.details.eRate)}
                                </AppText>
                              </View>

                              <View style={styles.row}>
                                <View style={styles.rowLeft}>
                                  <Ionicons name="moon-outline" size={14} color="#10B981" />
                                  <AppText style={styles.label} language={language}>{labels.full}</AppText>
                                </View>
                                <AppText style={styles.valueText} language={language}>
                                  {entry.details.full} × ₹{formatCurrency(entry.details.fRate)} = ₹{formatCurrency(entry.details.full * entry.details.fRate)}
                                </AppText>
                              </View>

                              <View style={styles.divider} />

                              <View style={styles.summaryRow}>
                                <View style={styles.summaryItem}>
                                  <Ionicons name="calendar-number-outline" size={14} style={{color: workColor}} />
                                  <AppText style={styles.summaryText} language={language}>
                                    {entry.details.totalDays} {labels.days}
                                  </AppText>
                                </View>
                                <View style={styles.summaryItem}>
                                  <Ionicons name="people-outline" size={14} style={{color: workColor}} />
                                  <AppText style={styles.summaryText} language={language}>
                                    {entry.details.totalWorkers} {labels.workers}
                                  </AppText>
                                </View>
                              </View>

                              <View style={styles.divider} />

                              {entry.paymentMode === "both" && entry.splitDetails && (
                                <View style={styles.splitBox}>
                                  <View style={styles.splitItem}>
                                    <AppText style={styles.splitLabel} language={language}>{language === "te" ? "క్యాష్" : "Cash"}</AppText>
                                    <AppText style={styles.splitVal}>₹ {formatCurrency(entry.splitDetails.cash)}</AppText>
                                  </View>
                                  <View style={styles.splitDivider} />
                                  <View style={styles.splitItem}>
                                    <AppText style={styles.splitLabel} language={language}>{language === "te" ? "యూపీఐ" : "UPI"}</AppText>
                                    <AppText style={styles.splitVal}>₹ {formatCurrency(entry.splitDetails.upi)}</AppText>
                                  </View>
                                </View>
                              )}

                              {entry.proofs && entry.proofs.length > 0 && (
                                <View style={styles.proofsBox}>
                                  <AppText style={styles.proofsLabel} language={language}>{language === "te" ? "ఆధారాలు" : "Proofs"}</AppText>
                                  <View style={styles.proofsRow}>
                                    {entry.proofs.map((proof: any, idx: number) => (
                                      <TouchableOpacity 
                                        key={idx} 
                                        activeOpacity={0.8}
                                        onPress={() => {
                                          if (proof.type === "pdf") {
                                            setPdfUrl(proof.url);
                                          } else {
                                            setFullScreenImg(proof.url);
                                          }
                                        }}
                                        style={styles.proofThumbWrap}
                                      >
                                        {proof.type === "pdf" ? (
                                          <View style={[styles.proofThumb, { backgroundColor: "#FEF2F2", justifyContent: "center", alignItems: "center" }]}>
                                            <Ionicons name="document-text" size={20} color="#DC2626" />
                                          </View>
                                        ) : (
                                          <Image source={{ uri: proof.url }} style={styles.proofThumb} contentFit="cover" />
                                        )}
                                      </TouchableOpacity>
                                    ))}
                                  </View>
                                </View>
                              )}

                              <View style={styles.bottomRow}>
                                <View>
                                  <AppText style={{fontSize: 10, color: '#6B7280'}} language={language}>{labels.amount}</AppText>
                                  <AppText style={[styles.amount, { color: workColor }]}>
                                    ₹ {formatCurrency(entry.totalAmount)}
                                  </AppText>
                                </View>
                                <TouchableOpacity 
                                  activeOpacity={0.6}
                                  onPress={() => { 
                                    setDeleteId(entry.id); 
                                    setModalVisible(true); 
                                  }}
                                  style={styles.deleteButtonContainer}
                                >
                                  <Ionicons name="trash-bin-outline" size={18} color="#EF4444" />
                                  <AppText style={styles.delete} language={language}>
                                    {language === "te" ? "తొలగించు" : "Delete"}
                                  </AppText>
                                </TouchableOpacity>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    );
                  })}
                </View>
              );
            }}
          />
        </>
      )}

      {/* DELETE MODAL */}
      <Modal visible={modalVisible} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.modalOverlayStandard}>
          <View style={styles.modalContentStandard}>
            <View style={styles.modalIconBgStandard}>
              <Ionicons name="trash-outline" size={36} color="#e44830" />
            </View>
            <AppText style={styles.modalTitleStandard} language={language}>
              {language === "te" ? "ఈ రికార్డును తొలగించాలా?" : "Are you sure you want to delete this? "}
            </AppText>
            <AppText style={styles.modalSubStandard} language={language}>
              {language === "te"
                ? "తొలగిస్తే, దీనికి సంబంధించిన హాజరు కార్డులు మళ్ళీ చెల్లింపు చేయడానికి అందుబాటులోకి వస్తాయి."
                : "Once deleted, the linked attendance cards will become available again for payment selection."}
            </AppText>
            <View style={styles.modalButtonsStandard}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.modalCancelBtnStandard}
                onPress={() => setModalVisible(false)}
              >
                <AppText style={styles.modalCancelTextStandard} language={language}>
                  {language === "te" ? "వద్దు" : "Cancel"}
                </AppText>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.modalConfirmBtnStandard}
                onPress={handleDelete}
              >
                <AppText style={styles.modalConfirmTextStandard} language={language}>
                  {language === "te" ? "తొలగించు" : "Delete"}
                </AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* FULLSCREEN IMAGE MODAL */}
      <Modal visible={!!fullScreenImg} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.fsOverlay}>
          <View style={styles.fsHeader}>
            <TouchableOpacity 
              style={styles.fsCloseBtn} 
              onPress={() => setFullScreenImg(null)}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
          {fullScreenImg && (
            <View style={styles.fsImageContainer}>
              <Image 
                source={{ uri: fullScreenImg }} 
                style={styles.fsImage} 
                contentFit="contain" 
              />
            </View>
          )}
        </View>
      </Modal>

      {/* FULLSCREEN PDF VIEWER */}
      <Modal visible={!!pdfUrl} transparent animationType="slide" statusBarTranslucent>
        <SafeAreaView style={styles.pdfOverlay}>
          <View style={styles.pdfHeader}>
            <AppText style={styles.pdfTitle} language={language}>{language === "te" ? "డాక్యుమెంట్" : "Document"}</AppText>
            <TouchableOpacity 
              style={styles.pdfCloseBtn} 
              onPress={() => setPdfUrl(null)}
            >
              <Ionicons name="close" size={24} color="#111827" />
            </TouchableOpacity>
          </View>
          {pdfUrl && (
            <WebView 
              source={{ uri: Platform.OS === "ios" ? pdfUrl : `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(pdfUrl)}` }} 
              style={{ flex: 1, opacity: 0.99, overflow: 'hidden' }} 
              startInLoadingState={true}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              androidHardwareAccelerationDisabled={false}
              renderLoading={() => (
                <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff", position: "absolute", width: "100%", height: "100%" }}>
                  <ActivityIndicator size="large" color="#16A34A" />
                  <AppText style={{ color: "#6B7280", marginTop: 10 }}>{language === "te" ? "డాక్యుమెంట్ లోడ్ అవుతోంది..." : "Loading Document..."}</AppText>
                </View>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F7F6" },

  errorContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40 },
  errorIconBg: { width: 90, height: 90, borderRadius: 45, backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  errorText: { fontSize: 16, fontWeight: "600", color: "#4B5563", textAlign: "center", marginBottom: 20 },
  retryBtn: { backgroundColor: "#16A34A", paddingHorizontal: 30, paddingVertical: 12, borderRadius: 14 },
  retryText: { color: "white", fontSize: 15, fontWeight: "600" },

  dashboard: { marginHorizontal: 20, marginTop: 10, paddingVertical: 14, flexDirection: "row", justifyContent: "space-around", alignItems: "center", backgroundColor: "#ffffff", borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB" },
  box: { alignItems: "center" },
  label: { fontSize: 13, color: "#374151" },
  value: { fontSize: 18, fontWeight: "600", marginTop: 2 },
  dividerVertical: { width: 1, height: 30, backgroundColor: "#E5E7EB" },
  
  cropHeader: { marginHorizontal: 20, marginTop: 14, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: "#ffffff", borderRadius: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: "#E5E7EB" },
  cropName: { fontSize: 16, fontWeight: "600", color: "#111827" },
  cropSub: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  
  workHeader: { marginHorizontal: 30, marginTop: 10, padding: 12, backgroundColor: "#fff", borderRadius: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  workName: { fontSize: 14, fontWeight: "600", color: "#111827" },
  workSub: { fontSize: 12, color: "#6B7280", marginTop: 2 },

  chevronBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6", 
    justifyContent: "center",
    alignItems: "center"
  },
  chevronBgSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F3F4F6", 
    justifyContent: "center",
    alignItems: "center"
  },
  
  card: { marginHorizontal: 30, marginVertical: 6, padding: 14, backgroundColor: "#fff", borderRadius: 12 , borderWidth: 1},
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dateBox: { flexDirection: "row", alignItems: "center", gap: 6 },
  dateText: { fontSize: 12, color: "#374151", fontWeight: "500" },
  modeBox: { flexDirection: "row", alignItems: "center", gap: 6 },
  modeText: { fontSize: 12, color: "#374151" },
  row: { flexDirection: "row", justifyContent: "space-between", marginVertical: 4 },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  valueText: { fontSize: 13, fontWeight: "500", color: "#111827" },
  divider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 8 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  summaryText: { fontSize: 12, color: "#6B7280" },
  bottomRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  amount: { fontWeight: "600", fontSize: 16 },
  
  deleteButtonContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#FEE2E2', gap: 6, shadowColor: "#EF4444", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3 },
  delete: { color: '#DC2626', fontSize: 12, fontWeight: '600' },
  
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
  modalBox: { width: "82%", backgroundColor: "#fff", borderRadius: 20, padding: 24, alignItems: "center", elevation: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5 },
  iconBg: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#FEE2E2", justifyContent: "center", alignItems: "center", marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: "600", color: "#111827" },
  modalSub: { fontSize: 13, color: "#6B7280", textAlign: "center", marginTop: 8, lineHeight: 18 },
  modalBtns: { flexDirection: "row", marginTop: 22, gap: 12, width: '100%' },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: "#F3F4F6", alignItems: "center" },
  deleteBtn: { flex: 1.5, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: "#DC2626" },
  cancelText: { fontSize: 14, color: "#4B5563", fontWeight: "600" },
  deleteText: { fontSize: 14, color: "#fff", fontWeight: "600" },
  
  shimmerCard: { marginHorizontal: 20, marginTop: 12, padding: 14, borderRadius: 12, backgroundColor: "#fff", overflow: "hidden" },

  // UNIFIED PREMIUM MODAL CLASSES
  modalOverlayStandard: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 999 },
  modalContentStandard: { width: "80%", backgroundColor: "white", borderRadius: 25, padding: 25, alignItems: "center" },
  modalTitleStandard: { fontSize: 20, fontWeight: "500", color: "#e2431f", marginVertical: 10, textAlign: "center" },
  modalSubStandard: { textAlign: "center", color: "#64748B", marginBottom: 25 },
  modalButtonsStandard: { flexDirection: "row", gap: 10 },
  modalCancelBtnStandard: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#F1F5F9", alignItems: "center" },
  modalConfirmBtnStandard: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#EF4444", alignItems: "center" },
  modalCancelTextStandard: { color: "#64748B", fontWeight: "500" },
  modalConfirmTextStandard: { color: "white", fontWeight: "500" },
  modalIconBgStandard: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#f5e8e8", justifyContent: "center", alignItems: "center", marginBottom: 10 },

  // SPLIT DETAILS
  splitBox: { flexDirection: "row", marginTop: 8, marginBottom: 8, padding: 10, backgroundColor: "#F9FAFB", borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB" },
  splitItem: { flex: 1, alignItems: "center" },
  splitDivider: { width: 1, backgroundColor: "#D1D5DB", marginHorizontal: 10 },
  splitLabel: { fontSize: 10, color: "#6B7280", marginBottom: 2 },
  splitVal: { fontSize: 13, fontWeight: "600", color: "#374151" },

  // PROOFS
  proofsBox: { marginTop: 4, marginBottom: 8 },
  proofsLabel: { fontSize: 11, color: "#9CA3AF", textTransform: 'uppercase', marginBottom: 4 },
  proofsRow: { flexDirection: "row", gap: 8 },
  proofThumbWrap: { width: 44, height: 44 },
  proofThumb: { width: "100%", height: "100%", borderRadius: 8, borderWidth: 1, borderColor: "#E5E7EB" },

  // FULLSCREEN VIEWER
  fsOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)", zIndex: 9999, paddingTop: Platform.OS === 'android' ? 40 : 50 },
  fsHeader: { width: "100%", alignItems: "flex-end", paddingRight: 20, marginBottom: 10 },
  fsCloseBtn: { width: 44, height: 44, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 22, justifyContent: "center", alignItems: "center" },
  fsImageContainer: { flex: 1, paddingBottom: 40, paddingHorizontal: 10 },
  fsImage: { flex: 1, width: "100%", height: "100%" },

  // PDF VIEWER
  pdfOverlay: { flex: 1, backgroundColor: "#F3F4F6", zIndex: 9999, paddingTop: Platform.OS === 'android' ? 40 : 0 },
  pdfHeader: { width: "100%", height: 60, backgroundColor: "#fff", flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  pdfTitle: { fontSize: 16, fontWeight: "600", color: "#111827" },
  pdfCloseBtn: { width: 40, height: 40, backgroundColor: "#F3F4F6", borderRadius: 20, justifyContent: "center", alignItems: "center" }
});