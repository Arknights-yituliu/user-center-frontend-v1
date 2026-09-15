<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { getUcToken, logoutUcSession } from '../api/uc/uc-api'
import { getThemeMode, setThemeMode, type ThemeMode } from '../plugins/vuetify/vuetify'

interface NavItem {
  title: string
  to: string
  icon: string
}

const accountNav: NavItem[] = [
  { title: '用户信息', to: '/user/profile', icon: 'mdi-account-outline' },
  { title: '我的授权应用', to: '/user/oauth-grants', icon: 'mdi-shield-account-outline' },
  { title: '换绑邮箱', to: '/user/email', icon: 'mdi-email-sync-outline' },
  { title: '重置密码', to: '/user/retrieve', icon: 'mdi-lock-reset' },
]

const devNav: NavItem[] = [
  { title: '客户端管理', to: '/user/oauth-clients', icon: 'mdi-api' },
  { title: '无后端 Web 授权', to: '/user/oauth-guide', icon: 'mdi-web' },
  { title: '加密客户端授权', to: '/user/oauth-server-guide', icon: 'mdi-server-security' },
  { title: 'OAuth 用户配置', to: '/user/oauth-config-guide', icon: 'mdi-cloud-sync-outline' },
]

const route = useRoute()
const router = useRouter()
const loggedIn = ref(!!getUcToken())
const mobileNavOpen = ref(false)
const hideSidebar = computed(() => !!route.meta.hideSidebar)
const themeMode = ref<ThemeMode>(getThemeMode())

watch(
  () => route.fullPath,
  () => {
    loggedIn.value = !!getUcToken()
    mobileNavOpen.value = false
  },
)

function isActive(to: string): boolean {
  return (
    route.path === to ||
    route.path === `/classic${to}` ||
    (to === '/user/profile' && route.path === '/classic/')
  )
}

function changeTheme(mode: ThemeMode): void {
  themeMode.value = mode
  setThemeMode(mode)
}

async function handleLogout(): Promise<void> {
  await logoutUcSession()
  router.push({ name: 'LOGIN' })
}
</script>

<template>
  <div class="classic-layout">
    <header class="classic-header">
      <div class="classic-header-left">
        <v-btn
          v-if="!hideSidebar"
          class="classic-mobile-nav-toggle"
          variant="text"
          :icon="mobileNavOpen ? 'mdi-close' : 'mdi-menu'"
          :aria-label="mobileNavOpen ? '关闭导航菜单' : '打开导航菜单'"
          @click="mobileNavOpen = !mobileNavOpen"
        ></v-btn>
        <RouterLink to="/" class="classic-header-brand">
          <img src="/logo.svg" alt="一图流用户中心" width="24" height="24" />
          <span>一图流用户中心</span>
        </RouterLink>
      </div>

      <div class="classic-header-actions">
        <v-menu location="bottom end">
          <template v-slot:activator="{ props }">
            <v-btn
              v-bind="props"
              variant="text"
              icon="mdi-palette-outline"
              class="classic-header-btn"
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
          <v-btn variant="text" color="primary" to="/user/profile" class="classic-header-btn"
            >个人中心</v-btn
          >
          <v-btn variant="text" color="default" class="classic-header-btn" @click="handleLogout"
            >退出登录</v-btn
          >
        </template>
        <v-btn v-else variant="text" color="primary" to="/account/login" class="classic-header-btn"
          >登录</v-btn
        >
      </div>
    </header>

    <div class="classic-body">
      <button
        v-if="!hideSidebar && mobileNavOpen"
        class="classic-sidebar-backdrop"
        type="button"
        aria-label="关闭导航菜单"
        @click="mobileNavOpen = false"
      ></button>
      <aside
        v-if="!hideSidebar"
        class="classic-sidebar"
        :class="{ 'classic-mobile-open': mobileNavOpen }"
      >
        <nav class="classic-sidebar-nav">
          <div class="classic-nav-group-title">账号中心</div>
          <RouterLink
            v-for="item in accountNav"
            :key="item.to"
            :to="item.to"
            class="classic-nav-item"
            :class="{ active: isActive(item.to) }"
          >
            <v-icon size="18" class="classic-nav-icon">{{ item.icon }}</v-icon>
            <span>{{ item.title }}</span>
          </RouterLink>

          <div class="classic-nav-group-title">开发者</div>
          <RouterLink
            v-for="item in devNav"
            :key="item.to"
            :to="item.to"
            class="classic-nav-item"
            :class="{ active: isActive(item.to) }"
          >
            <v-icon size="18" class="classic-nav-icon">{{ item.icon }}</v-icon>
            <span>{{ item.title }}</span>
          </RouterLink>
        </nav>
      </aside>
      <main class="classic-main">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style>
