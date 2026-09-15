<script setup lang="ts">
import { computed, defineAsyncComponent, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SecondaryPageHeader from '../components/SecondaryPageHeader.vue'

type DeveloperTabId = 'clients' | 'web' | 'server' | 'config'

interface DeveloperTab {
  id: DeveloperTabId
  label: string
  icon: string
}

const developerTabs: DeveloperTab[] = [
  {
    id: 'clients',
    label: '客户端管理',
    icon: 'mdi-api',
  },
  {
    id: 'web',
    label: '无后端 Web 授权',
    icon: 'mdi-web',
  },
  {
    id: 'server',
    label: '加密客户端授权',
    icon: 'mdi-server-security',
  },
  {
    id: 'config',
    label: 'OAuth 用户配置',
    icon: 'mdi-cloud-sync-outline',
  },
]

const tabComponents: Record<DeveloperTabId, Component> = {
  clients: defineAsyncComponent(() => import('../pages/account/oauth-clients.vue')),
  web: defineAsyncComponent(() => import('../pages/account/oauth-web-guide.vue')),
  server: defineAsyncComponent(() => import('../pages/account/oauth-server-guide.vue')),
  config: defineAsyncComponent(() => import('../pages/account/oauth-config-guide.vue')),
}

const route = useRoute()
const router = useRouter()

function isDeveloperTabId(value: unknown): value is DeveloperTabId {
  return developerTabs.some((tab) => tab.id === value)
}

const activeTab = computed<DeveloperTabId>(() => {
  const queryTab = Array.isArray(route.query.tab) ? route.query.tab[0] : route.query.tab
  return isDeveloperTabId(queryTab) ? queryTab : 'clients'
})

const activeTabInfo = computed(
  () => developerTabs.find((tab) => tab.id === activeTab.value) || developerTabs[0]!,
)

function selectTab(value: unknown): void {
  if (!isDeveloperTabId(value) || value === activeTab.value) {
    return
  }

  void router.replace({
    path: '/developer',
    query: {
      ...route.query,
      tab: value === 'clients' ? undefined : value,
    },
    hash: '',
  })
}
</script>

<template>
  <div class="developer-page">
    <SecondaryPageHeader
      title-id="developer-title"
      kicker="DEVELOPER CENTER"
      title-a="开发者中心"
      description="管理 OAuth2 客户端，选择适合你的接入方式，并使用用户配置服务。"
      visual-icon="mdi-console-line"
    >
      <template #visual>
        <div class="developer-header-mark">
          <v-icon icon="mdi-console-line" size="48"></v-icon>
        </div>
      </template>
    </SecondaryPageHeader>

    <div class="developer-tabs-wrap">
      <nav class="developer-tabs" role="tablist" aria-label="开发者中心功能">
        <button
          v-for="(tab, index) in developerTabs"
          :id="`developer-tab-${tab.id}`"
          :key="tab.id"
          class="developer-tab"
          :class="{ active: activeTab === tab.id }"
          type="button"
          role="tab"
          :aria-selected="activeTab === tab.id"
          aria-controls="developer-tab-panel"
          @click="selectTab(tab.id)"
        >
          <span class="developer-tab-index">{{ String(index + 1).padStart(2, '0') }}</span>
          <span class="developer-tab-icon" aria-hidden="true">
            <v-icon :icon="tab.icon" size="18"></v-icon>
          </span>
          <span class="developer-tab-label">{{ tab.label }}</span>
          <v-icon
            class="developer-tab-arrow"
            icon="mdi-arrow-top-right"
            size="16"
            aria-hidden="true"
          ></v-icon>
        </button>
      </nav>
    </div>

    <section
      id="developer-tab-panel"
      class="developer-tab-panel"
      role="tabpanel"
      :aria-label="activeTabInfo.label"
      :aria-labelledby="`developer-tab-${activeTab}`"
      aria-live="polite"
    >
      <component :is="tabComponents[activeTab]" :key="activeTab" />
    </section>
  </div>
</template>

<style scoped>
.developer-page {
  width: min(1280px, 100%);
  margin: 0 auto;
  padding: 38px 32px 72px;
}

.developer-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 32px;
  padding: 8px 0 34px;
  border-bottom: 1px solid var(--site-ink);
}

.developer-eyebrow {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0 0 12px;
  color: var(--site-accent);
  font-size: 12px;
  font-weight: 750;
  letter-spacing: 0.12em;
}

