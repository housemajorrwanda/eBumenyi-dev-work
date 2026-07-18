import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { LinearGradient } from 'expo-linear-gradient';
import TextField from '@/components/TextField';
import { User, Phone, MapPin, IdCardIcon, Calendar } from 'lucide-react-native';
import Dropdown, { DropdownItem } from '@/components/Dropdown';
import { assets } from '@/theme';
import * as locationsModule from '@/utils/locations';
import { fixUppercaseNames } from '@/utils/format';
import Button from '@/components/Button';
import DatePickerModal from '@/components/common/DatePickerModal';
import { signup } from '@/services/auth';
import { getAllHospitals } from '@/services/location';
import { handleResponse } from '@/utils/responseHandler';

// locationsModule exports a `locations` object with nested provinces -> districts -> sectors -> cells -> villages
const rootLocations = (locationsModule as any).locations || {};
// normalize any fully-uppercase names in the locations data
fixUppercaseNames(rootLocations);
const provincesData = rootLocations.provinces || [];

export default function SignupScreen() {
  const router = useRouter();
  const { isDark, themeColors } = useTheme();
  const { t } = useLanguage();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [NID, setNID] = useState('');
  // field-level errors
  // use undefined to match TextField error prop (string | boolean | undefined)
  const [fullNameError, setFullNameError] = useState<string | undefined>(
    undefined,
  );
  const [phoneError, setPhoneError] = useState<string | undefined>(undefined);
  const [NIDError, setNIDError] = useState<string | undefined>(undefined);
  const [districtError, setDistrictError] = useState<string | undefined>(undefined);
  const [sectorError, setSectorError] = useState<string | undefined>(undefined);
  const [hospitalError, setHospitalError] = useState<string | undefined>(undefined);
  const [birthdateError, setBirthdateError] = useState<string | undefined>(undefined);
  const [genderError, setGenderError] = useState<string | undefined>(undefined);
  const [roleError, setRoleError] = useState<string | undefined>(undefined);
  const [gender, setGender] = useState<string>('');
  const [roles, setRoles] = useState<string[]>([]);
  const [district, setDistrict] = useState('');
  const [sector, setSector] = useState('');
  const [cell, setCell] = useState('');
  const [village, setVillage] = useState('');
  const [districtOptions, setDistrictOptions] = useState<DropdownItem[]>([]);
  const [sectorOptions, setSectorOptions] = useState<DropdownItem[]>([]);
  const [cellOptions, setCellOptions] = useState<DropdownItem[]>([]);
  const [villageOptions, setVillageOptions] = useState<DropdownItem[]>([]);
  const [birthdate, setBirthdate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [birthDateObj, setBirthDateObj] = useState<Date | undefined>(undefined);
  const [hospital, setHospital] = useState('');
  const [hospitalOptions, setHospitalOptions] = useState<DropdownItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHospitals = async (params: {
    district?: string;
    sector?: string;
    cell?: string;
    village?: string;
  }) => {
    try {
      const res = await getAllHospitals(params);
      const hospitals = Array.isArray(res?.data) ? res.data : res;
      setHospitalOptions(
        (hospitals || []).map(
          (h: any) => ({ id: h.id, label: h.name }) as DropdownItem,
        ),
      );
    } catch (err) {
      console.error('[signup] error loading hospitals:', err);
    }
  };

  // populate district options from all provinces on mount and load all hospitals
  useEffect(() => {
    const allDistricts = provincesData.flatMap((p: any) => p.districts || []);
    setDistrictOptions(
      allDistricts.map((d: any) => ({ id: d.name, label: d.name })),
    );
    fetchHospitals({});
  }, []);

  // Helper functions to resolve names from ids/names in the provinces data
  const findDistrictName = (idOrName: string) => {
    for (const prov of provincesData) {
      for (const d of prov.districts || []) {
        if ((d.id && String(d.id) === idOrName) || d.name === idOrName)
          return d.name;
      }
    }
    return idOrName;
  };

  const findSectorName = (idOrName: string) => {
    for (const prov of provincesData) {
      for (const d of prov.districts || []) {
        for (const s of d.sectors || []) {
          if ((s.id && String(s.id) === idOrName) || s.name === idOrName)
            return s.name;
        }
      }
    }
    return idOrName;
  };

  const findCellName = (idOrName: string) => {
    for (const prov of provincesData) {
      for (const d of prov.districts || []) {
        for (const s of d.sectors || []) {
          for (const c of s.cells || []) {
            if ((c.id && String(c.id) === idOrName) || c.name === idOrName)
              return c.name;
          }
        }
      }
    }
    return idOrName;
  };

  const findVillageName = (idOrName: string) => {
    for (const prov of provincesData) {
      for (const d of prov.districts || []) {
        for (const s of d.sectors || []) {
          for (const c of s.cells || []) {
            for (const v of c.villages || []) {
              if ((v.id && String(v.id) === idOrName) || v.name === idOrName)
                return v.name;
            }
          }
        }
      }
    }
    return idOrName;
  };

  const handleSignup = async () => {
    // clear previous field errors
    setFullNameError(undefined);
    setPhoneError(undefined);
    setNIDError(undefined);
    setDistrictError(undefined);
    setSectorError(undefined);
    setHospitalError(undefined);
    setBirthdateError(undefined);
    setGenderError(undefined);
    setRoleError(undefined);

    // Validate every field up front so all applicable errors show at once,
    // rather than bailing out on the first failing field and hiding the rest.
    let hasError = false;

    if (!fullName) {
      setFullNameError(t('nameRequired'));
      hasError = true;
    }

    const cleanedPhone = phone.replace(/\D/g, '');
    const localPrefixes = ['078', '079', '072', '073'];
    const intlPrefixes = localPrefixes.map((p) => '250' + p.slice(1));
    const validLocal =
      cleanedPhone.length === 10 &&
      localPrefixes.some((p) => cleanedPhone.startsWith(p));
    const validIntl =
      cleanedPhone.length === 12 &&
      intlPrefixes.some((p) => cleanedPhone.startsWith(p));
    if (!phone) {
      setPhoneError(t('phoneRequired'));
      hasError = true;
    } else if (!(validLocal || validIntl)) {
      setPhoneError(t('invalidPhone'));
      hasError = true;
    }

    // Rwanda NID: 16 digits, starts with 1
    const cleanedNID = (NID || '').toString().trim();
    if (!cleanedNID) {
      setNIDError(t('nidRequired'));
      hasError = true;
    } else if (cleanedNID.length !== 16 || !/^1\d{15}$/.test(cleanedNID)) {
      setNIDError(t('invalidNID'));
      hasError = true;
    }

    if (!district) {
      setDistrictError(t('districtRequired'));
      hasError = true;
    }
    if (!sector) {
      setSectorError(t('sectorRequired'));
      hasError = true;
    }
    if (!hospital) {
      setHospitalError(t('hospitalRequired'));
      hasError = true;
    }
    if (!birthdate) {
      setBirthdateError(t('birthdateRequired'));
      hasError = true;
    }
    if (!gender) {
      setGenderError(t('genderRequired'));
      hasError = true;
    }
    if (!roles || roles.length === 0) {
      setRoleError(t('roleRequired'));
      hasError = true;
    }

    if (hasError) return;

    let sendPhone = cleanedPhone;
    if (cleanedPhone.startsWith('250') && cleanedPhone.length >= 11) {
      sendPhone = '0' + cleanedPhone.slice(3);
    }

    const payload = {
      fullNames: fullName,
      phoneNumber: sendPhone,
      NID: cleanedNID,
      gender: gender,
      district: findDistrictName(district),
      sector: findSectorName(sector),
      cell: findCellName(cell),
      village: findVillageName(village),
      birthdate: birthdate || undefined,
      hospitalId: hospital || undefined,
      role: roles && roles.length ? roles[0] : undefined,
      // bio, audio, video will be added in upload-video step
    };
    // directly call signup endpoint (no separate upload step)
    setLoading(true);
    try {
      const res = await signup(payload);
      const ok = handleResponse({ response: res });
      if (ok) {
        // registration succeeded - go to login
        router.replace('/auth/login');
      }
    } catch (err: any) {
      handleResponse({ response: err?.response ?? err });
    } finally {
      setLoading(false);
    }
  };

  const topSpacer = Dimensions.get('window').height * 0.12;

  return (
    <KeyboardAvoidingView
      style={[
        styles.container,
        { backgroundColor: isDark ? '#111827' : themeColors.primary },
      ]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 0 }}
        keyboardShouldPersistTaps="handled"
      >
        <LinearGradient
          colors={
            isDark
              ? [themeColors.primary, '#1e1b4b']
              : [themeColors.primary, themeColors.primary]
          }
          style={[styles.header, { paddingTop: topSpacer }]}
        >
          <Text style={[styles.headerTitle, { fontFamily: 'Inter-Bold' }]}>
            {t('signup.title')}
          </Text>
          <Text
            style={[styles.headerSubtitle, { fontFamily: 'Inter-Regular' }]}
          >
            {t('signup.subtitle')}
          </Text>
        </LinearGradient>

        <View style={styles.form}>
          <TextField
            label={t('signup.fullName')}
            value={fullName}
            onChangeText={(v) => {
              setFullName(v);
              setFullNameError(undefined);
            }}
            placeholder={t('signup.fullName')}
            labelColor="#d1d5db"
            icon={
              <User
                color={isDark ? '#d1d5db' : themeColors.primary70}
                size={18}
              />
            }
            error={fullNameError}
          />

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Dropdown
                label={t('signup.gender.label')}
                items={[
                  {
                    id: 'male',
                    label: t('signup.gender.male'),
                    icon: <Text>👨</Text>,
                  },
                  {
                    id: 'female',
                    label: t('signup.gender.female'),
                    icon: <Text>👩</Text>,
                  },
                ]}
                value={gender}
                onChange={(val) => {
                  setGender(val as string);
                  setGenderError(undefined);
                }}
                placeholder={t('signup.gender.label')}
                icon={
                  <User
                    color={isDark ? '#d1d5db' : themeColors.primary70}
                    size={18}
                  />
                }
                multiple={false}
                showIcons
                labelColor="#d1d5db"
                error={genderError}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Dropdown
                label={t('signup.role') || 'Role'}
                items={[
                  { id: 'TRAINEE', label: t('roles.trainee') || 'Trainee' },
                  { id: 'TESTER', label: t('roles.tester') || 'Tester' },
                ]}
                value={roles}
                onChange={(val) => {
                  setRoles(
                    Array.isArray(val) ? (val as string[]) : [val as string],
                  );
                  setRoleError(undefined);
                }}
                placeholder={t('signup.role.placeholder') || 'Select role'}
                multiple={false}
                labelColor="#d1d5db"
                error={roleError}
              />
            </View>
          </View>

          <TextField
            label={t('signup.id')}
            value={NID}
            onChangeText={(v) => {
              setNID(v);
              setNIDError(undefined);
            }}
            placeholder={t('signup.id')}
            labelColor="#d1d5db"
            keyboardType="phone-pad"
            icon={
              <IdCardIcon
                color={isDark ? '#d1d5db' : themeColors.primary70}
                size={18}
              />
            }
            error={NIDError}
          />

          <View style={{ flexDirection: 'row', marginBottom: 12 }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <TextField
                label={t('signup.phone')}
                value={phone}
                onChangeText={(v) => {
                  setPhone(v);
                  setPhoneError(undefined);
                }}
                placeholder={t('signup.phoneplaceholder')}
                labelColor="#d1d5db"
                keyboardType="phone-pad"
                icon={
                  <Phone
                    color={isDark ? '#d1d5db' : themeColors.primary70}
                    size={18}
                  />
                }
                error={phoneError}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={{ color: '#d1d5db', marginBottom: 8, fontSize: 14, fontFamily: 'Inter-Medium' }}>
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
                  borderColor: birthdateError ? '#ef4444' : ((themeColors as any).cardSubtitle ?? (isDark ? '#374151' : '#d1d5db')),
                  backgroundColor: (themeColors as any).cardBg ?? (isDark ? '#111827' : '#ffffff'),
                }}
                onPress={() => setShowDatePicker(true)}
              >
                <Calendar
                  color={isDark ? '#d1d5db' : (themeColors as any).primary70}
                  size={18}
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={{
                    fontSize: 16,
                    fontFamily: 'Inter-Regular',
                    color: birthdate
                      ? (themeColors as any).cardText ?? (isDark ? '#ffffff' : '#111827')
                      : isDark ? '#6b7280' : (themeColors as any).primary70,
                  }}
                >
                  {birthdate || 'YYYY-MM-DD'}
                </Text>
              </TouchableOpacity>
              {birthdateError ? (
                <Text style={{ color: '#ef4444', marginTop: 6, fontSize: 12 }}>{birthdateError}</Text>
              ) : null}
              <DatePickerModal
                visible={showDatePicker}
                value={birthDateObj || new Date(1990, 0, 1)}
                onConfirm={(selectedDate) => {
                  setBirthDateObj(selectedDate);
                  const y = selectedDate.getFullYear();
                  const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
                  const d = String(selectedDate.getDate()).padStart(2, '0');
                  setBirthdate(`${y}-${m}-${d}`);
                  setBirthdateError(undefined);
                  setShowDatePicker(false);
                }}
                onCancel={() => setShowDatePicker(false)}
                maximumDate={new Date()}
                minimumDate={new Date(1900, 0, 1)}
                title={t('signup.dob') || 'Date of Birth'}
              />
            </View>
          </View>

          {/* District dropdown (province selection removed) */}
          <View style={{ flexDirection: 'row', marginBottom: 12 }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Dropdown
                label={t('district')}
                items={districtOptions}
                value={district}
                onChange={(val) => {
                  const v = val as string;
                  setDistrict(v);
                  setDistrictError(undefined);
                  setSector('');
                  setCell('');
                  setVillage('');
                  setHospital('');
                  fetchHospitals({ district: v });
                  // find district object across provinces
                  let foundDistrict: any = null;
                  for (const prov of provincesData) {
                    const fd = (prov.districts || []).find(
                      (d: any) => d.id === v || d.name === v,
                    );
                    if (fd) {
                      foundDistrict = fd;
                      break;
                    }
                  }
                  const sectorList =
                    foundDistrict && foundDistrict.sectors
                      ? foundDistrict.sectors
                      : [];
                  setSectorOptions(
                    sectorList.map((s: any) => ({
                      id: s.id || s.name,
                      label: s.name,
                    })),
                  );
                  setCellOptions([]);
                  setVillageOptions([]);
                }}
                placeholder={t('district.placeholder')}
                icon={
                  <MapPin
                    color={isDark ? '#d1d5db' : themeColors.primary70}
                    size={18}
                  />
                }
                multiple={false}
                labelColor="#d1d5db"
                error={districtError}
                // searchable={true}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Dropdown
                label={t('sector')}
                items={sectorOptions}
                value={sector}
                onChange={(val) => {
                  const v = val as string;
                  setSector(v);
                  setSectorError(undefined);
                  setCell('');
                  setVillage('');
                  // find sector object across provinces/districts
                  let foundSector: any = null;
                  for (const prov of provincesData) {
                    for (const d of prov.districts || []) {
                      const fs = (d.sectors || []).find(
                        (s: any) => s.id === v || s.name === v,
                      );
                      if (fs) {
                        foundSector = fs;
                        break;
                      }
                    }
                    if (foundSector) break;
                  }
                  const cells =
                    foundSector && foundSector.cells ? foundSector.cells : [];
                  setCellOptions(
                    cells.map((c: any) => ({
                      id: c.id || c.name,
                      label: c.name,
                    })),
                  );
                  setVillageOptions([]);
                }}
                placeholder={t('sector.placeholder')}
                icon={
                  <MapPin
                    color={isDark ? '#d1d5db' : themeColors.primary70}
                    size={18}
                  />
                }
                multiple={false}
                labelColor="#d1d5db"
                error={sectorError}
                // searchable={true}
              />
            </View>
          </View>
          {/* Sector (left) -> Cell (right) */}
          <View style={{ flexDirection: 'row', marginBottom: 12 }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Dropdown
                label={t('cell')}
                items={cellOptions}
                value={cell}
                onChange={(val) => {
                  const v = val as string;
                  setCell(v);
                  setVillage('');
                  // find cell object across provinces/districts/sectors
                  let foundCell: any = null;
                  for (const prov of provincesData) {
                    for (const d of prov.districts || []) {
                      for (const s of d.sectors || []) {
                        const fc = (s.cells || []).find(
                          (c: any) => c.id === v || c.name === v,
                        );
                        if (fc) {
                          foundCell = fc;
                          break;
                        }
                      }
                      if (foundCell) break;
                    }
                    if (foundCell) break;
                  }
                  const villages =
                    foundCell && foundCell.villages ? foundCell.villages : [];
                  setVillageOptions(
                    villages.map((c: any) => ({
                      id: c.id || c.name,
                      label: c.name,
                    })),
                  );
                }}
                placeholder={
                  cellOptions.length
                    ? t('cell.placeholder')
                    : t('cell.placeholder')
                }
                icon={
                  <MapPin
                    color={isDark ? '#d1d5db' : themeColors.primary70}
                    size={18}
                  />
                }
                multiple={false}
                labelColor="#d1d5db"
                // searchable={true}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Dropdown
                label={t('village')}
                items={villageOptions}
                value={village}
                onChange={(val) => {
                  const v = val as string;
                  setVillage(v);
                }}
                placeholder={
                  villageOptions.length
                    ? t('village.placeholder')
                    : t('village.placeholder')
                }
                icon={
                  <MapPin
                    color={isDark ? '#d1d5db' : themeColors.primary70}
                    size={18}
                  />
                }
                multiple={false}
                labelColor="#d1d5db"
                // searchable={true}
              />
            </View>
          </View>

          {/* Hospital picker — server-filtered by selected district/sector/cell/village */}
          <View style={{ marginBottom: 12 }}>
            <Dropdown
              label={t('signup.hospital') || 'Hospital'}
              items={hospitalOptions}
              value={hospital}
              onChange={(val) => {
                setHospital(val as string);
                setHospitalError(undefined);
              }}
              placeholder={
                hospitalOptions.length
                  ? t('signup.hospital.placeholder') || 'Select hospital'
                  : t('signup.hospital.none') || 'No hospitals'
              }
              multiple={false}
              labelColor="#d1d5db"
              error={hospitalError}
            />
          </View>

          <Button
            title="Iyandikishe"
            onPress={handleSignup}
            variant="secondary"
            style={{ marginTop: 16 }}
            loading={loading}
            disabled={loading}
            icon={
              <Image
                source={assets.loginIcon}
                style={{ width: 18, height: 18, tintColor: '#fff' }}
              />
            }
          />

          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => router.back()}
          >
            <Text
              style={[
                styles.loginText,
                {
                  fontFamily: 'Inter-Regular',
                  color: isDark ? '#d1d5db' : '#d1d5db',
                },
              ]}
            >
              {t('alreadyHaveAccount')}
              <Text
                style={{
                  color: isDark ? '#6366f1' : '#d1d5db',
                  fontFamily: 'Inter-SemiBold',
                }}
              >
                {' '}
                {t('login')}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 28,
    color: 'white',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
  },
  form: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  inputButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    justifyContent: 'center',
    height: 44,
  },
  inputText: {
    fontSize: 16,
  },
  genderSection: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  genderButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  genderIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderText: {
    fontSize: 14,
  },
  signupButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  signupButtonText: {
    color: 'white',
    fontSize: 16,
  },
  loginLink: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  loginText: {
    fontSize: 14,
  },
});
