import { defineConfig } from 'vite';

export default defineConfig({
  // 상대 경로로 빌드해야 Cloudflare Pages / Capacitor 양쪽에서 동작한다.
  base: './',
  server: {
    // 같은 와이파이의 휴대폰에서도 접속해 볼 수 있도록 네트워크에 공개한다.
    host: true,
    port: 5173,
  },
});
