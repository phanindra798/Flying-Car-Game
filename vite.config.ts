import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    fs: {
      // Preserve Vite's sensitive-file defaults and keep personal notes off the LAN preview.
      deny: ['.env', '.env.*', '*.{crt,pem,key,p12,pfx,cer,der}', '.npmrc', '.yarnrc.yml', '**/.git/**', '**/.local/**'],
    },
  },
});
