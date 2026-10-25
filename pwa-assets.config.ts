import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// The logo is full-bleed black, so the extra padding or background the preset adds is dropped
export default defineConfig({
    preset: {
        ...minimal2023Preset,
        transparent: { ...minimal2023Preset.transparent, padding: 0 },
        maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#000' } },
        apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: '#000' } },
    },
    images: ['public/favicon.svg'],
});
