import { StyleSheet, Text, View } from 'react-native';

const WINE = '#7D293B';

/** A hairline plus drawn with two thin bars (not a text glyph), inside a thin ring. */
function PlusMark({ size }: { size: number }) {
  const bar = Math.round(size * 0.36);
  return (
    <View style={[s.ring, { width: size, height: size, borderRadius: size / 2 }]}>
      <View style={[s.bar, { width: bar, height: 1.5 }]} />
      <View style={[s.bar, { width: 1.5, height: bar }]} />
    </View>
  );
}

/**
 * Empty photo state shared by Edit Story and Public View: a quiet surface with a hairline
 * plus and, optionally, a serif italic line and a small caption.
 */
export function PhotoPlaceholder({ title, caption, size = 'large' }: { title?: string; caption?: string; size?: 'large' | 'small' }) {
  const large = size === 'large';
  return (
    <View style={s.surface}>
      <PlusMark size={large ? 44 : 32} />
      {title ? <Text style={[s.title, !large && s.titleSmall]}>{title}</Text> : null}
      {caption ? <Text style={s.caption}>{caption}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  surface: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#F6EEEA' },
  ring: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(125, 41, 59, 0.35)', backgroundColor: 'rgba(255, 255, 255, 0.55)' },
  bar: { position: 'absolute', borderRadius: 1, backgroundColor: WINE },
  title: { paddingHorizontal: 16, color: '#4A2A2F', fontFamily: 'CormorantGaramondItalic', fontSize: 20, lineHeight: 24, textAlign: 'center' },
  titleSmall: { fontSize: 15, lineHeight: 19 },
  caption: { paddingHorizontal: 16, color: '#9A8580', fontFamily: 'PlusJakartaSans', fontSize: 8, fontWeight: '600', letterSpacing: 1.2, textAlign: 'center' },
});
