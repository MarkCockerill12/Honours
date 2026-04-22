import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, Switch, ScrollView,
  Dimensions, Animated, StatusBar, Modal, TouchableWithoutFeedback,
  Easing, Linking, Alert, Platform
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ShieldIcon, GlobeIcon, LockIcon, InfoIcon, PaletteIcon,
  ChevronDownIcon, ExternalLinkIcon, ZapIcon, CopyIcon, CheckIcon,
  ChevronRightIcon, ChevronLeftIcon, WifiIcon
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as SecureStore from 'expo-secure-store';
import * as Clipboard from 'expo-clipboard';
import { WorldMap } from './components/WorldMap';
import { VPN_SERVERS, ServerLocation } from '@privacy-shield/core/src/shared';
import VpnPermission, { VpnEventEmitter } from './modules/vpn-permission';
import {
  connectVpn, disconnectVpn, setStatusCallback,
  getVpnStatus,
  type VpnStage, type VpnStatusUpdate
} from './services/vpnService';
const { height } = Dimensions.get('window');

type Theme = 'dark' | 'light' | 'vaporwave' | 'frutiger-aero';

const THEMES: Record<Theme, any> = {
  dark: { bg: '#0f172a', secondary: '#1e293b', accent: '#2dd4bf', text: '#f8fafc', dot: '#334155' },
  light: { bg: '#f8fafc', secondary: '#f1f5f9', accent: '#3b82f6', text: '#0f172a', dot: '#e2e8f0' },
  vaporwave: { bg: '#0a0015', secondary: '#1a0030', accent: '#ff6ac1', text: '#ff71ce', dot: '#3d0066' },
  'frutiger-aero': { bg: '#f0f9ff', secondary: '#ffffff', accent: '#0ea5e9', text: '#1e3a5f', dot: '#bae6fd' },
};

const THEME_GRADIENTS: Record<Theme, string[]> = {
  dark: ['#0f172a', '#020617'],
  light: ['#f8fafc', '#f1f5f9'],
  vaporwave: ['#0a0015', '#1a0030'],
  'frutiger-aero': ['#f0f9ff', '#e0f2fe'],
};

const TUTORIAL_STEPS = [
  {
    title: 'WELCOME',
    body: 'Welcome to Privacy Sentinel. This app keeps your phone safe by encrypting your internet connection and blocking ads and trackers.',
  },
  {
    title: 'USING THE VPN',
    body: 'Tap the shield button in the centre to turn on protection. Your internet traffic will be encrypted through a secure WireGuard tunnel.\n\nTap the server name (e.g. "US") to choose a different location from 5 global servers.',
  },
  {
    title: 'DNS AD BLOCKING',
    body: 'Tap "CONFIG" next to Adblock Protocol to set up DNS protection. This blocks ads and trackers across your entire phone — not just this app.\n\nYou will be shown the DNS addresses to enter in your phone\'s settings.',
  },
  {
    title: 'PERSONALISE',
    body: 'Tap the palette icon in the top-right to change your visual theme. Choose from Dark, Light, Vaporwave, or Frutiger Aero.\n\nTap the info icon anytime to see this guide again.',
  },
];

