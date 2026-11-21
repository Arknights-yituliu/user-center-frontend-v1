import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

const viteServerStartedAt = new Date().toISOString()
const virtualModuleId = 'virtual:vite-server-started-at'
const resolvedVirtualModuleId = `\0${virtualModuleId}`

function viteServerStartTimePlugin(): Plugin {
  return {
    name: 'vite-server-start-time',
    resolveId(id) {
      return id === virtualModuleId ? resolvedVirtualModuleId : undefined
    },
    load(id) {
      return id === resolvedVirtualModuleId
        ? `export const viteServerStartedAt = ${JSON.stringify(viteServerStartedAt)}`
        : undefined
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    viteServerStartTimePlugin(),
    vue(),
    vueDevTools(),
  ],
  server: {
    host: '0.0.0.0',
    port: 2180,
    allowedHosts: ['zrw.asia', 'qtjpt.zrw.asia'],
  },
})
