import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Run `npm run icons` to regenerate the PNG app icons from public/favicon.svg.
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#1f1e1d' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#1f1e1d' } },
  },
  images: ['public/favicon.svg'],
});
