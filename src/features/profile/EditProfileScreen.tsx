import { useFonts } from 'expo-font';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { SymbolView } from 'expo-symbols';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { Easing, FadeIn, FadeInDown } from 'react-native-reanimated';
import {
  INTENT_OPTIONS,
  MAX_VIGNETTES,
  REQUIRED_LABELS,
  missingRequired,
  type Intent,
  type RequiredField,
  type Photo,
  type Vignette,
  type Visibility as VisibilitySettings,
  type VoiceReflection,
} from './profileModel';
import { PhotoPlaceholder } from './PhotoPlaceholder';
import { ProfileApiError, getProfile, polishBio, saveProfile, type ProfileDraft } from './profileApi';
import { getSessionUser } from '@/features/auth/session';
import { showBuddyNext } from '@/features/resonance/landingTab';
import { rememberProfileComplete } from './profileStatus';
import { PublicMatchProfile } from './PublicMatchProfile';
import { SnakeBorder } from './SnakeBorder';
import { VoiceReflectionEditor } from './VoiceReflectionEditor';

const C = { bg: '#FCF8F7', ink: '#251719', wine: '#521927', muted: '#78716C', line: '#ECDCDA', card: '#FAF3F1' };
type Place = { id: string; name: string; detail: string };

export function EditProfileScreen() {
  const [fontsLoaded] = useFonts({
    CormorantGaramond: require('../../../assets/fonts/CormorantGaramond[wght].ttf'),
    CormorantGaramondItalic: require('../../../assets/fonts/CormorantGaramond-Italic[wght].ttf'),
    PlusJakartaSans: require('../../../assets/fonts/PlusJakartaSans[wght].ttf'),
  });
  const [tab, setTab] = useState<'edit' | 'public'>('edit');
  // Until the profile is saved once there is nothing to preview, so the Edit Story / Public View switch stays hidden.
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([null, null, null]);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [locationQuery, setLocationQuery] = useState('');
  const [craft, setCraft] = useState('');
  const [bio, setBio] = useState('');
  const [vignettes, setVignettes] = useState<Vignette[]>([{ title: '', body: '' }]);
  const [polishing, setPolishing] = useState(false);
  // The text before the last polish, so the user can undo it.
  const [bioBeforePolish, setBioBeforePolish] = useState<string | null>(null);
  const [intent, setIntent] = useState<Intent>('Lasting intimacy');
  const [voice, setVoice] = useState<VoiceReflection>({ title: '', uri: null, durationSeconds: 0 });
  const [visibility, setVisibility] = useState<VisibilitySettings>([true, true, false]);
  // Cover photo, name, age and neighborhood are required; their hints show after the first save attempt.
  const [showMissing, setShowMissing] = useState(false);
  const missing = missingRequired({ photos, name, age, neighborhood });
  const isMissing = (field: RequiredField) => showMissing && missing.includes(field);

  // Back (header arrow or the phone's back button, from Edit Story or Public View) always
  // returns to Buddy. Before the first save there is no profile yet, and one is required,
  // so back explains what's still needed instead.
  function goToBuddy() {
    if (saved) {
      showBuddyNext();
      router.dismissTo('/landing');
      return;
    }
    setShowMissing(true);
    Alert.alert('Almost there', `Create your profile first: add ${missing.map((field) => REQUIRED_LABELS[field]).join(', ') || 'your details'}, then tap Save profile.`);
  }
  const goToBuddyRef = useRef(goToBuddy);
  useEffect(() => {
    goToBuddyRef.current = goToBuddy;
  });
  // Only while this screen is in front (not while a call is open on top of it).
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      goToBuddyRef.current();
      return true;
    });
    return () => subscription.remove();
  }, []));

  function applyDraft(draft: ProfileDraft) {
    setPhotos(draft.photos);
    setName(draft.name);
    setAge(draft.age);
    setNeighborhood(draft.neighborhood);
    setCraft(draft.craft);
    setBio(draft.bio);
    setIntent(draft.intent);
    setVoice(draft.voice);
    setVignettes(draft.vignettes.length ? draft.vignettes : [{ title: '', body: '' }]);
    setVisibility(draft.visibility);
  }

  // Load the saved profile; the first time, start empty with the account's name.
  useEffect(() => {
    let active = true;
    Promise.all([getProfile(), getSessionUser()])
      .then(([profile, user]) => {
        if (!active) return;
        if (profile) {
          applyDraft(profile);
          setSaved(true);
        } else if (user) {
          setName(user.name);
        }
      })
      .catch((error: unknown) => {
        if (active) Alert.alert('Profile', error instanceof ProfileApiError ? error.message : "We couldn't load your profile.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function save() {
    if (saving) return;
    if (missing.length > 0) {
      setShowMissing(true);
      const ageTooLow = missing.includes('age') && age.trim() !== '' && Number(age) < 18;
      Alert.alert(
        'Almost there',
        ageTooLow
          ? 'You need to be 18 or older to use Resonance.'
          : `To save your profile, add ${missing.map((field) => REQUIRED_LABELS[field]).join(', ')}.`,
      );
      return;
    }
    Keyboard.dismiss();
    setSaving(true);
    try {
      const stored = await saveProfile({ name, age, neighborhood, craft, bio, intent, voice, vignettes, visibility, photos });
      applyDraft(stored);
      setSaved(true);
      setTab('public');
      // Next launch opens Buddy instead of Edit Story.
      const user = await getSessionUser();
      if (user) await rememberProfileComplete(user.id, true);
    } catch (error) {
      Alert.alert('Profile', error instanceof ProfileApiError ? error.message : "We couldn't save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!fontsLoaded || loading) return <View style={[s.loading, s.loadingCenter]}><ActivityIndicator color={C.wine} /></View>;
  if (tab === 'public') return <SafeAreaView style={s.safe} edges={['top', 'bottom']}><PublicMatchProfile photos={photos} name={name} age={age} neighborhood={neighborhood} craft={craft} bio={bio} intent={intent} voice={voice} vignettes={vignettes.slice(0, MAX_VIGNETTES)} visibility={visibility} onEdit={() => setTab('edit')} /></SafeAreaView>;

  async function choosePhoto(index: number) {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.92 });
      if (!result.canceled && result.assets[0]) setPhotos((list) => list.map((uri, i) => i === index ? result.assets[0].uri : uri));
    } catch {
      Alert.alert('Could not open photos', 'Please try selecting an image again.');
    }
  }


  async function polish() {
    if (polishing) return;
    if (bio.trim().length < 10) {
      Alert.alert('Polish tone', 'Write a few more words first, then polish.');
      return;
    }
    Keyboard.dismiss();
    setPolishing(true);
    try {
      const polished = await polishBio(bio.trim());
      setBioBeforePolish(bio);
      setBio(polished.slice(0, 280));
    } catch (error) {
      Alert.alert('Polish tone', error instanceof ProfileApiError ? error.message : 'Something went wrong. Please try again.');
    } finally {
      setPolishing(false);
    }
  }

  function changeVisibility(index: number) {
    setVisibility((list) => list.map((value, i) => i === index ? !value : value) as VisibilitySettings);
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.page}>
        <Animated.View entering={FadeIn.duration(260)} style={s.header}>
          <View style={s.topRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={goToBuddy} style={s.back}><Text style={s.backGlyph}>‹</Text></Pressable>
            <Text style={s.screenTitle}>Edit Profile</Text>
            <View style={s.avatar}><Text style={s.avatarGlyph}>♡</Text></View>
          </View>
          {saved ? <View style={s.segment}>
            <Pressable onPress={() => setTab('edit')} style={[s.segmentTab, s.segmentActive]}><Text style={[s.segmentText, s.segmentTextActive]}>Edit Story</Text></Pressable>
            <Pressable onPress={() => setTab('public')} style={s.segmentTab}><Text style={s.segmentText}>Public View</Text></Pressable>
          </View> : null}
        </Animated.View>

        <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.duration(360).easing(Easing.out(Easing.cubic))}>
            <Section title="Visual Moments" aside={photos.filter(Boolean).length + ' of 3 moments'} italic />
            <View style={s.visualStack}>
              <PhotoSlot uri={photos[0]} cover label="COVER IMAGE" onPress={() => choosePhoto(0)} />
              {isMissing('cover') ? <Text style={s.requiredHint}>Add a cover photo to save your profile</Text> : null}
              <View style={s.photoGrid}>{photos.slice(1).map((uri, i) => <PhotoSlot key={i} uri={uri} label={'PHOTO ' + (i + 2)} onPress={() => choosePhoto(i + 1)} />)}</View>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(360).delay(50).easing(Easing.out(Easing.cubic))}>
            <Section title="Essence" />
            <View style={s.essence}>
              <Field label="NAME & AGE" value={name} onChangeText={setName} placeholder="Name as it should appear" trailing={age} onTrailingChange={setAge} trailingPlaceholder="Age"
                error={isMissing('name') ? 'Add your name' : isMissing('age') ? 'Add your age (18 or older)' : undefined} />
              <LocationField value={neighborhood} onPress={() => { setLocationQuery(neighborhood); setLocationPickerOpen(true); }} error={isMissing('neighborhood') ? 'Choose your neighborhood' : undefined} />
              <Field label="CALLING & CRAFT" value={craft} onChangeText={setCraft} placeholder="Your work, craft, or calling" icon="✧" />
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(360).delay(90).easing(Easing.out(Easing.cubic))}>
            <Section title="A Few Lines of Introduction" aside={bio.length + ' / 280'} />
            <View style={s.bioCard}>
              <TextInput accessibilityLabel="A few lines of introduction" value={bio} onChangeText={(text) => { setBio(text); setBioBeforePolish(null); }} editable={!polishing} multiline maxLength={280} placeholder="A small glimpse of what feeling at home with you might be like…" placeholderTextColor="#A8A29E" style={s.bioInput} textAlignVertical="top" />
              <View style={s.bioActions}>
                {bioBeforePolish !== null ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="Undo polish" onPress={() => { setBio(bioBeforePolish); setBioBeforePolish(null); }} style={s.undo}>
                    <Text style={s.bioHint}>Polished with AI · </Text><Text style={s.undoText}>Undo</Text>
                  </Pressable>
                ) : <Text style={s.bioHint}>Shown as your introduction to a match</Text>}
                <Pressable accessibilityRole="button" accessibilityState={{ busy: polishing }} disabled={polishing} onPress={() => void polish()} style={s.polish}>
                  {polishing ? <ActivityIndicator size="small" color="#662031" /> : <Text style={s.spark}>✧</Text>}
                  <Text style={s.polishText}>{polishing ? 'Polishing…' : 'Polish tone'}</Text>
                </Pressable>
              </View>
            </View>
            <View style={s.intentGroup}>
              <Text style={s.fieldLabel}>INTENT</Text>
              <View style={s.chipRow}>{INTENT_OPTIONS.map((option) => (
                <Pressable key={option} accessibilityRole="radio" accessibilityState={{ selected: intent === option }} onPress={() => setIntent(option)} style={[s.choiceChip, intent === option && s.choiceChipActive]}>
                  <Text style={[s.choiceChipText, intent === option && s.choiceChipTextActive]}>{option}</Text>
                </Pressable>
              ))}</View>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(360).delay(110).easing(Easing.out(Easing.cubic))}>
            <Section title="Voice Reflection" aside="Up to 30 seconds" />
            <VoiceReflectionEditor value={voice} onChange={setVoice} />
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(360).delay(130).easing(Easing.out(Easing.cubic))}>
            <View style={s.titleRow}><Section title="Curated Vignettes" />{vignettes.length < MAX_VIGNETTES ? <Pressable onPress={() => setVignettes((items) => [...items, { title: 'A little more about me', body: '' }].slice(0, MAX_VIGNETTES))} style={s.newSpark}><Text style={s.spark}>✧</Text><Text style={s.newSparkText}>New Spark</Text></Pressable> : null}</View>
            <View style={s.vignettes}>{vignettes.map((item, index) => <View key={index} style={s.vignette}>
              <TextInput value={item.title} onChangeText={(title) => setVignettes((list) => list.map((entry, i) => i === index ? { ...entry, title } : entry))} style={s.vignetteTitle} placeholder="Give this moment a title" placeholderTextColor="#A8A29E" />
              <TextInput value={item.body} onChangeText={(body) => setVignettes((list) => list.map((entry, i) => i === index ? { ...entry, body } : entry))} style={s.vignetteBody} multiline placeholder="Share a detail that feels like you…" placeholderTextColor="#8B817E" />
            </View>)}</View>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(360).delay(170).easing(Easing.out(Easing.cubic))}>
            <Text style={s.heading}>What Matches Can See</Text>
            <Text style={s.intro}>Decide what you’d like a match to see.</Text>
            <View style={s.visibilityCard}>
              <Visibility title="Vibe Deck Highlights" detail="Your interests and everyday energy" value={visibility[0]} onChange={() => changeVisibility(0)} />
              <View style={s.divider} />
              <Visibility title="Curated Value Pillars" detail="Shared values and relationship priorities" value={visibility[1]} onChange={() => changeVisibility(1)} />
              <View style={s.divider} />
              <Visibility title="Chemistry Call Reflections" detail="Private notes used to personalize matching" value={visibility[2]} onChange={() => changeVisibility(2)} privateTag />
            </View>
            <View style={s.privacyNote}><Text style={s.privacyMark}>♙</Text><Text style={s.privacyText}>Resonance never publishes raw conversations or private reflections. You choose what appears on your profile.</Text></View>
          </Animated.View>

          <View style={s.footer}>
            <Pressable accessibilityRole="button" accessibilityState={{ busy: saving, disabled: saving }} disabled={saving} onPress={() => void save()} style={[s.saveButton, saving && s.saveButtonBusy]}>
              {saving ? <ActivityIndicator color="#FFF" /> : <><Text style={s.saveText}>{saved ? 'Save changes' : 'Save profile'}</Text><Text style={s.saveArrow}>→</Text></>}
            </Pressable>
          </View>
        </ScrollView>
      </View>
      <LocationPicker
        visible={locationPickerOpen}
        query={locationQuery}
        onQueryChange={setLocationQuery}
        onClose={() => setLocationPickerOpen(false)}
        onSelect={(place) => { setNeighborhood(place); setLocationPickerOpen(false); }}
      />
    </SafeAreaView>
  );
}

