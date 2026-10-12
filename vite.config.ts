import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 폴더가 심볼릭 링크·가상화 경로(Windows 앱 패키지 등)일 때 같은 파일이 두 경로로 잡혀
// React가 두 번 로드되는 문제를 막기 위해 실제 경로를 root로 쓴다.
const root = realpathSync.native(fileURLToPath(new URL('.', import.meta.url)));

export default defineConfig({
  root,
  plugins: [react()],
  resolve: { dedupe: ['react', 'react-dom'] },
  server: { port: 5173 },
});
