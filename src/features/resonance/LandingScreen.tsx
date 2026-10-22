import { router, useFocusEffect } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BuddyScreen } from '@/features/buddy/BuddyScreen';
import { BUDDY_THEMES, useBuddyTheme } from '@/features/buddy/buddyTheme';
import { SwipeDeckScreen } from '@/features/swipes/SwipeDeckScreen';

import { takeShowBuddyNext } from './landingTab';
import { navBarHeight } from './navBar';

type Tab = 'swipes' | 'buddy' | 'profile' | 'resonance';

export function LandingScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>('buddy');
  // The tab bar follows the Buddy tab's light/dark theme while Buddy is showing.
  const { palette: buddyPalette } = useBuddyTheme();
  const nav = activeTab === 'buddy' ? buddyPalette : BUDDY_THEMES.light;

  // Coming back from your own profile (Edit Story / Public View) always shows Buddy;
  // coming back from a match's profile keeps the deck you were on.
  useFocusEffect(useCallback(() => {
    if (takeShowBuddyNext()) setActiveTab('buddy');
  }, []));

  function selectTab(tab: Tab) {
    // Profile and Resonance open their own pages; this page stays on its current tab underneath.
    if (tab === 'profile') {
      router.push('/edit-profile');
      return;
    }
    if (tab === 'resonance') {
      router.push('/resonance-reveal');
      return;
    }
    setActiveTab(tab);
  }

  return (
    <View style={[s.screen, { backgroundColor: nav.background }]}>
      {activeTab === 'swipes' ? <SwipeDeckScreen /> : null}
      {activeTab === 'buddy' ? <BuddyScreen /> : null}
      <View style={[s.bottomNav, { height: navBarHeight(insets.bottom), paddingBottom: Math.max(insets.bottom, 12), backgroundColor: nav.nav, borderTopColor: nav.navLine }]}>
        <TabButton label="Swipes" tab="swipes" activeTab={activeTab} colors={nav} icon={{ ios: 'heart', android: 'swipe', web: 'swipe' }} onPress={selectTab} />
        <TabButton label="Buddy" tab="buddy" activeTab={activeTab} colors={nav} icon={{ ios: 'bubble.left.and.bubble.right', android: 'chat_bubble', web: 'chat_bubble' }} onPress={selectTab} />
        <TabButton label="Profile" tab="profile" activeTab={activeTab} colors={nav} icon={{ ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' }} onPress={selectTab} />
        <TabButton label="Resonance" tab="resonance" activeTab={activeTab} colors={nav} icon={{ ios: 'infinity', android: 'all_inclusive', web: 'all_inclusive' }} onPress={selectTab} />
      </View>
    </View>
  );
}

function TabButton({ label, tab, activeTab, colors, icon, onPress }: {
  label: string;
  tab: Tab;
  activeTab: Tab;
  colors: { navActive: string; navIdle: string };
  icon: SymbolViewProps['name'];
  onPress: (tab: Tab) => void;
}) {
  const active = tab === activeTab;
  const tint = active ? colors.navActive : colors.navIdle;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => onPress(tab)} style={s.item}>
      <SymbolView name={icon} tintColor={tint} size={23} />
      <Text style={[s.label, { color: tint }, active && s.activeLabel]}>{label}</Text>
      <View style={[s.activeMark, active && { backgroundColor: tint }]} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FCF8F7' },
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EDE3E0',
    backgroundColor: '#FCF8F7',
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 58 },
  label: { fontSize: 10, fontWeight: '500' },
  activeLabel: { fontWeight: '700' },
  activeMark: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'transparent' },
});
