/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback,
  Switch, ActivityIndicator,
} from 'react-native';
import {
  ChevronLeft, Camera, User, CreditCard, Phone, Mail, LogOutIcon, Trash2,
  Bell, Shield, Palette, Globe, Database, Sun, Moon, Monitor, Lock, RefreshCw,
  Heart, MessageCircle, Hospital, Settings2, Calendar, Volume2,
} from 'lucide-react-native';
import {
  DEFAULT_NARRATION_VOICE,
  loadNarrationVoice,
  NarrationVoice,
  saveNarrationVoice,
} from '@/services/narrationVoice';
import Dropdown from '@/components/Dropdown';
import TextField from '@/components/TextField';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMe, updateAvatar, deleteAvatar, updateProfile } from '@/services/auth';
import * as MessagingAPI from '@/services/messaging.api';
import httpClient from '@/services/httpClient';
import Toast from 'react-native-toast-message';
import {
  getDistrictOptions, getSectorOptions, getCellOptions, getVillageOptions,
  getDistrictIdByName, getSectorIdByName, getCellIdByName, getVillageIdByName,
  getDistrictNameById, getSectorNameById, getCellNameById, getVillageNameById,
  getHospitalOptions,
} from '@/utils/locations';
import { getAllHospitals } from '@/services/location';
import { validateUserToken } from '@/utils/tokenValidation';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import DatePickerModal from '@/components/common/DatePickerModal';
import { SocketService } from '@/services/socket.service';
import { clearAuthSession } from '@/utils/authSession';
import { useIsFocused } from '@react-navigation/native';
import { CopilotProvider, CopilotStep, useCopilot } from 'react-native-copilot';
import { WalkthroughableView, WalkthroughableTouchable } from '@/components/onboarding/walkthroughable';
import MascotTooltip from '@/components/onboarding/MascotTooltip';
import { TOUR_KEYS, onboardingService, scheduleTourStart } from '@/services/onboarding.service';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useTourStepAdvance } from '@/hooks/useTourStepAdvance';

const TABS = [
  { id: 'profile', labelKey: 'profile.tab.profile', Icon: User },
  { id: 'notifications', labelKey: 'profile.tab.notifications', Icon: Bell },
  { id: 'security', labelKey: 'profile.tab.security', Icon: Shield },
  { id: 'settings', labelKey: 'profile.tab.settings', Icon: Settings2 },
];

