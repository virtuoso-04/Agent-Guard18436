import baseConfig from '@agent-guard/tailwindcss-config';
import { withUI } from '@agent-guard/ui';

export default withUI({
  ...baseConfig,
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
});
