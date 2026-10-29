import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Storybook builds with this, not with the app's: no Worker, no router plugin, no service worker
export default defineConfig({
    plugins: [react()],
    resolve: { dedupe: ['react', 'react-dom'], tsconfigPaths: true },
});
