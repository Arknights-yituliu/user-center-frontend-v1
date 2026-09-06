<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { getUcToken, logoutUcSession } from './api/uc/uc-api'
import { getThemeMode, setThemeMode, type ThemeMode } from './plugins/vuetify/vuetify'

/** 侧边导航项 */
interface NavItem {
  /** 导航标题 */
  title: string
  /** 目标路由路径 */
  to: string
  /** 前置图标（mdi 图标名） */
  icon: string
}

/** 导航分组：账号中心 */
const accountNav: NavItem[] = [
  { title: '用户信息', to: '/user/profile', icon: 'mdi-account-outline' },
  { title: '我的授权应用', to: '/user/oauth-grants', icon: 'mdi-shield-account-outline' },
  { title: '换绑邮箱', to: '/user/email', icon: 'mdi-email-sync-outline' },
  { title: '重置密码', to: '/user/retrieve', icon: 'mdi-lock-reset' },
]

/** 导航分组：开发者 */
const devNav: NavItem[] = [
  { title: '客户端管理', to: '/user/oauth-clients', icon: 'mdi-api' },
  { title: '无后端 Web 授权', to: '/user/oauth-guide', icon: 'mdi-web' },
  { title: '加密客户端授权', to: '/user/oauth-server-guide', icon: 'mdi-server-security' },
  { title: 'OAuth 用户配置', to: '/user/oauth-config-guide', icon: 'mdi-cloud-sync-outline' },
]

const route = useRoute()
const router = useRouter()

/** 登录状态（token 存 localStorage 非响应式，路由变化时重新读取） */
const loggedIn = ref(!!getUcToken())
/** 移动端侧边导航显示状态 */
const mobileNavOpen = ref(false)

/** 当前页面是否隐藏侧边栏（登录/注册/授权类全屏页面，meta.hideSidebar=true） */
const hideSidebar = computed(() => !!route.meta.hideSidebar)

watch(
  () => route.fullPath,
  () => {
    loggedIn.value = !!getUcToken()
    mobileNavOpen.value = false
  },
)

/**
 * 判断导航项是否为当前页
 * @param to 导航目标路径
 */
function isActive(to: string): boolean {
  return route.path === to
}

/** 当前主题模式（蓝色 light / 橙色 orange） */
const themeMode = ref<ThemeMode>(getThemeMode())

/**
 * 切换主题模式并持久化
 * @param mode 目标主题模式
 */
function changeTheme(mode: ThemeMode): void {
  themeMode.value = mode
  setThemeMode(mode)
}

/**
 * 退出登录：调用 UC 登出并清除本地会话，然后跳转登录页
 */
async function handleLogout(): Promise<void> {
  await logoutUcSession()
  router.push({ name: 'LOGIN' })
}
</script>

<template>
  <v-app>
    <div class="app-layout">
      <!-- 顶栏：横跨整个屏幕 -->
      <header class="app-header">
        <div class="header-left">
          <v-btn
            v-if="!hideSidebar"
            class="mobile-nav-toggle"
            variant="text"
            :icon="mobileNavOpen ? 'mdi-close' : 'mdi-menu'"
            :aria-label="mobileNavOpen ? '关闭导航菜单' : '打开导航菜单'"
            @click="mobileNavOpen = !mobileNavOpen"
          ></v-btn>
          <RouterLink to="/" class="header-brand">
            <!-- 品牌 Logo 图片 -->
            <img class="brand-logo" src="/logo.png" alt="一图流用户中心" width="24" height="24" />
            <span class="brand-text">一图流用户中心</span>
          </RouterLink>
        </div>
        <div class="header-actions">
          <!-- 主题切换菜单（蓝色 / 橙色） -->
          <v-menu location="bottom end">
            <template v-slot:activator="{ props }">
              <v-btn
                v-bind="props"
                variant="text"
                icon="mdi-palette-outline"
                class="header-btn"
                aria-label="切换主题"
              ></v-btn>
            </template>
            <v-list density="compact" min-width="160">
              <v-list-item
                :active="themeMode === 'light'"
                color="primary"
                prepend-icon="mdi-palette-swatch"
                title="蓝色主题"
                @click="changeTheme('light')"
              ></v-list-item>
              <v-list-item
                :active="themeMode === 'orange'"
                color="primary"
                prepend-icon="mdi-palette-swatch"
                title="橙色主题"
                @click="changeTheme('orange')"
              ></v-list-item>
            </v-list>
          </v-menu>

          <template v-if="loggedIn">
            <v-btn variant="text" color="primary" to="/user/profile" class="header-btn"
              >个人中心</v-btn
            >
            <v-btn variant="text" color="default" class="header-btn" @click="handleLogout"
              >退出登录</v-btn
            >
          </template>
          <v-btn v-else variant="text" color="primary" to="/account/login" class="header-btn"
            >登录</v-btn
          >
        </div>
      </header>

      <!-- 侧边导航栏 + 主内容区（顶栏下方）；登录/注册/授权类页面隐藏侧边栏 -->
      <div class="app-body">
        <button
          v-if="!hideSidebar && mobileNavOpen"
          class="sidebar-backdrop"
          type="button"
          aria-label="关闭导航菜单"
          @click="mobileNavOpen = false"
        ></button>
        <aside v-if="!hideSidebar" class="app-sidebar" :class="{ 'mobile-open': mobileNavOpen }">
          <nav class="sidebar-nav">
            <div class="nav-group-title">账号中心</div>
            <RouterLink
              v-for="item in accountNav"
              :key="item.to"
              :to="item.to"
              class="nav-item"
              :class="{ active: isActive(item.to) }"
            >
              <v-icon size="18" class="nav-icon">{{ item.icon }}</v-icon>
              <span>{{ item.title }}</span>
            </RouterLink>

            <div class="nav-group-title">开发者</div>
            <RouterLink
              v-for="item in devNav"
              :key="item.to"
              :to="item.to"
              class="nav-item"
              :class="{ active: isActive(item.to) }"
            >
              <v-icon size="18" class="nav-icon">{{ item.icon }}</v-icon>
              <span>{{ item.title }}</span>
            </RouterLink>
          </nav>
        </aside>
        <main class="app-main">
          <RouterView />
        </main>
      </div>
    </div>
  </v-app>
