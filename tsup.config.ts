import { defineConfig } from 'tsup';
import { readFileSync } from 'fs';

const sdkVersion =
  JSON.parse(readFileSync('./package.json', 'utf8')).version || '0.0.0';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  splitting: false,
  define: {
    __LMTS_SDK_VERSION__: JSON.stringify(sdkVersion),
  },
});
