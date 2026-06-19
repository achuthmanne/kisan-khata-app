import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  Vibration,
  View
} from 'react-native';

import AppHeader from '@/components/AppHeader';
import AppText from '@/components/AppText';

// 🔥 రెస్పాన్సివ్ లాజిక్ (స్క్రీన్ సైజుని బట్టి)
const { width, height } = Dimensions.get('window');
const IS_SMALL_SCREEN = height < 700; // చిన్న ఫోన్లకి
const BUTTON_SIZE = (width - (IS_SMALL_SCREEN ? 90 : 80)) / 4; 

export default function StandardCalculator() {
  const [language, setLanguage] = useState<'te' | 'en'>('te');
  const [input, setInput] = useState('');
  const [resultPreview, setResultPreview] = useState('');

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
      <StatusBar barStyle="dark-content" backgroundColor="#F6F7F6" />
      
      <AppHeader
        title={language === 'te' ? 'సాధారణ లెక్కలు' : 'Standard Calc'}
        language={language}
      />

      <View style={styles.container}>
        
        {/* 🔥 DISPLAY SECTION */}
        <View style={styles.displayContainer}>
          <AppText 
            style={[
              styles.inputText, 
              { 
                fontSize: getInputFontSize(), 
                lineHeight: getInputLineHeight() // 'మండలి' ఫాంట్ కి లైన్ గ్యాప్ పర్ఫెక్ట్ గా ఉండటానికి
              }
            ]} 
            numberOfLines={3} // 3 లైన్ల కన్నా మించకుండా లాక్
            adjustsFontSizeToFit // ఆండ్రాయిడ్/ఐఓఎస్ లో ఆటో స్కేల్ కోసం
          >
            {formatIndianNumber(input) || '0'}
          </AppText>
          
          <AppText style={styles.previewText} numberOfLines={1}>
            {resultPreview ? `= ${formatIndianNumber(resultPreview)}` : ''}
          </AppText>
        </View>

        <View style={styles.divider} />

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
                      <Ionicons name="backspace-outline" size={IS_SMALL_SCREEN ? 28 : 32} color="#374151" />
                    ) : isOperator ? (
                      <MaterialCommunityIcons 
                        name={iconName} 
                        size={IS_SMALL_SCREEN ? 26 : 30} 
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { 
    flex: 1, 
    backgroundColor: '#F6F7F6' 
  },
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  
  // DISPLAY
  displayContainer: {
    paddingHorizontal: 24,
    paddingVertical: IS_SMALL_SCREEN ? 10 : 20,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    flex: 1, // 🔥 హెడర్ మీదకి వెళ్లకుండా ఇదే కంట్రోల్ చేస్తుంది
    overflow: 'hidden', // మరీ ఎక్కువైతే కట్ చేస్తుంది కానీ హెడర్ ని తగలదు
  },
  inputText: {
    fontWeight: '300',
    color: '#111827',
    textAlign: 'right',
    fontFamily: 'Mandali',
    includeFontPadding: false,
  },
  previewText: {
    fontSize: IS_SMALL_SCREEN ? 22 : 28,
    fontWeight: '400',
    color: '#9CA3AF',
    marginTop: 8,
    minHeight: IS_SMALL_SCREEN ? 28 : 34,
    fontFamily: 'Mandali',
    includeFontPadding: false,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 24,
    marginBottom: IS_SMALL_SCREEN ? 16 : 24,
  },

  // KEYPAD
  keypadContainer: {
    paddingHorizontal: IS_SMALL_SCREEN ? 16 : 22,
    paddingBottom: IS_SMALL_SCREEN ? 20 : 35,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: IS_SMALL_SCREEN ? 12 : 16,
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
    backgroundColor: '#F3F4F6',
  },
  textNumber: {
    color: '#111827',
    fontSize: IS_SMALL_SCREEN ? 28 : 34,
    fontWeight: '400',
  },

  btnOperator: {
    backgroundColor: '#DCFCE7',
  },
  btnAction: {
    backgroundColor: '#E5E7EB',
  },
  textAction: {
    color: '#374151',
    fontSize: IS_SMALL_SCREEN ? 24 : 30,
    fontWeight: '500',
  },

  btnEquals: {
    backgroundColor: '#16A34A',
  },
  textOperator: {
    color: '#16A34A', 
    fontSize: IS_SMALL_SCREEN ? 32 : 38,
    fontWeight: '500',
    textAlignVertical: 'center',
  },
  textEquals: {
    color: '#ffffff',
    fontSize: IS_SMALL_SCREEN ? 34 : 40,
    fontWeight: '500',
    textAlignVertical: 'center',
  },
});