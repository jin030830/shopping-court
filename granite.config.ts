import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'shopping-court',
  brand: {
    displayName: '소비재판소', // 화면에 노출될 앱의 한글 이름
    primaryColor: '#3182F6', // 화면에 노출될 앱의 기본 색상
    icon: "", // 화면에 노출될 앱의 아이콘 이미지 주소
  },
  web: {
    host: 'localhost',
    port: 5173,
    commands: {
      dev: 'vite',
      build: 'tsc -b && vite build',
    },
  },
  permissions: [],
  outdir: 'dist',
});
