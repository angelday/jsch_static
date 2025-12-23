import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Serve files from the in-repo `assets` folder as static public assets so
// `catalog.json` and `V3TMF8.json` are available at '/assets/catalog.json' and '/assets/V3TMF8.json'
export default defineConfig({
    // project root (default) — keep '.' for clarity
    root: '.',
    // Use relative base path so the site works in any subdirectory (e.g. on a CDN)
    base: './',
    // `publicDir` must be inside the project root; use the existing `assets` folder
    publicDir: 'assets',
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                explorer: resolve(__dirname, 'vpc_explorer.html'),
            }
        }
    }
});
