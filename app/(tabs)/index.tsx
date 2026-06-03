import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<'te' | 'en'>('en');
 const [time, setTime] = useState(new Date());
  const locale = language === 'te' ? 'te-IN' : 'en-IN';

const formattedDate = time.toLocaleDateString(locale, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const formattedTime = time.toLocaleTimeString(locale, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

  /* ---------- STATES ---------- */
 
  const [mestriName, setMestriName] = useState('');
  const [farmersCount, setFarmersCount] = useState(0);
  const [kulisCount, setKulisCount] = useState(0);

const [todaySessions, setTodaySessions] = useState<any[]>([]);
useFocusEffect(
  useCallback(() => {
    loadDashboard();
  }, [])
);

  
  /* ---------- LIVE CLOCK ---------- */
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* ---------- INIT ---------- */
  useEffect(() => {
    loadLanguage();
    loadDashboard();
  }, []);

  const loadLanguage = async () => {
    const savedLang = await AsyncStorage.getItem('APP_LANG');
    if (savedLang === 'te' || savedLang === 'en') {
      setLanguage(savedLang);
    }
  };

  /* ---------- LOAD DASHBOARD DATA ---------- */
  const loadDashboard = async () => {
    setLoading(true);

    const userRaw = await AsyncStorage.getItem('CURRENT_USER');
    if (!userRaw) {
      setLoading(false);
      return;
    }

    const user = JSON.parse(userRaw);
    setMestriName(user.name);

    /* COUNTS */
    const farmersRaw = await AsyncStorage.getItem(`FARMERS_${user.id}`);
    const kulisRaw = await AsyncStorage.getItem(`KULIS_${user.id}`);

    const farmers = farmersRaw ? JSON.parse(farmersRaw) : [];
    const kulis = kulisRaw ? JSON.parse(kulisRaw) : [];

    setFarmersCount(farmers.length);
    setKulisCount(kulis.length);

    /* TODAY ATTENDANCE */
    const attendanceRaw = await AsyncStorage.getItem(`ATTENDANCE_${user.id}`);
    if (attendanceRaw) {
      const sessions = JSON.parse(attendanceRaw);
      const todayStr = new Date().toDateString();

     const todayList = sessions.filter(
  (s: any) => s.date === todayStr
);

const mapped = todayList.map((s: any) => ({
  id: s.dateISO,          // ✅ key warning kuda fix
  dateISO: s.dateISO,
  farmerName: s.farmer,
  cropName: s.crop,
  workName: s.work,       // ✅ ADD THIS
  present: s.summary.present,
  absent: s.summary.absent,
  total: s.summary.total,
}));

setTodaySessions(mapped);
 } else {
  setTodaySessions([]);
}
 setTimeout(() => setLoading(false), 800);
  };

  /* ---------- NAV WITH LOADER ---------- */
  const goTo = (path: any) => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      router.push(path);
    }, 600);
  };

