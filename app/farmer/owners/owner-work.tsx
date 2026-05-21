import AppEmptyState from "@/components/AppEmptyState";
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
  View
} from "react-native";
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
          const userDoc = await firestore().collection("users").doc(userPhone).get();
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
              snap.forEach(doc => list.push({ id: doc.id, ...(doc.data() as any) }));

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

      await firestore()
        .collection("users")
        .doc(userPhone)
        .collection("owners")
        .doc(oId)
        .collection("entries")
        .doc(deleteId)
        .delete();

    } catch (e) {
      console.log("Error deleting entry:", e);
    } finally {
      if (isMounted.current) {
        setDeleteId(null);
        setActionLoading(false);
      }
    }
  };

 /* ---------------- LOCK & AUTO-ADD EXPENSE (BATCH WRITE) ---------------- */
  const handleStatusUpdate = async () => {
    if (actionLoading) return;
    try {
      setActionLoading(true);
      const userPhone = await AsyncStorage.getItem("USER_PHONE");
      if (!userPhone || !statusId || !oId) return;

      const userDoc = await firestore().collection("users").doc(userPhone).get();
      const activeSession = userDoc.data()?.activeSession;

      const entryRef = firestore()
        .collection("users").doc(userPhone)
        .collection("owners").doc(oId)
        .collection("entries").doc(statusId);

      const entrySnap = await entryRef.get();
      if (!entrySnap.exists) return;

      const entryData = entrySnap.data();
      const totalAmountNum = Number(entryData?.payableAmount || 0); 

      const batch = firestore().batch();

      batch.update(entryRef, {
        paymentStatus: newStatus 
      });

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

      await batch.commit();

    } catch (e) {
      console.log("Error locking and saving expense:", e);
    } finally {
      if (isMounted.current) {
        setStatusId(null);
        setActionLoading(false);
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
              ? "గమనిక: పనికి సంబంధించిన చెల్లింపు పూర్తయిన తర్వాత లాక్ బటన్ నొక్కండి. లాక్ చేసిన తర్వాత రికార్డును తొలగించడం కుదరదు." 
              : "Note: Mark as paid once the payment is completed. Locked records cannot be deleted."}
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

                    </View>
                  );
                })}
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

      {/* DELETE MODAL */}
      <Modal visible={!!deleteId} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconBg}>
              <Ionicons name="trash-outline" size={36} color="#e44830" />
            </View>
            <AppText style={styles.modalTitleStandard}>{language === "te" ? "తొలగించాలా?" : "Delete Work?"}</AppText>
            <AppText style={styles.modalSubStandard}>
              {language === "te" ? "ఈ పనిని పూర్తిగా తొలగించాలనుకుంటున్నారా?" : "Are you sure you want to completely delete this work?"}
            </AppText>
            <View style={styles.modalButtons}>
              <TouchableOpacity activeOpacity={0.8} style={styles.modalCancelBtn} onPress={() => setDeleteId(null)} disabled={actionLoading}>
                <AppText style={styles.modalCancelText}>{language === "te" ? "వద్దు" : "Cancel"}</AppText>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.8} style={styles.modalConfirmBtn} onPress={handleDelete} disabled={actionLoading}>
                <AppText style={styles.modalConfirmText}>
                  {actionLoading ? (language === "te" ? "తొలగిస్తోంది..." : "Deleting...") : (language === "te" ? "తొలగించు" : "Delete")}
                </AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

     {/* PAYMENT MODAL */}
      <Modal visible={!!statusId} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <View style={styles.iconBg1}>
              <Ionicons name="checkmark-done" size={36} color="#16A34A" />
            </View>
            <AppText style={styles.modalTitle}>
              {language === "te" ? "చెల్లింపు పూర్తయ్యిందా?" : "Confirm Payment"}
            </AppText>
            <AppText style={styles.modalSub}>
              {language === "te"
                ? "ఈ పనికి సంబంధించిన చెల్లింపు పూర్తిగా పూర్తయిందని మీరు ఖచ్చితంగా అనుకుంటున్నారా?\n\nఒక్కసారి 'అవును' నొక్కితే, ఈ పని శాశ్వతంగా లాక్ చేయబడుతుంది మరియు ఈ మొత్తం ఆటోమేటిక్ గా మీ 'ఖర్చుల' ఖాతాలో (Expenses) నమోదు అవుతుంది."
                : "Are you sure the payment for this work is fully completed?\n\nOnce you press 'confirm', this work will be permanently locked and the total amount will be automatically added to your 'Expenses'."}
            </AppText>
            <View style={styles.modalRow}>
              <TouchableOpacity activeOpacity={0.8} style={styles.cancelBtn} onPress={() => setStatusId(null)} disabled={actionLoading}>
                <AppText>{language === "te" ? "వద్దు" : "Cancel"}</AppText>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.8} style={styles.deleteConfirmBtn} onPress={handleStatusUpdate} disabled={actionLoading}>
                <AppText style={{ color: "#ffffff", fontWeight: "600" }}>
                  {actionLoading ? (language === "te" ? "లాక్ చేస్తోంది..." : "Locking...") : (language === "te" ? "అవును" : "Confirm")}
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
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center" },
  modalContent: { width: "80%", backgroundColor: "white", borderRadius: 25, padding: 25, alignItems: "center" },
  modalTitleStandard: { fontSize: 20, fontWeight: "500", color: "#e2431f", marginVertical: 10 },
  modalSubStandard: { textAlign: "center", color: "#64748B", marginBottom: 25 },
  modalButtons: { flexDirection: "row", gap: 10 },
  modalCancelBtn: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#F1F5F9", alignItems: "center" },
  modalConfirmBtn: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#EF4444", alignItems: "center" },
  modalCancelText: { color: "#64748B", fontWeight: "500" },
  modalConfirmText: { color: "white", fontWeight: "500" },
  modalIconBg: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#f5e8e8", justifyContent: "center", alignItems: "center", marginBottom: 10 },
});