function PrivacySentinelApp() {
  const insets = useSafeAreaInsets();
  const [theme, setTheme] = useState<Theme>('dark');
  const ct = THEMES[theme];

  const [protection, setProtection] = useState({ isActive: false, vpnEnabled: true, adblockEnabled: true });
  const [vpnStatus, setVpnStatus] = useState('READY');
  const [vpnMessage, setVpnMessage] = useState('');
  const [selectedServer, setSelectedServer] = useState<ServerLocation>(VPN_SERVERS[0]);
  const [showServerPicker, setShowServerPicker] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [showDnsConfig, setShowDnsConfig] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [shouldFlashTutorial, setShouldFlashTutorial] = useState(false);
  const [pings, setPings] = useState<Record<string, number>>({});

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotation = useRef(new Animated.Value(0)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);
  const rotationLoop = useRef<Animated.CompositeAnimation | null>(null);
  const LIGHTNING_COUNT = 12;
  const [showLightning, setShowLightning] = useState(false);
  const lightningAnims = useRef(Array.from({ length: LIGHTNING_COUNT }, () => ({
    translateX: new Animated.Value(0),
    translateY: new Animated.Value(0),
    opacity: new Animated.Value(0),
    scale: new Animated.Value(0),
  }))).current;

  const triggerLightningBurst = () => {
    lightningAnims.forEach(a => {
      a.translateX.setValue(0); a.translateY.setValue(0);
      a.opacity.setValue(0); a.scale.setValue(0);
    });
    setShowLightning(true);
    const RADIUS = 90; // extends well beyond the button
    const animations = lightningAnims.map((a, i) => {
      const angleRad = ((360 / LIGHTNING_COUNT) * i * Math.PI) / 180;
      const dx = Math.sin(angleRad) * RADIUS;
      const dy = -Math.cos(angleRad) * RADIUS;
      const delay = (i * 20) + Math.random() * 40;
      return Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(a.translateX, { toValue: dx, duration: 500, easing: Easing.out(Easing.exp), useNativeDriver: true }),
          Animated.timing(a.translateY, { toValue: dy, duration: 500, easing: Easing.out(Easing.exp), useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(a.opacity, { toValue: 1, duration: 80, useNativeDriver: true }),
            Animated.timing(a.opacity, { toValue: 0, duration: 420, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(a.scale, { toValue: 1.2, duration: 120, useNativeDriver: true }),
            Animated.timing(a.scale, { toValue: 0, duration: 380, useNativeDriver: true }),
          ]),
        ]),
      ]);
    });
    Animated.parallel(animations).start(() => setShowLightning(false));
  };

  useEffect(() => {
    SecureStore.getItemAsync('has_seen_tutorial').then(seen => {
      if (!seen) {
        setShouldFlashTutorial(true);
        setTimeout(() => setShouldFlashTutorial(false), 5000);
      }
    });
    SecureStore.getItemAsync('app_theme').then(saved => {
      if (saved && Object.keys(THEMES).includes(saved)) setTheme(saved as Theme);
    });

    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    );
    pulseLoop.current.start();

    rotationLoop.current = Animated.loop(
      Animated.timing(rotation, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true })
    );
    rotationLoop.current.start();

    console.log('[VPN] VpnPermission module status:', VpnPermission ? 'Loaded' : 'MISSING');

    // Listen for native disconnect (from notification bar)
    const subscription = VpnEventEmitter.addListener('onNativeDisconnect', () => {
      console.log('[VPN] Received native disconnect event');
      setProtection(prev => ({ ...prev, isActive: false }));
      setVpnStatus('READY');
      setVpnMessage('Disconnected via notification');
    });

    // Check actual VPN status on launch
    const checkInitialState = async () => {
      const savedServerId = await SecureStore.getItemAsync('selected_server_id');
      if (savedServerId) {
        const s = VPN_SERVERS.find(v => v.id === savedServerId);
        if (s) setSelectedServer(s);
      }

      const status = await getVpnStatus();
      if (status === 'connected' || status === 'up') {
        setProtection(prev => ({ ...prev, isActive: true }));
        setVpnStatus('SECURE');
      }
    };
    checkInitialState();

    refreshPings();

    setStatusCallback((update: VpnStatusUpdate) => {
      setVpnMessage(update.message);
      if (update.stage === 'CONNECTED') setVpnStatus('SECURE');
      else if (update.stage === 'ERROR') { setVpnStatus('ERROR'); Alert.alert('VPN Error', update.message); }
      else if (update.stage === 'IDLE') setVpnStatus('READY');
      else setVpnStatus('LOADING');
    });

    return () => {
      pulseLoop.current?.stop();
      rotationLoop.current?.stop();
      subscription.remove();
    };
  }, []);

  const refreshPings = async () => {
    const regionMap: Record<string, string> = {
      us: "us-east-1", uk: "eu-west-2", de: "eu-central-1", jp: "ap-northeast-1", au: "ap-southeast-2"
    };
    const p: Record<string, number> = {};
    await Promise.all(VPN_SERVERS.map(async (s) => {
      const start = Date.now();
      try {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 3000);
        await fetch(`https://dynamodb.${regionMap[s.id]}.amazonaws.com`, { method: "HEAD", mode: "no-cors", signal: controller.signal });
        clearTimeout(tid);
        p[s.id] = Date.now() - start;
      } catch {
        p[s.id] = 999;
      }
    }));
    setPings(p);
  };

  const toggleProtection = useCallback(async () => {
    if (protection.isActive) {
      setIsStarting(true);
      await disconnectVpn();
      setProtection(prev => ({ ...prev, isActive: false }));
      setVpnStatus('READY');
      setVpnMessage('');
      setIsStarting(false);
      return;
    }

    triggerLightningBurst();
    setIsStarting(true);
    setVpnStatus('LOADING');
    const success = await connectVpn(selectedServer.id, protection.adblockEnabled);
    if (success) {
      setProtection(prev => ({ ...prev, isActive: true }));
      setVpnStatus('SECURE');
    } else {
      setVpnStatus('READY');
    }
    setIsStarting(false);
  }, [protection.isActive, protection.adblockEnabled, selectedServer]);

  const toggleVpn = () => setProtection(prev => ({ ...prev, vpnEnabled: !prev.vpnEnabled }));

  const cycleTheme = () => {
    const themes: Theme[] = ['dark', 'light', 'vaporwave', 'frutiger-aero'];
    const next = themes[(themes.indexOf(theme) + 1) % themes.length];
    setTheme(next);
    SecureStore.setItemAsync('app_theme', next);
  };

  const selectServer = useCallback(async (s: ServerLocation) => {
    setSelectedServer(s);
    SecureStore.setItemAsync('selected_server_id', s.id);
    setShowServerPicker(false);
    if (protection.isActive) {
      setIsStarting(true);
      setVpnStatus('LOADING');
      await disconnectVpn();
      const success = await connectVpn(s.id, protection.adblockEnabled);
      if (success) setVpnStatus('SECURE');
      else setVpnStatus('READY');
      setIsStarting(false);
    }
  }, [protection.isActive, protection.adblockEnabled]);

  const copyToClipboard = async (text: string, field: string) => {
    await Clipboard.setStringAsync(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const openAndroidDnsSettings = () => {
    if (Platform.OS === 'android') {
      Linking.openSettings().catch(() => {
        Linking.openURL('app-settings:').catch(() => {
          Alert.alert('Settings', 'Please open Settings > Network & Internet > Private DNS manually.');
        });
      });
    }
  };

  const closeTutorial = () => {
    SecureStore.setItemAsync('has_seen_tutorial', 'true');
    setShowTutorial(false);
    setTutorialStep(0);
  };

  const rotate = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={[styles.container, { backgroundColor: ct.bg }]}>
      <StatusBar translucent backgroundColor="transparent" barStyle={theme === 'light' || theme === 'frutiger-aero' ? 'dark-content' : 'light-content'} />
      <LinearGradient colors={THEME_GRADIENTS[theme]} style={StyleSheet.absoluteFill} />

      <View style={{ flex: 1, paddingTop: insets.top }}>
        {/* Background map - centered on screen */}
        <View style={[styles.mapBackground, { opacity: (theme === 'light' || theme === 'frutiger-aero') ? 0.35 : 0.25 }]}>
          <WorldMap servers={VPN_SERVERS} selectedServer={selectedServer} isConnected={protection.vpnEnabled && protection.isActive} theme={theme} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.brandGroup}>
            <Text style={[styles.brandText, { color: ct.text }]}>PRIVACY SENTINEL</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => { setTutorialStep(0); setShowTutorial(true); }}
              style={[
                styles.circleBtn,
                { backgroundColor: ct.secondary },
                shouldFlashTutorial && { backgroundColor: ct.accent, opacity: 0.8 }
              ]}
            >
              <Animated.View style={shouldFlashTutorial ? { opacity: pulseAnim } : {}}>
                <InfoIcon size={18} color={shouldFlashTutorial ? (theme === 'light' ? '#fff' : '#000') : ct.accent} />
              </Animated.View>
            </TouchableOpacity>
            <TouchableOpacity onPress={cycleTheme} style={[styles.circleBtn, { backgroundColor: ct.secondary }]}>
              <PaletteIcon size={18} color={ct.accent} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Scrollable content */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Hero - power button area */}
          <View style={styles.hero}>
            <View style={styles.orbCenter}>
              {(protection.isActive || vpnStatus === 'LOADING') && (
                <>
                  {vpnStatus === 'LOADING' && (
                    <Animated.View style={[styles.radarSweep, { borderColor: ct.accent, transform: [{ rotate }] }]} />
                  )}
                  <Animated.View style={[styles.glowRing, { borderColor: ct.accent, transform: [{ scale: pulseAnim }], opacity: protection.isActive ? 0.4 : 0.2 }]} />
                </>
              )}
              <TouchableOpacity activeOpacity={0.9} onPress={toggleProtection} disabled={isStarting} 
                style={[styles.orb, { 
                  borderColor: protection.isActive ? ct.accent : '#334155', 
                  opacity: isStarting ? 0.7 : 1,
                  backgroundColor: protection.isActive ? ct.accent + '10' : 'transparent'
                }]}>
                <View style={[styles.orbInner, { backgroundColor: protection.isActive ? ct.accent : 'transparent' }]}>
                  <ShieldIcon size={40} color={protection.isActive ? (theme === 'light' ? '#fff' : '#000') : ct.accent} />
                </View>
              </TouchableOpacity>
              {showLightning && lightningAnims.map((a, i) => {
                const isVaporwave = theme === 'vaporwave';
                const isDarkTheme = theme === 'dark' || theme === 'vaporwave';
                const color = i % 2 === 0
                  ? (isVaporwave ? '#ff71ce' : isDarkTheme ? '#81ecff' : '#3b82f6')
                  : (isVaporwave ? '#b967ff' : isDarkTheme ? '#a5f3fc' : '#60a5fa');
                const orbSize = 8 + (i % 3) * 3;
                return (
                  <Animated.View
                    key={i}
                    style={{
                      position: 'absolute',
                      width: orbSize,
                      height: orbSize,
                      borderRadius: orbSize / 2,
                      backgroundColor: color,
                      opacity: a.opacity,
                      shadowColor: color,
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 1,
                      shadowRadius: orbSize * 1.5,
                      elevation: 10,
                      transform: [
                        { translateX: a.translateX },
                        { translateY: a.translateY },
                        { scale: a.scale },
                      ],
                    }}
                  />
                );
              })}
            </View>
            {vpnStatus === 'LOADING' ? (
              <Text style={[styles.orbStatus, styles.orbStatusLoading, { color: ct.accent }]} numberOfLines={2}>
                {vpnMessage || 'Connecting...'}
              </Text>
            ) : (
              <Text style={[styles.orbStatus, { color: ct.accent }]}>
                {protection.isActive ? 'PROTECTION SECURE' : 'SHIELD INACTIVE'}
              </Text>
            )}
          </View>

          {/* Analytics */}
          <View style={styles.analytics}>
            <View style={[styles.statCard, { backgroundColor: ct.secondary, borderColor: ct.accent + '15' }]}>
              <GlobeIcon size={16} color={ct.accent} style={{ marginBottom: 6, opacity: 0.6 }} />
              <Text style={[styles.statVal, { color: ct.accent }]}>{pings[selectedServer.id] || 0} ms</Text>
              <Text style={styles.statKey}>LATENCY</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: ct.secondary, borderColor: ct.accent + '15' }]}>
              <ShieldIcon size={16} color={vpnStatus === 'LOADING' ? '#eab308' : ct.accent} style={{ marginBottom: 6, opacity: 0.6 }} />
              <Text adjustsFontSizeToFit numberOfLines={1} minimumFontScale={0.5}
                style={[styles.statVal, { color: vpnStatus === 'LOADING' ? '#eab308' : ct.accent, textAlign: 'center', width: '100%' }]}>
                {vpnStatus === 'LOADING' ? 'LOADING...' : vpnStatus}
              </Text>
              <Text style={styles.statKey}>STATUS</Text>
            </View>
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            <View style={[styles.controlRow, { backgroundColor: ct.secondary }]}>
              <View style={styles.controlInfo}>
                <GlobeIcon size={20} color={ct.accent} />
                <Text style={[styles.controlLabel, { color: ct.text }]}>VPN Encryption</Text>
              </View>
              <View style={styles.controlActions}>
                <TouchableOpacity style={styles.nodePicker} onPress={() => setShowServerPicker(true)}>
                  <Text style={[styles.nodePickerText, { color: ct.accent }]}>{selectedServer.id.toUpperCase()}</Text>
                  <ChevronDownIcon size={12} color={ct.accent} style={{ marginLeft: 4 }} />
                </TouchableOpacity>
                <Switch value={protection.vpnEnabled} onValueChange={toggleVpn} trackColor={{ false: '#334155', true: ct.accent }} thumbColor="#fff" />
              </View>
            </View>
            <TouchableOpacity style={[styles.controlRow, { backgroundColor: ct.secondary }]} onPress={() => setShowDnsConfig(true)}>
              <View style={styles.controlInfo}>
                <LockIcon size={20} color={ct.accent} />
                <Text style={[styles.controlLabel, { color: ct.text }]}>Adblock Protocol</Text>
              </View>
              <View style={styles.actionBtn}>
                <Text style={[styles.actionBtnText, { color: ct.accent }]}>CONFIG</Text>
                <ExternalLinkIcon size={14} color={ct.accent} />
              </View>
            </TouchableOpacity>
          </View>

        </ScrollView>

        {/* Server Picker Modal */}
        <Modal visible={showServerPicker} transparent animationType="slide">
          <TouchableWithoutFeedback onPress={() => setShowServerPicker(false)}>
            <View style={styles.modalBackdrop}>
              <TouchableWithoutFeedback>
                <View style={[styles.modalBody, { backgroundColor: ct.bg }]}>
                  <Text style={[styles.modalTitle, { color: ct.text }]}>SELECT TERMINAL</Text>
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {VPN_SERVERS.map((s: ServerLocation) => (
                      <TouchableOpacity key={s.id} style={styles.serverRow} onPress={() => selectServer(s)}>
                        <Text style={{ fontSize: 22, marginRight: 15 }}>{s.flag}</Text>
                        <Text style={[styles.serverRowName, { color: ct.text }]}>{s.name.toUpperCase()}</Text>
                        <View style={{ flex: 1 }} />
                        <Text style={[styles.serverRowPing, { color: ct.accent }]}>{pings[s.id] || '--'} ms</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <TouchableOpacity style={[styles.modalClose, { backgroundColor: ct.accent }]} onPress={() => setShowServerPicker(false)}>
                    <Text style={styles.modalCloseText}>CANCEL</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* DNS Config Modal */}
        <Modal visible={showDnsConfig} transparent animationType="slide">
          <TouchableWithoutFeedback onPress={() => setShowDnsConfig(false)}>
            <View style={styles.modalBackdrop}>
              <TouchableWithoutFeedback>
                <View style={[styles.modalBody, { backgroundColor: ct.bg, height: height * 0.85, paddingBottom: 20 }]}>
                  <ScrollView 
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 60 }}
                  >
                    <Text style={[styles.modalTitle, { color: ct.text }]}>DNS-LEVEL AD BLOCKING</Text>
                    <Text style={[styles.dnsDesc, { color: ct.text }]}>
                      DNS ad blocking works across your entire device — not just this app. It blocks ads, trackers, and malicious domains at the network level.
                    </Text>

                    <Text style={[styles.dnsSectionTitle, { color: ct.accent }]}>PRIVATE DNS (ANDROID 9+)</Text>
                    <Text style={[styles.dnsInstructions, { color: ct.text }]}>
                      This is the easiest method. It encrypts your DNS queries automatically.
                    </Text>
                    <View style={[styles.dnsRow, { backgroundColor: ct.secondary }]}>
                      <View>
                        <Text style={[styles.dnsLabel, { color: ct.accent }]}>HOSTNAME</Text>
                        <Text style={[styles.dnsValue, { color: ct.text }]}>dns.adguard.com</Text>
                      </View>
                      <TouchableOpacity onPress={() => copyToClipboard('dns.adguard.com', 'hostname')}>
                        {copiedField === 'hostname' ? <CheckIcon size={18} color="#22c55e" /> : <CopyIcon size={18} color={ct.accent} />}
                      </TouchableOpacity>
                    </View>

                    <View style={[styles.dnsSteps, { backgroundColor: ct.secondary }]}>
                      <Text style={[styles.dnsStepTitle, { color: ct.accent }]}>SETUP STEPS</Text>
                      {[
                        'Open your phone Settings',
                        'Go to Network & Internet (or Connections)',
                        'Tap "Private DNS" (or "More connection settings > Private DNS")',
                        'Select "Private DNS provider hostname"',
                        'Type: dns.adguard.com',
                        'Tap Save',
                      ].map((step, i) => (
                        <Text key={i} style={[styles.dnsStep, { color: ct.text }]}>{i + 1}. {step}</Text>
                      ))}
                    </View>

                    <Text style={[styles.dnsSectionTitle, { color: ct.accent, marginTop: 20 }]}>MANUAL DNS (WIFI ONLY)</Text>
                    <View style={[styles.dnsRow, { backgroundColor: ct.secondary }]}>
                      <View>
                        <Text style={[styles.dnsLabel, { color: ct.accent }]}>PRIMARY</Text>
                        <Text style={[styles.dnsValue, { color: ct.text }]}>94.140.14.14</Text>
                      </View>
                      <TouchableOpacity onPress={() => copyToClipboard('94.140.14.14', 'primary')}>
                        {copiedField === 'primary' ? <CheckIcon size={18} color="#22c55e" /> : <CopyIcon size={18} color={ct.accent} />}
                      </TouchableOpacity>
                    </View>
                    <View style={[styles.dnsRow, { backgroundColor: ct.secondary, marginTop: 8 }]}>
                      <View>
                        <Text style={[styles.dnsLabel, { color: ct.accent }]}>SECONDARY</Text>
                        <Text style={[styles.dnsValue, { color: ct.text }]}>94.140.15.15</Text>
                      </View>
                      <TouchableOpacity onPress={() => copyToClipboard('94.140.15.15', 'secondary')}>
                        {copiedField === 'secondary' ? <CheckIcon size={18} color="#22c55e" /> : <CopyIcon size={18} color={ct.accent} />}
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={[styles.dnsOpenBtn, { backgroundColor: ct.accent }]} onPress={openAndroidDnsSettings}>
                      <WifiIcon size={18} color="#000" />
                      <Text style={styles.dnsOpenBtnText}>OPEN DEVICE SETTINGS</Text>
                    </TouchableOpacity>
                  </ScrollView>
                  <TouchableOpacity style={[styles.modalClose, { backgroundColor: ct.accent }]} onPress={() => setShowDnsConfig(false)}>
                    <Text style={styles.modalCloseText}>DONE</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* Tutorial Modal (Multi-Step) */}
        <Modal visible={showTutorial} transparent animationType="fade">
          <View style={styles.tutOverlay}>
            <View style={[styles.tutCard, { backgroundColor: ct.bg }]}>
              <ZapIcon size={50} color={ct.accent} />
              <Text style={[styles.tutTitle, { color: ct.text }]}>{TUTORIAL_STEPS[tutorialStep].title}</Text>
              <Text style={[styles.tutText, { fontSize: 15, lineHeight: 24 }]}>{TUTORIAL_STEPS[tutorialStep].body}</Text>

              <View style={styles.tutDots}>
                {TUTORIAL_STEPS.map((_, i) => (
                  <View key={i} style={[styles.tutDot, { backgroundColor: i === tutorialStep ? ct.accent : ct.dot }]} />
                ))}
              </View>

              <View style={styles.tutNav}>
                {tutorialStep > 0 && (
                  <TouchableOpacity style={[styles.tutNavBtn, { borderColor: ct.accent }]} onPress={() => setTutorialStep(s => s - 1)}>
                    <ChevronLeftIcon size={16} color={ct.accent} />
                    <Text style={[styles.tutNavBtnText, { color: ct.accent }]}>BACK</Text>
                  </TouchableOpacity>
                )}
                <View style={{ flex: 1 }} />
                {tutorialStep < TUTORIAL_STEPS.length - 1 ? (
                  <TouchableOpacity style={[styles.tutBtn, { backgroundColor: ct.accent, flex: 0, paddingHorizontal: 30 }]} onPress={() => setTutorialStep(s => s + 1)}>
                    <Text style={styles.tutBtnText}>NEXT</Text>
                    <ChevronRightIcon size={16} color="#000" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={[styles.tutBtn, { backgroundColor: ct.accent, flex: 0, paddingHorizontal: 30 }]} onPress={closeTutorial}>
                    <Text style={styles.tutBtnText}>GET STARTED</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity style={{ marginTop: 10 }} onPress={() => { setShowTutorial(false); setTutorialStep(0); }}>
                <Text style={{ color: ct.text, opacity: 0.4, fontWeight: '900', letterSpacing: 2, fontSize: 11 }}>SKIP</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <PrivacySentinelApp />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 12 },
  brandGroup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  brandText: { fontSize: 18, fontWeight: '900', letterSpacing: -1 },
  headerActions: { flexDirection: 'row', gap: 8 },
  circleBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  mapBackground: { position: 'absolute', top: '20%', left: 0, right: 0, alignItems: 'center', justifyContent: 'center', zIndex: 0 },
  scrollContent: { paddingBottom: 32 },
  hero: { alignItems: 'center', paddingTop: height * 0.06, paddingBottom: 20 },
  orbCenter: { width: 240, height: 240, alignItems: 'center', justifyContent: 'center' },
  orb: { width: 130, height: 130, borderRadius: 65, borderWidth: 1, padding: 6, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  orbInner: { width: '100%', height: '100%', borderRadius: 60, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  radarSweep: { position: 'absolute', width: '100%', height: '100%', borderRadius: 120, borderTopWidth: 2 },
  glowRing: { position: 'absolute', width: '100%', height: '100%', borderRadius: 120, borderWidth: 1, opacity: 0.2 },
  orbStatus: { marginTop: 16, fontSize: 10, fontWeight: '900', letterSpacing: 4, textAlign: 'center' },
  orbStatusLoading: { fontSize: 12, letterSpacing: 1, paddingHorizontal: 24, lineHeight: 20 },
  analytics: { flexDirection: 'row', gap: 10, paddingHorizontal: 24, marginBottom: 12 },
  statCard: { flex: 1, padding: 16, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  statVal: { fontSize: 22, fontWeight: '900' },
  statKey: { color: '#64748b', fontSize: 8, fontWeight: '900', letterSpacing: 2, marginTop: 4 },
  controls: { paddingHorizontal: 24, gap: 10, marginBottom: 12 },
  controlRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  controlInfo: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  controlLabel: { fontSize: 14, fontWeight: '700' },
  controlActions: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  nodePicker: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', flexDirection: 'row', alignItems: 'center' },
  nodePickerText: { fontSize: 10, fontWeight: '900' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionBtnText: { fontSize: 10, fontWeight: '900' },
  serverList: { paddingHorizontal: 24, gap: 8 },
  serverListTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 3, marginBottom: 8, opacity: 0.5 },
  serverCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  serverCardName: { fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  serverCardRegion: { fontSize: 10, fontWeight: '600', letterSpacing: 1, marginTop: 2 },
  serverCardPing: { fontSize: 12, fontWeight: '800', marginRight: 8 },
  serverActiveIndicator: { width: 8, height: 8, borderRadius: 4 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalBody: { padding: 32, borderTopLeftRadius: 40, borderTopRightRadius: 40, height: height * 0.85, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  modalTitle: { fontSize: 14, fontWeight: '900', letterSpacing: 2, marginBottom: 20 },
  serverRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 22, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.05)' },
  serverRowName: { fontSize: 15, fontWeight: '700', letterSpacing: 1 },
  serverRowPing: { fontSize: 12, fontWeight: '800' },
  modalClose: { marginTop: 20, paddingVertical: 20, alignItems: 'center', borderRadius: 20 },
  modalCloseText: { color: '#000', fontWeight: '900', fontSize: 14, letterSpacing: 2 },
  // DNS Config styles
  dnsDesc: { fontSize: 14, lineHeight: 22, opacity: 0.7, marginBottom: 20 },
  dnsSectionTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 3, marginBottom: 12 },
  dnsInstructions: { fontSize: 13, lineHeight: 20, opacity: 0.6, marginBottom: 12 },
  dnsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  dnsLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 2, marginBottom: 4 },
  dnsValue: { fontSize: 16, fontWeight: '700' },
  dnsSteps: { marginTop: 16, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  dnsStepTitle: { fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 12 },
  dnsStep: { fontSize: 14, lineHeight: 26, opacity: 0.8 },
  dnsOpenBtn: { marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18, borderRadius: 20 },
  dnsOpenBtnText: { color: '#000', fontWeight: '900', letterSpacing: 2, fontSize: 12 },
  // Tutorial styles
  tutOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', padding: 24 },
  tutCard: { padding: 32, borderRadius: 44, alignItems: 'center', gap: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  tutTitle: { fontSize: 22, fontWeight: '900', letterSpacing: 2 },
  tutText: { color: '#64748b', textAlign: 'center', lineHeight: 22 },
  tutDots: { flexDirection: 'row', gap: 8, marginTop: 8 },
  tutDot: { width: 8, height: 8, borderRadius: 4 },
  tutNav: { flexDirection: 'row', alignItems: 'center', width: '100%', marginTop: 8 },
  tutNavBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 16, borderWidth: 1 },
  tutNavBtnText: { fontWeight: '900', letterSpacing: 1, fontSize: 11 },
  tutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 16, borderRadius: 20 },
  tutBtnText: { color: '#000', fontWeight: '900', letterSpacing: 2, fontSize: 12 },
});
