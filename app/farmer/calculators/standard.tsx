import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState, useRef } from 'react';
import {
  Dimensions,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  Vibration,
  View,
  ScrollView,
  Animated,
  BackHandler,
  Modal,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppHeader from '@/components/AppHeader';
import AppText from '@/components/AppText';

// 🔥 రెస్పాన్సివ్ లాజిక్ (స్క్రీన్ సైజుని బట్టి)
const { width, height } = Dimensions.get('window');
const IS_SMALL_SCREEN = height < 700;
// Make buttons look compact and native (max 68px)
const BUTTON_SIZE = Math.min(width * 0.175, 68); 

export default function StandardCalculator() {
  const [language, setLanguage] = useState<'te' | 'en'>('te');
  const [input, setInput] = useState('');
  const [resultPreview, setResultPreview] = useState('');
  const scrollRef = useRef<any>(null);
  const insets = useSafeAreaInsets();

  const router = useRouter();
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [isListening, setIsListening] = useState(false);

  // Custom Scrollbar States
  const [contentHeight, setContentHeight] = useState(0);
  const [scrollViewHeight, setScrollViewHeight] = useState(0);
  const scrollY = useRef(new Animated.Value(0)).current;

  const showScrollbar = contentHeight > scrollViewHeight && scrollViewHeight > 0;
  const scrollbarHeight = showScrollbar ? Math.max((scrollViewHeight / contentHeight) * scrollViewHeight, 30) : 0;
  const maxScrollY = contentHeight - scrollViewHeight;
  const maxScrollbarY = scrollViewHeight - scrollbarHeight;
  
  const scrollbarTranslateY = scrollY.interpolate({
    inputRange: [0, Math.max(1, maxScrollY)],
    outputRange: [0, maxScrollbarY],
    extrapolate: 'clamp'
  });

  // Load history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const data = await AsyncStorage.getItem('CALCULATOR_HISTORY');
        if (data) setHistoryItems(JSON.parse(data));
      } catch (e) { }
    };
    loadHistory();
  }, []);

  const handleExit = () => {
    if (input.trim() === '' || input === '0' || input === 'Error') {
      router.back();
      return;
    }
    setSaveTitle('');
    setIsListening(false);
    setShowExitPrompt(true);
  };

  useEffect(() => {
    const onBackPress = () => {
      handleExit();
      return true; // Prevent default Android exit behavior
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [input, resultPreview]);

  const saveToHistory = async () => {
    try {
      if (isListening) ExpoSpeechRecognitionModule.stop();
      setIsListening(false);
      let finalTitle = saveTitle.trim();
      
      if (!finalTitle) {
        let maxCount = 0;
        historyItems.forEach(item => {
          if (item.title && item.title.startsWith('లెక్క ')) {
            const num = parseInt(item.title.replace('లెక్క ', ''), 10);
            if (!isNaN(num) && num > maxCount) {
              maxCount = num;
            }
          }
        });
        finalTitle = `లెక్క ${maxCount + 1}`;
      }

      const newItem = {
        title: finalTitle,
        expression: input,
        result: resultPreview || input,
        timestamp: Date.now()
      };
      const updatedHistory = [newItem, ...historyItems];
      setHistoryItems(updatedHistory);
      await AsyncStorage.setItem('CALCULATOR_HISTORY', JSON.stringify(updatedHistory));
      setSaveTitle('');
    } catch (e) { }
  };

  const confirmSaveAndExit = async () => {
    await saveToHistory();
    setShowExitPrompt(false);
    if (isListening) ExpoSpeechRecognitionModule.stop();
    setIsListening(false);
    router.back();
  };

  const exitWithoutSaving = () => {
    setShowExitPrompt(false);
    if (isListening) ExpoSpeechRecognitionModule.stop();
    setIsListening(false);
    router.back();
  };
  
  const handleClosePrompt = () => {
    setShowExitPrompt(false);
    if (isListening) ExpoSpeechRecognitionModule.stop();
    setIsListening(false);
  };
  
  const clearHistory = async () => {
    await AsyncStorage.removeItem('CALCULATOR_HISTORY');
    setHistoryItems([]);
  };

  const startVoice = async () => {
    try {
      ExpoSpeechRecognitionModule.stop();
      const res = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!res.granted) return;
      
      setIsListening(true);
      
      ExpoSpeechRecognitionModule.start({
        lang: language === "te" ? "te-IN" : "en-US",
        interimResults: true,
      });
    } catch (e) {
      console.log("Voice error", e);
      setIsListening(false);
    }
  };

  useSpeechRecognitionEvent("result", (event) => {
    if (!isListening || !event.results?.length) return;
    
    const text = event.results[0].transcript;
    setSaveTitle(text);
  });

  const loadItemFromHistory = (item: any) => {
    setInput(item.expression);
    setResultPreview(item.result !== item.expression ? item.result : '');
    setShowHistory(false);
  };

  useEffect(() => {
    AsyncStorage.getItem('APP_LANG').then((saved) => {
      if (saved === 'te' || saved === 'en') setLanguage(saved);
    });
  }, []);

  useEffect(() => {
    if (input) {
      calculateResult(input, true);
    } else {
      setResultPreview('');
    }
  }, [input]);

  const handlePress = (val: string) => {
    Vibration.vibrate(20);

    if (val === 'C') {
      setInput('');
      setResultPreview('');
      return;
    }

    if (val === '⌫') {
      setInput((prev) => prev.slice(0, -1));
      return;
    }

    if (val === '=') {
      calculateResult(input, false);
      return;
    }

    const operators = ['+', '-', '×', '÷', '%'];
    const lastChar = input.slice(-1);

    if (operators.includes(val) && operators.includes(lastChar)) {
      setInput((prev) => prev.slice(0, -1) + val);
      return;
    }

    setInput((prev) => prev + val);
  };

  const calculateResult = (expression: string, isPreview: boolean) => {
    try {
      let formattedExpr = expression.replace(/×/g, '*').replace(/÷/g, '/').replace(/%/g, '/100');

      if (/[+\-*/.]$/.test(formattedExpr)) {
        formattedExpr = formattedExpr.slice(0, -1);
      }

      const evalResult = new Function('return ' + formattedExpr)();

      if (evalResult === Infinity || Number.isNaN(evalResult)) {
        if (!isPreview) setInput('Error');
        return;
      }

      const finalAns = String(Math.round(evalResult * 100000000) / 100000000);

      if (isPreview) {
        setResultPreview(finalAns);
      } else {
        setInput(finalAns);
        setResultPreview('');
      }
    } catch (error) {
      if (!isPreview) {
        setInput('Error');
      }
    }
  };

  const buttons = [
    ['C', '⌫', '%', '÷'],
    ['7', '8', '9', '×'],
    ['4', '5', '6', '-'],
    ['1', '2', '3', '+'],
    ['00', '0', '.', '=']
  ];

  const getButtonStyle = (btn: string) => {
    if (btn === '=') return styles.btnEquals;
    if (['+', '-', '×', '÷'].includes(btn)) return styles.btnOperator;
    if (['C', '⌫', '%'].includes(btn)) return styles.btnAction;
    return styles.btnNumber;
  };

  const getButtonTextStyle = (btn: string) => {
    if (btn === '=') return styles.textEquals;
    if (['+', '-', '×', '÷'].includes(btn)) return styles.textOperator;
    if (['C', '⌫', '%'].includes(btn)) return styles.textAction;
    return styles.textNumber;
  };

  // 🔥 టైప్ చేసే నెంబర్ల సంఖ్య పెరిగే కొద్దీ ఫాంట్ సైజు ఆటోమేటిక్ గా తగ్గించే లాజిక్ (Overlap రాకుండా)
  const getInputFontSize = () => {
    if (input.length > 25) return IS_SMALL_SCREEN ? 22 : 26;
    if (input.length > 15) return IS_SMALL_SCREEN ? 28 : 34;
    if (input.length > 9) return IS_SMALL_SCREEN ? 36 : 44;
    return IS_SMALL_SCREEN ? 44 : 56;
  };

  const getInputLineHeight = () => {
    if (input.length > 25) return IS_SMALL_SCREEN ? 28 : 32;
    if (input.length > 15) return IS_SMALL_SCREEN ? 34 : 40;
    if (input.length > 9) return IS_SMALL_SCREEN ? 42 : 50;
    return IS_SMALL_SCREEN ? 50 : 64;
  };

  const formatIndianNumber = (numStr: string) => {
    if (!numStr) return "";
    return numStr.replace(/\d+(?:\.\d+)?/g, (match) => {
      const parts = match.split('.');
      let integerPart = parts[0];
      const decimalPart = parts.length > 1 ? '.' + parts[1] : '';
      
      if (integerPart.length > 3) {
        const lastThree = integerPart.substring(integerPart.length - 3);
        const otherNumbers = integerPart.substring(0, integerPart.length - 3);
        integerPart = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree;
      }
      return integerPart + decimalPart;
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <AppHeader
        title={language === 'te' ? 'సాధారణ లెక్కలు' : 'Standard Calc'}
        subtitle={language === 'te' ? 'రోజువారీ కూడికలు, తీసివేతల కోసం' : 'For daily basic calculations'}
        language={language}
        onBackPress={handleExit}
        rightIcon="time-outline"
        onRightPress={() => setShowHistory(true)}
      />

      <View style={styles.container}>
        
        {/* 🔥 DISPLAY SECTION */}
        <View style={styles.displayContainer}>
          <Animated.ScrollView 
            style={{ width: '100%' }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end', paddingRight: 10 }}
            ref={scrollRef}
            onLayout={(e) => setScrollViewHeight(e.nativeEvent.layout.height)}
            onContentSizeChange={(w, h) => {
              setContentHeight(h);
              scrollRef.current?.scrollToEnd({ animated: true });
            }}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: true }
            )}
            scrollEventThrottle={16}
          >
            <AppText 
              style={[
                styles.inputText, 
                { 
                  fontSize: getInputFontSize(), 
                  lineHeight: getInputLineHeight(),
                  width: '100%'
                }
              ]} 
            >
              {formatIndianNumber(input) || '0'}
            </AppText>
          </Animated.ScrollView>

          {/* 🔥 CUSTOM SCROLLBAR (Visible ONLY when scrolling is possible) */}
          {showScrollbar && (
            <View style={{
              position: 'absolute',
              right: 24, 
              top: 40,   
              height: scrollViewHeight,
              width: 3,
              backgroundColor: '#F3F4F6',
              borderRadius: 2,
              overflow: 'hidden'
            }}>
              <Animated.View style={{
                position: 'absolute',
                top: 0,
                transform: [{ translateY: scrollbarTranslateY }],
                width: 3,
                height: scrollbarHeight,
                backgroundColor: '#9CA3AF',
                borderRadius: 2
              }} />
            </View>
          )}
          
          <AppText style={[styles.previewText, { width: '100%', textAlign: 'right' }]} numberOfLines={1}>
            {resultPreview ? `= ${formatIndianNumber(resultPreview)}` : ''}
          </AppText>
        </View>

        {/* 🔥 KEYPAD SECTION */}
        <View style={styles.keypadContainer}>
          {buttons.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.row}>
              {row.map((btn) => {
                
                const isOperator = ['+', '-', '×', '÷', '='].includes(btn);
                let iconName: any = '';
                if (btn === '+') iconName = 'plus';
                if (btn === '-') iconName = 'minus';
                if (btn === '×') iconName = 'close';
                if (btn === '÷') iconName = 'division';
                if (btn === '=') iconName = 'equal';

                return (
                  <TouchableOpacity
                    key={btn}
                    activeOpacity={0.6}
                    style={[styles.button, getButtonStyle(btn)]}
                    onPress={() => handlePress(btn)}
                  >
                    {btn === '⌫' ? (
                      <Ionicons name="backspace-outline" size={24} color="#EF4444" />
                    ) : isOperator ? (
                      <MaterialCommunityIcons 
                        name={iconName} 
                        size={26} 
                        color={btn === '=' ? '#ffffff' : '#16A34A'} 
                      />
                    ) : (
                      <AppText style={[styles.btnText, getButtonTextStyle(btn)]}>
                        {btn}
                      </AppText>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      {/* EXIT PROMPT MODAL */}
      <Modal visible={showExitPrompt} transparent animationType="fade">
        <KeyboardAvoidingView 
          style={styles.modalOverlay} 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.promptBox}>
            <View style={styles.promptIconContainer}>
              <Ionicons name="save-outline" size={28} color="#16A34A" />
            </View>
            <AppText style={styles.promptTitle}>{language === 'te' ? 'లెక్కకి పేరు పెట్టండి' : 'Name this calculation'}</AppText>
            
            <View style={styles.titleInputContainer}>
              <TextInput
                style={styles.titleInput}
                placeholder={language === 'te' ? 'ఉదా: ఎరువుల ఖర్చు' : 'e.g., Fertilizer Cost'}
                placeholderTextColor="#9CA3AF"
                value={saveTitle}
                onChangeText={setSaveTitle}
                maxLength={30}
              />
              <TouchableOpacity 
                style={styles.micBtn} 
                onPress={isListening ? () => {
                  ExpoSpeechRecognitionModule.stop();
                  setIsListening(false);
                } : startVoice}
              >
                <Ionicons name={isListening ? "mic" : "mic-outline"} size={24} color={isListening ? "#EF4444" : "#16A34A"} />
              </TouchableOpacity>
            </View>

            <View style={styles.promptBtnContainer}>
              <TouchableOpacity style={styles.promptBtnOutline} onPress={exitWithoutSaving}>
                <AppText style={styles.promptBtnOutlineText}>{language === 'te' ? 'వద్దు' : 'No, Exit'}</AppText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.promptBtnSolid} onPress={confirmSaveAndExit}>
                <AppText style={styles.promptBtnSolidText}>{language === 'te' ? 'సేవ్ చెయ్' : 'Yes, Save'}</AppText>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity style={{ marginTop: 12, padding: 8 }} onPress={handleClosePrompt}>
              <AppText style={{ color: '#EF4444', fontSize: 16, fontWeight: '600' }}>
                {language === 'te' ? 'ముగించండి' : 'Close'}
              </AppText>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* HISTORY MODAL */}
      <Modal visible={showHistory} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: '#F9FAFB', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0, paddingBottom: insets.bottom }}>
          <View style={styles.historyHeader}>
            <AppText style={styles.historyTitle}>{language === 'te' ? 'లెక్కల హిస్టరీ' : 'History'}</AppText>
            <TouchableOpacity onPress={() => setShowHistory(false)} style={styles.historyCloseBtn}>
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          {historyItems.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Ionicons name="time-outline" size={64} color="#D1D5DB" />
              <AppText style={styles.emptyHistoryText}>
                {language === 'te' ? 'ఇంకా ఎలాంటి హిస్టరీ లేదు' : 'No history yet'}
              </AppText>
            </View>
          ) : (
            <FlatList 
              data={historyItems}
              keyExtractor={(item, index) => index.toString()}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.historyCard}
                  onPress={() => loadItemFromHistory(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.historyCardHeader}>
                    <AppText style={styles.historyCardTitle} numberOfLines={1}>{item.title}</AppText>
                    <AppText style={styles.historyDate}>
                      {new Date(item.timestamp).toLocaleString(language === 'te' ? 'te-IN' : 'en-IN', { hour: 'numeric', minute: 'numeric', day: 'numeric', month: 'short' })}
                    </AppText>
                  </View>
                  <AppText style={styles.historyExpression} numberOfLines={2}>
                    {formatIndianNumber(item.expression)}
                  </AppText>
                  <AppText style={styles.historyResult}>
                    = {formatIndianNumber(item.result)}
                  </AppText>
                </TouchableOpacity>
              )}
            />
          )}

          {historyItems.length > 0 && (
            <TouchableOpacity style={styles.clearHistoryBtn} onPress={clearHistory}>
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
              <AppText style={styles.clearHistoryText}>{language === 'te' ? 'మొత్తం డిలీట్ చేయండి' : 'Clear History'}</AppText>
            </TouchableOpacity>
          )}
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { 
    flex: 1, 
    backgroundColor: '#FFFFFF' 
  },
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  
  // DISPLAY
  displayContainer: {
    paddingHorizontal: 24,
    paddingTop: 40, // Header gap guarantee
    paddingBottom: IS_SMALL_SCREEN ? 10 : 20,
    justifyContent: 'flex-end',
    flex: 1, 
  },
  inputText: {
    fontWeight: '400',
    color: '#111827',
    textAlign: 'right',
    fontFamily: 'Mandali',
    includeFontPadding: false,
  },
  previewText: {
    fontSize: IS_SMALL_SCREEN ? 24 : 28,
    fontWeight: '400',
    color: '#6B7280',
    marginTop: 8,
    minHeight: IS_SMALL_SCREEN ? 28 : 34,
    fontFamily: 'Mandali',
    includeFontPadding: false,
  },

  // KEYPAD
  keypadContainer: {
    paddingHorizontal: 24,
    paddingBottom: IS_SMALL_SCREEN ? 25 : 40,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: IS_SMALL_SCREEN ? 14 : 16,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnText: {
    fontFamily: 'Mandali',
    textAlign: 'center',
    includeFontPadding: false,
  },

  // FLAT COLORS & FONTS
  btnNumber: {
    backgroundColor: '#F9FAFB',
  },
  textNumber: {
    color: '#111827',
    fontSize: 26,
    fontWeight: '400',
  },

  btnOperator: {
    backgroundColor: '#E8F5E9',
  },
  btnAction: {
    backgroundColor: '#F3F4F6',
  },
  textAction: {
    color: '#EF4444', // Red for C and backspace
    fontSize: 24,
    fontWeight: '400',
  },

  btnEquals: {
    backgroundColor: '#16A34A',
  },
  textOperator: {
    color: '#16A34A', 
    fontSize: 28,
    fontWeight: '400',
    textAlignVertical: 'center',
  },
  textEquals: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '500',
  },

  // MODAL STYLES
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  promptBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    alignItems: 'center',
  },
  promptIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  promptTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  promptDesc: {
    fontSize: 16,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 28,
    includeFontPadding: false,
  },
  promptBtnContainer: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    gap: 12,
  },
  promptBtnOutline: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  promptBtnSolid: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#16A34A',
    alignItems: 'center',
  },
  promptBtnOutlineText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  promptBtnSolidText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
  // HISTORY STYLES
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  historyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  historyCloseBtn: {
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  emptyHistory: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyHistoryText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 12,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  historyDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  historyExpression: {
    fontSize: 18,
    color: '#374151',
    marginBottom: 4,
  },
  historyResult: {
    fontSize: 24,
    fontWeight: '600',
    color: '#16A34A',
    textAlign: 'right',
  },
  clearHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: '#FEF2F2',
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    gap: 8,
  },
  clearHistoryText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '500',
  },
  
  // TITLE INPUT STYLES
  titleInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  titleInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#111827',
    fontFamily: 'Mandali',
    marginTop: 4, // slight adjustment for custom font baseline
  },
  micBtn: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // HISTORY CARD ENHANCEMENTS
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyCardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginRight: 8,
  },
});