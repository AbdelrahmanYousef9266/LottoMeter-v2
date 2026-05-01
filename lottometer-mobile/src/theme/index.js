export const Colors = {
  background:    '#F6FAFF',
  surface:       '#FFFFFF',
  primary:       '#0077CC',
  primaryDark:   '#005FA3',
  primaryLight:  '#E6F2FF',
  accent:        '#2DAE1A',
  accentDark:    '#229113',
  accentLight:   '#EDFBEA',
  textPrimary:   '#0A1128',
  textSecondary: '#46627F',
  textMuted:     '#8FA3B8',
  border:        '#DDE6F0',
  inputBg:       '#F0F5FB',
  error:         '#DC2626',
  errorBg:       '#FEF2F2',
  errorBorder:   '#FCA5A5',
  warning:       '#D97706',
  warningBg:     '#FFFBEB',
  success:       '#2DAE1A',
  successBg:     '#EDFBEA',
  overlay:       'rgba(10, 17, 40, 0.5)',
};

export const Gradient = {
  primary: ['#0077CC', '#2DAE1A'],
};

export const Radius = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  full: 999,
};

export const Shadow = {
  card: {
    shadowColor: '#0A1128',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  sm: {
    shadowColor: '#0A1128',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
};

export const Typography = {
  h1:        { fontSize: 28, fontWeight: '700', color: '#0A1128' },
  h2:        { fontSize: 22, fontWeight: '700', color: '#0A1128' },
  h3:        { fontSize: 18, fontWeight: '600', color: '#0A1128' },
  body:      { fontSize: 15, fontWeight: '400', color: '#0A1128', lineHeight: 22 },
  bodySmall: { fontSize: 13, fontWeight: '400', color: '#46627F', lineHeight: 19 },
  label:     { fontSize: 13, fontWeight: '600', color: '#46627F', letterSpacing: 0.2 },
  caption:   { fontSize: 11, fontWeight: '500', color: '#8FA3B8', letterSpacing: 0.3 },
};
