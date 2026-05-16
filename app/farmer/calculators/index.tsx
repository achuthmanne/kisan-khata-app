import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

// మన కస్టమ్ కాంపోనెంట్స్
import AppHeader from '@/components/AppHeader';
import AppText from '@/components/AppText';

export default function CalculatorHub() {
  const router = useRouter();
  const [language, setLanguage] = useState<'te' | 'en'>('te');

  /* ---------- LOAD LANGUAGE ---------- */
  useEffect(() => {
    const loadLang = async () => {
      const saved = await AsyncStorage.getItem('APP_LANG');
      if (saved === 'te' || saved === 'en') {
        setLanguage(saved);
      }
    };
    loadLang();
  }, []);

  /* ---------- UI ---------- */
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F6F7F6" />
      
      {/* 🟢 MANA CUSTOM HEADER */}
      <AppHeader
        title={language === 'te' ? 'లెక్కలు' : 'Calculators'}
        subtitle={language === 'te' ? 'మీ లెక్కలను సులువుగా చేసుకోండి' : 'Make your calculations easy'}
        language={language}
      />

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        <AppText style={styles.sectionTitle}>
          {language === 'te' ? 'ఏ లెక్క చేయాలి?' : 'What do you want to calculate?'}
        </AppText>

        {/* 1. VADDI LEKKALA CALCULATOR (వడ్డీ లెక్కలు) */}
        <TouchableOpacity 
          activeOpacity={0.8} 
          style={styles.calcCard}
          onPress={() => router.push('/farmer/calculators/interest')} // నెక్స్ట్ మనం చేయబోయే వడ్డీ క్యాలిక్యులేటర్ స్క్రీన్ 
        >
          <View style={[styles.iconWrapper, { backgroundColor: '#ECFCCB' }]}>
            <MaterialCommunityIcons name="hand-coin-outline" size={30} color="#65A30D" />
          </View>
          <View style={styles.cardContent}>
            <AppText style={styles.cardTitle}>
              {language === 'te' ? 'వడ్డీ లెక్కలు' : 'Interest Calculator'}
            </AppText>
            <AppText style={styles.cardDesc}>
              {language === 'te' ? 'అప్పులు, వడ్డీలు మరియు నెలవారీ వాయిదాలు (EMI) లెక్కించండి.' : 'Calculate loans, interest rates, and EMIs easily.'}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
        </TouchableOpacity>

        {/* 2. REAL CALCULATOR (సాధారణ క్యాలిక్యులేటర్) */}
        <TouchableOpacity 
          activeOpacity={0.8} 
          style={styles.calcCard}
          onPress={() => router.push('/farmer/calculators/standard')} // నెక్స్ట్ మనం చేయబోయే నార్మల్ క్యాలిక్యులేటర్ స్క్రీన్
        >
          <View style={[styles.iconWrapper, { backgroundColor: '#E0E7FF' }]}>
            <MaterialCommunityIcons name="calculator-variant-outline" size={30} color="#4F46E5" />
          </View>
          <View style={styles.cardContent}>
            <AppText style={styles.cardTitle}>
              {language === 'te' ? 'సాధారణ క్యాలిక్యులేటర్' : 'Standard Calculator'}
            </AppText>
            <AppText style={styles.cardDesc}>
              {language === 'te' ? 'కూడికలు, తీసివేతలు, మరియు రోజువారీ సాధారణ లెక్కల కోసం.' : 'For daily basic calculations like addition and subtraction.'}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------- STYLES ---------- */
const styles = StyleSheet.create({
  safe: { 
    flex: 1, 
    backgroundColor: '#F6F7F6' 
  },
  scrollContainer: { 
    padding: 20 
  },
  sectionTitle: {
    fontSize: 18,
    color: '#6B7280',
    marginBottom: 16,
    marginLeft: 4,
    textAlign: 'center',
    fontFamily: 'Mandali'
  },
  calcCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e6e9ef'
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 6,
    fontFamily: 'Mandali'
  },
  cardDesc: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    fontFamily: 'Mandali'
  }
});