function Section({ title, aside, italic }: { title: string; aside?: string; italic?: boolean }) {
  return <View style={s.sectionRow}><Text style={s.heading}>{title}</Text>{aside ? <Text style={[s.aside, italic && s.italic]}>{aside}</Text> : null}</View>;
}
function PhotoSlot({ uri, cover, label, onPress }: { uri: Photo; cover?: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={uri ? 'Change ' + label.toLowerCase() : 'Add ' + label.toLowerCase()} onPress={onPress} style={[s.photoSlot, cover ? s.cover : s.small, !uri && s.emptyPhoto, cover && s.coverBorder]}>
    {uri ? <Image source={{ uri }} contentFit="cover" style={s.photoImage} /> : <PhotoPlaceholder title={cover ? 'Add a cover photo' : undefined} caption={cover ? 'TAP TO CHOOSE' : undefined} size={cover ? 'large' : 'small'} />}
    {uri ? <View style={s.editBadge}><Text style={s.editGlyph}>✎</Text></View> : null}
    {cover ? <SnakeBorder radius={24} /> : null}
  </Pressable>;
}
function Field({ label, value, onChangeText, placeholder, icon, trailing, onTrailingChange, trailingPlaceholder, error }: {
  label: string; value: string; onChangeText: (text: string) => void; placeholder: string; icon?: string; trailing?: string; onTrailingChange?: (text: string) => void; trailingPlaceholder?: string; error?: string;
}) {
  return <View style={s.fieldGroup}><Text style={s.fieldLabel}>{label}</Text><View style={[s.fieldRow, error && s.fieldRowError]}>{icon ? <Text style={s.fieldIcon}>{icon}</Text> : null}
    <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#A8A29E" style={s.fieldInput} />
    {onTrailingChange ? <TextInput value={trailing} onChangeText={onTrailingChange} placeholder={trailingPlaceholder} placeholderTextColor="#A8A29E" keyboardType="number-pad" maxLength={2} style={s.ageInput} /> : null}
  </View>{error ? <Text style={s.requiredHint}>{error}</Text> : null}</View>;
}
function LocationField({ value, onPress, error }: { value: string; onPress: () => void; error?: string }) {
  return <View style={s.fieldGroup}>
    <Text style={s.fieldLabel}>NEIGHBORHOOD</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Choose neighborhood or city" onPress={onPress} style={[s.fieldRow, error && s.fieldRowError]}>
      <Text style={s.fieldIcon}>⌖</Text>
      <Text numberOfLines={1} style={[s.fieldInput, !value && s.locationPlaceholder]}>{value || 'Search neighborhood or city'}</Text>
      <SymbolView name={{ ios: 'chevron.down', android: 'arrow_drop_down', web: 'arrow_drop_down' }} tintColor="#7D293B" size={17} />
    </Pressable>
    {error ? <Text style={s.requiredHint}>{error}</Text> : null}
  </View>;
}
function LocationPicker({ visible, query, onQueryChange, onClose, onSelect }: {
  visible: boolean; query: string; onQueryChange: (query: string) => void; onClose: () => void; onSelect: (place: string) => void;
}) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loadingQuery, setLoadingQuery] = useState<string | null>(null);
  const [resultsQuery, setResultsQuery] = useState<string | null>(null);
  const [failedQuery, setFailedQuery] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  async function fetchCurrentLocation() {
    Keyboard.dismiss();
    setLocating(true);
    setLocationError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setLocationError('Allow location access to find your neighborhood, or search for a place instead.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const addresses = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      const address = addresses[0];
      if (!address) {
        setLocationError('We couldn’t identify a nearby address. Search for your neighborhood instead.');
        return;
      }
      const primary = address.district || address.subregion || address.city || address.name;
      const location = [primary, address.city, address.region, address.country]
        .filter((part, index, all): part is string => Boolean(part) && all.indexOf(part) === index)
        .join(', ');
      if (!location) {
        setLocationError('We couldn’t identify a nearby address. Search for your neighborhood instead.');
        return;
      }
      onSelect(location);
    } catch {
      setLocationError('Couldn’t get your location. Check that location services are on and try again.');
    } finally {
      setLocating(false);
    }
  }

  useEffect(() => {
    const trimmed = query.trim();
    if (!visible || trimmed.length < 3) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoadingQuery(trimmed);
      setFailedQuery(null);
      try {
        const params = new URLSearchParams({ q: trimmed, limit: '7', lang: 'en' });
        const response = await fetch(`https://photon.komoot.io/api/?${params.toString()}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Location search failed');
        const result = await response.json() as { features?: { properties?: Record<string, unknown>; geometry?: { coordinates?: number[] } }[] };
        const mapped = (result.features ?? []).map((feature, index) => {
          const p = feature.properties ?? {};
          const pick = (...keys: string[]) => keys.map((key) => p[key]).find((value) => typeof value === 'string' && value.trim()) as string | undefined;
          const name = pick('name', 'locality', 'district', 'city', 'county', 'state') ?? trimmed;
          const city = pick('city', 'district', 'county');
          const region = pick('state', 'country');
          const detail = [city && city !== name ? city : undefined, region && region !== city && region !== name ? region : undefined]
            .filter(Boolean).join(', ');
          const coords = feature.geometry?.coordinates;
          const id = String(p.osm_id ?? `${name}-${coords?.join(',') ?? index}`);
          return { id, name, detail };
        });
        setPlaces(mapped.filter((place, index) => mapped.findIndex((other) => other.name === place.name && other.detail === place.detail) === index));
        setResultsQuery(trimmed);
      } catch {
        if (!controller.signal.aborted) {
          setPlaces([]);
          setResultsQuery(trimmed);
          setFailedQuery(trimmed);
        }
      } finally {
        if (!controller.signal.aborted) setLoadingQuery((current) => current === trimmed ? null : current);
      }
    }, 400);

    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, visible]);

  const trimmedQuery = query.trim();
  const loading = loadingQuery === trimmedQuery;
  const searchFailed = failedQuery === trimmedQuery;
  const visiblePlaces = resultsQuery === trimmedQuery ? places : [];

  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <SafeAreaView style={s.locationModal} edges={['top', 'bottom']}>
      <View style={s.locationHeader}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close location search" onPress={onClose} style={s.locationClose}><Text style={s.locationCloseGlyph}>×</Text></Pressable>
        <View style={s.locationTitleBlock}><Text style={s.locationTitle}>Your location</Text><Text style={s.locationSubtitle}>Choose the neighborhood you call home</Text></View>
        <View style={s.locationCloseSpacer} />
      </View>
      <View style={s.locationSearchRow}>
        <Text style={s.locationSearchIcon}>⌕</Text>
        <TextInput autoFocus value={query} onChangeText={onQueryChange} placeholder="Search city or neighborhood" placeholderTextColor="#9A8D89" style={s.locationSearchInput} returnKeyType="search" autoCorrect={false} />
        {loading ? <ActivityIndicator size="small" color={C.wine} /> : query.length > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => onQueryChange('')}><Text style={s.locationClear}>×</Text></Pressable> : null}
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" style={s.locationResults}>
        <Pressable accessibilityRole="button" accessibilityLabel="Use current location" disabled={locating} onPress={() => void fetchCurrentLocation()} style={s.locationCurrent}>
          <View style={s.locationCurrentIcon}><SymbolView name={{ ios: 'location.fill', android: 'my_location', web: 'my_location' }} tintColor="#7D293B" size={19} /></View>
          <View style={s.locationResultCopy}><Text style={s.locationCurrentTitle}>Use current location</Text><Text style={s.locationPlaceDetail}>Find your neighborhood automatically</Text></View>
          {locating ? <ActivityIndicator size="small" color={C.wine} /> : <Text style={s.locationResultArrow}>›</Text>}
        </Pressable>
        {locationError ? <Text accessibilityRole="alert" style={s.locationError}>{locationError}</Text> : null}
        {visiblePlaces.map((place) => <Pressable key={place.id} accessibilityRole="button" onPress={() => onSelect([place.name, place.detail].filter(Boolean).join(', '))} style={s.locationResult}>
          <View style={s.locationPin}><Text style={s.locationPinGlyph}>⌖</Text></View>
          <View style={s.locationResultCopy}><Text numberOfLines={1} style={s.locationPlaceName}>{place.name}</Text>{place.detail ? <Text numberOfLines={1} style={s.locationPlaceDetail}>{place.detail}</Text> : null}</View>
          <Text style={s.locationResultArrow}>›</Text>
        </Pressable>)}
        {loading && places.length === 0 ? <Text style={s.locationHint}>Finding places…</Text> : null}
        {!loading && trimmedQuery.length < 3 ? <Text style={s.locationHint}>Type at least 3 characters to search.</Text> : null}
        {!loading && trimmedQuery.length >= 3 && visiblePlaces.length === 0 && !searchFailed && resultsQuery === trimmedQuery ? <Text style={s.locationHint}>No places found. Try a nearby city or landmark.</Text> : null}
        {searchFailed ? <Text style={s.locationHint}>Couldn’t reach place search. Check your connection or use the location you entered.</Text> : null}
        {query.trim().length > 0 ? <Pressable accessibilityRole="button" onPress={() => onSelect(query.trim())} style={s.locationManual}>
          <Text style={s.locationManualIcon}>＋</Text><View style={s.locationResultCopy}><Text style={s.locationPlaceName}>Use “{query.trim()}”</Text><Text style={s.locationPlaceDetail}>Keep this location as entered</Text></View>
        </Pressable> : null}
      </ScrollView>
      <Text style={s.locationAttribution}>Place search by Photon · © OpenStreetMap contributors</Text>
    </SafeAreaView>
  </Modal>;
}
function Visibility({ title, detail, value, onChange, privateTag }: { title: string; detail: string; value: boolean; onChange: () => void; privateTag?: boolean }) {
  return <View style={s.toggleRow}><View style={s.toggleCopy}><View style={s.toggleTitleRow}><Text style={s.toggleTitle}>{title}</Text>{privateTag ? <Text style={s.privateTag}>PRIVATE</Text> : null}</View><Text style={s.toggleDetail}>{detail}</Text></View><Switch value={value} onValueChange={onChange} trackColor={{ false: '#E7E5E4', true: C.wine }} thumbColor="#FFF" ios_backgroundColor="#E7E5E4" /></View>;
}

const s = StyleSheet.create({
  loading: { flex: 1, backgroundColor: C.bg }, loadingCenter: { alignItems: 'center', justifyContent: 'center' }, safe: { flex: 1, backgroundColor: C.bg }, page: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F0E4E2', backgroundColor: C.bg },
  topRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }, backGlyph: { color: C.ink, fontFamily: 'CormorantGaramond', fontSize: 34, lineHeight: 38 },
  screenTitle: { position: 'absolute', left: 78, right: 78, textAlign: 'center', color: C.ink, fontFamily: 'CormorantGaramond', fontWeight: '600', fontSize: 22 },
  avatar: { width: 32, height: 32, borderRadius: 99, backgroundColor: C.wine, alignItems: 'center', justifyContent: 'center' }, avatarGlyph: { color: '#FFF', fontSize: 16 },
  segment: { height: 38, flexDirection: 'row', alignItems: 'center', marginTop: 10, padding: 4, backgroundColor: 'rgba(239,228,226,0.7)', borderRadius: 99 }, segmentTab: { flex: 1, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 99 }, segmentActive: { backgroundColor: '#FFF', elevation: 1 }, segmentText: { color: '#57534E', fontFamily: 'PlusJakartaSans', fontSize: 11 }, segmentTextActive: { color: '#331C21', fontWeight: '700' },
  scroll: { flex: 1 }, content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 30, gap: 25 }, sectionRow: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, titleRow: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { color: '#231518', fontFamily: 'CormorantGaramond', fontSize: 23, fontWeight: '500', lineHeight: 29 }, aside: { color: C.muted, fontFamily: 'PlusJakartaSans', fontSize: 10, lineHeight: 16 }, italic: { fontFamily: 'CormorantGaramondItalic', fontSize: 14 },
  visualStack: { gap: 12, marginTop: 10 }, photoSlot: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F2E5E3', backgroundColor: '#F7F0EE' }, cover: { height: 356, borderRadius: 24 }, coverBorder: { borderColor: 'rgba(125, 41, 59, 0.18)' }, small: { flex: 1, height: 172, borderRadius: 20 }, emptyPhoto: { borderColor: '#EADDD9', backgroundColor: '#F6EEEA' }, photoGrid: { flexDirection: 'row', gap: 12 }, photoImage: { ...StyleSheet.absoluteFill, width: undefined, height: undefined },
  editBadge: { position: 'absolute', right: 10, bottom: 10, width: 28, height: 28, borderRadius: 99, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' }, editGlyph: { color: C.wine, fontSize: 14 },
  essence: { gap: 12, marginTop: 8, padding: 14, borderWidth: 1, borderColor: C.line, borderRadius: 22, backgroundColor: C.card },
  fieldGroup: { gap: 4 }, fieldRowError: { borderColor: '#9F1D2C' }, requiredHint: { color: '#9F1D2C', fontFamily: 'PlusJakartaSans', fontSize: 11, marginTop: 2 }, fieldLabel: { color: C.muted, fontFamily: 'PlusJakartaSans', fontSize: 9, fontWeight: '500', letterSpacing: 0.8 }, fieldRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 13, borderWidth: 1, borderColor: '#EFE5E3', borderRadius: 12, backgroundColor: '#FFF' }, fieldIcon: { width: 17, color: '#7D293B', fontSize: 16, textAlign: 'center' }, fieldInput: { flex: 1, paddingVertical: 8, color: '#292524', fontFamily: 'PlusJakartaSans', fontSize: 13 }, ageInput: { width: 45, paddingVertical: 7, paddingLeft: 7, color: '#292524', fontFamily: 'PlusJakartaSans', fontSize: 12, textAlign: 'right', borderLeftWidth: 1, borderColor: '#EFE5E3' },
  bioCard: { marginTop: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 13, borderWidth: 1, borderColor: '#EADBDA', borderRadius: 22, backgroundColor: '#FFF', elevation: 1 }, bioInput: { minHeight: 100, padding: 0, color: '#44403C', fontFamily: 'PlusJakartaSans', fontSize: 12, lineHeight: 21 }, bioActions: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderColor: '#F5F5F4' }, bioHint: { flex: 1, color: '#A8A29E', fontFamily: 'PlusJakartaSans', fontSize: 9, fontStyle: 'italic' },
  polish: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 }, spark: { color: '#662031', fontSize: 13 }, polishText: { color: '#662031', fontFamily: 'PlusJakartaSans', fontSize: 10, fontWeight: '700' }, newSpark: { flexDirection: 'row', alignItems: 'center', gap: 4 }, newSparkText: { color: '#662031', fontFamily: 'PlusJakartaSans', fontSize: 10, fontWeight: '700' },
  vignettes: { gap: 12, marginTop: 8 }, vignette: { gap: 6, padding: 16, borderWidth: 1, borderColor: C.line, borderRadius: 22, backgroundColor: C.card }, vignetteTitle: { padding: 0, color: '#471925', fontFamily: 'CormorantGaramond', fontSize: 18, fontWeight: '500' }, vignetteBody: { minHeight: 72, padding: 0, color: '#44403C', fontFamily: 'PlusJakartaSans', fontSize: 12, lineHeight: 19, textAlignVertical: 'top' },
  intro: { marginTop: 1, color: C.muted, fontFamily: 'PlusJakartaSans', fontSize: 10, lineHeight: 16 }, visibilityCard: { gap: 12, marginTop: 12, padding: 14, borderWidth: 1, borderColor: C.line, borderRadius: 24, backgroundColor: C.card }, toggleRow: { minHeight: 49, flexDirection: 'row', alignItems: 'center', gap: 12 }, toggleCopy: { flex: 1, gap: 3 }, toggleTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 }, toggleTitle: { color: '#2A181D', fontFamily: 'PlusJakartaSans', fontSize: 11, fontWeight: '700' }, toggleDetail: { color: C.muted, fontFamily: 'PlusJakartaSans', fontSize: 9, lineHeight: 14 }, privateTag: { overflow: 'hidden', paddingHorizontal: 5, paddingVertical: 2, color: '#7D293B', fontFamily: 'PlusJakartaSans', fontSize: 8, fontWeight: '700', backgroundColor: '#F8EAEA', borderRadius: 4 }, divider: { height: 1, backgroundColor: 'rgba(234,219,218,0.8)' },
  privacyMark: { color: '#7D293B', fontSize: 13 }, privacyNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 10, padding: 12, borderWidth: 1, borderColor: '#ECDCD3', borderRadius: 16, backgroundColor: '#F8EFEA' }, privacyText: { flex: 1, color: '#4F3C3E', fontFamily: 'PlusJakartaSans', fontSize: 10, lineHeight: 15 }, footer: { gap: 9, paddingTop: 8 },
  saveButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 99, backgroundColor: C.wine, elevation: 3 }, saveText: { color: '#FFF', fontFamily: 'PlusJakartaSans', fontSize: 12, fontWeight: '700' }, saveArrow: { color: '#FFF', fontSize: 15 },
  locationPlaceholder: { color: '#A8A29E' },
  saveButtonBusy: { opacity: 0.85 },
  undo: { flex: 1, flexDirection: 'row', alignItems: 'center' }, undoText: { color: '#662031', fontFamily: 'PlusJakartaSans', fontSize: 9, fontWeight: '700' },
  intentGroup: { gap: 8, marginTop: 12 }, chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceChip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 99, borderWidth: 1, borderColor: '#EFE5E3', backgroundColor: '#FFF' },
  choiceChipActive: { borderColor: C.wine, backgroundColor: '#F6EAE8' },
  choiceChipText: { color: '#57534E', fontFamily: 'PlusJakartaSans', fontSize: 11 },
  choiceChipTextActive: { color: C.wine, fontWeight: '700' },
  locationModal: { flex: 1, backgroundColor: C.bg }, locationHeader: { minHeight: 74, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: C.line },
  locationClose: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: '#F4E9E7' }, locationCloseGlyph: { color: C.ink, fontSize: 25, lineHeight: 28, marginTop: -2 }, locationTitleBlock: { alignItems: 'center', gap: 1 }, locationTitle: { color: C.ink, fontFamily: 'CormorantGaramond', fontSize: 22, fontWeight: '600' }, locationSubtitle: { color: C.muted, fontFamily: 'PlusJakartaSans', fontSize: 9 }, locationCloseSpacer: { width: 38 },
  locationSearchRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 18, marginTop: 18, paddingHorizontal: 14, borderWidth: 1, borderColor: '#E8D9D6', borderRadius: 15, backgroundColor: '#FFF' }, locationSearchIcon: { color: '#7D293B', fontSize: 23 }, locationSearchInput: { flex: 1, paddingVertical: 11, color: C.ink, fontFamily: 'PlusJakartaSans', fontSize: 12 }, locationClear: { color: C.muted, fontSize: 22, paddingHorizontal: 3 }, locationResults: { flex: 1, marginTop: 10, paddingHorizontal: 18 },
  locationCurrent: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#F0E7E4' }, locationCurrentIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#F6EAE8' }, locationCurrentTitle: { color: '#7D293B', fontFamily: 'PlusJakartaSans', fontSize: 12, fontWeight: '700' }, locationError: { marginTop: 10, padding: 11, color: '#7D293B', fontFamily: 'PlusJakartaSans', fontSize: 10, lineHeight: 15, borderRadius: 12, backgroundColor: '#F8EAEA' }, locationResult: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#F0E7E4' }, locationPin: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#F6EAE8' }, locationPinGlyph: { color: '#7D293B', fontSize: 18 }, locationResultCopy: { flex: 1, gap: 2 }, locationPlaceName: { color: C.ink, fontFamily: 'PlusJakartaSans', fontSize: 12, fontWeight: '600' }, locationPlaceDetail: { color: C.muted, fontFamily: 'PlusJakartaSans', fontSize: 10 }, locationResultArrow: { color: '#9A777B', fontSize: 23 }, locationHint: { paddingHorizontal: 3, paddingVertical: 20, color: C.muted, fontFamily: 'PlusJakartaSans', fontSize: 11, lineHeight: 17 }, locationManual: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#F0E7E4' }, locationManualIcon: { width: 34, color: '#7D293B', textAlign: 'center', fontSize: 22 }, locationAttribution: { paddingHorizontal: 18, paddingVertical: 12, color: '#948783', fontFamily: 'PlusJakartaSans', fontSize: 9, textAlign: 'center' },
});
