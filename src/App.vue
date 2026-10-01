<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { getUcToken } from './api/user-center/request'
import { logoutUcSession } from './api/user-center/user-api'
import ClassicShell from './components/ClassicShell.vue'

const route = useRoute()
const router = useRouter()
const loggedIn = ref(!!getUcToken())
const mobileNavigationOpen = ref(false)

const siteNavigation = [
  { to: '/home', label: '个人中心', icon: 'mdi-account-circle-outline' },
  { to: '/projects', label: '工具列表', icon: 'mdi-view-grid-outline' },
  { to: '/common-data', label: '通用数据', icon: 'mdi-database-cog-outline' },
  { to: '/user-guide', label: '用户指南', icon: 'mdi-book-open-variant-outline' },
  { to: '/developer', label: '开发者中心', icon: 'mdi-console-line' },
  { to: '/about', label: '关于', icon: 'mdi-information-outline' },
]

const hideNavigation = computed(() => !!route.meta.hideSidebar)
const classicMode = computed(() => !!route.meta.classicShell)
const isLanding = computed(() => route.name === 'LANDING')

watch(
  () => route.fullPath,
  () => {
    loggedIn.value = !!getUcToken()
    mobileNavigationOpen.value = false
  },
)

function isNavigationActive(path: string): boolean {
  return route.path === path || route.path.startsWith(`${path}/`)
}

function toggleMobileNavigation(): void {
  mobileNavigationOpen.value = !mobileNavigationOpen.value
}

function closeMobileNavigation(): void {
  mobileNavigationOpen.value = false
}

async function handleLogout(): Promise<void> {
  await logoutUcSession()
  router.push({ name: 'LOGIN' })
}
</script>

<template>
  <v-app>
    <ClassicShell v-if="classicMode" />
    <div v-else class="site-shell" :class="{ 'site-shell-landing': isLanding }">
      <header v-if="!isLanding" class="site-header">
        <div class="header-inner">
          <nav class="header-primary" aria-label="主导航">
            <RouterLink to="/" class="brand" @click="closeMobileNavigation">
              <span class="brand-mark">
                <img src="/logo.svg" alt="" width="30" height="30" />
              </span>
              <span class="brand-copy">
                <strong>酸橙云</strong>
                <small>THIS LAND CLOUD</small>
              </span>
            </RouterLink>

            <RouterLink
              v-for="item in siteNavigation"
              :key="item.to"
              class="site-nav-link"
              :class="{ 'site-nav-link-active': isNavigationActive(item.to) }"
              :to="item.to"
              :aria-current="isNavigationActive(item.to) ? 'page' : undefined"
            >
              <v-icon :icon="item.icon" size="17" aria-hidden="true"></v-icon>
              <span>{{ item.label }}</span>
            </RouterLink>
          </nav>

          <div class="header-actions">
            <button
              class="site-nav-toggle"
              type="button"
              aria-label="打开页面导航"
              aria-controls="site-mobile-nav"
              :aria-expanded="mobileNavigationOpen"
              @click="toggleMobileNavigation"
            >
              <v-icon :icon="mobileNavigationOpen ? 'mdi-close' : 'mdi-menu'"></v-icon>
            </button>
            <template v-if="loggedIn">
              <RouterLink
                v-if="hideNavigation"
                to="/home"
                class="header-user"
                @click="closeMobileNavigation"
              >
                用户中心
              </RouterLink>
              <button class="logout-button" type="button" aria-label="退出登录" @click="handleLogout">
                <v-icon icon="mdi-logout-variant"></v-icon>
              </button>
            </template>
            <RouterLink v-else to="/login" class="login-link" @click="closeMobileNavigation">登录</RouterLink>
          </div>
        </div>

        <nav
          v-if="mobileNavigationOpen"
          id="site-mobile-nav"
          class="site-mobile-nav"
          aria-label="页面导航"
        >
          <RouterLink
            v-for="item in siteNavigation"
            :key="item.to"
            class="site-mobile-nav-link"
            :class="{ 'site-mobile-nav-link-active': isNavigationActive(item.to) }"
            :to="item.to"
            :aria-current="isNavigationActive(item.to) ? 'page' : undefined"
            @click="closeMobileNavigation"
          >
            <v-icon :icon="item.icon" size="19" aria-hidden="true"></v-icon>
            <span>{{ item.label }}</span>
            <v-icon icon="mdi-arrow-top-right" size="16" aria-hidden="true"></v-icon>
          </RouterLink>
        </nav>
      </header>

      <main class="site-main" :class="{ 'site-main-landing': isLanding }">
        <RouterView />
      </main>
    </div>
  </v-app>
</template>

<style>
:root {
  --site-ink: #173a63;
  --site-muted: #55758a;
  --site-paper: #eaf7f7;
  --site-surface: #fffdf6;
  --site-line: #a9dde2;
  --site-accent: #1976c5;
  --site-accent-soft: #d5f2f3;
  --site-green: #36bfc8;
  --site-cyan: #5bc7d4;
  --site-warm: #ffd23f;
  --site-pink: #ef78a8;
  --site-shadow: 0 18px 50px rgb(25 118 197 / 0.12);
  --v-theme-font-family:
    'Inter', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', -apple-system, BlinkMacSystemFont,
    'Segoe UI', sans-serif;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body,
#app {
  min-height: 100%;
  margin: 0;
}

