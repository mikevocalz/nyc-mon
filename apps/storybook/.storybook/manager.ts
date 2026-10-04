import { addons } from 'storybook/manager-api';
import { create } from 'storybook/theming/create';

// NYC-Tron is the UI kit in packages/ui; the app built on it stays NYC-MON.
// Colours copy the brand tokens in packages/theme/tokens.ts (night, orange,
// royal, carolina, white, silver) and the dark surface/border values in
// theme.css. The manager bundle is built apart from the preview, so they are
// literals here rather than imports.
const nycTron = create({
  base: 'dark',
  brandTitle: 'NYC-Tron',

  colorPrimary: '#FC7C00',
  colorSecondary: '#4BA8F0',

  appBg: '#000212',
  appContentBg: '#00041C',
  appPreviewBg: '#00041C',
  appBorderColor: '#1A2E6E',
  appBorderRadius: 0,

  fontBase: "'Space Grotesk', system-ui, -apple-system, sans-serif",

  textColor: '#F8F8F8',
  textMutedColor: '#BEC0C2',
  textInverseColor: '#00041C',

  barBg: '#0A1230',
  barTextColor: '#BEC0C2',
  barSelectedColor: '#FC7C00',
  barHoverColor: '#4BA8F0',

  buttonBg: '#0A1230',
  buttonBorder: '#1A2E6E',
  booleanBg: '#000212',
  booleanSelectedBg: '#0058F8',

  inputBg: '#000212',
  inputBorder: '#1A2E6E',
  inputTextColor: '#F8F8F8',
  inputBorderRadius: 0,
});

addons.setConfig({ theme: nycTron });