</template>

<style>
/* ===== 全局基础 ===== */
html,
body {
  background-color: #f7f8fa;
  min-height: 100%;
}

/* 全局字体：优先系统中文字体（腾讯云控制台风格） */
:root {
  --v-theme-font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB',
    'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif;
  --v-theme-font-size: 14px;
}

/* ===== 全局布局：顶栏（全屏宽）+ 侧边栏/主内容区 ===== */
.app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  flex: 1;
}

/* 顶栏 */
.app-header {
  height: 56px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: #ffffff;
  border-bottom: 1px solid #e5e6eb;
  z-index: 10;
}

.header-left {
  display: flex;
  align-items: center;
}

.mobile-nav-toggle {
  display: none;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  color: inherit;
}

/* 品牌 Logo 容器（尺寸由 AppLogo 组件 size prop 控制） */
.brand-logo {
  flex-shrink: 0;
}

.brand-text {
  font-size: 18px;
  font-weight: 600;
  color: #1d2129;
}

.header-btn {
  font-size: 14px;
}

/* 侧边栏 */
.app-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.app-sidebar {
  width: 220px;
  flex-shrink: 0;
  background: #ffffff;
  border-right: 1px solid #e5e6eb;
  padding: 12px 8px;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* 分组标题 */
.nav-group-title {
  font-size: 12px;
  color: #86909c;
  padding: 8px 12px 4px;
}

/* 导航项 */
.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 14px;
  color: #4e5969;
  text-decoration: none;
  border-radius: 4px;
  position: relative;
  transition:
    background-color 0.2s,
    color 0.2s;
}

.nav-item:hover {
  background-color: #f7f8fa;
  color: #1d2129;
}

.nav-item.active {
  background-color: rgb(var(--v-theme-primary) / 0.1);
  color: rgb(var(--v-theme-primary));
  font-weight: 500;
}

.nav-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 20%;
  bottom: 20%;
  width: 3px;
  border-radius: 2px;
  background-color: rgb(var(--v-theme-primary));
}

.nav-icon {
  flex-shrink: 0;
}

/* 主内容区 */
.app-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background-color: #f7f8fa;
}

.sidebar-backdrop {
  display: none;
}

/* 登录/授权类全屏居中页面：在全局布局内用 flex 撑满主内容区，避免 min-height:100vh 导致溢出 */
.login-page,
.consent-page {
  min-height: 0 !important;
  flex: 1;
}

@media (max-width: 700px) {
  .app-header {
    padding: 0 12px;
  }

  .mobile-nav-toggle {
    display: inline-flex;
    margin-right: 2px;
  }

  .brand-text {
    font-size: 16px;
  }

  .app-sidebar {
    position: fixed;
    z-index: 20;
    top: 56px;
    bottom: 0;
    left: 0;
    width: 220px;
    transform: translateX(-100%);
    box-shadow: 4px 0 12px rgb(0 0 0 / 0.12);
    transition: transform 0.2s ease;
  }

  .app-sidebar.mobile-open {
    transform: translateX(0);
  }

  .sidebar-backdrop {
    position: fixed;
    z-index: 19;
    inset: 56px 0 0;
    display: block;
    border: 0;
    background: rgb(0 0 0 / 0.3);
  }

  .app-main {
    width: 100%;
  }
}
</style>
