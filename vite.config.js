import { defineConfig } from 'vite';

// Serve files from ../assets as static public assets so catalog and VPC JSON are available at '/catalog.json' and '/V3TMF8.json'
export default defineConfig({
    root: '.',
    publicDir: '../assets',
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: 'index.html'
        }
    }
});