function ProfileEditScreenContent() {
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme, isDark, themeColors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('profile');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isValidatingToken, setIsValidatingToken] = useState(true);

  // Notification preferences
  const [emailNotif, setEmailNotif] = useState(true);
  const [pushNotif, setPushNotif] = useState(true);
  const [smsNotif, setSmsNotif] = useState(false);
  const [categories, setCategories] = useState({
    courseUpdates: true, assignmentReminders: true, certificates: true, systemUpdates: false,
  });

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPasswordError, setCurrentPasswordError] = useState<string | undefined>(undefined);
  const [newPasswordError, setNewPasswordError] = useState<string | undefined>(undefined);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | undefined>(undefined);

  // Profile form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [phoneError, setPhoneError] = useState<string | undefined>(undefined);
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [idNumberError, setIdNumberError] = useState<string | undefined>(undefined);
  const [role, setRole] = useState('');
  const [district, setDistrict] = useState('');
  const [sector, setSector] = useState('');
  const [cell, setCell] = useState('');
  const [village, setVillage] = useState('');
  const [hospitalId, setHospitalId] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [birthDateObj, setBirthDateObj] = useState<Date | undefined>(undefined);
  const [timezone, setTimezone] = useState('Africa/Kigali');
  const [narrationVoice, setNarrationVoice] = useState<NarrationVoice>(
    DEFAULT_NARRATION_VOICE,
  );
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
  const [hospitalOptions, setHospitalOptions] = useState<{ id: string; label: string; extra?: any }[]>([]);

  // Load hospitals from API
  useEffect(() => {
    const loadHospitals = async () => {
      try {
        const res = await getAllHospitals();
        const hospitals = Array.isArray(res?.data) ? res.data : res;
        setHospitalOptions(
          (hospitals || []).map((h: any) => ({ id: h.id, label: h.name, extra: h })),
        );
      } catch (err) {
        console.error('[Profile] Error loading hospitals:', err);
        setHospitalOptions(getHospitalOptions());
      }
    };
    loadHospitals();
  }, []);

  // Token validation
  useEffect(() => {
    const checkTokenValidity = async () => {
      try {
        const validationResult = await validateUserToken();
        if (!validationResult.isValid && validationResult.shouldRedirect) {
          router.replace(validationResult.redirectTo);
          return;
        }
        setIsValidatingToken(false);
      } catch {
        router.replace('/auth/login');
      }
    };
    checkTokenValidity();
  }, [router]);

  // Load notification preferences
  useEffect(() => {
    const loadPrefs = async () => {
      const email = await AsyncStorage.getItem('st_email');
      const push = await AsyncStorage.getItem('st_push');
      const sms = await AsyncStorage.getItem('st_sms');
      const cats = await AsyncStorage.getItem('st_notif_categories');
      const tz = await AsyncStorage.getItem('st_tz');
      const df = await AsyncStorage.getItem('st_datefmt');
      if (email !== null) setEmailNotif(JSON.parse(email));
      if (push !== null) setPushNotif(JSON.parse(push));
      if (sms !== null) setSmsNotif(JSON.parse(sms));
      if (cats !== null) setCategories(JSON.parse(cats));
      if (tz !== null) setTimezone(tz);
      if (df !== null) setDateFormat(df);
      const voice = await loadNarrationVoice();
      setNarrationVoice(voice);
    };
    loadPrefs();
  }, []);

  // User data
  const { data: userData } = useQuery<any>({
    queryKey: ['USER_INFO'],
    queryFn: async () => {
      const data = await getMe();
      console.log('[Profile] API response:', data);
      return data;
    },
    gcTime: 0,
    enabled: !isValidatingToken,
  });

  // Location options
  const districtOptions = useMemo(() => getDistrictOptions(), []);

  const [sectorOptions, setSectorOptions] = useState<{ id: string; label: string }[]>([]);
  const [cellOptions, setCellOptions] = useState<{ id: string; label: string }[]>([]);
  const [villageOptions, setVillageOptions] = useState<{ id: string; label: string }[]>([]);

  // Populate form when user data loads
  useEffect(() => {
    if (userData) {
      console.log('[Profile] User data loaded:', {
        gender: userData.gender,
        birthdate: userData.birthdate,
        hospital: userData.hospital,
        hospitalId: userData.hospital?.id,
      });
      
      setName(userData.fullNames || '');
      setPhone(userData.phoneNumber || '');
      setEmail(userData.email || '');
      
      // Capitalize gender to match dropdown options (Male/Female)
      const genderValue = userData.gender 
        ? userData.gender.charAt(0).toUpperCase() + userData.gender.slice(1).toLowerCase()
        : '';
      console.log('[Profile] Setting gender:', genderValue);
      setGender(genderValue);
      
      setIdNumber(userData.NID || '');
      setRole(userData.role || userData.roles?.[0] || '');
      
      const hospitalIdValue = userData.hospital?.id || '';
      console.log('[Profile] Setting hospitalId:', hospitalIdValue);
      setHospitalId(hospitalIdValue);
      
      // Set birthdate
      if (userData.birthdate) {
        const date = new Date(userData.birthdate);
        setBirthDateObj(date);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        setBirthdate(`${y}-${m}-${d}`);
      }
      
      const districtId = getDistrictIdByName(userData.district || '');
      setDistrict(districtId);
      if (districtId && userData.sector) {
        const sectorId = getSectorIdByName(userData.sector, districtId);
        setSector(sectorId);
        if (sectorId && userData.cell) {
          const cellId = getCellIdByName(userData.cell, sectorId);
          setCell(cellId);
          if (cellId && userData.village) {
            setVillage(getVillageIdByName(userData.village, cellId));
          }
        }
      }
    }
  }, [userData]);

  // Cascade location dropdowns
  useEffect(() => {
    if (district) {
      const sectors = getSectorOptions(district);
      setSectorOptions(sectors);
      if (!sectors.find(s => s.id === sector)) {
        setSector(''); setCellOptions([]); setVillageOptions([]); setCell(''); setVillage('');
      }
      // reset hospital if it no longer belongs to the new district
      if (hospitalId && hospitalOptions.length) {
        const current = hospitalOptions.find(h => h.id === hospitalId);
        if (current?.extra) {
          const districtName = getDistrictNameById(district).toLowerCase().trim();
          const hospitalDistrict = String(current.extra.district || '').toLowerCase().trim();
          const catchment: string[] = Array.isArray(current.extra.catchmentArea)
            ? current.extra.catchmentArea
            : current.extra.catchmentArea ? [current.extra.catchmentArea] : [];
          const belongs = hospitalDistrict === districtName ||
            catchment.some(c => String(c).toLowerCase().trim() === districtName);
          if (!belongs) setHospitalId('');
        }
      }
    } else {
      setSectorOptions([]); setCellOptions([]); setVillageOptions([]);
    }
  }, [district]);

  useEffect(() => {
    if (sector) {
      const cells = getCellOptions(sector);
      setCellOptions(cells);
      if (!cells.find(c => c.id === cell)) {
        setCell(''); setVillageOptions([]); setVillage('');
      }
    } else {
      setCellOptions([]); setVillageOptions([]);
    }
  }, [sector]);

  useEffect(() => {
    if (cell) {
      const villages = getVillageOptions(cell);
      setVillageOptions(villages);
      if (!villages.find(v => v.id === village)) setVillage('');
    } else {
      setVillageOptions([]);
    }
  }, [cell]);

  useEffect(() => {
    if (userData && district) {
      setSectorOptions(getSectorOptions(district));
      if (sector) {
        setCellOptions(getCellOptions(sector));
        if (cell) setVillageOptions(getVillageOptions(cell));
      }
    }
  }, [userData, district, sector, cell]);

  // Mutations
  const updateAvatarMutation = useMutation({
    mutationFn: updateAvatar,
    onSuccess: () => {
      Toast.show({ type: 'success', text1: t('profile.photoUpdated') });
      queryClient.invalidateQueries({ queryKey: ['USER_INFO'] });
      setImageUri(null);
    },
    onError: () => Toast.show({ type: 'error', text1: t('profile.photoUpdateFailed') }),
  });

  const deleteAvatarMutation = useMutation({
    mutationFn: deleteAvatar,
    onSuccess: () => {
      Toast.show({ type: 'success', text1: t('profile.photoDeleted') });
      queryClient.invalidateQueries({ queryKey: ['USER_INFO'] });
      setImageUri(null);
    },
    onError: () => Toast.show({ type: 'error', text1: t('profile.photoDeleteFailed') }),
  });

  const updateProfileMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      Toast.show({ type: 'success', text1: t('profile.profileUpdated') });
      queryClient.invalidateQueries({ queryKey: ['USER_INFO'] });
    },
    onError: () => Toast.show({ type: 'error', text1: t('profile.profileUpdateFailed') }),
  });

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect: [1, 1], quality: 0.8,
      });
      // @ts-ignore
      const uri = result.assets?.length ? result.assets[0].uri : (result.uri as string | undefined);
      if (uri) {
        setImageUri(uri);
        const formData = new FormData();
        // @ts-ignore
        formData.append('photo', { uri, type: 'image/jpeg', name: 'avatar.jpg' });
        updateAvatarMutation.mutate(formData);
      }
    } catch { /* ignore */ }
  };

  const handleUpdateProfile = () => {
    setNameError(undefined);
    setPhoneError(undefined);
    setEmailError(undefined);
    setIdNumberError(undefined);

    if (!name.trim()) setNameError(t('nameRequired'));
    if (!phone.trim()) setPhoneError(t('phoneRequired'));
    if (!name.trim() || !phone.trim()) return;

    const cleanedPhone = phone.replace(/\D/g, '');
    const localPrefixes = ['078', '079', '072', '073'];
    const intlPrefixes = localPrefixes.map((p) => '250' + p.slice(1));
    const validPhone =
      (cleanedPhone.length === 10 && localPrefixes.some((p) => cleanedPhone.startsWith(p))) ||
      (cleanedPhone.length === 12 && intlPrefixes.some((p) => cleanedPhone.startsWith(p)));
    if (!validPhone) {
      setPhoneError(t('invalidPhone'));
      return;
    }

    if (idNumber.trim() && !/^1\d{15}$/.test(idNumber.trim())) {
      setIdNumberError(t('invalidNID'));
      return;
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError(t('invalidEmail'));
      return;
    }

    const formData = new FormData();
    formData.append('fullNames', name);
    formData.append('phoneNumber', phone);
    if (email) formData.append('email', email);
    if (hospitalId) formData.append('hospitalId', hospitalId);
    if (birthdate) formData.append('birthdate', birthdate);
    // Save gender in lowercase to match database format
    formData.append('gender', gender.toLowerCase());
    formData.append('NID', idNumber);
    formData.append('district', district ? getDistrictNameById(district) : '');
    formData.append('sector', sector ? getSectorNameById(sector) : '');
    formData.append('cell', cell ? getCellNameById(cell) : '');
    formData.append('village', village ? getVillageNameById(village) : '');
    updateProfileMutation.mutate(formData);
  };

  const handleChangePassword = async () => {
    setCurrentPasswordError(undefined);
    setNewPasswordError(undefined);
    setConfirmPasswordError(undefined);
    if (!currentPassword || !newPassword || !confirmPassword) {
      if (!currentPassword) setCurrentPasswordError(t('currentPasswordRequired'));
      if (!newPassword) setNewPasswordError(t('newPasswordRequired'));
      if (!confirmPassword) setConfirmPasswordError(t('confirmPasswordRequired'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setConfirmPasswordError(t('profile.passwordMismatch'));
      return;
    }
    if (newPassword.length < 8) {
      setNewPasswordError(t('profile.passwordTooShort'));
      return;
    }
    setChangingPassword(true);
    try {
      await httpClient.put('/auth/update-password', { currentPassword, newPassword });
      Toast.show({ type: 'success', text1: t('profile.passwordChanged') });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.response?.data?.message || t('profile.passwordChangeFailed') });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogout = async () => {
    try {
      await SocketService.getInstance()?.disconnect();
      SocketService.disconnect();
      SocketService.disconnectNamespaces();
      queryClient.clear();
      await clearAuthSession();
    } catch (err) {
      console.log('Error clearing cache/storage on logout', err);
    } finally {
      router.push('/auth/login');
    }
  };

  const handleClearCache = async () => {
    const keys = ['st_email', 'st_push', 'st_sms', 'st_theme', 'st_lang', 'st_tz', 'st_datefmt', 'st_notif_categories'];
    await Promise.all(keys.map(k => AsyncStorage.removeItem(k)));
    Toast.show({ type: 'success', text1: t('profile.cacheCleared') });
  };

  const { start, copilotEvents, stop, visible } = useCopilot();
  // start()'s identity is not stable across CopilotProvider re-renders (the
  // library doesn't memoize its internal visibility setter, which start
  // depends on) — reading it through a ref means a re-render before the
  // scheduled tour fires doesn't cancel it via the effect's cleanup.
  const startRef = useRef(start);
  startRef.current = start;
  const { markComplete } = useOnboarding();
  const advancePhoto = useTourStepAdvance('profile-photo');
  const advanceLogout = useTourStepAdvance('profile-logout');
  const advanceTabs = useTourStepAdvance('profile-tabs');
  const isFocused = useIsFocused();
  // If the user navigates away (tapping the real highlighted element can
  // itself trigger navigation, but this also covers back/tab-switch/etc.)
  // while a tour is visible, its CopilotProvider can stay mounted (stack
  // navigators often keep the previous screen alive) — without this, the
  // tour's Modal renders in RN's top-level layer and keeps floating over
  // whatever screen is now active. Close it on the focus transition.
  const wasFocusedRef = useRef(isFocused);
  useEffect(() => {
    if (wasFocusedRef.current && !isFocused && visible) {
      stop().catch(() => {});
    }
    wasFocusedRef.current = isFocused;
  }, [isFocused, visible, stop]);
  const autoStartAttemptedRef = useRef(false);

  useEffect(() => {
    let cancelSchedule: (() => void) | null = null;
    let cancelled = false;
    if (!isValidatingToken && isFocused && !autoStartAttemptedRef.current) {
      autoStartAttemptedRef.current = true;
      void (async () => {
        const done = await onboardingService.hasCompleted(TOUR_KEYS.PROFILE);
        if (cancelled) return;
        if (!done) { cancelSchedule = scheduleTourStart(() => startRef.current()); }
      })();
    }
    return () => { cancelled = true; cancelSchedule?.(); };
  }, [isValidatingToken, isFocused]);

  useEffect(() => {
    const handleStop = () => { markComplete(TOUR_KEYS.PROFILE).catch(() => {}); };
    copilotEvents.on('stop', handleStop);
    return () => { copilotEvents.off('stop', handleStop); };
  }, [copilotEvents, markComplete]);

  if (isValidatingToken) return <LoadingSpinner />;

  const DEFAULT_AVATAR = 'https://img.freepik.com/premium-vector/user-profile-icon-flat-style-member-avatar-vector-illustration-isolated-background-human-permission-sign-business-concept_157943-15752.jpg';

  const ds = {
    container: { backgroundColor: themeColors.pageBackground },
    card: { backgroundColor: themeColors.cardBg },
    tabBar: { backgroundColor: themeColors.cardBg, borderBottomColor: isDark ? '#374151' : '#e5e7eb' },
    sectionTitle: { color: themeColors.cardText },
    settingLabel: { color: themeColors.cardText },
    settingDesc: { color: themeColors.cardSubtitle },
    themeCard: { backgroundColor: themeColors.cardBg, borderColor: isDark ? '#374151' : '#e5e7eb' },
    themeCardActive: { backgroundColor: isDark ? '#1e3a5f' : '#eff6ff', borderColor: '#3363AD' },
    themeLabel: { color: themeColors.cardText },
    langCard: { backgroundColor: themeColors.cardBg, borderColor: isDark ? '#374151' : '#e5e7eb' },
    langLabel: { color: themeColors.cardText },
    securityCard: { backgroundColor: isDark ? '#1a1a2e' : '#f9fafb', borderColor: isDark ? '#374151' : '#e5e7eb' },
    dataCard: { backgroundColor: themeColors.cardBg, borderColor: isDark ? '#374151' : '#e5e7eb' },
    dataCardDanger: { backgroundColor: isDark ? '#2d0a0a' : '#fff5f5', borderColor: isDark ? '#7f1d1d' : '#fecaca' },
    dataCardTitle: { color: themeColors.cardText },
    dataCardDesc: { color: themeColors.cardSubtitle },
  };

  return (
    <View style={[styles.container, ds.container]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft color="#FFFFFF" size={24} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <View style={styles.titleContainer}>
            <User color="#FFFFFF" size={20} />
            <Text style={styles.title}>{t('profile.header')}</Text>
          </View>
        </View>
        <CopilotStep text="Kanda hano gusohoka muri konte yawe." order={3} name="profile-logout">
          <WalkthroughableTouchable style={styles.logoutButton} onPress={advanceLogout(handleLogout)}>
            <LogOutIcon color="#FFFFFF" size={20} />
            <Text style={styles.logoutText}>{t('profile.logout')}</Text>
          </WalkthroughableTouchable>
        </CopilotStep>
      </View>

      {/* Profile photo (always visible) */}
      <View style={styles.profileSection}>
        {/* The tooltip text instructs tapping the photo's change/remove
            controls specifically — target just this container instead of
            the whole profile section, which also includes the unrelated
            name text below (a wider target anchors the library's pointer
            away from these buttons and can make them un-tappable). */}
        <CopilotStep text="Kanda hano guhindura ifoto yawe cyangwa kuyikuraho." order={1} name="profile-photo">
          <WalkthroughableView style={styles.profileImageContainer}>
            <Image
              source={{ uri: imageUri || userData?.photo || DEFAULT_AVATAR }}
              style={styles.profileImage}
            />
            <TouchableOpacity style={styles.cameraButton} onPress={advancePhoto(pickImage)}>
              <Camera color="#3363AD" size={16} />
            </TouchableOpacity>
            {userData?.photo && userData.photo !== DEFAULT_AVATAR && (
              <TouchableOpacity style={styles.deleteButton} onPress={advancePhoto(() => deleteAvatarMutation.mutate())}>
                <Trash2 color="#FF4444" size={14} />
              </TouchableOpacity>
            )}
          </WalkthroughableView>
        </CopilotStep>
        {userData?.fullNames ? (
          <Text style={styles.profileName}>{userData.fullNames}</Text>
        ) : null}
      </View>

      {/* White card with tab bar + content */}
      <View style={[styles.card, ds.card]}>
        {/* Tab bar */}
        <CopilotStep
          text="Hitamo  kugira ngo uhindure amakuru yawe bwite, uburyo bwo kubona amatangazo, umutekano , cyangwa igenamiterere."
          order={2}
          name="profile-tabs"
        >
          <WalkthroughableView style={[styles.tabBar, ds.tabBar]}>
            {TABS.map(({ id, labelKey, Icon }) => {
              const active = activeTab === id;
              return (
                <TouchableOpacity
                  key={id}
                  onPress={advanceTabs(() => setActiveTab(id))}
                  style={styles.tab}
                  activeOpacity={0.7}
                >
                  <View style={[styles.tabIconBox, active && styles.tabIconBoxActive]}>
                    <Icon size={16} color={active ? '#3363AD' : '#9ca3af'} />
                  </View>
                  <Text style={[styles.tabLabel, active && styles.activeTabLabel]} numberOfLines={1} adjustsFontSizeToFit>{t(labelKey)}</Text>
                  <View style={[styles.tabUnderline, active && styles.tabUnderlineActive]} />
                </TouchableOpacity>
              );
            })}
          </WalkthroughableView>
        </CopilotStep>


        {/* Tab content */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
        >
          <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
            <ScrollView
              style={styles.tabContent}
              contentContainerStyle={{ paddingBottom: 40 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* ── PROFILE ── */}
              {activeTab === 'profile' && (
                <View>
                  <Text style={[styles.sectionTitle, ds.sectionTitle]}>{t('profile.personalInfo')}</Text>

                  <TextField
                    label={t('profile.fullName')}
                    value={name}
                    onChangeText={(v) => { setName(v); setNameError(undefined); }}
                    placeholder={t('profile.fullNamePlaceholder')}
                    icon={<User color="#3363AD" size={20} />}
                    error={nameError}
                  />

                  <TextField
                    label={t('profile.emailLabel')}
                    value={email}
                    onChangeText={(v) => { setEmail(v); setEmailError(undefined); }}
                    placeholder={t('profile.emailLabel')}
                    icon={<Mail color="#3363AD" size={20} />}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    error={emailError}
                  />

                  <View style={styles.rowContainer}>
                    <View style={{ flex: 1, marginRight: 4 }}>
                      <TextField
                        label={t('profile.phoneLabel')}
                        value={phone}
                        onChangeText={(v) => { setPhone(v); setPhoneError(undefined); }}
                        placeholder={t('profile.phonePlaceholder')}
                        icon={<Phone color="#3363AD" size={14} />}
                        keyboardType="phone-pad"
                        error={phoneError}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 4 }}>
                      <Dropdown
                        label={t('profile.gender')}
                        items={[
                          { id: 'Male', label: t('signup.gender.male'), icon: <Text>👨</Text> },
                          { id: 'Female', label: t('signup.gender.female'), icon: <Text>👩</Text> },
                        ]}
                        value={gender}
                        onChange={(v) => typeof v === 'string' ? setGender(v) : setGender(Array.isArray(v) ? v[0] : '')}
                        placeholder={t('profile.gender')}
                        showIcons
                      />
                    </View>
                  </View>

                  <TextField
                    label={t('profile.nid')}
                    value={idNumber}
                    onChangeText={(v) => { setIdNumber(v); setIdNumberError(undefined); }}
                    placeholder={t('profile.nidPlaceholder')}
                    icon={<CreditCard color="#3363AD" size={18} />}
                    keyboardType="phone-pad"
                    error={idNumberError}
                  />

                  <View style={styles.rowContainer}>
                    <View style={{ flex: 1, marginRight: 4 }}>
                      <Text style={{ color: isDark ? '#d1d5db' : '#374151', marginBottom: 8, fontSize: 14, fontWeight: '500' }}>
                        {t('signup.dob') || 'Date of Birth'}
                      </Text>
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingHorizontal: 16,
                          paddingVertical: 12,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: (themeColors as any).cardSubtitle ?? (isDark ? '#374151' : '#d1d5db'),
                          backgroundColor: (themeColors as any).cardBg ?? (isDark ? '#111827' : '#ffffff'),
                          gap: 8,
                        }}
                        onPress={() => setShowDatePicker(true)}
                      >
                        <Calendar color="#3363AD" size={18} />
                        <Text
                          style={{
                            fontSize: 16,
                            flex: 1,
                            color: birthdate
                              ? (themeColors as any).cardText ?? (isDark ? '#ffffff' : '#111827')
                              : isDark ? '#6b7280' : '#9ca3af',
                          }}
                        >
                          {birthdate || 'YYYY-MM-DD'}
                        </Text>
                      </TouchableOpacity>
                      <DatePickerModal
                        visible={showDatePicker}
                        value={birthDateObj || new Date(1990, 0, 1)}
                        onConfirm={(selectedDate) => {
                          setBirthDateObj(selectedDate);
                          const y = selectedDate.getFullYear();
                          const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
                          const d = String(selectedDate.getDate()).padStart(2, '0');
                          setBirthdate(`${y}-${m}-${d}`);
                          setShowDatePicker(false);
                        }}
                        onCancel={() => setShowDatePicker(false)}
                        maximumDate={new Date()}
                        minimumDate={new Date(1900, 0, 1)}
                        title={t('profile.birthdate') || "Itariki y'amavuko"}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 4 }}>
                      <TextField
                        label={t('profile.role')}
                        value={role ? (t(`roles.${role.toLowerCase()}`) || role) : ''}
                        onChangeText={() => {}}
                        placeholder={t('profile.rolePlaceholder')}
                        icon={<Shield color="#3363AD" size={20} />}
                        editable={false}
                      />
                    </View>
                  </View>

                  <Dropdown
                    label={t('profile.hospital')}
                    items={hospitalOptions.filter((h) => {
                      if (!district) return true;
                      const extra = h.extra;
                      if (!extra) return true;
                      const districtName = getDistrictNameById(district).toLowerCase().trim();
                      const hospitalDistrict = String(extra.district || '').toLowerCase().trim();
                      if (hospitalDistrict === districtName) return true;
                      const catchment: string[] = Array.isArray(extra.catchmentArea)
                        ? extra.catchmentArea
                        : extra.catchmentArea ? [extra.catchmentArea] : [];
                      return catchment.some((c) => String(c).toLowerCase().trim() === districtName);
                    })}
                    value={hospitalId}
                    onChange={(val) => setHospitalId(val as string)}
                    placeholder={t('profile.hospitalPlaceholder') || 'Select hospital'}
                    icon={<Hospital color="#3363AD" size={20} />}
                  />

                  <Text style={[styles.sectionTitle, ds.sectionTitle, { marginTop: 8 }]}>{t('profile.location')}</Text>

                  <View style={styles.rowContainer}>
                    <View style={{ flex: 1, marginRight: 4 }}>
                      <Dropdown
                        label={t('district')}
                        items={districtOptions}
                        value={district}
                        onChange={(v) => typeof v === 'string' && setDistrict(v)}
                        placeholder={t('district.placeholder')}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 4 }}>
                      <Dropdown
                        label={t('sector')}
                        items={sectorOptions}
                        value={sector}
                        onChange={(v) => typeof v === 'string' && setSector(v)}
                        placeholder={t('sector.placeholder')}
                      />
                    </View>
                  </View>

                  <View style={styles.rowContainer}>
                    <View style={{ flex: 1, marginRight: 4 }}>
                      <Dropdown
                        label={t('cell')}
                        items={cellOptions}
                        value={cell}
                        onChange={(v) => typeof v === 'string' && setCell(v)}
                        placeholder={t('cell.placeholder')}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 4 }}>
                      <Dropdown
                        label={t('village')}
                        items={villageOptions}
                        value={village}
                        onChange={(v) => typeof v === 'string' && setVillage(v)}
                        placeholder={t('village.placeholder')}
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleUpdateProfile}
                    disabled={updateProfileMutation.isPending}
                  >
                    {updateProfileMutation.isPending
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.primaryButtonText}>{t('profile.updateProfile')}</Text>
                    }
                  </TouchableOpacity>
                </View>
              )}

              {/* ── NOTIFICATIONS ── */}
              {activeTab === 'notifications' && (
                <View>
                  <Text style={[styles.sectionTitle, ds.sectionTitle]}>{t('profile.notifMethods')}</Text>

                  <View style={styles.settingRow}>
                    <View style={styles.settingLeft}>
                      <View style={[styles.settingIconBox, { backgroundColor: '#fef3c7' }]}>
                        <Mail size={18} color="#d97706" />
                      </View>
                      <View style={styles.settingInfo}>
                        <Text style={[styles.settingLabel, ds.settingLabel]}>{t('profile.emailLabel')}</Text>
                        <Text style={[styles.settingDesc, ds.settingDesc]}>{t('profile.notifEmailDesc')}</Text>
                      </View>
                    </View>
                    <Switch
                      value={emailNotif}
                      onValueChange={async (v) => {
                        setEmailNotif(v);
                        await AsyncStorage.setItem('st_email', JSON.stringify(v));
                        Toast.show({ type: 'success', text1: v ? t('profile.notifEmailOn') : t('profile.notifEmailOff') });
                      }}
                      trackColor={{ false: '#d1d5db', true: '#fcd34d' }}
                      thumbColor={emailNotif ? '#d97706' : '#9ca3af'}
                    />
                  </View>

                  <View style={styles.settingRow}>
                    <View style={styles.settingLeft}>
                      <View style={[styles.settingIconBox, { backgroundColor: '#eff6ff' }]}>
                        <Bell size={18} color="#3363AD" />
                      </View>
                      <View style={styles.settingInfo}>
                        <Text style={[styles.settingLabel, ds.settingLabel]}>{t('profile.notifPush')}</Text>
                        <Text style={[styles.settingDesc, ds.settingDesc]}>{t('profile.notifPushDesc')}</Text>
                      </View>
                    </View>
                    <Switch
                      value={pushNotif}
                      onValueChange={async (v) => {
                        setPushNotif(v);
                        await AsyncStorage.setItem('st_push', JSON.stringify(v));
                        Toast.show({ type: 'success', text1: v ? t('profile.notifOn') : t('profile.notifOff') });
                      }}
                      trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
                      thumbColor={pushNotif ? '#3363AD' : '#9ca3af'}
                    />
                  </View>

                  <View style={styles.settingRow}>
                    <View style={styles.settingLeft}>
                      <View style={[styles.settingIconBox, { backgroundColor: '#f0fdf4' }]}>
                        <Phone size={18} color="#16a34a" />
                      </View>
                      <View style={styles.settingInfo}>
                        <Text style={[styles.settingLabel, ds.settingLabel]}>SMS</Text>
                        <Text style={[styles.settingDesc, ds.settingDesc]}>{t('profile.notifSmsDesc')}</Text>
                      </View>
                    </View>
                    <Switch
                      value={smsNotif}
                      onValueChange={async (v) => {
                        setSmsNotif(v);
                        await AsyncStorage.setItem('st_sms', JSON.stringify(v));
                        Toast.show({ type: 'success', text1: v ? t('profile.smsOn') : t('profile.smsOff') });
                      }}
                      trackColor={{ false: '#d1d5db', true: '#86efac' }}
                      thumbColor={smsNotif ? '#16a34a' : '#9ca3af'}
                    />
                  </View>

                  <Text style={[styles.sectionTitle, ds.sectionTitle, { marginTop: 24 }]}>{t('profile.notifCategories')}</Text>

                  {([
                    { key: 'courseUpdates',       labelKey: 'profile.catCourses',      descKey: 'profile.catCoursesDesc' },
                    { key: 'assignmentReminders', labelKey: 'profile.catAssignments',   descKey: 'profile.catAssignmentsDesc' },
                    { key: 'certificates',        labelKey: 'profile.catCerts',         descKey: 'profile.catCertsDesc' },
                    { key: 'systemUpdates',       labelKey: 'profile.catSystem',        descKey: 'profile.catSystemDesc' },
                  ] as const).map((item, idx, arr) => (
                    <View key={item.key} style={[styles.settingRow, { borderBottomWidth: idx < arr.length - 1 ? 1 : 0, borderBottomColor: '#f3f4f6' }]}>
                      <View style={styles.settingInfo}>
                        <Text style={[styles.settingLabel, ds.settingLabel]}>{t(item.labelKey)}</Text>
                        <Text style={[styles.settingDesc, ds.settingDesc]}>{t(item.descKey)}</Text>
                      </View>
                      <Switch
                        value={categories[item.key]}
                        onValueChange={async (v) => {
                          const next = { ...categories, [item.key]: v };
                          setCategories(next);
                          await AsyncStorage.setItem('st_notif_categories', JSON.stringify(next));
                        }}
                        trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
                        thumbColor={categories[item.key] ? '#3363AD' : '#9ca3af'}
                      />
                    </View>
                  ))}
                </View>
              )}

              {/* ── SECURITY ── */}
              {activeTab === 'security' && (
                <View>
                  <Text style={[styles.sectionTitle, ds.sectionTitle]}>{t('profile.changePassword')}</Text>

                  <View style={[styles.securityCard, ds.securityCard]}>
                    <View style={styles.inputContainer}>
                      <TextField
                        label={t('profile.currentPassword')}
                        value={currentPassword}
                        onChangeText={(v) => { setCurrentPassword(v); setCurrentPasswordError(undefined); }}
                        placeholder={t('profile.currentPasswordPlaceholder')}
                        icon={<Lock color="#3363AD" size={20} />}
                        secureTextEntry
                        error={currentPasswordError}
                      />
                    </View>
                    <View style={styles.inputContainer}>
                      <TextField
                        label={t('profile.newPassword')}
                        value={newPassword}
                        onChangeText={(v) => { setNewPassword(v); setNewPasswordError(undefined); }}
                        placeholder={t('profile.newPasswordPlaceholder')}
                        icon={<Lock color="#3363AD" size={20} />}
                        secureTextEntry
                        error={newPasswordError}
                      />
                    </View>
                    <View style={styles.inputContainer}>
                      <TextField
                        label={t('profile.confirmNewPassword')}
                        value={confirmPassword}
                        onChangeText={(v) => { setConfirmPassword(v); setConfirmPasswordError(undefined); }}
                        placeholder={t('profile.confirmNewPasswordPlaceholder')}
                        icon={<Lock color="#3363AD" size={20} />}
                        secureTextEntry
                        error={confirmPasswordError}
                      />
                    </View>

                    <TouchableOpacity
                      style={styles.primaryButton}
                      onPress={handleChangePassword}
                      disabled={changingPassword}
                    >
                      {changingPassword
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={styles.primaryButtonText}>{t('profile.changePasswordBtn')}</Text>
                      }
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.sectionTitle, ds.sectionTitle, { marginTop: 24 }]}>{t('profile.activeSessions')}</Text>
                  <View style={[styles.securityCard, ds.securityCard, { flexDirection: 'row', alignItems: 'center' }]}>
                    <View style={[styles.settingIconBox, { backgroundColor: '#f0fdf4', marginRight: 12 }]}>
                      <Monitor size={18} color="#16a34a" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.settingLabel, ds.settingLabel]}>{t('profile.currentDevice')}</Text>
                      <Text style={[styles.settingDesc, ds.settingDesc]}>{t('profile.currentDeviceDesc')}</Text>
                    </View>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#16a34a' }}>{t('profile.activeNow')}</Text>
                  </View>
                </View>
              )}

              {/* ── SETTINGS (merged: appearance + language + data) ── */}
              {activeTab === 'settings' && (
                <View>
                  {/* ── Appearance section ── */}
                  <Text style={[styles.sectionTitle, ds.sectionTitle]}>{t('profile.appAppearance')}</Text>

                  {([
                    { value: 'light', labelKey: 'profile.themeLight', descKey: 'profile.themeLightDesc', Icon: Sun, color: '#f59e0b' },
                    { value: 'dark', labelKey: 'profile.themeDark', descKey: 'profile.themeDarkDesc', Icon: Moon, color: '#6366f1' },
                    { value: 'system', labelKey: 'profile.themeSystem', descKey: 'profile.themeSystemDesc', Icon: Monitor, color: '#6b7280' },
                  ] as const).map(({ value, labelKey, descKey, Icon: TIcon, color }) => (
                    <TouchableOpacity
                      key={value}
                      style={[styles.themeCard, ds.themeCard, theme === value && { ...styles.themeCardActive, ...ds.themeCardActive }]}
                      onPress={() => {
                        setTheme(value);
                        Toast.show({ type: 'success', text1: t(labelKey), text2: t(descKey) });
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.themeIconBox, { backgroundColor: `${color}20` }]}>
                        <TIcon size={22} color={color} />
                      </View>
                      <View style={styles.themeInfo}>
                        <Text style={[styles.themeLabel, ds.themeLabel, theme === value && styles.themeLabelActive]}>{t(labelKey)}</Text>
                        <Text style={[styles.themeDesc, ds.settingDesc]}>{t(descKey)}</Text>
                      </View>
                      {theme === value && (
                        <View style={styles.themeCheck}>
                          <Text style={styles.themeCheckText}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}

                  {/* ── Language section ── */}
                  <Text style={[styles.sectionTitle, ds.sectionTitle, { marginTop: 24 }]}>{t('profile.appLanguage')}</Text>

                  {([
                    { value: 'en', label: 'English', flag: '🇬🇧' },
                    { value: 'rw', label: 'Kinyarwanda', flag: '🇷🇼' },
                  ] as const).map(({ value, label, flag }) => (
                    <TouchableOpacity
                      key={value}
                      style={[styles.langCard, ds.langCard, language === value && styles.langCardActive]}
                      onPress={() => {
                        setLanguage(value);
                        Toast.show({ type: 'success', text1: label, text2: t('profile.languageChanged') });
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.langFlag}>{flag}</Text>
                      <Text style={[styles.langLabel, ds.langLabel, language === value && styles.langLabelActive]}>{label}</Text>
                      {language === value && (
                        <View style={styles.themeCheck}>
                          <Text style={styles.themeCheckText}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}

                          {/* ── Read-aloud voice section ── */}
                          <Text style={[styles.sectionTitle, ds.sectionTitle, { marginTop: 24 }]}>
                    {t('profile.narrationVoice')}
                  </Text>
                  <Text style={[styles.settingDesc, ds.settingDesc, { marginBottom: 10 }]}>
                    {t('profile.narrationVoiceDesc')}
                  </Text>

                  {([
                    {
                      value: 'female1' as NarrationVoice,
                      labelKey: 'profile.voiceFemale1',
                      descKey: 'profile.voiceFemale1Desc',
                      color: '#ec4899',
                    },
                    {
                      value: 'female2' as NarrationVoice,
                      labelKey: 'profile.voiceFemale2',
                      descKey: 'profile.voiceFemale2Desc',
                      color: '#a855f7',
                    },
                    {
                      value: 'male' as NarrationVoice,
                      labelKey: 'profile.voiceMale',
                      descKey: 'profile.voiceMaleDesc',
                      color: '#3363AD',
                    },
                  ]).map(({ value, labelKey, descKey, color }) => (
                    <TouchableOpacity
                      key={value}
                      style={[
                        styles.themeCard,
                        ds.themeCard,
                        narrationVoice === value && {
                          ...styles.themeCardActive,
                          ...ds.themeCardActive,
                        },
                      ]}
                      onPress={async () => {
                        setNarrationVoice(value);
                        await saveNarrationVoice(value);
                        Toast.show({
                          type: 'success',
                          text1: t(labelKey),
                          text2: t('profile.narrationVoiceChanged'),
                        });
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.themeIconBox, { backgroundColor: `${color}20` }]}>
                        <Volume2 size={22} color={color} />
                      </View>
                      <View style={styles.themeInfo}>
                        <Text
                          style={[
                            styles.themeLabel,
                            ds.themeLabel,
                            narrationVoice === value && styles.themeLabelActive,
                          ]}
                        >
                          {t(labelKey)}
                        </Text>
                        <Text style={[styles.themeDesc, ds.settingDesc]}>{t(descKey)}</Text>
                      </View>
                      {narrationVoice === value && (
                        <View style={styles.themeCheck}>
                          <Text style={styles.themeCheckText}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}


                  <Text style={[styles.sectionTitle, ds.sectionTitle, { marginTop: 24 }]}>{t('profile.timezone')}</Text>
                  <Dropdown
                    label={t('profile.timezone')}
                    items={[
                      { id: 'Africa/Kigali',    label: '(UTC+02:00) Africa/Kigali' },
                      { id: 'UTC',              label: '(UTC+00:00) UTC' },
                      { id: 'Europe/London',    label: '(UTC+00:00) Europe/London' },
                      { id: 'America/New_York', label: '(UTC-05:00) America/New_York' },
                      { id: 'Asia/Tokyo',       label: '(UTC+09:00) Asia/Tokyo' },
                    ]}
                    value={timezone}
                    onChange={async (v) => {
                      if (typeof v === 'string') {
                        setTimezone(v);
                        await AsyncStorage.setItem('st_tz', v);
                      }
                    }}
                    placeholder={t('profile.timezonePlaceholder')}
                  />

                  <Text style={[styles.sectionTitle, ds.sectionTitle, { marginTop: 20 }]}>{t('profile.dateFormat')}</Text>
                  <Dropdown
                    label={t('profile.dateFormatLabel')}
                    items={[
                      { id: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
                      { id: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
                      { id: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
                    ]}
                    value={dateFormat}
                    onChange={async (v) => {
                      if (typeof v === 'string') {
                        setDateFormat(v);
                        await AsyncStorage.setItem('st_datefmt', v);
                      }
                    }}
                    placeholder={t('profile.dateFormatPlaceholder')}
                  />

                  {/* ── Data section ── */}
                  <Text style={[styles.sectionTitle, ds.sectionTitle, { marginTop: 24 }]}>{t('profile.manageData')}</Text>

                  <View style={[styles.dataCard, ds.dataCard]}>
                    <View style={styles.dataCardHeader}>
                      <RefreshCw size={18} color="#3363AD" />
                      <Text style={[styles.dataCardTitle, ds.dataCardTitle]}>{t('profile.clearCache')}</Text>
                    </View>
                    <Text style={[styles.dataCardDesc, ds.dataCardDesc]}>
                      {t('profile.clearCacheDesc')}
                    </Text>
                    <TouchableOpacity style={styles.outlineButton} onPress={handleClearCache}>
                      <Text style={styles.outlineButtonText}>{t('profile.clearCacheBtn')}</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.dataCard, ds.dataCardDanger]}>
                    <View style={styles.dataCardHeader}>
                      <Trash2 size={18} color="#ef4444" />
                      <Text style={[styles.dataCardTitle, { color: '#ef4444' }]}>{t('profile.deleteAccount')}</Text>
                    </View>
                    <Text style={[styles.dataCardDesc, { color: isDark ? '#fca5a5' : '#b91c1c' }]}>
                      {t('profile.deleteAccountDesc')}
                    </Text>
                    <TouchableOpacity
                      style={styles.dangerButton}
                      onPress={() => Toast.show({ type: 'info', text1: t('profile.deleteAccountContact') })}
                    >
                      <Text style={styles.dangerButtonText}>{t('profile.deleteAccountBtn')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

export default function ProfileEditScreen() {
  return (
    <CopilotProvider
      tooltipComponent={MascotTooltip}
      overlay="view"
      backdropColor="rgba(0, 0, 0, 0.65)"
      animationDuration={300}
      stepNumberComponent={() => null}
      arrowSize={10}
      androidStatusBarVisible
      labels={{ finish: 'Rangiza', next: 'Ibikurikiraho', previous: 'Inyuma', skip: 'Simbuka' }}
    >
      <ProfileEditScreenContent />
    </CopilotProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },

  // Header
  header: {
    backgroundColor: '#3363AD',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerContent: { flex: 1, alignItems: 'center' },
  titleContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  logoutButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8, paddingVertical: 8,
    borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  logoutText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  // Profile photo area
  profileSection: { backgroundColor: '#3363AD', alignItems: 'center', paddingBottom: 24 },
  profileImageContainer: { position: 'relative' },
  profileImage: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#E5E7EB' },
  profileName: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', marginTop: 8 },
  cameraButton: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#3363AD',
  },
  deleteButton: {
    position: 'absolute', bottom: 0, left: 0,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#FF4444',
  },

  // White card
  card: {
    flex: 1, backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    marginTop: -20, overflow: 'hidden',
  },

  // Tab bar
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 8, paddingBottom: 0,
  },
  tabIconBox: {
    width: 34, height: 34, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  tabIconBoxActive: { backgroundColor: '#eff6ff' },
  tabLabel: { fontSize: 10, color: '#9ca3af', fontWeight: '500', marginTop: 2, marginBottom: 6 },
  activeTabLabel: { color: '#3363AD', fontWeight: '700' },
  tabUnderline: { height: 2.5, alignSelf: 'stretch', borderRadius: 2, backgroundColor: 'transparent' },
  tabUnderlineActive: { backgroundColor: '#3363AD' },

  // Tab content
  tabContent: { flex: 1, paddingHorizontal: 16, paddingTop: 20 },

  // Profile form
  inputContainer: { marginBottom: 2 },
  rowContainer: { flexDirection: 'row', marginBottom: 2 },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  datePickerText: {
    fontSize: 14,
    flex: 1,
  },

  // Notifications
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 12 },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 4,
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  settingIconBox: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  settingInfo: { flex: 1 },
  settingLabel: { fontSize: 14, fontWeight: '600', color: '#111827' },
  settingDesc: { fontSize: 12, color: '#6b7280', marginTop: 2 },

  // Security
  securityCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#e5e7eb',
  },

  // Appearance
  themeCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, borderRadius: 16,
    borderWidth: 2, borderColor: '#e5e7eb',
    marginBottom: 12, backgroundColor: '#ffffff',
  },
  themeCardActive: { borderColor: '#3363AD', backgroundColor: '#eff6ff' },
  themeIconBox: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  themeInfo: { flex: 1 },
  themeLabel: { fontSize: 15, fontWeight: '600', color: '#374151' },
  themeLabelActive: { color: '#3363AD' },
  themeDesc: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  themeCheck: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#3363AD', alignItems: 'center', justifyContent: 'center',
  },
  themeCheckText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Language
  langCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, borderRadius: 16,
    borderWidth: 2, borderColor: '#e5e7eb',
    marginBottom: 12, backgroundColor: '#ffffff',
  },
  langCardActive: { borderColor: '#3363AD', backgroundColor: '#eff6ff' },
  langFlag: { fontSize: 28, marginRight: 14 },
  langLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#374151' },
  langLabelActive: { color: '#3363AD' },

  // Data
  dataCard: {
    padding: 16, borderRadius: 16,
    borderWidth: 1, borderColor: '#e5e7eb',
    marginBottom: 16, backgroundColor: '#ffffff',
  },
  dataCardDanger: { borderColor: '#fecaca', backgroundColor: '#fff5f5' },
  dataCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  dataCardTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  dataCardDesc: { fontSize: 13, color: '#6b7280', marginBottom: 14, lineHeight: 20 },

  // Buttons
  primaryButton: {
    backgroundColor: '#3363AD', paddingVertical: 14,
    borderRadius: 12, alignItems: 'center', marginTop: 8,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  outlineButton: {
    borderWidth: 1, borderColor: '#3363AD', paddingVertical: 10,
    borderRadius: 10, alignItems: 'center',
  },
  outlineButtonText: { color: '#3363AD', fontSize: 14, fontWeight: '600' },
  dangerButton: {
    backgroundColor: '#ef4444', paddingVertical: 10,
    borderRadius: 10, alignItems: 'center',
  },
  dangerButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});
