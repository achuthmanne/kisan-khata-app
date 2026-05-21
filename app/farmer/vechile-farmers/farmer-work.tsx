// vechile farmer work history
import AppEmptyState from "@/components/AppEmptyState";
import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
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

export default function FarmerHistory() {

  const router = useRouter();
  const { vehicleId, farmerId, name, phone } = useLocalSearchParams();
  const isMounted = useRef(true); 

  const fName = Array.isArray(name) ? name[0] : name;
  const fPhone = Array.isArray(phone) ? phone[0] : phone;
  const vId = Array.isArray(vehicleId) ? vehicleId[0] : vehicleId;
  const fId = Array.isArray(farmerId) ? farmerId[0] : farmerId;

  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<"te" | "en">("te");
  const [expanded, setExpanded] = useState<string | null>(null);

  const [data, setData] = useState<WorkItem[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [statusId, setStatusId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<"pending" | "paid">("paid");

  /* ---------------- LOAD ---------------- */

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let unsub: any;

      const load = async () => {
        const lang = await AsyncStorage.getItem("APP_LANG");
        if (lang && isMounted.current) setLanguage(lang as any);

        const userPhone = await AsyncStorage.getItem("USER_PHONE");
        if (!userPhone || !vId || !fId) {
            if (isMounted.current) setLoading(false);
            return;
        }

        const userDoc = await firestore().collection("users").doc(userPhone).get();
        const activeSession = userDoc.data()?.activeSession;

        if (!activeSession) {
          if (isMounted.current) setLoading(false);
          return;
        }

        unsub = firestore()
          .collection("users")
          .doc(userPhone)
          .collection("vehicles")
          .doc(vId)
          .collection("works")
          .doc(fId)
          .collection("entries")
          .where("session", "==", activeSession) 
          .onSnapshot(snap => {
            if (!snap || !snap.docs) {
              if (isMounted.current) setLoading(false);
              return;
            }

            const list: WorkItem[] = [];
            snap.forEach(doc => list.push({ id: doc.id, ...(doc.data() as any) }));

            list.sort((a, b) => {
              const timeA = a.createdAt?.toMillis() || 0;
              const timeB = b.createdAt?.toMillis() || 0;
              return timeB - timeA;
            });

            if (isMounted.current) {
                setData(list);
                setLoading(false);
            }
          }, (error) => {
              console.log("Snapshot error: ", error);
              if (isMounted.current) setLoading(false);
          });
      };

      load();
      return () => {
        if (unsub) unsub();
      };
    }, [vId, fId])
  );

  const handleDelete = async () => {
    const userPhone = await AsyncStorage.getItem("USER_PHONE");
    if (!userPhone || !deleteId || !vId || !fId) return;

    try {
        await firestore()
        .collection("users")
        .doc(userPhone)
        .collection("vehicles")
        .doc(vId)
        .collection("works")
        .doc(fId)
        .collection("entries")
        .doc(deleteId)
        .delete();
    } catch (error) {
        console.log("Delete Error: ", error);
    }

    if (isMounted.current) setDeleteId(null);
  };

  const handleStatusUpdate = async () => {
    const userPhone = await AsyncStorage.getItem("USER_PHONE");
    if (!userPhone || !statusId || !vId || !fId) return;

    try {
        await firestore()
        .collection("users")
        .doc(userPhone)
        .collection("vehicles")
        .doc(vId)
        .collection("works")
        .doc(fId)
        .collection("entries")
        .doc(statusId)
        .update({
            paymentStatus: newStatus
        });
    } catch (error) {
        console.log("Update Error: ", error);
    }

    if (isMounted.current) setStatusId(null);
  };

  /* ---------------- GROUP BY CROP ---------------- */
  const grouped = Object.values(
    data.reduce<Record<string, { crop: string; list: WorkItem[] }>>((acc, item) => {
      if (!acc[item.crop]) acc[item.crop] = { crop: item.crop, list: [] };
      acc[item.crop].list.push(item);
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
        subtitle={language === "te" ? "ఖాతా వివరాలు" : "Account Details"}
        language={language}
      />

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
          keyExtractor={(item: any) => item.crop}
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
            const isOpen = expanded === item.crop;

            return (
              <View style={styles.cropCard}>

                {/* CROP HEADER */}
                <TouchableOpacity activeOpacity={0.7}
                  style={[styles.cropHeader, { alignItems: "center" }]}
                  onPress={() => setExpanded(isOpen ? null : item.crop)}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", flex: 1, paddingRight: 10 }}>
                    <View style={{
                      width: 4, height: 50, borderRadius: 4,
                      backgroundColor: getCropColor(item.crop), marginRight: 10
                    }} />
                    <View style={{ flex: 1 }}>
                      <AppText style={styles.cropTitle} numberOfLines={1} ellipsizeMode="tail">{item.crop}</AppText>
                      <AppText style={styles.cropCount}>
                        {language === "te" ? `${item.list.length} పనులు` : `${item.list.length} Works`}
                      </AppText>
                    </View>
                  </View>
                  <View style={{ width: 32, height: 32, borderRadius: 20, backgroundColor: "#e6e8e9", justifyContent: "center", alignItems: "center" }}>
                    <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={18} color="#4B5563" />
                  </View>
                </TouchableOpacity>

                {/* EXPAND */}
                {isOpen && item.list.map((work: any) => {
                  const amount = Number(work.finalAmount?.toString().replace(/,/g, "") || 0);
                  const isPaid = work.paymentStatus === "paid"; 

                  return (
                    <View key={work.id} style={[styles.workCard]}>
                      
                      {/* TOP */}
                      <View style={styles.rowBetween}>
                        <AppText style={styles.workTitle} numberOfLines={1} ellipsizeMode="tail">{work.work}</AppText>
                        <AppText style={styles.date}>{work.date}</AppText>
                      </View>

                      {/* PAYMENT STATUS */}
                      <View style={styles.statusRow}>
                        <AppText style={[styles.statusText, { color: isPaid ? "#16A34A" : "#DC2626" }]}>
                          {isPaid
                            ? (language === "te" ? "చెల్లింపు పూర్తైంది (లాక్)" : "Payment Done (Locked)")
                            : (language === "te" ? "చెల్లింపు పెండింగ్" : "Pending")}
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

                      {/* 🔥 DETAILED GRID (ACRES vs SAALLU vs TIME DYNAMIC LOGIC) */}
                      <View style={styles.detailsGrid}>
                        
                        {/* 1. ACRES (Show if available) */}
                        {work.acres ? (
                          <View style={styles.detailItem}>
                            <View style={styles.leftPart}>
                              <Ionicons name="resize-outline" size={14} color="#6B7280" />
                              <AppText style={styles.label}>{language === "te" ? "ఎకరాలు:" : "Acres:"}</AppText>
                            </View>
                            <AppText style={styles.value}>{work.acres}</AppText>
                          </View>
                        ) : null}

                        {/* 2. DYNAMIC WORK MEASURE (Time vs Saallu) */}
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
                        {/* If it's pure ratePerAcre, we skip Saallu and Time, which is perfectly correct! */}

                        {/* 3. DYNAMIC RATE */}
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
                            <AppText style={styles.label}>{language === "te" ? "మొత్తం:" : "Payable:"}</AppText>
                          </View>
                          <AppText style={styles.value}>₹ {Number(work.payableAmount || 0).toLocaleString("en-IN")}</AppText>
                        </View>

                        {/* ADVANCE */}
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
                          <AppText style={styles.notesText} numberOfLines={2} ellipsizeMode="tail">{work.notes}</AppText>
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
            pathname: "/farmer/vechile-farmers/add-farmerwork",
            params: { vehicleId: vId, farmerId: fId }
          })
        }
      >
        <LinearGradient colors={["#16A34A", "#166534"]} style={styles.addGradient}>
          <Ionicons name="add" size={30} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

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

      {/* PAYMENT MODAL */}
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
  safe: { flex: 1, backgroundColor: "#F8FAFC" },  
  infoBanner: { flexDirection: "row", backgroundColor: "#DBEAFE", padding: 12, marginHorizontal: 16, marginTop: 12, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: "#BFDBFE" },
  infoText: { flex: 1, marginLeft: 8, fontSize: 13, color: "#1E3A8A", lineHeight: 22, fontFamily: "Mandali" },
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
  notesText: { fontSize: 14, color: "#374151", flex: 1, lineHeight: 24 },
  workCard: { padding: 14, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", paddingRight: 5 },
  workTitle: { fontSize: 14, fontWeight: "600", flex: 1, marginRight: 10 },
  date: { fontSize: 12, color: "#6B7280" },
  addBtn: { position: "absolute", bottom: 30, right: 20 },
  addGradient: { width: 60, height: 60, borderRadius: 30, justifyContent: "center", alignItems: "center", elevation: 5, shadowColor: "#000", shadowOffset:{width:0, height:2}, shadowOpacity:0.2, shadowRadius:4 },
  statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  statusText: { fontSize: 12, fontWeight: "600" },
  toggle: { width: 40, height: 20, borderRadius: 20, padding: 2, justifyContent: "center" },
  toggleCircle: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#fff" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", zIndex: 999 },
  modalBox: { backgroundColor: "#fff", padding: 20, borderRadius: 16, width: "80%", alignItems: "center", elevation: 10 },
  modalTitle: { marginTop: 10, fontSize: 16, fontWeight: "600", color: "#111827" },
  modalSub: { fontSize: 13, color: "#6B7280", marginTop: 6, textAlign: "center", lineHeight: 20 },
  modalRow: { flexDirection: "row", marginTop: 20, gap: 12 }, 
  iconBg: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#FEE2E2", justifyContent: "center", alignItems: "center", marginBottom: 10 },
  iconBg1: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#DCFCE7", justifyContent: "center", alignItems: "center", marginBottom: 10 }, 
  cancelBtn: { flex: 1, padding: 12, backgroundColor: "#F3F4F6", borderRadius: 10, alignItems: "center" },
  deleteConfirmBtn: { flex: 1, padding: 12, backgroundColor: "#16A34A", borderRadius: 10, alignItems: "center" },
  deleteConfirmBtn1: { flex: 1, padding: 12, backgroundColor: "#DC2626", borderRadius: 10, alignItems: "center" },
  
  // UNIFIED PREMIUM MODAL CLASSES
  modalOverlayStandard: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 999 },
  modalContentStandard: { width: "80%", backgroundColor: "white", borderRadius: 25, padding: 25, alignItems: "center" },
  modalTitleStandard: { fontSize: 20, fontWeight: "500", color: "#e2431f", marginVertical: 10 },
  modalSubStandard: { textAlign: "center", color: "#64748B", marginBottom: 25 },
  modalButtonsStandard: { flexDirection: "row", gap: 10 },
  modalCancelBtnStandard: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#F1F5F9", alignItems: "center" },
  modalConfirmBtnStandard: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#EF4444", alignItems: "center" },
  modalCancelTextStandard: { color: "#64748B", fontWeight: "500" },
  modalConfirmTextStandard: { color: "white", fontWeight: "500" },
  modalIconBgStandard: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#f5e8e8", justifyContent: "center", alignItems: "center", marginBottom: 10 },
});