.developer-header h1 {
  margin: 0;
  color: var(--site-ink);
  font-size: 44px;
  font-weight: 700;
  line-height: 1.1;
}

.developer-intro {
  max-width: 560px;
  margin: 12px 0 0;
  color: var(--site-muted);
  font-size: 15px;
  line-height: 1.7;
}

.developer-header-mark {
  position: absolute;
  top: 50%;
  left: 43%;
  display: grid;
  width: 86px;
  height: 86px;
  flex-shrink: 0;
  place-items: center;
  transform: translate(-50%, -50%);
  border: 1px solid var(--site-ink);
  background: var(--site-warm);
  color: var(--site-ink);
}

.developer-tabs-wrap {
  overflow-x: auto;
  margin-top: 28px;
  border-bottom: 1px solid var(--site-line);
  background: var(--site-surface);
}

.developer-tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  min-width: 760px;
}

.developer-tab {
  position: relative;
  display: grid;
  grid-template-columns: auto 34px minmax(0, 1fr) 18px;
  gap: 10px;
  align-items: center;
  min-height: 78px;
  padding: 12px 18px;
  border: 0;
  border-top: 1px solid var(--site-line);
  border-right: 1px solid var(--site-line);
  background: transparent;
  color: var(--site-muted);
  cursor: pointer;
  text-align: left;
  transition:
    background-color 160ms ease,
    color 160ms ease;
}

.developer-tab:first-child {
  border-left: 1px solid var(--site-line);
}

.developer-tab::after {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 3px;
  background: transparent;
  content: '';
  transition: background-color 160ms ease;
}

.developer-tab:hover {
  background: rgb(213 242 243 / 0.58);
  color: var(--site-ink);
}

.developer-tab.active {
  background: var(--site-accent-soft);
  color: var(--site-ink);
}

.developer-tab.active::after {
  background: var(--site-accent);
}

.developer-tab:focus-visible {
  z-index: 1;
  outline: 3px solid var(--site-warm);
  outline-offset: -3px;
}

.developer-tab-index {
  align-self: start;
  padding-top: 2px;
  color: var(--site-pink);
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.08em;
  line-height: 1;
}

.developer-tab-icon {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid var(--site-line);
  border-radius: 6px;
  background: var(--site-surface);
  color: var(--site-accent);
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    color 160ms ease;
}

.developer-tab.active .developer-tab-icon {
  border-color: var(--site-accent);
  background: var(--site-accent);
  color: var(--site-surface);
}

.developer-tab-label {
  min-width: 0;
  color: inherit;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0;
  line-height: 1.35;
}

.developer-tab-arrow {
  color: var(--site-accent);
  opacity: 0;
  transform: translate(-2px, 2px);
  transition:
    opacity 160ms ease,
    transform 160ms ease;
}

.developer-tab:hover .developer-tab-arrow,
.developer-tab.active .developer-tab-arrow {
  opacity: 1;
  transform: translate(0, 0);
}

.developer-tab-panel {
  min-width: 0;
}

@media (max-width: 760px) {
  .developer-page {
    padding: 24px 16px 48px;
  }

  .developer-header {
    align-items: flex-start;
    padding-bottom: 26px;
  }

  .developer-header h1 {
    font-size: 34px;
  }

  .developer-intro {
    font-size: 14px;
  }

  .developer-header-mark {
    width: 58px;
    height: 58px;
  }

  .developer-header-mark :deep(.v-icon) {
    font-size: 32px !important;
  }

  .developer-tabs {
    min-width: 700px;
  }

  .developer-tabs-wrap {
    margin-top: 20px;
  }

  .developer-tab {
    grid-template-columns: auto 30px minmax(0, 1fr) 16px;
    gap: 8px;
    min-height: 70px;
    padding: 10px 14px;
  }

  .developer-tab-icon {
    width: 30px;
    height: 30px;
  }

  .developer-tab-label {
    font-size: 12px;
  }
}

@media (max-width: 520px) {
  .developer-header-mark {
    display: grid;
  }

  .developer-tabs {
    min-width: 640px;
  }

  .developer-tab {
    grid-template-columns: 28px minmax(0, 1fr) 16px;
    gap: 8px;
    min-height: 66px;
    padding: 9px 12px;
  }

  .developer-tab-index {
    display: none;
  }

  .developer-tab-icon {
    width: 28px;
    height: 28px;
  }

}
</style>
