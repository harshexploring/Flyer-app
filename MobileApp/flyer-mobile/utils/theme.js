// Shared visual language — same palette as the web app's style.css.

export const COLORS = {
  skyTop: '#8ed4ff',
  skyBottom: '#d9f2ff',
  groundTop: '#8fce5a',
  groundBottom: '#6bb244',
  groundBorder: '#7fbf4d',
  ink: '#3b3230',
  cardBg: '#fffdf7',
  panelInner: '#f4eede',
  flyBlue: '#4db3f0',
  flyBlueDark: '#2b8cc9',
  groundBrown: '#c98a4b',
  groundBrownDark: '#a06430',
  accent: '#ff9f43',
  accentDark: '#cc7a25',
  good: '#58c774',
  goodDark: '#2e9e50',
  bad: '#f0605a',
  gold: '#ffe9b3',
};

export const FONTS = {
  regular: 'Fredoka_500Medium',
  bold: 'Fredoka_700Bold',
};

// Chunky cartoon border + "3D" bottom shadow, like the web buttons.
export const cartoonBorder = (shadowColor = 'rgba(0,0,0,0.25)') => ({
  borderWidth: 3,
  borderColor: COLORS.ink,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.25,
  shadowRadius: 0,
  elevation: 4,
});
