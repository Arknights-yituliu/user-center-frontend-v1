<script setup lang="ts">
import { computed, ref } from 'vue'

type PreviewPageId = 'projects' | 'common-data' | 'user-guide' | 'developer' | 'color' | 'components'

interface TitlePreset {
  id: PreviewPageId
  label: string
  kicker: string
  titleA: string
  titleB?: string
  titleSuffix?: string
  description?: string
  visualTop?: string
  visualBottom?: string
  visualIndex?: string
  visualIcon?: string
  visualIndexText?: boolean
}

const pagePresets: TitlePreset[] = [
  {
    id: 'projects',
    label: '工具列表',
    kicker: 'PROJECTS',
    titleA: '授权控制面板',
    description: '管理各个工具对数据的访问',
  },
  {
    id: 'common-data',
    label: '通用数据维护',
    kicker: 'COMMON DATA',
    titleA: '通用数据维护',
    description: '维护干员信息等通用于各大项目的数据',
  },
  {
    id: 'user-guide',
    label: '用户指南',
    kicker: 'USER GUIDE',
    titleA: '用户指南',
    description: '了解酸橙云如何保存、同步和管理你的个人数据',
    visualBottom: 'USER GUIDE',
  },
  {
    id: 'developer',
    label: '开发者中心',
    kicker: 'DEVELOPER CENTER',
    titleA: '开发者中心',
    description: '管理 OAuth2 客户端，选择适合你的接入方式，并使用用户配置服务。',
    visualIcon: 'mdi-console-line',
  },
  {
    id: 'color',
    label: '配色方案',
    kicker: 'COLOR',
    titleA: '给界面一片',
    titleB: '晴湾珊瑚',
    titleSuffix: '。',
    description: '以参考图中的晴空、湖水、珊瑚与日落为线索，整理出四种可以落到产品界面的色彩方向。',
    visualTop: 'ATMOSPHERE / 01',
    visualBottom: 'SKY · WATER · LIGHT',
    visualIndex: '01',
  },
  {
    id: 'components',
    label: '组件名称',
    kicker: 'COMPONENTS',
    titleA: '主标题',
    titleB: '主标题',
    description: '副标题',
    visualTop: '右侧视觉',
    visualBottom: '辅助标记',
    visualIndex: '装饰区',
    visualIndexText: true,
  },
]

const activePageId = ref<PreviewPageId>('projects')
const activePreset = computed<TitlePreset>(
  () => pagePresets.find((preset) => preset.id === activePageId.value) ?? pagePresets[0]!,
)
</script>

<template>
  <main class="ui-preview-page">
    <header class="title-module" aria-labelledby="preview-title">
      <div class="title-module-copy">
        <p class="title-module-kicker">
          <span aria-hidden="true"></span>
          {{ activePreset.kicker }}
        </p>
        <h1 id="preview-title">
          <span class="title-line title-line-a">{{ activePreset.titleA }}</span>
          <span v-if="activePreset.titleB" class="title-line title-line-b">
            <em>{{ activePreset.titleB }}</em>{{ activePreset.titleSuffix }}
          </span>
        </h1>
        <p v-if="activePreset.description" class="title-module-description">
          {{ activePreset.description }}
        </p>
      </div>

      <div class="title-module-visual" aria-hidden="true">
        <span v-if="activePreset.visualTop" class="visual-label visual-label-top">
          {{ activePreset.visualTop }}
        </span>
        <span class="visual-rule visual-rule-horizontal"></span>
        <span class="visual-rule visual-rule-vertical"></span>
        <span class="visual-marker visual-marker-primary"></span>
        <span class="visual-marker visual-marker-secondary"></span>
        <span class="visual-marker visual-marker-highlight"></span>
        <span
          v-if="activePreset.visualIndex"
          class="visual-index"
          :class="{ 'visual-index-label': activePreset.visualIndexText }"
        >
          {{ activePreset.visualIndex }}
        </span>
        <span v-if="activePreset.visualIcon" class="visual-icon">
          <v-icon :icon="activePreset.visualIcon" size="42"></v-icon>
        </span>
        <span v-if="activePreset.visualBottom" class="visual-label visual-label-bottom">
          {{ activePreset.visualBottom }}
        </span>
      </div>
    </header>

    <nav class="preview-switcher" role="tablist" aria-label="二级页面标题预览">
      <button
        v-for="preset in pagePresets"
        :key="preset.id"
        class="preview-switcher-button"
        :class="{ active: activePageId === preset.id }"
        type="button"
        role="tab"
        :aria-selected="activePageId === preset.id"
        @click="activePageId = preset.id"
      >
        <span>{{ preset.label }}</span>
      </button>
    </nav>
  </main>
</template>

<style scoped>
.ui-preview-page {
  width: min(1120px, calc(100% - 64px));
  margin: 0 auto;
  padding: 42px 0 80px;
}

.title-module {
  --module-surface: var(--site-surface);
  --module-line: var(--site-ink);
  --module-primary: var(--site-accent);
  --module-secondary: var(--site-cyan);
  --module-highlight: var(--site-pink);
  position: relative;
  isolation: isolate;
  overflow: hidden;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(250px, 0.58fr);
  gap: 64px;
  align-items: stretch;
  min-height: 320px;
  padding: 30px 52px 34px;
  border: 1px solid var(--module-line);
  border-left: 10px solid var(--module-primary);
  background: var(--module-surface);
  box-shadow: 12px 12px 0 var(--module-secondary);
}

.title-module-copy {
  position: relative;
  z-index: 1;
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  transform: translateY(-10px);
}

