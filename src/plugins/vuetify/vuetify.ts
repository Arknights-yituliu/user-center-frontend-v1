import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import '@mdi/font/css/materialdesignicons.css'
import { aliases, mdi } from 'vuetify/iconsets/mdi'

/** localStorage 中主题模式的存储键 */
const THEME_KEY = 'uc-theme-mode'

/** 可用主题模式：light=晴空蓝 orange=珊瑚粉（保留旧 key 兼容已有偏好） */
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
 * Vuetify 实例：内置 晴空蓝（light）/ 珊瑚粉（orange）两套主题。
 * - light：宝蓝主色 #1976C5
 * - orange：珊瑚粉主色 #EF78A8
 * - 两套主题共用天空青背景、奶油白表面和柠檬黄提示色
 */
const vuetify = createVuetify({
  theme: {
    defaultTheme: loadThemeMode(),
    themes: {
      // 晴空蓝主题（默认）
      light: {
        dark: false,
        colors: {
          primary: '#1976C5',
          secondary: '#5BC7D4',
          background: '#EAF7F7',
          surface: '#FFFDF6',
          error: '#D94F5C',
          warning: '#FFD23F',
          success: '#36BFC8',
          info: '#1976C5',
        },
      },
      // 珊瑚粉主题（保留 orange key 兼容历史本地偏好）
      orange: {
        dark: false,
        colors: {
          primary: '#EF78A8',
          secondary: '#5BC7D4',
          background: '#EAF7F7',
          surface: '#FFFDF6',
          error: '#D94F5C',
          warning: '#FFD23F',
          success: '#36BFC8',
          info: '#EF78A8',
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
