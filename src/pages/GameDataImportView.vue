<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SecondaryPageHeader from '../components/SecondaryPageHeader.vue'
import SklandImportView from './SklandImportView.vue'

type GameDataImportTabId = 'skland' | 'json' | 'third-party'

interface GameDataImportTab {
  id: GameDataImportTabId
  label: string
}

const tabs: GameDataImportTab[] = [
  { id: 'skland', label: '森空岛导入' },
  { id: 'json', label: '通过json导入' },
  { id: 'third-party', label: '第三方授权' },
]

const route = useRoute()
const router = useRouter()

function isTabId(value: unknown): value is GameDataImportTabId {
  return tabs.some((tab) => tab.id === value)
}

const activeTab = computed<GameDataImportTabId>(() => {
  const queryTab = Array.isArray(route.query.tab) ? route.query.tab[0] : route.query.tab
  return isTabId(queryTab) ? queryTab : 'skland'
})

function selectTab(tab: GameDataImportTabId): void {
  if (tab === activeTab.value) return

  void router.replace({
    path: '/gamedata-import',
    query: tab === 'skland' ? {} : { tab },
    hash: '',
  })
}
</script>

<template>
  <div class="gamedata-import-page">
    <SecondaryPageHeader
      title-id="gamedata-import-title"
      kicker="DATA IMPORT"
      title-a="数据导入"
      visual-icon="mdi-database-import-outline"
    />

    <div class="gamedata-import-tabs-wrap">
      <nav class="gamedata-import-tabs" role="tablist" aria-label="数据导入方式">
        <button
          v-for="tab in tabs"
          :id="`gamedata-import-tab-${tab.id}`"
          :key="tab.id"
          class="gamedata-import-tab"
          :class="{ active: activeTab === tab.id }"
          type="button"
          role="tab"
          :aria-selected="activeTab === tab.id"
          aria-controls="gamedata-import-tab-panel"
          @click="selectTab(tab.id)"
        >
          {{ tab.label }}
        </button>
      </nav>
    </div>

    <section
      id="gamedata-import-tab-panel"
      class="gamedata-import-tab-panel"
      role="tabpanel"
      :aria-label="tabs.find((tab) => tab.id === activeTab)?.label"
      :aria-labelledby="`gamedata-import-tab-${activeTab}`"
    >
      <SklandImportView v-if="activeTab === 'skland'" embedded />

      <div v-else-if="activeTab === 'json'" class="gamedata-import-simple-panel">
        <button type="button" class="gamedata-import-json-button">选择json文件</button>
      </div>

      <div v-else class="gamedata-import-simple-panel">
        <p class="gamedata-import-third-party-copy">
          该功能将完全授权其他应用管理你所有的酸橙云数据，如只需更新部分数据，建议使用对应游戏和账号的只写token
        </p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.gamedata-import-page {
  width: min(1280px, 100%);
  margin: 0 auto;
  padding: 40px 32px 72px;
}

.gamedata-import-tabs-wrap {
  overflow-x: auto;
  margin-top: 28px;
  border-bottom: 1px solid var(--site-line);
  background: var(--site-surface);
}

.gamedata-import-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  min-width: 600px;
}

.gamedata-import-tab {
  position: relative;
  min-height: 64px;
  padding: 12px 18px;
  border: 0;
  border-top: 1px solid var(--site-line);
  border-right: 1px solid var(--site-line);
  background: transparent;
  color: var(--site-muted);
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  text-align: left;
  transition:
    background-color 160ms ease,
    color 160ms ease;
}

.gamedata-import-tab:first-child {
  border-left: 1px solid var(--site-line);
}

.gamedata-import-tab::after {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 3px;
  background: transparent;
  content: '';
}

.gamedata-import-tab:hover,
.gamedata-import-tab.active {
  background: var(--site-accent-soft);
  color: var(--site-ink);
}

.gamedata-import-tab.active::after {
  background: var(--site-accent);
}

.gamedata-import-tab:focus-visible {
  z-index: 1;
  outline: 3px solid var(--site-warm);
  outline-offset: -3px;
}

.gamedata-import-tab-panel {
  min-width: 0;
  margin-top: 28px;
}

.gamedata-import-simple-panel {
  display: flex;
  min-height: 180px;
  align-items: center;
  justify-content: center;
  padding: 28px;
  border: 1px solid var(--site-line);
  background: var(--site-surface);
}

.gamedata-import-json-button {
  min-height: 42px;
  padding: 0 18px;
  border: 1px solid var(--site-accent);
  background: var(--site-accent);
  color: var(--site-surface);
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
}

.gamedata-import-json-button:hover {
  background: var(--site-ink);
  border-color: var(--site-ink);
}

.gamedata-import-third-party-copy {
  max-width: 760px;
  margin: 0;
  color: var(--site-ink);
  font-size: 15px;
  line-height: 1.8;
}

@media (max-width: 760px) {
  .gamedata-import-page {
    padding: 24px 16px 48px;
  }

  .gamedata-import-tabs-wrap {
    margin-top: 20px;
  }

  .gamedata-import-tab {
    min-height: 58px;
    padding: 10px 14px;
    font-size: 12px;
  }
}
</style>