const NavCard = ({
  icon,
  title,
  desc,
  path,
}: {
  icon: any;
  title: string;
  desc: string;
  path: string;
}) => (
  <Pressable
    style={({ pressed }) => [
      styles.navCard,
      pressed && { transform: [{ scale: 0.97 }] },
    ]}
    onPress={() => goTo(path)}
  >
    <View style={styles.navRow}>
      <View style={styles.iconBox}>
        <Ionicons name={icon} size={26} color="#1b5e20" />
      </View>

      <View style={styles.textBox}>
        <Text style={styles.navTitle}>{title}</Text>
        <Text style={styles.navDesc}>{desc}</Text>
      </View>

      <Ionicons name="chevron-forward" size={20} color="#999" />
    </View>
  </Pressable>
);



  const HomeShimmer = () => {
    const opacity = useSharedValue(0.4);
    useEffect(() => {
      opacity.value = withRepeat(withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true);
    }, []);
    const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

    return (
      <Animated.View style={[{ padding: 20 }, animatedStyle]}>
        {/* Welcome Text */}
        <View style={{ height: 28, width: 220, backgroundColor: '#E2E8F0', borderRadius: 8, marginBottom: 10 }} />
        <View style={{ height: 16, width: 160, backgroundColor: '#E2E8F0', borderRadius: 6, marginBottom: 30 }} />

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={{ height: 32, width: 50, backgroundColor: '#E2E8F0', borderRadius: 6, marginBottom: 10 }} />
            <View style={{ height: 16, width: 90, backgroundColor: '#E2E8F0', borderRadius: 4 }} />
          </View>
          <View style={styles.statCard}>
            <View style={{ height: 32, width: 50, backgroundColor: '#E2E8F0', borderRadius: 6, marginBottom: 10 }} />
            <View style={{ height: 16, width: 90, backgroundColor: '#E2E8F0', borderRadius: 4 }} />
          </View>
        </View>

        {/* Today Card */}
        <View style={styles.todayCard}>
          <View style={{ height: 20, width: 140, backgroundColor: '#E2E8F0', borderRadius: 6, marginBottom: 12 }} />
          <View style={{ height: 14, width: 180, backgroundColor: '#E2E8F0', borderRadius: 4, marginBottom: 20 }} />
          {[1, 2, 3].map(i => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ height: 16, width: 80, backgroundColor: '#E2E8F0', borderRadius: 4, marginRight: 10 }} />
              <View style={{ height: 16, width: 120, backgroundColor: '#E2E8F0', borderRadius: 4 }} />
            </View>
          ))}
          <View style={styles.summaryRow}>
            <View style={styles.summaryBox}>
              <View style={{ height: 24, width: 30, backgroundColor: '#E2E8F0', borderRadius: 4, marginBottom: 8 }} />
              <View style={{ height: 12, width: 60, backgroundColor: '#E2E8F0', borderRadius: 4 }} />
            </View>
            <View style={styles.summaryBox}>
              <View style={{ height: 24, width: 30, backgroundColor: '#E2E8F0', borderRadius: 4, marginBottom: 8 }} />
              <View style={{ height: 12, width: 60, backgroundColor: '#E2E8F0', borderRadius: 4 }} />
            </View>
          </View>
        </View>

        {/* Mestri Badge */}
        <View style={styles.mestriBadge}>
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#E2E8F0', marginRight: 10 }} />
          <View style={{ height: 18, width: 180, backgroundColor: '#E2E8F0', borderRadius: 6 }} />
        </View>

        {/* Nav Cards */}
        {[1, 2, 3, 4].map(i => (
          <View key={i} style={styles.navCard}>
            <View style={styles.navRow}>
              <View style={[styles.iconBox, { backgroundColor: '#E2E8F0' }]} />
              <View style={styles.textBox}>
                <View style={{ height: 18, width: '50%', backgroundColor: '#E2E8F0', borderRadius: 6, marginBottom: 8 }} />
                <View style={{ height: 14, width: '80%', backgroundColor: '#E2E8F0', borderRadius: 4 }} />
              </View>
            </View>
          </View>
        ))}
      </Animated.View>
    );
  };

  /* ---------- UI ---------- */
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* HEADER */}
      <View style={styles.headerCard}>
        <Text style={styles.title}>
          {language === 'te' ? 'డాష్‌బోర్డ్' : 'Dashboard'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={loading ? { paddingBottom: 0 } : styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <HomeShimmer />
        ) : (
          <>
            {/* WELCOME */}
            <Text style={styles.sub}>
              {language === 'te' ? 'స్వాగతం!' : 'Welcome back!'} {mestriName}
            </Text>

            <Text style={styles.sub1}>
              {formattedDate} | {formattedTime}
            </Text>

            {/* STATS */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{farmersCount}</Text>
                <Text style={styles.statLabel}>
                  {language === 'te' ? 'మొత్తం రైతులు' : 'Farmers'}
                </Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statValue}>{kulisCount}</Text>
                <Text style={styles.statLabel}>
                  {language === 'te' ? 'మొత్తం కూలీలు' : 'Workers'}
                </Text>
              </View>
            </View>

            {todaySessions.length > 0 ? (
              todaySessions.map((item, index) => (
                <View key={item.dateISO || index} style={styles.todayCard}>
                  <View style={styles.todayHeader}>
                    <Ionicons name="calendar-outline" size={18} color="#1b5e20" />
                    <Text style={styles.todayTitle}>
                      {language === 'te' ? 'ఈరోజు హాజరు' : "Today's Attendance"}
                    </Text>
                  </View>

                  <Text style={styles.savedTime}>
                    {formattedDate} | {new Date(item.dateISO).toLocaleTimeString(locale, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>
                      👨‍🌾 {language === 'te' ? 'రైతు' : 'Farmer'}:
                    </Text>
                    <Text style={styles.detailValue}>{item.farmerName}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>
                      🛠 {language === 'te' ? 'పని' : 'Work'}:
                    </Text>
                    <Text style={styles.detailValue}>{item.workName}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>
                      🌾 {language === 'te' ? 'పంట' : 'Crop'}:
                    </Text>
                    <Text style={styles.detailValue}>{item.cropName}</Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <View style={styles.summaryBox}>
                      <Text style={styles.summaryNumber}>{item.present}</Text>
                      <Text style={styles.summaryLabel}>
                        {language === 'te' ? 'హాజరు' : 'Present'}
                      </Text>
                    </View>

                    <View style={styles.summaryBox}>
                      <Text style={styles.summaryNumber1}>{item.absent}</Text>
                      <Text style={styles.summaryLabel}>
                        {language === 'te' ? 'గైర్హాజరు' : 'Absent'}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.noAttendanceCard}>
                <Text style={styles.noAttendanceTitle}>
                  {language === 'te'
                    ? 'ఈరోజు హాజరు ఇంకా వెయ్యలేదు'
                    : "Attandance Not Yet Taken Today"}
                </Text>
              </View>
            )}

            <View style={styles.mestriBadge}>
              <Ionicons name="person-circle" size={25} color="#1b5e20" />
              <Text style={styles.mestriText}>
                {language === 'te' ? 'మెస్త్రి పేరు' : 'Head Name: '} :   {mestriName}
              </Text>
            </View>

            {/* NAV CARDS */}
            <NavCard
              icon="people-outline"
              title={language === 'te' ? 'రైతులు' : 'Farmers'}
              desc={
                language === 'te'
                  ? 'రైతుల వివరాలు నిర్వహించండి'
                  : 'Manage farmers'
              }
              path="/(tabs)/farmers"
            />

            <NavCard
              icon="construct-outline"
              title={language === 'te' ? 'కూలీలు' : 'Workers'}
              desc={
                language === 'te'
                  ? 'కూలీల వివరాలు'
                  : 'Manage workers'
              }
              path="/(tabs)/kulis"
            />

            <NavCard
              icon="calendar-outline"
              title={language === 'te' ? 'హాజరు' : 'Attendance'}
              desc={
                language === 'te'
                  ? 'రోజువారీ హాజరు నమోదు'
                  : 'Daily attendance entry'
              }
              path="/(tabs)/attendance"
            />

            <NavCard
              icon="cash-outline"
              title={language === 'te' ? 'చెల్లింపులు' : 'Payments'}
              desc={
                language === 'te'
                  ? 'కూలి లెక్కలు'
                  : 'Payment history & settlement'
              }
              path="/(tabs)/payment"
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

/* ---------- STYLES ---------- */
const styles = StyleSheet.create({
  headerCard: {
    backgroundColor: '#1b5e20',
    paddingTop: 50,
    paddingBottom: 14,
    alignItems: 'center',
  },
  title: { fontSize: 28, fontWeight: '700', color: '#fff' },

  content: { padding: 20 },
  sub: { fontSize: 26, fontWeight: '600', color: '#1b5e20' },
  sub1: { color: '#555', marginBottom: 30, fontSize: 16},

  statsRow: { flexDirection: 'row', marginBottom: 30 },
  statCard: {
    flex: 1,
    backgroundColor: '#e8f5e9',
    marginHorizontal: 6,
    borderRadius: 14,
    paddingVertical: 20,
    alignItems: 'center',
    elevation: 3
  },
 cardRow: {
  flexDirection: 'row',
  alignItems: 'center',
},

  statValue: { fontSize: 28, fontWeight: '700', color: '#1b5e20' },
  statLabel: { color: '#555' },
  todayCard: {
  backgroundColor: '#f1f8e9',
  borderRadius: 18,
  padding: 18,
  marginBottom: 30,
  elevation: 4,
},

todayHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 6,
},

todayTitle: {
  marginLeft: 6,
  fontSize: 16,
  fontWeight: '700',
  color: '#1b5e20',
},

savedTime: {
  fontSize: 15,
  color: '#555',
  marginBottom: 12,
},

detailRow: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 8,
},

detailLabel: {
  marginLeft: 6,
  fontSize: 14,
  fontWeight: '600',
  color: '#555',
},

detailValue: {
  marginLeft: 6,
  fontSize: 14,
  fontWeight: '700',
  color: '#1b5e20',
},

summaryRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  marginTop: 14,
},

summaryBox: {
  flex: 1,
  backgroundColor: '#ffffff',
  marginHorizontal: 4,
  paddingVertical: 12,
  borderRadius: 12,
  alignItems: 'center',
  elevation: 1
},

summaryNumber: {
  fontSize: 18,
  fontWeight: '800',
  color: '#2e7d32',
},
summaryNumber1: {
  fontSize: 18,
  fontWeight: '800',
  color: '#e80e0e',
},
navCard: {
  backgroundColor: '#ffffff',
  borderRadius: 18,
  paddingVertical: 20,
  paddingHorizontal: 16,
  marginBottom: 16,
  elevation: 5,
  shadowColor: '#000',
  shadowOpacity: 0.08,
  shadowRadius: 6,
},

navRow: {
  flexDirection: 'row',
  alignItems: 'center',
},

iconBox: {
  width: 48,
  height: 48,
  borderRadius: 14,
  backgroundColor: '#e8f5e9',
  justifyContent: 'center',
  alignItems: 'center',
},

textBox: {
  flex: 1,
  marginLeft: 14,
},

navTitle: {
  fontSize: 17,
  fontWeight: '700',
  color: '#1b5e20',
},

navDesc: {
  marginTop: 4,
  fontSize: 13,
  color: '#666',
},

summaryLabel: {
  fontSize: 12,
  color: '#555',
  marginTop: 2,
},


  

  value: { color: '#1b5e20', fontWeight: '600', marginBottom: 6 },
  attValue: { color: '#2e7d32', fontWeight: '600' },
  attTotal: { fontWeight: '700', marginTop: 6 },

  noAttendanceCard: {
    backgroundColor: '#fffbcb',
    borderRadius: 16,
    padding: 20,
    marginBottom: 30,
    alignItems: 'center',
    elevation: 3
  },
  noAttendanceTitle: { fontWeight: '700', color: '#ff0000'
   },
  noAttendanceMsg: { color: '#ff0000', marginTop: 6 },
card: {
  backgroundColor: '#ffffff',
  borderRadius: 18,
  paddingVertical: 22,
  paddingHorizontal: 18,
  marginBottom: 16,
  elevation: 5,
  shadowColor: '#000',
  shadowOpacity: 0.08,
  shadowRadius: 6,
},

 cardTitle: {
  fontSize: 18,
  fontWeight: '700',
  color: '#1b5e20',
},

 cardDesc: {
  marginTop: 4,
  color: '#666',
  fontSize: 14,
},

mestriBadge: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#e8f5ea',
  padding: 10,
  borderRadius: 12,
  marginBottom: 12,
elevation: 2,
},
mestriText: {
  marginLeft:10,
  fontSize: 18,
  fontWeight: '700',
  color: '#1b5e20',
alignItems: 'center'
},




  loader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: { marginTop: 10, color: '#1b5e20', fontWeight: '600' },
});
