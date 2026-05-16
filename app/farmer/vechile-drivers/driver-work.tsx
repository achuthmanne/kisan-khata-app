import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";
import AppEmptyState from "@/components/AppEmptyState"; 
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
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
  work: string;
  date: string;
  acres?: string;
  payableAmount?: string;
  advanceAmount?: string;
  finalAmount?: string;
  notes?: string;
  paymentStatus?: string;
  createdAt?: any;
};

export default function DriverHistory() {

  const router = useRouter();
  const { vehicleId, driverId, name, phone } = useLocalSearchParams();

  // 🔥 URL Params Array లాగా వస్తే క్రాష్ అవ్వకుండా
  const dName = Array.isArray(name) ? name[0] : name;
  const dPhone = Array.isArray(phone) ? phone[0] : phone;
  const vId = Array.isArray(vehicleId) ? vehicleId[0] : vehicleId;
  const dId = Array.isArray(driverId) ? driverId[0] : driverId;

  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<"te" | "en">("te");
  const [expanded, setExpanded] = useState<string | null>(null);

  const [data, setData] = useState<WorkItem[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [statusId, setStatusId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<"pending" | "paid">("paid");

  /* ---------------- LOAD ---------------- */

  useFocusEffect(
    useCallback(() => {
      let unsub: any;

      const load = async () => {
        const lang = await AsyncStorage.getItem("APP_LANG");
        if (lang) setLanguage(lang as any);

        const userPhone = await AsyncStorage.getItem("USER_PHONE");
        if (!userPhone || !vId || !dId) return;

        // 🔥 1. FETCH ACTIVE SESSION
        const userDoc = await firestore().collection("users").doc(userPhone).get();
        const activeSession = userDoc.data()?.activeSession;

        if (!activeSession) {
          setLoading(false);
          return;
        }

        // 🔥 2. SESSION BASED QUERY WITH CLIENT SORTING
        unsub = firestore()
          .collection("users")
          .doc(userPhone)
          .collection("vehicles")
          .doc(vId)
          .collection("drivers")
          .doc(dId)
          .collection("entries")
          .where("session", "==", activeSession)
          .onSnapshot(snap => {
            if (!snap || !snap.docs) {
              setLoading(false);
              return;
            }

            const list: WorkItem[] = [];
            snap.forEach(doc => list.push({ id: doc.id, ...(doc.data() as any) }));

            // 🔥 Index ఎర్రర్ రాకుండా సార్టింగ్
            list.sort((a, b) => {
              const timeA = a.createdAt?.toMillis() || 0;
              const timeB = b.createdAt?.toMillis() || 0;
              return timeB - timeA;
            });

            setData(list);
            setLoading(false);
          });
      };

      load();
      return () => {
        if (unsub) unsub();
      };
    }, [vId, dId])
  );

  const handleDelete = async () => {
    const userPhone = await AsyncStorage.getItem("USER_PHONE");
    if (!userPhone || !deleteId || !vId || !dId) return;

    await firestore()
      .collection("users")
      .doc(userPhone)
      .collection("vehicles")
      .doc(vId)
      .collection("drivers")
      .doc(dId)
      .collection("entries")
      .doc(deleteId)
      .delete();

    setDeleteId(null);
  };

  const handleStatusUpdate = async () => {
    const userPhone = await AsyncStorage.getItem("USER_PHONE");
    if (!userPhone || !statusId || !vId || !dId) return;

    await firestore()
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
      });

    setStatusId(null);
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
        <View style={{ paddingTop: 10 }}>
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
                  <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                    <View style={{
                      width: 4, height: 50, borderRadius: 4,
                      backgroundColor: getCropColor(item.work), marginRight: 10
                    }} />
                    <View style={{ flex: 1 }}>
                      <AppText style={styles.cropTitle}>
                        {item.work}
                      </AppText>
                      <AppText style={styles.cropCount}>
                        {language === "te" ? `${item.list.length} పనులు` : `${item.list.length} Works`}
                      </AppText>
                    </View>
                  </View>
                  <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={20} color="#6B7280" />
                </TouchableOpacity>

                {/* EXPAND */}
                {isOpen && item.list.map((work: any) => {
                  const amount = Number(work.finalAmount?.toString().replace(/,/g, "") || 0);
                  const isPaid = work.paymentStatus === "paid"; // 🔥 Check if Paid

                  return (
                    <View key={work.id} style={[styles.workCard]}>

                      {/* TOP */}
                      <View style={[styles.rowBetween, { justifyContent:'center'}]}>
                        <AppText style={styles.date}>{work.date}</AppText>
                      </View>

                      {/* PAYMENT STATUS */}
                      <View style={styles.statusRow}>
                        <AppText style={[styles.statusText, { color: isPaid ? "#16A34A" : "#DC2626" }]}>
                          {isPaid
                            ? (language === "te" ? "చెల్లింపు పూర్తైంది" : "Payment Done")
                            : (language === "te" ? "చెల్లింపు పెండింగ్" : "Payment Pending")}
                        </AppText>
                        <TouchableOpacity
                          activeOpacity={isPaid ? 1 : 0.8}
                          disabled={isPaid}
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

                      {/* DETAILS */}
                      <View style={styles.detailsGrid}>
                        <View style={styles.detailItem}>
                          <View style={styles.leftPart}>
                            <Ionicons name="cash-outline" size={14} color="#6B7280" />
                            <AppText style={styles.label}>{language === "te" ? "మొత్తం:" : "Payable:"}</AppText>
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
      <TouchableOpacity activeOpacity={0.8}
        style={styles.addBtn}
        onPress={() =>
          router.push({
            pathname: "/farmer/vechile-drivers/add-driverwork",    
            params: { vehicleId: vId, driverId: dId }
          })
        }
      >
        <LinearGradient colors={["#16A34A","#166534"]} style={styles.addGradient}>
          <Ionicons name="add" size={30} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
      
      {/* DELETE MODAL */}
      <Modal visible={!!deleteId} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <View style={styles.iconBg}>
              <Ionicons name="trash-outline" size={36} color="#DC2626" />
            </View>
            <AppText style={styles.modalTitle}>{language === "te" ? "తొలగించాలా?" : "Delete Work?"}</AppText>
            <AppText style={styles.modalSub}>
              {language === "te" ? "ఈ పనిని తొలగించాలనుకుంటున్నారా?" : "Are you sure you want to delete this work?"}
            </AppText>
            <View style={styles.modalRow}>
              <TouchableOpacity activeOpacity={0.8} style={styles.cancelBtn} onPress={() => setDeleteId(null)}>
                <AppText>{language === "te" ? "రద్దు చేయి" : "Cancel"}</AppText>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.8} style={styles.deleteConfirmBtn1} onPress={handleDelete}>
                <AppText style={{ color: "#fff" }}>{language === "te" ? "తొలగించు" : "Delete"}</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* STATUS MODAL */}
      <Modal visible={!!statusId} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <View style={styles.iconBg1}>
              <Ionicons name="checkmark-done" size={36} color="#16A34A" />
            </View>
            <AppText style={styles.modalTitle}>
              {language === "te" ? "చెల్లింపు పూర్తయ్యిందా?" : "Confirm Payment Completion"}
            </AppText>
            <AppText style={styles.modalSub}>
              {language === "te"
                ? "ఈ పనికి సంబంధించిన చెల్లింపు పూర్తిగా పూర్తయిందని మీరు ఖచ్చితంగా అనుకుంటున్నారా?\n\nఒక్కసారి 'అవును' నొక్కితే, ఈ పని శాశ్వతంగా లాక్ చేయబడుతుంది మరియు చెల్లింపు జరిగినట్లుగా మార్క్ చేయబడుతుంది."
                : "Are you sure the payment for this work is fully completed?\n\nOnce you press 'confirm', this work will be permanently locked and marked as paid."}
            </AppText>
            <View style={styles.modalRow}>
              <TouchableOpacity activeOpacity={0.8} style={styles.cancelBtn} onPress={() => setStatusId(null)}>
                <AppText>{language === "te" ? "రద్దు చేయి" : "Cancel"}</AppText>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.8} style={styles.deleteConfirmBtn} onPress={handleStatusUpdate}>
                <AppText style={{ color: "#ffffff" }}>{language === "te" ? "అవును" : "Confirm"}</AppText>
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
  finalAmount: { fontSize: 17, fontWeight: "bold", color: "#111827" },
  deleteBtn: { backgroundColor: "#FEE2E2", padding: 8, borderRadius: 10 },
  notesBox: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#E5E7EB" },
  notesText: { fontSize: 12, color: "#374151", flex: 1, lineHeight: 18 },
  workCard: { padding: 14, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between" },
  date: { fontSize: 12, color: "#6B7280" },
  addBtn: { position: "absolute", bottom: 30, right: 20 },
  addGradient: { width: 60, height: 60, borderRadius: 30, justifyContent: "center", alignItems: "center" },
  statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  statusText: { fontSize: 12, fontWeight: "600" },
  toggle: { width: 40, height: 20, borderRadius: 20, padding: 2, justifyContent: "center" },
  toggleCircle: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#fff" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  modalBox: { backgroundColor: "#fff", padding: 20, borderRadius: 16, width: "80%", alignItems: "center" },
  modalTitle: { marginTop: 10, fontSize: 16, fontWeight: "600" },
  modalSub: { fontSize: 13, color: "#6B7280", marginTop: 6, textAlign: "center" },
  modalRow: { flexDirection: "row", marginTop: 20, gap: 30 },
  iconBg: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#FEE2E2", justifyContent: "center", alignItems: "center", marginBottom: 10 },
  iconBg1: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#e2fef3", justifyContent: "center", alignItems: "center", marginBottom: 10 },
  cancelBtn: { flex: 1, padding: 12, backgroundColor: "#F3F4F6", borderRadius: 10, alignItems: "center" },
  deleteConfirmBtn: { flex: 1, padding: 12, backgroundColor: "#0c652f", borderRadius: 10, alignItems: "center" },
  deleteConfirmBtn1: { flex: 1, padding: 12, backgroundColor: "#DC2626", borderRadius: 10, alignItems: "center" },
});