body {
  background: var(--site-paper);
  color: var(--site-ink);
  font-family: var(--v-theme-font-family);
  -webkit-font-smoothing: antialiased;
}

button,
a {
  font: inherit;
}

a {
  color: inherit;
  text-decoration: none;
}

.site-shell {
  min-height: 100vh;
  background: var(--site-paper);
}

.site-shell-landing {
  min-width: 0;
}

.site-header {
  position: sticky;
  top: 0;
  z-index: 30;
  background: var(--site-accent);
  box-shadow: 0 4px 14px rgb(23 58 99 / 0.04);
}

.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1440px;
  min-height: 60px;
  margin: 0 auto;
  padding: 0 32px;
}

.header-primary {
  display: flex;
  align-self: stretch;
  min-width: 0;
  flex: 1 1 auto;
  align-items: stretch;
  overflow-x: auto;
  scrollbar-width: none;
}

.header-primary::-webkit-scrollbar {
  display: none;
}

.brand,
.site-nav-link {
  position: relative;
  display: inline-flex;
  min-height: 60px;
  align-items: center;
  gap: 7px;
  padding: 0 14px;
  color: rgb(255 253 246 / 0.72);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  transition:
    background-color 160ms ease,
    color 160ms ease;
}

.site-nav-link:hover,
.site-nav-link-active {
  background: rgb(255 253 246 / 0.12);
  color: var(--site-surface);
}

.site-nav-link::after {
  position: absolute;
  right: 14px;
  bottom: 0;
  left: 14px;
  height: 3px;
  background: transparent;
  content: '';
}

.site-nav-link-active::after {
  background: var(--site-warm);
}

.brand {
  flex-shrink: 0;
}

.brand:hover {
  background: rgb(255 253 246 / 0.12);
}

.brand-mark {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 10px;
  background: transparent;
}

.brand-mark img {
  display: block;
  width: 34px;
  height: 34px;
  filter: none;
}

.brand-copy {
  display: flex;
  flex-direction: column;
  gap: 1px;
  line-height: 1;
}

.brand-copy strong {
  color: var(--site-surface);
  font-size: 16px;
  font-weight: 750;
  letter-spacing: 0.02em;
}

.brand-copy small {
  color: rgb(255 253 246 / 0.72);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.18em;
}

.login-link,
.header-user,
.logout-button {
  border: 0;
  background: transparent;
  color: var(--site-surface);
  cursor: pointer;
}

.header-user:hover,
.login-link:hover {
  color: var(--site-ink);
}

.header-actions {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 18px;
  margin-left: 24px;
}

.site-nav-toggle {
  display: none;
  width: 32px;
  height: 32px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--site-surface);
  cursor: pointer;
}

.site-nav-toggle:hover {
  background: rgb(255 253 246 / 0.12);
}

.site-mobile-nav {
  display: none;
}

.logout-button,
.header-user {
  display: grid;
  place-items: center;
  font-size: 13px;
  font-weight: 700;
}

.logout-button {
  width: 30px;
  height: 30px;
  border-radius: 50%;
}

.login-link {
  font-size: 13px;
  font-weight: 700;
}

.site-main {
  min-height: calc(100vh - 60px);
}

.site-main-landing {
  min-height: 100vh;
}

@media (max-width: 700px) {
  .header-inner {
    min-height: 54px;
    padding: 0 16px;
  }

  .header-actions {
    gap: 6px;
  }

  .site-main {
    min-height: calc(100vh - 55px);
  }

  .site-main-landing {
    min-height: 100vh;
  }
}

@media (max-width: 860px) {
  .header-primary {
    align-items: center;
    overflow: hidden;
  }

  .header-primary .site-nav-link {
    display: none;
  }

  .site-nav-toggle {
    display: grid;
  }

  .site-mobile-nav {
    display: grid;
    gap: 4px;
    padding: 8px 16px 14px;
    border-top: 1px solid rgb(255 253 246 / 0.14);
    background: var(--site-accent);
  }

  .site-mobile-nav-link {
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr) 18px;
    gap: 10px;
    align-items: center;
    min-height: 44px;
    padding: 0 12px;
    color: rgb(255 253 246 / 0.78);
    font-size: 13px;
    font-weight: 700;
  }

  .site-mobile-nav-link:hover,
  .site-mobile-nav-link-active {
    background: rgb(255 253 246 / 0.14);
    color: var(--site-surface);
  }

  .site-mobile-nav-link-active {
    box-shadow: inset 3px 0 0 var(--site-warm);
  }
}

@media (max-width: 520px) {
  .brand-copy small {
    display: none;
  }

  .header-actions {
    gap: 3px;
  }
}
</style>
