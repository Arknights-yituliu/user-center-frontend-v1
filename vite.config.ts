import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  server: {
    // 指定开发服务器启动端口为 3000
    port: 3000,
    proxy: {
      '/uc-api': {
        target: 'https://auth.yituliu.cn',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/uc-api/, ''),
      },
    },
  },
})
