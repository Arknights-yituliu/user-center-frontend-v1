import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import '@mdi/font/css/materialdesignicons.css'
import { aliases, mdi } from 'vuetify/iconsets/mdi'

/** localStorage 中主题模式的存储键 */
const THEME_KEY = 'uc-theme-mode'

/** 可用主题模式：light=腾讯云蓝 orange=活力橙 */
export type ThemeMode = 'light' | 'orange'

/**
 * 读取本地主题偏好（localStorage，默认蓝色 light）
 * @returns 主题模式
 */
function loadThemeMode(): ThemeMode {
  const saved = localStorage.getItem(THEME_KEY)
  return saved === 'orange' ? 'orange' : 'light'
}

/**
 * Vuetify 实例：内置 蓝色（light）/ 橙色（orange）两套主题，mdi 图标集，全量注册组件与指令
 * - light：腾讯云蓝主色 #0052D9
 * - orange：活力橙主色 #FF6A00
 * - 内容区背景 #F7F8FA，卡片 surface 白色（两套主题共用）
 */
const vuetify = createVuetify({
  theme: {
    defaultTheme: loadThemeMode(),
    themes: {
      // 蓝色主题（默认，腾讯云控制台风格）
      light: {
        dark: false,
        colors: {
          primary: '#0052D9',
          secondary: '#0081FF',
          background: '#F7F8FA',
          surface: '#FFFFFF',
          error: '#F53F3F',
          warning: '#FF7D00',
          success: '#00B42A',
          info: '#0052D9',
        },
      },
      // 橙色主题（活力橙）
      orange: {
        dark: false,
        colors: {
          primary: '#FF6A00',
          secondary: '#FF8F1F',
          background: '#F7F8FA',
          surface: '#FFFFFF',
          error: '#F53F3F',
          warning: '#FF7D00',
          success: '#00B42A',
          info: '#FF6A00',
        },
      },
    },
  },
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: {
      mdi,
    },
  },
  components,
  directives,
})

/**
 * 切换主题模式并持久化到 localStorage
 * @param mode 目标主题模式
 */
export function setThemeMode(mode: ThemeMode): void {
  localStorage.setItem(THEME_KEY, mode)
  vuetify.theme.global.name.value = mode
}

/** 获取当前主题模式 */
export function getThemeMode(): ThemeMode {
  return loadThemeMode()
}

export default vuetify
