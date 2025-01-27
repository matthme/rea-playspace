import path from 'node:path';
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts';

module.exports = defineConfig({
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,
    })
  ],
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'typed-object-tweezers',
      formats: ['es', 'umd'],
      fileName: (format) => `typed-object-tweezers.${format}.js`
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
  }
});