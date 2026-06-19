import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

import AppHeader from '@/components/AppHeader';
import AppText from '@/components/AppText';

export default function InterestCalculator() {
  const router = useRouter();
  const [language, setLanguage] = useState<'te' | 'en'>('te');

  // Active Tab State
  const [activeTab, setActiveTab] = useState<'village' | 'bank' | 'emi'>('village');

  // 🔥 STANDARD PATTERN STATES
  const [activeInput, setActiveInput] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Shared States
  const [principal, setPrincipal] = useState('');
  
  // Village State
  const [villageRate, setVillageRate] = useState('2');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());

  // Bank State
  const [bankRate, setBankRate] = useState('9'); 

  // EMI State
  const [emiRate, setEmiRate] = useState('11'); 
  const [emiMonths, setEmiMonths] = useState('24'); 

  // Refs for standard focus behavior
  const principalRef = useRef<TextInput>(null);
  const villageRateRef = useRef<TextInput>(null);
  const bankRateRef = useRef<TextInput>(null);
  const emiRateRef = useRef<TextInput>(null);
  const emiMonthsRef = useRef<TextInput>(null);

  // Modals
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Result State
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    AsyncStorage.getItem('APP_LANG').then((saved) => {
      if (saved === 'te' || saved === 'en') setLanguage(saved);
    });
  }, []);

  useEffect(() => {
    setResult(null);
    setErrors({});
  }, [activeTab]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(Math.round(amount));
  };

  const formatDate = (date: Date) => {
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
  };

  const formatNumberInput = (numStr: string) => {
    if (!numStr) return "";
    const raw = numStr.replace(/,/g, '');
    let integerPart = raw.split('.')[0];
    const decimalPart = raw.includes('.') ? '.' + raw.split('.')[1] : '';
    if (integerPart.length > 3) {
      const lastThree = integerPart.substring(integerPart.length - 3);
      const otherNumbers = integerPart.substring(0, integerPart.length - 3);
      integerPart = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree;
    }
    return integerPart + decimalPart;
  };

  const handleCalculate = () => {
    // 🔥 INLINE VALIDATION LOGIC
    let newErrors: any = {};
    const P = parseFloat(principal);
    
    if (isNaN(P) || P <= 0) {
      newErrors.principal = language === 'te' ? 'దయచేసి సరైన అసలు మొత్తం ఇవ్వండి*' : 'Please enter valid principal amount*';
    }

    if (activeTab === 'village') {
      const R = parseFloat(villageRate);
      if (isNaN(R) || R <= 0) newErrors.villageRate = language === 'te' ? 'సరైన వడ్డీ రేటు ఇవ్వండి*' : 'Enter valid rate*';
      if (startDate > endDate) newErrors.date = language === 'te' ? 'తేదీలు సరిగ్గా ఎంచుకోండి*' : 'Invalid dates selected*';
    } 
    else if (activeTab === 'bank') {
      const R = parseFloat(bankRate);
      if (isNaN(R) || R <= 0) newErrors.bankRate = language === 'te' ? 'సరైన వడ్డీ రేటు ఇవ్వండి*' : 'Enter valid rate*';
      if (startDate > endDate) newErrors.date = language === 'te' ? 'తేదీలు సరిగ్గా ఎంచుకోండి*' : 'Invalid dates selected*';
    } 
    else if (activeTab === 'emi') {
      const R = parseFloat(emiRate);
      const N = parseInt(emiMonths);
      if (isNaN(R) || R <= 0) newErrors.emiRate = language === 'te' ? 'సరైన రేటు ఇవ్వండి*' : 'Enter valid rate*';
      if (isNaN(N) || N <= 0) newErrors.emiMonths = language === 'te' ? 'నెలలు సరిగ్గా ఇవ్వండి*' : 'Enter valid months*';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setResult(null);
      return;
    }
    
    setErrors({});

    // Calculations
    if (activeTab === 'village') {
      const R = parseFloat(villageRate);
      let d1 = startDate.getDate(), m1 = startDate.getMonth(), y1 = startDate.getFullYear();
      let d2 = endDate.getDate(), m2 = endDate.getMonth(), y2 = endDate.getFullYear();
      
      let days = d2 - d1;
      let months = m2 - m1;
      let years = y2 - y1;

      if (days < 0) { months -= 1; days += 30; }
      if (months < 0) { years -= 1; months += 12; }

      const totalMonths = (years * 12) + months;
      const interestPerMonth = (P * R) / 100;
      const interestPerDay = interestPerMonth / 30;

      const totalInterest = (interestPerMonth * totalMonths) + (interestPerDay * days);
      
      setResult({
        type: 'village',
        months: totalMonths,
        days: days,
        interest: totalInterest,
        total: P + totalInterest
      });
    } 
    else if (activeTab === 'bank') {
      const R = parseFloat(bankRate);
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      const totalInterest = (P * R * (diffDays / 365)) / 100;

      setResult({
        type: 'bank',
        days: diffDays,
        interest: totalInterest,
        total: P + totalInterest
      });
    } 
    else if (activeTab === 'emi') {
      const R = parseFloat(emiRate);
      const N = parseInt(emiMonths);
      const r = R / (12 * 100); 
      const emi = (P * r * Math.pow(1 + r, N)) / (Math.pow(1 + r, N) - 1);
      const totalAmount = emi * N;
      const totalInterest = totalAmount - P;

      setResult({
        type: 'emi',
        emi: emi,
        interest: totalInterest,
        total: totalAmount,
        months: N
      });
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F6F7F6" />
      
      <AppHeader
        title={language === 'te' ? 'వడ్డీ లెక్కలు' : 'Interest Calculators'}
        subtitle={language === 'te' ? 'ఊరి వడ్డీ, బ్యాంక్ వడ్డీ & ఈఎంఐ' : 'Village, Bank & EMI Calc'}
        language={language}
      />

      <View style={styles.tabContainer}>
        <TouchableOpacity activeOpacity={0.8} style={[styles.tabBtn, activeTab === 'village' && styles.activeTabBtn]} onPress={() => setActiveTab('village')}>
          <MaterialCommunityIcons name="hand-coin-outline" size={20} color={activeTab === 'village' ? '#fff' : '#4B5563'} />
          <AppText style={[styles.tabText, activeTab === 'village' && styles.activeTabText]}>{language === 'te' ? 'ఊరి వడ్డీ' : 'Village'}</AppText>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.8} style={[styles.tabBtn, activeTab === 'bank' && styles.activeTabBtn]} onPress={() => setActiveTab('bank')}>
          <MaterialCommunityIcons name="bank-outline" size={20} color={activeTab === 'bank' ? '#fff' : '#4B5563'} />
          <AppText style={[styles.tabText, activeTab === 'bank' && styles.activeTabText]}>{language === 'te' ? 'బ్యాంక్ వడ్డీ' : 'Bank'}</AppText>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.8} style={[styles.tabBtn, activeTab === 'emi' && styles.activeTabBtn]} onPress={() => setActiveTab('emi')}>
          <Ionicons name="calendar-outline" size={18} color={activeTab === 'emi' ? '#fff' : '#4B5563'} />
          <AppText style={[styles.tabText, activeTab === 'emi' && styles.activeTabText]}>{language === 'te' ? 'ఈఎంఐ' : 'EMI'}</AppText>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* 💰 PRINCIPAL INPUT */}
          <View style={styles.inputGroup}>
            <AppText style={styles.label}>{activeTab === 'emi' ? (language === 'te' ? 'లోన్ మొత్తం (రూపాయల్లో)' : 'Loan Amount (₹)') : (language === 'te' ? 'అసలు మొత్తం (రూపాయల్లో)' : 'Principal Amount (₹)')}</AppText>
            <TouchableOpacity 
              activeOpacity={1} 
              onPress={() => { setActiveInput("principal"); principalRef.current?.focus(); }}
              style={[styles.inputBox, activeInput === "principal" && styles.inputFocused, errors.principal && styles.inputError]}
            >
              <MaterialCommunityIcons name="currency-inr" size={20} color={principal || activeInput === "principal" ? "#16A34A" : "#9CA3AF"} />
              <View style={styles.inputWrapper}>
                {!principal && activeInput !== "principal" && (
                  <AppText style={styles.placeholder}>{language === 'te' ? 'ఉదా: 100000' : 'Ex: 100000'}</AppText>
                )}
                <TextInput 
                  ref={principalRef}
                  style={[styles.input, { display: (principal || activeInput === "principal") ? "flex" : "none" }]} 
                  value={formatNumberInput(principal)} 
                  onChangeText={(txt) => { setPrincipal(txt.replace(/,/g, '')); if(errors.principal) setErrors({...errors, principal: ""}); }} 
                  keyboardType="numeric" 
                  cursorColor="#16A34A" 
                  selectionColor="#16A34A40"
                  onFocus={() => setActiveInput("principal")}
                  onBlur={() => setActiveInput(null)}
                />
              </View>
            </TouchableOpacity>
            {errors.principal && <AppText style={styles.errorText} language={language}>{errors.principal}</AppText>}
          </View>

          {/* 🏘️ VILLAGE RATE INPUT */}
          {activeTab === 'village' && (
            <View style={styles.inputGroup}>
              <AppText style={styles.label}>{language === 'te' ? 'వడ్డీ రేటు (నూరుకి నెలకు)' : 'Interest Rate (Per 100/Month)'}</AppText>
              <TouchableOpacity 
                activeOpacity={1} 
                onPress={() => { setActiveInput("villageRate"); villageRateRef.current?.focus(); }}
                style={[styles.inputBox, activeInput === "villageRate" && styles.inputFocused, errors.villageRate && styles.inputError]}
              >
                <MaterialCommunityIcons name="brightness-percent" size={20} color={villageRate || activeInput === "villageRate" ? "#EA580C" : "#9CA3AF"} />
                <View style={styles.inputWrapper}>
                  {!villageRate && activeInput !== "villageRate" && (
                    <AppText style={styles.placeholder}>{language === 'te' ? 'ఉదా: 2' : 'Ex: 2'}</AppText>
                  )}
                  <TextInput 
                    ref={villageRateRef}
                    style={[styles.input, { display: (villageRate || activeInput === "villageRate") ? "flex" : "none" }]} 
                    value={villageRate} 
                    onChangeText={(txt) => { setVillageRate(txt); if(errors.villageRate) setErrors({...errors, villageRate: ""}); }} 
                    keyboardType="numeric" 
                    cursorColor="#16A34A" 
                    selectionColor="#16A34A40"
                    onFocus={() => setActiveInput("villageRate")}
                    onBlur={() => setActiveInput(null)}
                  />
                </View>
                <AppText style={styles.suffixText}>{language === 'te' ? 'రూపాయలు' : 'Rupees'}</AppText>
              </TouchableOpacity>
              {errors.villageRate && <AppText style={styles.errorText} language={language}>{errors.villageRate}</AppText>}
            </View>
          )}

          {/* 🏦 BANK RATE INPUT */}
          {activeTab === 'bank' && (
            <View style={styles.inputGroup}>
              <AppText style={styles.label}>{language === 'te' ? 'వడ్డీ రేటు (% సంవత్సరానికి)' : 'Interest Rate (% Per Annum)'}</AppText>
              <TouchableOpacity 
                activeOpacity={1} 
                onPress={() => { setActiveInput("bankRate"); bankRateRef.current?.focus(); }}
                style={[styles.inputBox, activeInput === "bankRate" && styles.inputFocused, errors.bankRate && styles.inputError]}
              >
                <MaterialCommunityIcons name="brightness-percent" size={20} color={bankRate || activeInput === "bankRate" ? "#EA580C" : "#9CA3AF"} />
                <View style={styles.inputWrapper}>
                  {!bankRate && activeInput !== "bankRate" && (
                    <AppText style={styles.placeholder}>{language === 'te' ? 'ఉదా: 9' : 'Ex: 9'}</AppText>
                  )}
                  <TextInput 
                    ref={bankRateRef}
                    style={[styles.input, { display: (bankRate || activeInput === "bankRate") ? "flex" : "none" }]} 
                    value={bankRate} 
                    onChangeText={(txt) => { setBankRate(txt); if(errors.bankRate) setErrors({...errors, bankRate: ""}); }} 
                    keyboardType="numeric" 
                    cursorColor="#16A34A" 
                    selectionColor="#16A34A40"
                    onFocus={() => setActiveInput("bankRate")}
                    onBlur={() => setActiveInput(null)}
                  />
                </View>
                <AppText style={styles.suffixText}>%</AppText>
              </TouchableOpacity>
              {errors.bankRate && <AppText style={styles.errorText} language={language}>{errors.bankRate}</AppText>}
            </View>
          )}

          {/* 🗓️ EMI INPUTS */}
          {activeTab === 'emi' && (
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                <AppText style={styles.label}>{language === 'te' ? 'వడ్డీ రేటు (% / ఏడాడికి)' : 'Interest Rate (%)'}</AppText>
                <TouchableOpacity 
                  activeOpacity={1} 
                  onPress={() => { setActiveInput("emiRate"); emiRateRef.current?.focus(); }}
                  style={[styles.inputBox, activeInput === "emiRate" && styles.inputFocused, errors.emiRate && styles.inputError]}
                >
                  <View style={[styles.inputWrapper, { marginLeft: 0 }]}>
                    {!emiRate && activeInput !== "emiRate" && (
                      <AppText style={styles.placeholder}>11</AppText>
                    )}
                    <TextInput 
                      ref={emiRateRef}
                      style={[styles.input, { display: (emiRate || activeInput === "emiRate") ? "flex" : "none" }]} 
                      value={emiRate} 
                      onChangeText={(txt) => { setEmiRate(txt); if(errors.emiRate) setErrors({...errors, emiRate: ""}); }} 
                      keyboardType="numeric" 
                      cursorColor="#16A34A" 
                      selectionColor="#16A34A40"
                      onFocus={() => setActiveInput("emiRate")}
                      onBlur={() => setActiveInput(null)}
                    />
                  </View>
                  <AppText style={styles.suffixText}>%</AppText>
                </TouchableOpacity>
                {errors.emiRate && <AppText style={styles.errorText} language={language}>{errors.emiRate}</AppText>}
              </View>

              <View style={[styles.inputGroup, { flex: 1 }]}>
                <AppText style={styles.label}>{language === 'te' ? 'సమయం (నెలల్లో)' : 'Tenure (Months)'}</AppText>
                <TouchableOpacity 
                  activeOpacity={1} 
                  onPress={() => { setActiveInput("emiMonths"); emiMonthsRef.current?.focus(); }}
                  style={[styles.inputBox, activeInput === "emiMonths" && styles.inputFocused, errors.emiMonths && styles.inputError]}
                >
                  <View style={[styles.inputWrapper, { marginLeft: 0 }]}>
                    {!emiMonths && activeInput !== "emiMonths" && (
                      <AppText style={styles.placeholder}>24</AppText>
                    )}
                    <TextInput 
                      ref={emiMonthsRef}
                      style={[styles.input, { display: (emiMonths || activeInput === "emiMonths") ? "flex" : "none" }]} 
                      value={emiMonths} 
                      onChangeText={(txt) => { setEmiMonths(txt); if(errors.emiMonths) setErrors({...errors, emiMonths: ""}); }} 
                      keyboardType="numeric" 
                      cursorColor="#16A34A" 
                      selectionColor="#16A34A40"
                      onFocus={() => setActiveInput("emiMonths")}
                      onBlur={() => setActiveInput(null)}
                    />
                  </View>
                  <AppText style={styles.suffixText}>{language === 'te' ? 'నెలలు' : 'Mo'}</AppText>
                </TouchableOpacity>
                {errors.emiMonths && <AppText style={styles.errorText} language={language}>{errors.emiMonths}</AppText>}
              </View>
            </View>
          )}

          {/* 📅 DATES (VILLAGE & BANK) */}
          {activeTab !== 'emi' && (
            <View>
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 10, marginBottom: 0 }]}>
                  <AppText style={styles.label}>{language === 'te' ? 'తీసుకున్న తేదీ' : 'Start Date'}</AppText>
                  <TouchableOpacity 
                    activeOpacity={0.8} 
                    style={[styles.inputBox, errors.date && styles.inputError]} 
                    onPress={() => { setShowStartPicker(true); if(errors.date) setErrors({...errors, date: ""}); }}
                  >
                    <Ionicons name="calendar-outline" size={20} color="#16A34A" />
                    <View style={styles.inputWrapper}>
                      <AppText style={styles.dateText}>{formatDate(startDate)}</AppText>
                    </View>
                  </TouchableOpacity>
                  {showStartPicker && (
                    <DateTimePicker 
                      value={startDate} 
                      mode="date" 
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'} 
                      themeVariant="light"
                      accentColor="#16A34A"
                      textColor="#1F2937"
                      onChange={(event, date) => { setShowStartPicker(Platform.OS === 'ios'); if (date) setStartDate(date); }} 
                    />
                  )}
                </View>
                
                <View style={[styles.inputGroup, { flex: 1, marginBottom: 0 }]}>
                  <AppText style={styles.label}>{language === 'te' ? 'తిరిగి ఇచ్చే తేదీ' : 'End Date'}</AppText>
                  <TouchableOpacity 
                    activeOpacity={0.8} 
                    style={[styles.inputBox, errors.date && styles.inputError]} 
                    onPress={() => { setShowEndPicker(true); if(errors.date) setErrors({...errors, date: ""}); }}
                  >
                    <Ionicons name="calendar-outline" size={20} color="#16A34A" />
                    <View style={styles.inputWrapper}>
                      <AppText style={styles.dateText}>{formatDate(endDate)}</AppText>
                    </View>
                  </TouchableOpacity>
                  {showEndPicker && (
                    <DateTimePicker 
                      value={endDate} 
                      mode="date" 
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      themeVariant="light"
                      accentColor="#16A34A"
                      textColor="#1F2937" 
                      onChange={(event, date) => { setShowEndPicker(Platform.OS === 'ios'); if (date) setEndDate(date); }} 
                    />
                  )}
                </View>
              </View>
              {errors.date && <AppText style={[styles.errorText, { marginTop: 4, marginBottom: 16 }]} language={language}>{errors.date}</AppText>}
            </View>
          )}

          {/* CALCULATE BUTTON */}
          <TouchableOpacity activeOpacity={0.8} style={[styles.calculateBtn, activeTab !== 'emi' && !errors.date && { marginTop: 20 }]} onPress={handleCalculate}>
            <LinearGradient colors={["#2E7D32", "#1B5E20"]} style={styles.btnGradient}>
              <Ionicons name="calculator" size={22} color="#fff" />
              <AppText style={styles.btnText}>{language === 'te' ? 'లెక్కించు' : 'Calculate'}</AppText>
            </LinearGradient>
          </TouchableOpacity>

          {/* RESULT CARD */}
          {result && (
            <View style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <Ionicons name="receipt-outline" size={24} color="#1E40AF" />
                <AppText style={styles.resultTitle}>{language === 'te' ? 'లెక్క వివరాలు' : 'Calculation Summary'}</AppText>
              </View>
              <View style={styles.divider} />

              {result.type === 'village' && (
                <>
                  <View style={styles.resultRow}><AppText style={styles.resultLabel}>{language === 'te' ? 'గడిచిన సమయం:' : 'Time:'}</AppText><AppText style={styles.resultValueTime}>{result.months} {language === 'te' ? 'నెలలు' : 'Months'}, {result.days} {language === 'te' ? 'రోజులు' : 'Days'}</AppText></View>
                  <View style={styles.resultRow}><AppText style={styles.resultLabel}>{language === 'te' ? 'అసలు:' : 'Principal:'}</AppText><AppText style={styles.resultValue}>{formatCurrency(parseFloat(principal))}</AppText></View>
                  <View style={styles.resultRow}><AppText style={styles.resultLabel}>{language === 'te' ? 'మొత్తం వడ్డీ:' : 'Interest:'}</AppText><AppText style={[styles.resultValue, { color: '#EA580C' }]}>+ {formatCurrency(result.interest)}</AppText></View>
                </>
              )}

              {result.type === 'bank' && (
                <>
                  <View style={styles.resultRow}><AppText style={styles.resultLabel}>{language === 'te' ? 'మొత్తం రోజులు:' : 'Total Days:'}</AppText><AppText style={styles.resultValueTime}>{result.days} {language === 'te' ? 'రోజులు' : 'Days'}</AppText></View>
                  <View style={styles.resultRow}><AppText style={styles.resultLabel}>{language === 'te' ? 'అసలు:' : 'Principal:'}</AppText><AppText style={styles.resultValue}>{formatCurrency(parseFloat(principal))}</AppText></View>
                  <View style={styles.resultRow}><AppText style={styles.resultLabel}>{language === 'te' ? 'మొత్తం వడ్డీ:' : 'Interest:'}</AppText><AppText style={[styles.resultValue, { color: '#EA580C' }]}>+ {formatCurrency(result.interest)}</AppText></View>
                </>
              )}

              {result.type === 'emi' && (
                <>
                  <View style={styles.resultRow}><AppText style={styles.resultLabel}>{language === 'te' ? 'నెలవారీ కంతు (EMI):' : 'Monthly EMI:'}</AppText><AppText style={[styles.resultValue, { color: '#16A34A', fontSize: 20 }]}>{formatCurrency(result.emi)}</AppText></View>
                  <View style={styles.resultRow}><AppText style={styles.resultLabel}>{language === 'te' ? 'అసలు లోన్:' : 'Loan Amount:'}</AppText><AppText style={styles.resultValue}>{formatCurrency(parseFloat(principal))}</AppText></View>
                  <View style={styles.resultRow}><AppText style={styles.resultLabel}>{language === 'te' ? 'మొత్తం వడ్డీ:' : 'Total Interest:'}</AppText><AppText style={[styles.resultValue, { color: '#EA580C' }]}>+ {formatCurrency(result.interest)}</AppText></View>
                </>
              )}

              <View style={[styles.divider, { borderStyle: 'dashed' }]} />
              <View style={styles.resultRow}>
                <AppText style={styles.totalLabel}>{language === 'te' ? 'చెల్లించాల్సిన మొత్తం:' : 'Total Payable:'}</AppText>
                <AppText style={styles.totalValue}>{formatCurrency(result.total)}</AppText>
              </View>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F6F7F6' },
  scrollContainer: { padding: 20, paddingBottom: 60 },
  
  tabContainer: { flexDirection: 'row', backgroundColor: '#E5E7EB', borderRadius: 14, padding: 4, marginHorizontal: 20, marginTop: 10, marginBottom: 20 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, gap: 6 },
  activeTabBtn: { backgroundColor: '#1B5E20', elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 },
  tabText: { fontSize: 13, fontWeight: '600', color: '#4B5563', fontFamily: 'Mandali' },
  activeTabText: { color: '#fff' },

  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, color: '#4B5563', marginBottom: 8, fontWeight: '600', fontFamily: 'Mandali' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },

  // 🔥 STANDARD PATTERN INPUT STYLES
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 55,
    borderWidth: 1,
    borderColor: "#D1D5DB"
  },
  inputFocused: {
    borderColor: "#16A34A",
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inputError: {
    borderColor: "#EF4444",
  },
  errorText: {
    color: "#EF4444",
    fontSize: 12,
    fontFamily: "Mandali",
    marginTop: 6,
    marginLeft: 4,
  },
  inputWrapper: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center'
  },
  input: {
    flex: 1,
    fontSize: 18,
    color: "#1F2937",
    fontFamily: "Mandali",
    fontWeight: "600",
    textAlignVertical: "center",
    includeFontPadding: false,
  },
  placeholder: {
    position: "absolute",
    fontSize: 16,
    color: "#9CA3AF",
    fontFamily: "Mandali"
  },
  suffixText: { 
    fontSize: 14, 
    color: '#6B7280', 
    fontFamily: 'Mandali', 
    fontWeight: '600',
    marginLeft: 8
  },

  dateText: { fontSize: 15, color: '#1F2937', fontWeight: '600', fontFamily: 'Mandali' },

  // Calculate Button
  calculateBtn: { borderRadius: 16, overflow: 'hidden', elevation: 3, shadowColor: '#1B5E20', shadowOpacity: 0.3, shadowRadius: 8 },
  btnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 56, gap: 10 },
  btnText: { color: '#fff', fontSize: 18, fontWeight: '600', fontFamily: 'Mandali' },

  // Result Card
  resultCard: { marginTop: 30, backgroundColor: '#EFF6FF', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#BFDBFE' },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 },
  resultTitle: { fontSize: 18, fontWeight: '600', color: '#1E40AF', fontFamily: 'Mandali' },
  divider: { height: 1, backgroundColor: '#BFDBFE', marginVertical: 12 },
  
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 6 },
  resultLabel: { fontSize: 15, color: '#4B5563', fontFamily: 'Mandali' },
  resultValueTime: { fontSize: 15, color: '#1E40AF', fontWeight: '600', fontFamily: 'Mandali' },
  resultValue: { fontSize: 16, color: '#1F2937', fontWeight: '600', fontFamily: 'Mandali' },
  
  totalLabel: { fontSize: 18, color: '#1E40AF', fontWeight: '600', fontFamily: 'Mandali' },
  totalValue: { fontSize: 24, color: '#1B5E20', fontWeight: '600', fontFamily: 'Mandali' },
});