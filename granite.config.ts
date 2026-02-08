import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'shopping-court',
  brand: {
    displayName: '소비재판소', // 화면에 노출될 앱의 한글 이름
    primaryColor: '#3182F6', // 화면에 노출될 앱의 기본 색상
    icon: "https://static.toss.im/appsintoss/15155/4dfa3fe7-556e-424d-820a-61a865a49168.png", // 화면에 노출될 앱의 아이콘 이미지 주소
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
