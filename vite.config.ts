import { defineConfig } from 'vite';
import path from 'path';
import react from '@vitejs/plugin-react-swc';

const createConfig = (outDir: string) => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src/renderer/src"),
      "@framework": path.resolve(__dirname, "./src/renderer/WebSDK/Framework/src"),
      "@cubismsdksamples": path.resolve(__dirname, "./src/renderer/WebSDK/src"),
      "@motionsyncframework": path.resolve(
        __dirname,
        "./src/renderer/MotionSync/Framework/src",
      ),
      "@motionsync": path.resolve(__dirname, "./src/renderer/MotionSync/src"),
      "/src": path.resolve(__dirname, "./src/renderer/src"),
    },
  },
  root: path.join(__dirname, "src/renderer"),
  publicDir: path.join(__dirname, "src/renderer/public"),
  base: "./",
  server: {
    port: 3000,
  },
  build: {
    outDir: path.join(__dirname, outDir),
    emptyOutDir: true,
    assetsDir: "assets",
    rollupOptions: {
      input: {
        main: path.join(__dirname, "src/renderer/index.html"),
        live2d: path.join(__dirname, "src/renderer/index_live2d.html"),
        motionsync: path.join(__dirname, "src/renderer/index_motionsync.html"),
      },
    },
  },
});

export default defineConfig(({ mode }) => {
  if (mode === 'web') {
    return createConfig('dist/web');
  }
  return createConfig('dist/renderer');
});
