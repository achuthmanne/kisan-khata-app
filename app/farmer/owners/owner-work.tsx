import AppEmptyState from "@/components/AppEmptyState";
import { executeOfflineSafeRead, executeOfflineSafeWrite, executeOfflineSafeFetch } from "@/utils/offlineHelper";

import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  FlatList, Modal, SafeAreaView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
  Linking,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView
} from "react-native";
import { WebView } from "react-native-webview";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import storage from "@react-native-firebase/storage";
import ShimmerPlaceHolder from "react-native-shimmer-placeholder";

type WorkItem = {
  id: string;
  crop: string;
  work: string;
  date: string;
  workType?: string;
  acres?: string;
  ratePerAcre?: string; // 🔥 కొత్తగా యాడ్ చేశాం (ఎకరాకు ధర)
  saalluCount?: string;
  ratePerSaalu?: string;
  ratePerHour?: string;
  hrs?: string;
  mins?: string;
  payableAmount?: string;
  advanceAmount?: string;
  finalAmount?: string;
  notes?: string;
  paymentStatus?: string;
  paymentMode?: string;
  splitDetails?: { cash: number; upi: number };
  proofs?: { type: "image" | "pdf"; uri: string }[];
  createdAt?: any;
};

export default function OwnerWork() {

  const router = useRouter();
  const { ownerId, name, phone } = useLocalSearchParams();

  // URL Params Array లాగా వస్తే క్రాష్ అవ్వకుండా
  const oName = Array.isArray(name) ? name[0] : name;
  const oPhone = Array.isArray(phone) ? phone[0] : phone;
  const oId = Array.isArray(ownerId) ? ownerId[0] : ownerId;

  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<"te" | "en">("te");
  const [expanded, setExpanded] = useState<string | null>(null);

  const [data, setData] = useState<WorkItem[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [statusId, setStatusId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<"pending" | "paid">("paid");

  const [actionLoading, setActionLoading] = useState(false); 

  // 🔥 NEW STATES FOR 2-STEP PAYMENT
  const [step1ModalVisible, setStep1ModalVisible] = useState(false);
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | "both">("cash");
  const [splitCash, setSplitCash] = useState("");
  const [splitUpi, setSplitUpi] = useState("");
  const [proofs, setProofs] = useState<{ type: "image" | "pdf"; uri: string; name?: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const [viewerPdf, setViewerPdf] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const isMounted = useRef(true); 

  /* ---------------- LOAD ---------------- */

  useFocusEffect(
    useCallback(() => {
      let unsub: any;
      isMounted.current = true;

      const load = async () => {
        try {
          const lang = await AsyncStorage.getItem("APP_LANG");
          if (lang && isMounted.current) setLanguage(lang as any);

          const userPhone = await AsyncStorage.getItem("USER_PHONE");
          if (!userPhone || !oId) return;

          // 🔥 FETCH ACTIVE SESSION
          const userDoc = await executeOfflineSafeRead(firestore().collection("users").doc(userPhone));
          const activeSession = userDoc.data()?.activeSession;

          if (!activeSession) {
            if (isMounted.current) setLoading(false);
            return;
          }

          if (isMounted.current) setLoading(true);

          // 🔥 REALTIME SNAPSHOT WITH SESSION FILTER
          unsub = firestore()
            .collection("users")
            .doc(userPhone)
            .collection("owners")
            .doc(oId)
            .collection("entries")
            .where("session", "==", activeSession) 
            .onSnapshot(snap => {
              if (!isMounted.current) return;
              
              if (!snap || !snap.docs) {
                setLoading(false);
                return;
              }

              const list: WorkItem[] = [];
              snap.forEach((doc: any) => list.push({ id: doc.id, ...(doc.data() as any) }));

              // 🔥 Client Side Sorting (Latest first)
              list.sort((a, b) => {
                const timeA = a.createdAt?.toMillis() || 0;
                const timeB = b.createdAt?.toMillis() || 0;
                return timeB - timeA;
              });

              setData(list);
              setLoading(false);
            }, (err) => {
              console.log("Snapshot error:", err);
              if (isMounted.current) setLoading(false);
            });
        } catch (error) {
          console.log("Load error:", error);
          if (isMounted.current) setLoading(false);
        }
      };

      load();
      return () => {
        isMounted.current = false;
        if (unsub) unsub();
      };
    }, [oId])
  );

  /* ---------------- ACTIONS ---------------- */
  
  const handleDelete = async () => {
    if (actionLoading) return;
    try {
      setActionLoading(true);
      const userPhone = await AsyncStorage.getItem("USER_PHONE");
      if (!userPhone || !deleteId || !oId) return;

      await executeOfflineSafeWrite(firestore()
        .collection("users")
        .doc(userPhone)
        .collection("owners")
        .doc(oId)
        .collection("entries")
        .doc(deleteId)
        .delete());

    } catch (e) {
      console.log("Error deleting entry:", e);
    } finally {
      if (isMounted.current) {
        setDeleteId(null);
        setActionLoading(false);
      }
    }
  };

  const handlePickDocument = async () => {
    if (proofs.length >= 2) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf"],
        copyToCacheDirectory: true
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setProofs([...proofs, { type: "pdf", uri: result.assets[0].uri, name: result.assets[0].name }]);
      }
    } catch (error) {
      console.log("Doc Pick Error:", error);
    }
  };

  const handlePickImage = async (useCamera: boolean) => {
    if (proofs.length >= 2) return;
    try {
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      };
      
      const result = useCamera 
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
        
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setProofs([...proofs, { type: "image", uri: result.assets[0].uri }]);
      }
    } catch (error) {
      console.log("Image Pick Error:", error);
    }
  };

  const removeProof = (index: number) => {
    setProofs(proofs.filter((_, i) => i !== index));
  };

 /* ---------------- LOCK & AUTO-ADD EXPENSE (BATCH WRITE) ---------------- */
  const handleStatusUpdate = async () => {
    if (actionLoading || uploading) return;
    try {
      setActionLoading(true);
      setUploading(true);
      const userPhone = await AsyncStorage.getItem("USER_PHONE");
      if (!userPhone || !statusId || !oId) return;

      const userDoc = await executeOfflineSafeRead(firestore().collection("users").doc(userPhone));
      const activeSession = userDoc.data()?.activeSession;

      // Upload proofs
      const uploadedProofs: { type: "image" | "pdf"; uri: string }[] = [];
      
      for (let i = 0; i < proofs.length; i++) {
        const proof = proofs[i];
        let fileUri = proof.uri;
        try {
          if (Platform.OS === "android" && proof.uri.startsWith("content://")) {
            const ext = proof.type === "pdf" ? ".pdf" : ".jpg";
            // @ts-ignore
            const tempUri = `${FileSystem.cacheDirectory}proof_${Date.now()}_${i}${ext}`;
            await FileSystem.copyAsync({ from: proof.uri, to: tempUri });
            fileUri = tempUri;
          }
          const fileName = `owners/${oId}/payments/${statusId}_${Date.now()}_${i}`;
          const ref = storage().ref(fileName);
          await ref.putFile(fileUri);
          const downloadUrl = await ref.getDownloadURL();
          uploadedProofs.push({ type: proof.type, uri: downloadUrl });
        } catch (uploadError) {
          console.log("Upload Error:", uploadError);
          uploadedProofs.push({ type: proof.type, uri: proof.uri });
        }
      }

      const entryRef = firestore()
        .collection("users").doc(userPhone)
        .collection("owners").doc(oId)
        .collection("entries").doc(statusId);

      const entrySnap = await executeOfflineSafeRead(entryRef.get());
      if (!entrySnap.exists) return;

      const entryData = entrySnap.data();
      const totalAmountNum = Number(entryData?.payableAmount || 0); 

      const batch = firestore().batch();

      const updateData: any = {
        paymentStatus: newStatus,
        paymentMode: paymentMode,
        proofs: uploadedProofs
      };

      if (paymentMode === "both") {
        updateData.splitDetails = {
          cash: Number(splitCash),
          upi: Number(splitUpi)
        };
      }

      batch.update(entryRef, updateData);

      if (totalAmountNum > 0) {
        const expenseRef = firestore()
          .collection("users").doc(userPhone)
          .collection("expenses").doc();

        batch.set(expenseRef, {
          crop: entryData?.crop || "Others",
          category: language === "te" ? "ట్రాక్టర్ / యంత్రాలు" : "Tractor", 
          amount: totalAmountNum,
          session: activeSession,
          linkedWorkId: statusId, 
          notes: language === "te" 
            ? `${entryData?.work} - ట్రాక్టర్ ఓనర్ కి చెల్లించిన పూర్తి ఖర్చు` 
            : `${entryData?.work} - Total amount settled to tractor owner`,
          createdAt: firestore.FieldValue.serverTimestamp()
        });
      }

      await executeOfflineSafeWrite(batch.commit());

    } catch (e) {
      console.log("Error locking and saving expense:", e);
    } finally {
      if (isMounted.current) {
        setStatusId(null);
        setStep1ModalVisible(false);
        setProofs([]);
        setPaymentMode("cash");
        setSplitCash("");
        setSplitUpi("");
        setActionLoading(false);
        setUploading(false);
      }
    }
  };

  /* ---------------- GROUP BY CROP ---------------- */
  const grouped = Object.values(
    data.reduce<Record<string, { crop: string; list: WorkItem[] }>>((acc, item) => {
      const cropName = item.crop || "పని వివరాలు (Others)";
      if (!acc[cropName]) acc[cropName] = { crop: cropName, list: [] };
      acc[cropName].list.push(item);
      return acc;
    }, {})
  );

  const cropColors = [
    "#16A34A", "#2563EB", "#F59E0B", "#DC2626",
    "#8B5CF6", "#14B8A6", "#F97316"
  ];

  const getCropColor = (crop: string) => {
    if (!crop) return cropColors[0];
    let hash = 0;
    for (let i = 0; i < crop.length; i++) {
      hash = crop.charCodeAt(i) + ((hash << 5) - hash);
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

  const activeEntry = data.find(w => w.id === statusId);
  const activeAmount = activeEntry ? Number(activeEntry.finalAmount?.toString().replace(/,/g, "") || 0) : 0;
  const isSplitValid = paymentMode === "both" 
    ? (Number(splitCash || 0) + Number(splitUpi || 0) === activeAmount)
    : true;

  /* ---------------- UI ---------------- */
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      <AppHeader
        title={language === "te" ? "పనుల చరిత్ర" : "Work History"}
        subtitle={oName ? `${oName} ${language === "te" ? "ఖాతా" : "Account"}` : (language === "te" ? "యజమాని ఖాతా" : "Owner Account")}
        language={language}
      />

      {!loading && data.length > 0 && (
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={20} color="#0284C7" />
          <AppText style={styles.infoText} language={language}>
            {language === "te" 
              ? "గమనిక: చెల్లింపు పూర్తయిన తర్వాత లాక్ బటన్ నొక్కండి. లాక్ చేసిన తర్వాత ఈ రికార్డు ఆటోమేటిక్‌గా ఖర్చుల ఖాతాలో యాడ్ అవుతుంది, ఆ తర్వాత దీనిని తొలగించడం కుదరదు." 
              : "Note: Mark as paid once the payment is completed. Once locked, this record is automatically added to Expenses and cannot be deleted."}
          </AppText>
        </View>
      )}

      {loading ? (
        <View style={{ paddingTop: 10 }}>
          <ShimmerCard /><ShimmerCard /><ShimmerCard />
        </View>
      ) : (
        <FlatList
          data={grouped}
          keyExtractor={(item: any) => item.crop}
          contentContainerStyle={[
            { padding: 16, paddingBottom: 120 },
            grouped.length === 0 && { flexGrow: 1, justifyContent: 'center' }
          ]}
          showsVerticalScrollIndicator={false}
          
          ListEmptyComponent={
            <AppEmptyState
              iconName="clipboard-outline"
              title={language === "te" ? "పనులు ఏమీ లేవు" : "No Works Found"}
              subtitle={language === "te" ? "పనులను చేర్చడానికి కింద ఉన్న '+' బటన్ నొక్కండి" : "Tap '+' button below to add a new work entry"}
              language={language}
            />
          }

          renderItem={({ item }: any) => {
            const isOpen = expanded === item.crop;

            return (
              <View style={styles.cropCard}>

                <TouchableOpacity activeOpacity={0.7}
                  style={[styles.cropHeader, { alignItems: "center" }]}
                  onPress={() => setExpanded(isOpen ? null : item.crop)}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                    <View style={{
                      width: 4, height: 40, borderRadius: 4,
                      backgroundColor: getCropColor(item.crop), marginRight: 12
                    }} />
                    <View style={{ flex: 1 }}>
                      <AppText style={styles.cropTitle}>{item.crop}</AppText>
                      <AppText style={styles.cropCount}>
                        {language === "te" ? `${item.list.length} పనులు` : `${item.list.length} Works`}
                      </AppText>
                    </View>
                  </View>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#E5E7EB", justifyContent: "center", alignItems: "center" }}>
                    <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={18} color="#4B5563" />
                  </View>
                </TouchableOpacity>

                {isOpen && item.list.map((work: any) => {
                  const amount = Number(work.finalAmount?.toString().replace(/,/g, "") || 0);
                  const isPaid = work.paymentStatus === "paid"; 

                  return (
                    <View key={work.id} style={[styles.workCard]}>
                      
                      <View style={styles.rowBetween}>
                        <AppText style={styles.workTitle}>{work.work}</AppText>
                        <AppText style={styles.date}>{work.date}</AppText>
                      </View>

                      <View style={styles.statusRow}>
                        <AppText style={[styles.statusText, { color: isPaid ? "#16A34A" : "#DC2626" }]}>
                          {isPaid
                            ? (language === "te" ? "చెల్లింపు పూర్తైంది (లాక్)" : "Payment Done (Locked)")
                            : (language === "te" ? "చెల్లింపు పెండింగ్" : "Pending")}
                        </AppText>
                        <TouchableOpacity
                          activeOpacity={isPaid ? 1 : 0.8}
                          disabled={isPaid || actionLoading}
                          style={[styles.toggle, { backgroundColor: isPaid ? "#16A34A" : "#DC2626", opacity: isPaid ? 0.6 : 1 }]}
                          onPress={() => {
                            if (isPaid) return;
                            setStatusId(work.id);
                            setNewStatus("paid");
                          }}
                        >
                          <View style={[styles.toggleCircle, { alignSelf: isPaid ? "flex-end" : "flex-start" }]} />
                        </TouchableOpacity>
                      </View>

                      {/* 🔥 DETAILED GRID (TIME/ACRES SPECIFIC) */}
                      <View style={styles.detailsGrid}>
                        
                        {/* ACRES (If available) */}
                        {work.acres ? (
                          <View style={styles.detailItem}>
                            <View style={styles.leftPart}>
                              <Ionicons name="resize-outline" size={14} color="#6B7280" />
                              <AppText style={styles.label}>{language === "te" ? "ఎకరాలు:" : "Acres:"}</AppText>
                            </View>
                            <AppText style={styles.value}>{work.acres}</AppText>
                          </View>
                        ) : null}

                        {/* TIME / SAALLU DYNAMIC */}
                        {work.workType === "time" ? (
                          <View style={styles.detailItem}>
                            <View style={styles.leftPart}>
                              <Ionicons name="time-outline" size={14} color="#6B7280" />
                              <AppText style={styles.label}>{language === "te" ? "సమయం:" : "Time:"}</AppText>
                            </View>
                            <AppText style={styles.value}>{work.hrs || 0}h {work.mins || 0}m</AppText>
                          </View>
                        ) : work.saalluCount ? (
                          <View style={styles.detailItem}>
                            <View style={styles.leftPart}>
                              <Ionicons name="list-outline" size={14} color="#6B7280" />
                              <AppText style={styles.label}>{language === "te" ? "సాళ్లు:" : "Saallu:"}</AppText>
                            </View>
                            <AppText style={styles.value}>{work.saalluCount || 0}</AppText>
                          </View>
                        ) : null}

                        {/* 🔥 RATE DYNAMIC LOGIC */}
                        <View style={styles.detailItem}>
                          <View style={styles.leftPart}>
                            <Ionicons name="pricetag-outline" size={14} color="#6B7280" />
                            <AppText style={styles.label}>{language === "te" ? "ధర:" : "Rate:"}</AppText>
                          </View>
                          <AppText style={styles.value}>
                            ₹ {
                              work.workType === "time"
                                ? `${Number(work.ratePerHour || 0).toLocaleString("en-IN")}${language === "te" ? " / గం" : " / hr"}`
                                : work.ratePerAcre 
                                  ? `${Number(work.ratePerAcre || 0).toLocaleString("en-IN")}${language === "te" ? " / ఎకరా" : " / acre"}`
                                  : `${Number(work.ratePerSaalu || 0).toLocaleString("en-IN")}${language === "te" ? " / సాలు" : " / saalu"}`
                            }
                          </AppText>
                        </View>

                        {/* PAYABLE */}
                        <View style={styles.detailItem}>
                          <View style={styles.leftPart}>
                            <Ionicons name="cash-outline" size={14} color="#6B7280" />
                            <AppText style={styles.label}>{language === "te" ? "మొత్తం ఖర్చు:" : "Total Cost:"}</AppText>
                          </View>
                          <AppText style={styles.value}>₹ {Number(work.payableAmount || 0).toLocaleString("en-IN")}</AppText>
                        </View>

                        {/* ADVANCE */}
                        <View style={styles.detailItem}>
                          <View style={styles.leftPart}>
                            <Ionicons name="wallet-outline" size={14} color="#6B7280" />
                            <AppText style={styles.label}>{language === "te" ? "అడ్వాన్స్ చెల్లించినది:" : "Advance Paid:"}</AppText>
                          </View>
                          <AppText style={styles.value}>₹ {Number(work.advanceAmount || 0).toLocaleString("en-IN")}</AppText>
                        </View>
                      </View>

                      {/* FINAL + DELETE */}
                      <View style={styles.bottomRow}>
                        <View>
                          <AppText style={{ fontSize: 11, color: "#6B7280", marginBottom: 2 }}>
                            {language === "te" ? "మిగిలిన బ్యాలెన్స్" : "Remaining Balance"}
                          </AppText>
                          <AppText style={[styles.finalAmount, isPaid && {color: "#16A34A"}]}>₹ {amount.toLocaleString("en-IN")}</AppText>
                        </View>
                        
                        {isPaid ? (
                          <View style={[styles.deleteBtn, { backgroundColor: '#DCFCE7' }]}>
                             <Ionicons name="lock-closed" size={18} color="#16A34A" />
                          </View>
                        ) : (
                          <TouchableOpacity activeOpacity={0.7} style={styles.deleteBtn} onPress={() => setDeleteId(work.id)}>
                            <Ionicons name="trash" size={18} color="#DC2626" />
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* NOTES */}
                      {work.notes ? (
                        <View style={styles.notesBox}>
                          <Ionicons name="document-text-outline" size={14} color="#6B7280" style={{ marginTop: 2 }} />
                          <AppText style={styles.notesText}>{work.notes}</AppText>
                        </View>
                      ) : null}

                      {/* PAYMENT DETAILS (IF PAID) */}
                      {isPaid && work.paymentMode && (
                        <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#E5E7EB" }}>
                          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: work.paymentMode === "both" ? 6 : 0 }}>
                            <Ionicons name="card-outline" size={16} color="#4B5563" style={{ marginRight: 6 }} />
                            <AppText style={{ fontSize: 13, color: "#4B5563", fontFamily: "Mandali", fontWeight: "600" }}>
                              {language === "te" ? "చెల్లింపు విధానం:" : "Payment Mode:"} 
                              <AppText style={{ color: "#1F2937" }}>
                                {work.paymentMode === "cash" ? " Cash" : work.paymentMode === "upi" ? " UPI" : " Cash + UPI"}
                              </AppText>
                            </AppText>
                          </View>
                          {work.paymentMode === "both" && (
                            <View style={{ flexDirection: "row", gap: 16, marginLeft: 22 }}>
                              <AppText style={{ fontSize: 13, color: "#6B7280", fontFamily: "Mandali" }}>
                                Cash: <AppText style={{ color: "#1F2937", fontWeight: "600" }}>₹{work.splitCash || work.splitDetails?.cash || 0}</AppText>
                              </AppText>
                              <AppText style={{ fontSize: 13, color: "#6B7280", fontFamily: "Mandali" }}>
                                UPI: <AppText style={{ color: "#1F2937", fontWeight: "600" }}>₹{work.splitUpi || work.splitDetails?.upi || 0}</AppText>
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
                              <TouchableOpacity key={idx} activeOpacity={0.8} onPress={() => {
                                const urlToUse = p.url || p.uri;
                                if(p.type === "pdf" || urlToUse?.endsWith(".pdf")) setViewerPdf(urlToUse);
                                else setViewerImage(urlToUse);
                              }}>
                                {p.type === "image" ? (
                                  <Image source={{ uri: p.url || p.uri }} style={{ width: 60, height: 60, borderRadius: 8, borderWidth: 1, borderColor: "#E5E7EB" }} resizeMode="cover" />
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


                    </View>
                  );
                })}

                {/* WHATSAPP SHARE BUTTON FOR CROP */}
                {item.list.length > 0 && (
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
                      onPress={() => {
                        let totalPayable = 0;
                        let totalAdvance = 0;
                        let balanceDue = 0;
                        let msg = `🚜 *Kisan Khata - Owner Report*\n`;
                        msg += `👤 *యజమాని పేరు:* ${oName || 'Owner'}\n`;
                        msg += `🌾 *పంట:* ${item.crop}\n\n`;
                        
                        msg += `📝 *పనుల వివరాలు:*\n\n`;

                        item.list.forEach((work: any, index: number) => {
                          const payable = Number(work.payableAmount?.toString().replace(/,/g, "") || 0);
                          const advance = Number(work.advanceAmount?.toString().replace(/,/g, "") || 0);
                          const finalAmount = Number(work.finalAmount?.toString().replace(/,/g, "") || 0);
                          
                          totalPayable += payable;
                          totalAdvance += advance;
                          balanceDue += finalAmount;

                          msg += `*${index + 1}. తేదీ:* ${work.date}\n`;
                          msg += `✅ *పని:* ${work.work}\n`;
                          
                          if (work.acres) {
                            msg += `🚜 *విస్తీర్ణం:* ${work.acres} ఎకరాలు\n`;
                          } else if (work.workType === "time") {
                            msg += `⏱️ *సమయం:* ${work.hrs || 0}h ${work.mins || 0}m\n`;
                          } else if (work.saalluCount) {
                            msg += `🌾 *సాళ్లు:* ${work.saalluCount}\n`;
                          }

                          let rateStr = "";
                          if (work.workType === "time") {
                            rateStr = `₹${work.ratePerHour || 0} / గం`;
                          } else if (work.ratePerAcre) {
                            rateStr = `₹${work.ratePerAcre || 0} / ఎకరా`;
                          } else {
                            rateStr = `₹${work.ratePerSaalu || 0} / సాలు`;
                          }
                          msg += `🏷️ *ధర:* ${rateStr}\n`;
                          
                          msg += `💵 *బిల్లు:* ₹${payable.toLocaleString('en-IN')}\n`;
                          if (advance > 0) msg += `💰 *అడ్వాన్స్:* ₹${advance.toLocaleString('en-IN')}\n`;
                          if (finalAmount > 0) msg += `⚠️ *బ్యాలెన్స్:* ₹${finalAmount.toLocaleString('en-IN')}\n`;

                          if (work.paymentStatus === "paid") {
                              msg += `✅ *స్టేటస్:* చెల్లింపు పూర్తయింది (Paid)\n`;
                              if (work.paymentMode) {
                                  let pMode = work.paymentMode === "cash" ? "Cash" : work.paymentMode === "upi" ? "UPI" : "Cash + UPI";
                                  msg += `- విధానం: ${pMode}\n`;
                                  if (work.paymentMode === "both") {
                                      msg += `  • క్యాష్: ₹${work.splitDetails?.cash || work.splitCash || 0}\n`;
                                      msg += `  • యూపీఐ: ₹${work.splitDetails?.upi || work.splitUpi || 0}\n`;
                                  }
                              }
                          } else {
                              msg += `❌ *స్టేటస్:* పూర్తి కాలేదు (Pending)\n`;
                          }

                          if (work.proofs && work.proofs.length > 0) {
                              msg += `📎 *ఆధారాలు (Proofs):*\n`;
                              work.proofs.forEach((p: any, idx: number) => {
                                  msg += `  ${idx + 1}. ${p.uri}\n`;
                              });
                          }
                          if (work.notes) {
                              msg += `📌 *నోట్స్:* ${work.notes}\n`;
                          }
                          msg += `\n-----------------------\n\n`;
                        });

                        msg += `📊 *మొత్తం సారాంశం (Summary):*\n`;
                        msg += `💵 *మొత్తం బిల్లు:* ₹${totalPayable.toLocaleString('en-IN')}\n`;
                        msg += `💰 *మొత్తం అడ్వాన్స్:* ₹${totalAdvance.toLocaleString('en-IN')}\n`;
                        msg += `⚠️ *ఇవ్వాల్సిన బ్యాలెన్స్:* ₹${balanceDue.toLocaleString('en-IN')}\n`;

                        Linking.openURL(`whatsapp://send?text=${encodeURIComponent(msg)}`);
                      }}
                    >
                      <Ionicons name="logo-whatsapp" size={20} color="#16A34A" />
                      <AppText style={{ color: "#16A34A", fontWeight: "600", marginLeft: 8 }}>
                        {language === "te" ? "వాట్సాప్ లో షేర్ చేయండి" : "Share on WhatsApp"}
                      </AppText>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      {/* FAB */}
      <TouchableOpacity activeOpacity={0.9}
        style={styles.addBtn}
        onPress={() =>
          router.push({
            pathname: "/farmer/owners/add-owner-work",
            params: { ownerId: oId }
          })
        }
      >
        <LinearGradient colors={["#16A34A", "#166534"]} style={styles.addGradient}>
          <Ionicons name="add" size={32} color="#fff" />
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

              {activeAmount > 0 ? (
                <>
                  <AppText style={[styles.modalSubStandard, { marginBottom: 15 }]}>
                    {language === "te" 
                      ? `మీరు బ్యాలెన్స్ ₹${activeAmount} కి ఎలా చెల్లించారు?` 
                      : `How did you pay the balance ₹${activeAmount}?`}
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
                      
                      {(splitCash !== "" || splitUpi !== "") && ((isNaN(Number(splitCash))?0:Number(splitCash)) + (isNaN(Number(splitUpi))?0:Number(splitUpi)) !== activeAmount) && (
                        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, paddingHorizontal: 5, gap: 5 }}>
                          <Ionicons name="information-circle" size={16} color="#DC2626" />
                          <AppText style={{ color: "#DC2626", fontSize: 12, fontWeight: "500", flex: 1 }}>
                            {language === "te" ? `క్యాష్, యూపీఐ రెండూ కలిపితే మొత్తం ₹${activeAmount} కి సమానం అవ్వాలి.` : `Sum of Cash & UPI must equal ₹${activeAmount}.`}
                          </AppText>
                        </View>
                      )}
                    </View>
                  )}
                </>
              ) : (
                <AppText style={[styles.modalSubStandard, { marginBottom: 15 }]}>
                  {language === "te" 
                    ? `బ్యాలెన్స్ ₹0 కాబట్టి, చెల్లింపు విధానం అవసరం లేదు. ఈ పనిని లాక్ చేయాలా?` 
                    : `Balance is ₹0. No payment method required. Do you want to lock this work?`}
                </AppText>
              )}

              {/* UPLOAD PROOFS */}
              <View style={{ width: "100%", marginTop: 20, marginBottom: 25 }}>
                <AppText style={{ fontSize: 13, color: "#6B7280", marginBottom: 12, fontWeight: "600", fontFamily: "Mandali" }}>{language === "te" ? "ఆధారాలు (Proofs) - Max 2" : "Upload Proofs - Max 2"}</AppText>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                  {proofs.map((proof, idx) => (
                    <View key={idx} style={{ position: "relative" }}>
                      {proof.type === "image" ? (
                        <Image source={{ uri: proof.uri }} style={{ width: 70, height: 70, borderRadius: 10, backgroundColor: "#E5E7EB" }} />
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
                    <TouchableOpacity style={[{ width: 70, height: 70, borderRadius: 10, backgroundColor: "#E5E7EB" }, { backgroundColor: "#F0FDF4", borderWidth: 1, borderColor: "#16A34A", borderStyle: "dashed", justifyContent: "center", alignItems: "center" }]} onPress={() => setStep1ModalVisible(true)}>
                      <Ionicons name="cloud-upload-outline" size={24} color="#16A34A" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.modalButtonsStandard}>
                <TouchableOpacity style={styles.modalCancelBtnStandard} onPress={() => { setStatusId(null); setPaymentMode("cash"); setSplitCash(""); setSplitUpi(""); setProofs([]); }} disabled={actionLoading || uploading}>
                  <AppText style={styles.modalCancelTextStandard}>{language === "te" ? "రద్దు చేయి" : "Cancel"}</AppText>
                </TouchableOpacity>
                <TouchableOpacity 
                  activeOpacity={0.9} 
                  onPress={handleStatusUpdate}
                  disabled={actionLoading || uploading || (activeAmount > 0 && !paymentMode) || (activeAmount > 0 && paymentMode === "both" && ((isNaN(Number(splitCash))?0:Number(splitCash)) + (isNaN(Number(splitUpi))?0:Number(splitUpi)) !== activeAmount))}
                  style={[styles.modalConfirmBtnStandard, { backgroundColor: (actionLoading || uploading || (activeAmount > 0 && !paymentMode) || (activeAmount > 0 && paymentMode === "both" && ((isNaN(Number(splitCash))?0:Number(splitCash)) + (isNaN(Number(splitUpi))?0:Number(splitUpi)) !== activeAmount))) ? "#D1D5DB" : "#16A34A" }]}
                >
                  {actionLoading || uploading ? (
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
      <Modal visible={step1ModalVisible} transparent animationType="slide" statusBarTranslucent>
        <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }} activeOpacity={1} onPress={() => setStep1ModalVisible(false)}>
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#EFF6FF", justifyContent: "center", alignItems: "center", marginRight: 12 }}>
                  <Ionicons name="cloud-upload" size={22} color="#2563EB" />
                </View>
                <AppText style={{ fontSize: 18, fontWeight: "600", color: "#1F2937", fontFamily: "Mandali" }}>
                  {language === "te" ? "ఆధారం అప్లోడ్ చేయండి" : "Upload Proof"}
                </AppText>
              </View>
              <TouchableOpacity onPress={() => setStep1ModalVisible(false)} hitSlop={{top:10, bottom:10, left:10, right:10}}>
                <Ionicons name="close" size={26} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F9FAFB", padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: "#F3F4F6" }} activeOpacity={0.8} onPress={async () => {
              setStep1ModalVisible(false);
              handlePickImage(true);
            }}>
              <View style={[{ width: 48, height: 48, borderRadius: 12, justifyContent: "center", alignItems: "center", marginRight: 16 }, { backgroundColor: "#EFF6FF" }]}><Ionicons name="camera" size={24} color="#3B82F6" /></View>
              <View>
                <AppText style={{ fontSize: 16, fontWeight: "600", color: "#1F2937", fontFamily: "Mandali" }}>{language === "te" ? "కెమెరా ద్వారా" : "Take Photo"}</AppText>
                <AppText style={{ fontSize: 13, color: "#6B7280", marginTop: 2, fontFamily: "Mandali" }}>{language === "te" ? "ఇప్పుడే ఫోటో తీయండి" : "Capture a live photo"}</AppText>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F9FAFB", padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: "#F3F4F6" }} activeOpacity={0.8} onPress={async () => {
              setStep1ModalVisible(false);
              handlePickImage(false);
            }}>
              <View style={[{ width: 48, height: 48, borderRadius: 12, justifyContent: "center", alignItems: "center", marginRight: 16 }, { backgroundColor: "#F0FDF4" }]}><Ionicons name="images" size={24} color="#16A34A" /></View>
              <View>
                <AppText style={{ fontSize: 16, fontWeight: "600", color: "#1F2937", fontFamily: "Mandali" }}>{language === "te" ? "గ్యాలరీ నుండి" : "Gallery"}</AppText>
                <AppText style={{ fontSize: 13, color: "#6B7280", marginTop: 2, fontFamily: "Mandali" }}>{language === "te" ? "పాత ఫోటో ఎంచుకోండి" : "Choose an existing photo"}</AppText>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F9FAFB", padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: "#F3F4F6" }} activeOpacity={0.8} onPress={async () => {
              setStep1ModalVisible(false);
              handlePickDocument();
            }}>
              <View style={[{ width: 48, height: 48, borderRadius: 12, justifyContent: "center", alignItems: "center", marginRight: 16 }, { backgroundColor: "#FEF2F2" }]}><Ionicons name="document-text" size={24} color="#DC2626" /></View>
              <View>
                <AppText style={{ fontSize: 16, fontWeight: "600", color: "#1F2937", fontFamily: "Mandali" }}>{language === "te" ? "PDF డాక్యుమెంట్" : "PDF Document"}</AppText>
                <AppText style={{ fontSize: 13, color: "#6B7280", marginTop: 2, fontFamily: "Mandali" }}>{language === "te" ? "రసీదు ఫైల్ ఎంచుకోండి" : "Upload a receipt file"}</AppText>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* FULLSCREEN PROOF VIEWER MODAL */}
      <Modal visible={!!viewerImage || !!viewerPdf} transparent animationType="fade" statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "center", alignItems: "center" }}>
          
          <TouchableOpacity 
            style={{ position: "absolute", top: Platform.OS === 'ios' ? 50 : 30, right: 20, zIndex: 10, padding: 10, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 30 }} 
            onPress={() => { setViewerImage(null); setViewerPdf(null); }}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>

          {viewerImage ? (
            <Image 
              source={{ uri: viewerImage }} 
              style={{ width: "95%", height: "80%", borderRadius: 10 }} 
              resizeMode="contain"
            />
          ) : viewerPdf ? (
            <View style={{ width: "95%", height: "80%", borderRadius: 10, overflow: 'hidden', backgroundColor: "#fff" }}>
              <WebView 
                source={{ uri: Platform.OS === 'android' ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(viewerPdf)}` : viewerPdf }} 
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
  safe: { flex: 1, backgroundColor: "#F8FAFC" },  

  infoBanner: { flexDirection: "row", backgroundColor: "#E0F2FE", padding: 12, marginHorizontal: 16, marginTop: 12, borderRadius: 10, alignItems: "flex-start", borderWidth: 1, borderColor: "#BFDBFE" },
  infoText: { flex: 1, marginLeft: 8, fontSize: 13, color: "#1E3A8A", lineHeight: 24, fontFamily: "Mandali" },

  cropCard: { backgroundColor: "#fff", borderRadius: 16, marginBottom: 16, overflow: "hidden", borderWidth: 1, borderColor: "#E5E7EB", marginHorizontal: 16,  shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 5 },
  cropHeader: { flexDirection: "row", justifyContent: "space-between", padding: 16, backgroundColor: "#F9FAFB" },
  cropTitle: { fontSize: 18, fontWeight: "600", color: "#111827" },
  cropCount: { fontSize: 14, color: "#6B7280", marginTop: 2, fontWeight: "500" },
  detailItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  leftPart: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: { fontSize: 13, color: "#4B5563" },
  value: { fontSize: 13, fontWeight: "600", color: "#111827", textAlign: "right" },
  detailsGrid: { marginTop: 12, gap: 4 },
  bottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  finalAmount: { fontSize: 22, fontWeight: "800", color: "#0F172A" },
  deleteBtn: { backgroundColor: "#FEE2E2", padding: 10, borderRadius: 10 },
  notesBox: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 12, padding: 12, backgroundColor: "#F9FAFB", borderRadius: 8, borderWidth: 1, borderColor: "#E5E7EB" },
  notesText: { fontSize: 13, color: "#374151", flex: 1, lineHeight: 24 },
  workCard: { padding: 16, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  workTitle: { fontSize: 18, fontWeight: "600", color: "#111827" },
  date: { fontSize: 13, color: "#6B7280", fontWeight: "500" },
  addBtn: { position: "absolute", bottom: 30, right: 20 },
  addGradient: { width: 60, height: 60, borderRadius: 30, justifyContent: "center", alignItems: "center", elevation: 8, shadowColor: "#166534", shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.3, shadowRadius: 5 },
  statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, marginBottom: 4 },
  statusText: { fontSize: 13, fontWeight: "600" },
  toggle: { width: 44, height: 24, borderRadius: 12, padding: 2, justifyContent: "center" },
  toggleCircle: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff", elevation: 2 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalBox: { backgroundColor: "#fff", padding: 24, borderRadius: 20, width: "100%", alignItems: "center", elevation: 10 },
  modalTitle: { marginTop: 12, fontSize: 18, fontWeight: "600", color: "#111827" },
  modalSub: { fontSize: 14, color: "#4B5563", marginTop: 8, textAlign: "center", lineHeight: 22 },
  modalRow: { flexDirection: "row", marginTop: 24, gap: 16, width: "100%" },
  iconBg: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#FEE2E2", justifyContent: "center", alignItems: "center" },
  iconBg1: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#DCFCE7", justifyContent: "center", alignItems: "center" },
  cancelBtn: { flex: 1, paddingVertical: 14, backgroundColor: "#F3F4F6", borderRadius: 12, alignItems: "center" },
  deleteConfirmBtn: { flex: 1, paddingVertical: 14, backgroundColor: "#16A34A", borderRadius: 12, alignItems: "center" },
  deleteConfirmBtn1: { flex: 1, paddingVertical: 14, backgroundColor: "#DC2626", borderRadius: 12, alignItems: "center" },
  
  // UNIFIED PREMIUM MODAL CLASSES
  modalOverlayStandard: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center" },
  modalContentStandard: { width: "85%", backgroundColor: "white", borderRadius: 25, padding: 25, alignItems: "center", elevation: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10 },
  modalTitleStandard: { fontSize: 20, fontWeight: "500", marginVertical: 10, fontFamily: "Mandali" },
  modalSubStandard: { textAlign: "center", color: "#6B7280", marginBottom: 25, fontFamily: "Mandali", fontSize: 14, lineHeight: 20 },
  modalButtonsStandard: { flexDirection: "row", gap: 12, width: "100%" },
  modalCancelBtnStandard: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  modalConfirmBtnStandard: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center" },
  modalCancelTextStandard: { color: "#4B5563", fontWeight: "600", fontSize: 15, fontFamily: "Mandali" },
  modalConfirmTextStandard: { color: "white", fontWeight: "600", fontSize: 15, fontFamily: "Mandali" },
  modalIconBgStandard: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#FEE2E2", justifyContent: "center", alignItems: "center", marginBottom: 10 },
});