.classic-layout {
  display: flex;
  min-height: 100vh;
  flex-direction: column;
  background: #f7f8fa;
  color: #1d2129;
}

.classic-header {
  z-index: 10;
  display: flex;
  height: 56px;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  border-bottom: 1px solid #e5e6eb;
  background: #ffffff;
}

.classic-header-left,
.classic-header-actions,
.classic-header-brand {
  display: flex;
  align-items: center;
}

.classic-header-left {
  gap: 0;
}

.classic-header-brand {
  gap: 8px;
  color: inherit;
  text-decoration: none;
}

.classic-header-brand img {
  flex-shrink: 0;
}

.classic-header-brand span {
  color: #1d2129;
  font-size: 18px;
  font-weight: 600;
}

.classic-header-actions {
  gap: 4px;
}

.classic-mobile-nav-toggle {
  display: none;
}

.classic-header-btn {
  font-size: 14px;
}

.classic-body {
  display: flex;
  min-height: 0;
  flex: 1;
}

.classic-sidebar {
  width: 220px;
  flex-shrink: 0;
  padding: 12px 8px;
  border-right: 1px solid #e5e6eb;
  background: #ffffff;
}

.classic-sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.classic-nav-group-title {
  padding: 8px 12px 4px;
  color: #86909c;
  font-size: 12px;
}

.classic-nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 4px;
  color: #4e5969;
  font-size: 14px;
  text-decoration: none;
  transition:
    background-color 0.2s,
    color 0.2s;
}

.classic-nav-item:hover {
  background: #f7f8fa;
  color: #1d2129;
}

.classic-nav-item.active {
  background: rgb(var(--v-theme-primary) / 0.1);
  color: rgb(var(--v-theme-primary));
  font-weight: 500;
}

.classic-nav-item.active::before {
  position: absolute;
  top: 20%;
  bottom: 20%;
  left: 0;
  width: 3px;
  border-radius: 2px;
  background: rgb(var(--v-theme-primary));
  content: '';
}

.classic-nav-icon {
  flex-shrink: 0;
}

.classic-main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  background: #f7f8fa;
}

.classic-sidebar-backdrop {
  display: none;
}

@media (max-width: 700px) {
  .classic-header {
    padding: 0 12px;
  }

  .classic-mobile-nav-toggle {
    display: inline-flex;
    margin-right: 2px;
  }

  .classic-header-brand span {
    font-size: 16px;
  }

  .classic-sidebar {
    position: fixed;
    z-index: 20;
    top: 56px;
    bottom: 0;
    left: 0;
    width: 220px;
    box-shadow: 4px 0 12px rgb(0 0 0 / 0.12);
    transform: translateX(-100%);
    transition: transform 0.2s ease;
  }

  .classic-sidebar.classic-mobile-open {
    transform: translateX(0);
  }

  .classic-sidebar-backdrop {
    position: fixed;
    z-index: 19;
    inset: 56px 0 0;
    display: block;
    border: 0;
    background: rgb(0 0 0 / 0.3);
  }

  .classic-main {
    width: 100%;
  }
}
</style>