.title-module-kicker {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 0;
  color: var(--module-primary);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.13em;
  line-height: 1.4;
}

.title-module-kicker span {
  width: 9px;
  height: 9px;
  flex: 0 0 9px;
  background: var(--module-highlight);
}

.title-module h1 {
  max-width: 650px;
  margin: 18px 0 0;
  color: var(--site-ink);
  font-size: 52px;
  font-weight: 650;
  letter-spacing: -0.06em;
  line-height: 0.98;
}

.title-line {
  display: block;
}

.title-module h1 em {
  color: var(--module-primary);
  font-style: normal;
}

.title-module-description {
  max-width: 430px;
  margin: 24px 0 0;
  color: var(--site-muted);
  font-size: 18px;
  line-height: 1.65;
}

.title-module-visual {
  position: relative;
  min-height: 250px;
  align-self: center;
}

.preview-switcher {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  margin-top: 28px;
  border: 1px solid var(--site-line);
  background: var(--site-surface);
}

.preview-switcher-button {
  display: flex;
  min-width: 0;
  min-height: 58px;
  align-items: center;
  justify-content: center;
  padding: 12px 14px;
  border: 0;
  border-right: 1px solid var(--site-line);
  background: transparent;
  color: var(--site-muted);
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  transition:
    background-color 160ms ease,
    color 160ms ease;
}

.preview-switcher-button:last-child {
  border-right: 0;
}

.preview-switcher-button:hover {
  background: var(--site-accent-soft);
  color: var(--site-ink);
}

.preview-switcher-button.active {
  background: var(--site-ink);
  color: var(--site-surface);
}

.preview-switcher-button:focus-visible {
  position: relative;
  z-index: 1;
  outline: 3px solid var(--site-warm);
  outline-offset: -4px;
}

.visual-label {
  position: absolute;
  color: var(--site-muted);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.16em;
  white-space: nowrap;
}

.visual-label-top {
  top: 8px;
  left: 0;
}

.visual-label-bottom {
  right: 0;
  bottom: 5px;
}

.visual-rule {
  position: absolute;
  display: block;
  background: var(--module-primary);
  opacity: 0.32;
}

.visual-rule-horizontal {
  top: 50%;
  right: 0;
  left: 4%;
  height: 1px;
}

.visual-rule-vertical {
  top: 14%;
  bottom: 12%;
  left: 43%;
  width: 1px;
  background: var(--module-highlight);
}

.visual-marker {
  position: absolute;
  display: block;
  width: 10px;
  height: 10px;
  border: 1px solid var(--module-line);
  background: var(--module-surface);
}

.visual-marker-primary {
  top: 27%;
  left: 20%;
  background: var(--module-primary);
}

.visual-marker-secondary {
  top: 50%;
  right: 22%;
  background: var(--module-secondary);
}

.visual-marker-highlight {
  bottom: 21%;
  left: 43%;
  background: var(--module-highlight);
}

.visual-index {
  position: absolute;
  top: 50%;
  left: 43%;
  display: grid;
  width: 132px;
  height: 132px;
  place-items: center;
  transform: translate(-50%, -50%);
  border: 1px solid var(--module-line);
  background: var(--module-primary);
  box-shadow: 12px 12px 0 var(--module-highlight);
  color: var(--module-surface);
  font-size: 56px;
  font-weight: 700;
  line-height: 1;
}

.visual-index-label {
  padding: 12px;
  font-size: 22px;
  line-height: 1.2;
  text-align: center;
}

.visual-icon {
  position: absolute;
  top: 50%;
  left: 43%;
  display: grid;
  width: 86px;
  height: 86px;
  place-items: center;
  transform: translate(-50%, -50%);
  border: 1px solid var(--module-line);
  background: var(--site-warm);
  color: var(--module-line);
}

@media (max-width: 820px) {
  .ui-preview-page {
    width: min(100% - 48px, 680px);
  }

  .title-module {
    grid-template-columns: 1fr;
    gap: 34px;
    min-height: 0;
    padding: 34px 30px 38px;
  }

  .title-module-visual {
    min-height: 220px;
  }

  .preview-switcher {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .preview-switcher-button {
    min-height: 52px;
    padding: 10px 8px;
    font-size: 12px;
  }

  .preview-switcher-button:nth-child(3) {
    border-right: 0;
  }

  .preview-switcher-button:nth-child(n + 4) {
    border-top: 1px solid var(--site-line);
  }

  .preview-switcher-button:nth-child(4) {
    border-right: 1px solid var(--site-line);
  }
}

@media (max-width: 520px) {
  .ui-preview-page {
    width: calc(100% - 32px);
    padding-top: 28px;
  }

  .title-module {
    gap: 26px;
    padding: 26px 20px 30px;
    box-shadow: 8px 8px 0 var(--module-secondary);
  }

  .title-module-copy {
    transform: translateY(-6px);
  }

  .preview-switcher {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .preview-switcher-button:nth-child(3) {
    border-top: 1px solid var(--site-line);
    border-right: 1px solid var(--site-line);
  }

  .preview-switcher-button:nth-child(4) {
    border-right: 0;
  }

  .preview-switcher-button:nth-child(5) {
    border-right: 1px solid var(--site-line);
  }

  .title-module h1 {
    font-size: 42px;
  }

  .title-module-description {
    font-size: 15px;
  }

  .title-module-visual {
    min-height: 190px;
  }

  .visual-index {
    width: 108px;
    height: 108px;
    font-size: 46px;
  }
}
</style>
