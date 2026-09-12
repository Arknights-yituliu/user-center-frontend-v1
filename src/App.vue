<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { getUcToken, logoutUcSession } from './api/uc/uc-api'
import ClassicShell from './components/ClassicShell.vue'

const route = useRoute()
const router = useRouter()
const loggedIn = ref(!!getUcToken())

const hideNavigation = computed(() => !!route.meta.hideSidebar)
const classicMode = computed(() => !!route.meta.classicShell)
const isLanding = computed(() => route.name === 'LANDING')

watch(
  () => route.fullPath,
  () => {
    loggedIn.value = !!getUcToken()
  },
)

async function handleLogout(): Promise<void> {
  await logoutUcSession()
  router.push({ name: 'LOGIN' })
}
</script>

<template>
  <v-app>
    <ClassicShell v-if="classicMode" />
    <div v-else class="site-shell">
      <header v-if="!isLanding" class="site-header">
        <div class="header-inner">
          <RouterLink to="/" class="brand">
            <span class="brand-mark">
              <img src="/logo.png" alt="" width="30" height="30" />
            </span>
            <span class="brand-copy">
              <strong>酸橙云</strong>
              <small>YITULIU ACCOUNT</small>
            </span>
          </RouterLink>

          <div class="header-actions">
            <template v-if="loggedIn">
              <RouterLink v-if="hideNavigation" to="/home" class="header-user">用户中心</RouterLink>
              <button class="logout-button" type="button" aria-label="退出登录" @click="handleLogout">
                <v-icon icon="mdi-logout-variant"></v-icon>
              </button>
            </template>
            <RouterLink v-else to="/login" class="login-link">登录</RouterLink>
          </div>
        </div>
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

.site-header {
  position: relative;
  top: 0;
  z-index: 30;
  background: transparent;
}

.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1440px;
  min-height: 72px;
  margin: 0 auto;
  padding: 0 32px;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.brand-mark {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border: 1px solid var(--site-ink);
  border-radius: 50%;
  background: var(--site-accent);
}

.brand-mark img {
  display: block;
  width: 28px;
  height: 28px;
  filter: brightness(0) invert(1);
}

.brand-copy {
  display: flex;
  flex-direction: column;
  gap: 1px;
  line-height: 1;
}

.brand-copy strong {
  font-size: 16px;
  font-weight: 750;
  letter-spacing: 0.02em;
}

.brand-copy small {
  color: var(--site-muted);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.18em;
}

.login-link,
.header-user,
.logout-button {
  border: 0;
  background: transparent;
  color: var(--site-muted);
  cursor: pointer;
}

.header-user:hover,
.login-link:hover {
  color: var(--site-ink);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 18px;
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
  min-height: calc(100vh - 72px);
}

.site-main-landing {
  min-height: 100vh;
}

@media (max-width: 700px) {
  .header-inner {
    min-height: 62px;
    padding: 0 16px;
  }

  .header-actions {
    gap: 6px;
  }

  .site-main {
    min-height: calc(100vh - 63px);
  }

  .site-main-landing {
    min-height: 100vh;
  }
}
</style>
