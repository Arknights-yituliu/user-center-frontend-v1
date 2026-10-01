<script setup lang="ts">
import { computed, ref } from 'vue'
import SecondaryPageHeader from '../components/SecondaryPageHeader.vue'

type PaletteId = 'sky-coral' | 'sky-lagoon' | 'coral-coast' | 'deep-sunset'

interface PaletteSwatch {
  role: string
  label: string
  value: string
  text: string
}

interface Palette {
  id: PaletteId
  index: string
  name: string
  subtitle: string
  mood: string
  description: string
  useCase: string
  page: string
  surface: string
  surfaceStrong: string
  ink: string
  muted: string
  line: string
  primary: string
  primaryStrong: string
  secondary: string
  highlight: string
  coral: string
  primarySoft: string
  secondarySoft: string
  onPrimary: string
  shadow: string
  swatches: PaletteSwatch[]
}

const palettes: Palette[] = [
  {
    id: 'sky-coral',
    index: '01',
    name: '晴湾珊瑚',
    subtitle: 'Sky / Coral',
    mood: '晴湾珊瑚',
    description:
      '将首页现有的晴空青蓝、湖水青、日光黄与珊瑚粉收进同一套界面语气，兼顾清爽秩序和亲和热度。',
    useCase: '首页基准 · 清爽 · 亲和',
    page: '#eaf7f7',
    surface: '#fffdf6',
    surfaceStrong: '#d5f2f3',
    ink: '#173a63',
    muted: '#55758a',
    line: '#a9dde2',
    primary: '#1976c5',
    primaryStrong: '#155f9d',
    secondary: '#36bfc8',
    highlight: '#ffd23f',
    coral: '#ef78a8',
    primarySoft: '#d5f2f3',
    secondarySoft: '#dff5f5',
    onPrimary: '#fffdf6',
    shadow: 'rgba(25, 118, 197, 0.12)',
    swatches: [
      { role: 'canvas', label: '云朵底色', value: '#EAF7F7', text: '#173A63' },
      { role: 'ink', label: '深海文字', value: '#173A63', text: '#FFFDF6' },
      { role: 'primary', label: '晴空青蓝', value: '#1976C5', text: '#FFFDF6' },
      { role: 'secondary', label: '湖水青', value: '#36BFC8', text: '#173A63' },
      { role: 'highlight', label: '日光黄', value: '#FFD23F', text: '#173A63' },
      { role: 'coral', label: '珊瑚粉', value: '#EF78A8', text: '#173A63' },
    ],
  },
  {
    id: 'sky-lagoon',
    index: '02',
    name: '晴空湖水',
    subtitle: 'Sky / Lagoon',
    mood: '晴空湖水',
    description: '清透的天空青蓝与湖水绿相遇，适合日常使用频率高、需要轻快呼吸感的界面。',
    useCase: '轻快 · 清晰 · 日常',
    page: '#eef7f4',
    surface: '#fffdf7',
    surfaceStrong: '#dff0ed',
    ink: '#153b4b',
    muted: '#5f7b82',
    line: '#b7d9d3',
    primary: '#178fbd',
    primaryStrong: '#08759f',
    secondary: '#22ae9b',
    highlight: '#ffd35b',
    coral: '#e97999',
    primarySoft: '#d8edf1',
    secondarySoft: '#d9f0e8',
    onPrimary: '#fffdf7',
    shadow: 'rgba(21, 59, 75, 0.15)',
    swatches: [
      { role: 'canvas', label: '云朵底色', value: '#EEF7F4', text: '#153B4B' },
      { role: 'ink', label: '深海文字', value: '#153B4B', text: '#FFFDF7' },
      { role: 'primary', label: '晴空青蓝', value: '#178FBD', text: '#FFFDF7' },
      { role: 'secondary', label: '湖水绿', value: '#22AE9B', text: '#153B4B' },
      { role: 'highlight', label: '日光黄', value: '#FFD35B', text: '#153B4B' },
      { role: 'coral', label: '珊瑚粉', value: '#E97999', text: '#153B4B' },
    ],
  },
  {
    id: 'coral-coast',
    index: '03',
    name: '珊瑚海岸',
    subtitle: 'Coral / Coast',
    mood: '珊瑚海岸',
    description: '暖珊瑚作为视觉主角，青蓝负责拉开层次，橙黄让操作状态更有温度。',
    useCase: '温暖 · 活力 · 亲和',
    page: '#fff4e9',
    surface: '#fffdf8',
    surfaceStrong: '#f8e5d9',
    ink: '#193b48',
    muted: '#7a706d',
    line: '#edc8ac',
    primary: '#e86e6c',
    primaryStrong: '#c85359',
    secondary: '#18a5b0',
    highlight: '#ffb643',
    coral: '#f08b94',
    primarySoft: '#f8deda',
    secondarySoft: '#d8efec',
    onPrimary: '#fffdf8',
    shadow: 'rgba(117, 65, 53, 0.16)',
    swatches: [
      { role: 'canvas', label: '贝壳底色', value: '#FFF4E9', text: '#193B48' },
      { role: 'ink', label: '礁石文字', value: '#193B48', text: '#FFFDF8' },
      { role: 'primary', label: '珊瑚主色', value: '#E86E6C', text: '#FFFDF8' },
      { role: 'secondary', label: '海岸青蓝', value: '#18A5B0', text: '#FFFDF8' },
      { role: 'highlight', label: '落日橙黄', value: '#FFB643', text: '#193B48' },
      { role: 'coral', label: '浅珊瑚', value: '#F08B94', text: '#193B48' },
    ],
  },
  {
    id: 'deep-sunset',
    index: '04',
    name: '深海日落',
    subtitle: 'Deep / Sunset',
    mood: '深海日落',
    description: '深海青承担秩序与稳定，明亮的日落橙黄集中在关键操作上，气质更沉静。',
    useCase: '沉静 · 稳定 · 聚焦',
    page: '#e9f2ef',
    surface: '#fffaf0',
    surfaceStrong: '#d8e8e4',
    ink: '#12394b',
    muted: '#5f7479',
    line: '#a9cfca',
    primary: '#12647c',
    primaryStrong: '#0b4f65',
    secondary: '#2fa697',
    highlight: '#f4b33e',
    coral: '#ed765f',
    primarySoft: '#d5e7e8',
    secondarySoft: '#d8eee5',
    onPrimary: '#fffaf0',
    shadow: 'rgba(18, 57, 75, 0.18)',
    swatches: [
      { role: 'canvas', label: '晨雾底色', value: '#E9F2EF', text: '#12394B' },
      { role: 'ink', label: '深海文字', value: '#12394B', text: '#FFFAF0' },
      { role: 'primary', label: '深海青', value: '#12647C', text: '#FFFAF0' },
      { role: 'secondary', label: '潮汐绿', value: '#2FA697', text: '#FFFAF0' },
      { role: 'highlight', label: '日落橙黄', value: '#F4B33E', text: '#12394B' },
      { role: 'coral', label: '霞光珊瑚', value: '#ED765F', text: '#FFFAF0' },
    ],
  },
]

const activeId = ref<PaletteId>('sky-coral')
const activePalette = computed<Palette>(
  () => palettes.find((palette) => palette.id === activeId.value) ?? palettes[0]!,
)

const activeStyle = computed<Record<string, string>>(() => ({
  '--lab-page': activePalette.value.page,
  '--lab-surface': activePalette.value.surface,
  '--lab-surface-strong': activePalette.value.surfaceStrong,
  '--lab-ink': activePalette.value.ink,
  '--lab-muted': activePalette.value.muted,
  '--lab-line': activePalette.value.line,
  '--lab-primary': activePalette.value.primary,
  '--lab-primary-strong': activePalette.value.primaryStrong,
  '--lab-secondary': activePalette.value.secondary,
  '--lab-highlight': activePalette.value.highlight,
  '--lab-coral': activePalette.value.coral,
  '--lab-primary-soft': activePalette.value.primarySoft,
  '--lab-secondary-soft': activePalette.value.secondarySoft,
  '--lab-on-primary': activePalette.value.onPrimary,
  '--lab-shadow': activePalette.value.shadow,
}))

const previewNavigation = [
  { label: '总览', icon: 'mdi-view-dashboard-outline', active: true },
  { label: '我的工具', icon: 'mdi-wrench-outline', active: false },
  { label: '数据维护', icon: 'mdi-database-cog-outline', active: false },
]

const previewMetrics = [
  { label: '已连接工具', value: '04', note: '全部在线', tone: 'primary' },
  { label: '云端数据', value: '128', note: '较上周 +12', tone: 'secondary' },
  { label: '最近同步', value: '14:32', note: '今天 · 周三', tone: 'highlight' },
]

const previewTools = [
  { name: '明日方舟一图流', detail: '浏览器缓存同步', status: '已同步', tone: 'secondary' },
  { name: '终末地集成工业仿真器', detail: 'OAuth 授权', status: '已授权', tone: 'primary' },
  { name: '明日方舟工具箱', detail: '工具专属 Token', status: '已连接', tone: 'highlight' },
]
</script>

<template>
  <main class="color-page" :style="activeStyle">
    <div class="color-page-inner">
      <SecondaryPageHeader
        title-id="color-title"
        kicker="COLOR"
        title-a="给界面一片"
        :title-b="activePalette.mood"
        title-suffix="。"
        description="以参考图中的晴空、湖水、珊瑚与日落为线索，整理出四种可以落到产品界面的色彩方向。"
        :visual-top="`ATMOSPHERE / ${activePalette.index}`"
        visual-bottom="SKY · WATER · LIGHT"
        :visual-index="activePalette.index"
        :theme="{
          surface: 'var(--lab-surface)',
          line: 'var(--lab-ink)',
          ink: 'var(--lab-ink)',
          muted: 'var(--lab-muted)',
          primary: 'var(--lab-primary)',
          secondary: 'var(--lab-secondary)',
          highlight: 'var(--lab-highlight)',
          warm: 'var(--lab-highlight)',
          shadow: 'var(--lab-secondary)',
        }"
      >
        <template #visual>
          <div class="hero-composition" aria-hidden="true">
            <div class="composition-label composition-label-top">
              ATMOSPHERE / {{ activePalette.index }}
            </div>
            <div class="composition-sun"></div>
            <div class="composition-wave composition-wave-back"></div>
            <div class="composition-wave composition-wave-front"></div>
            <div class="composition-card">
              <span>ACTIVE PALETTE</span>
              <strong>{{ activePalette.name }}</strong>
              <small>{{ activePalette.subtitle }}</small>
            </div>
            <div class="composition-label composition-label-bottom">SKY · WATER · LIGHT</div>
          </div>
        </template>
      </SecondaryPageHeader>

      <section class="palette-section" aria-labelledby="palette-title">
        <div class="section-heading">
          <span class="section-number">01</span>
          <div>
            <p class="section-kicker">Palette directions</p>
            <h2 id="palette-title">四种情绪，四种入口。</h2>
          </div>
        </div>

        <div class="palette-choices" aria-label="配色方案">
          <button
            v-for="palette in palettes"
            :key="palette.id"
            class="palette-choice"
            :class="{ 'palette-choice-active': palette.id === activeId }"
            type="button"
            :aria-pressed="palette.id === activeId"
            @click="activeId = palette.id"
          >
            <span class="choice-topline">
              <span class="choice-index">{{ palette.index }}</span>
              <v-icon
                v-if="palette.id === activeId"
                icon="mdi-check-circle"
                size="18"
                aria-hidden="true"
              ></v-icon>
            </span>
            <span class="choice-title">
              <strong>{{ palette.name }}</strong>
              <small>{{ palette.subtitle }}</small>
            </span>
            <span class="choice-strip" aria-hidden="true">
              <i
                v-for="swatch in palette.swatches"
                :key="swatch.role"
                :style="{ backgroundColor: swatch.value }"
              ></i>
            </span>
            <span class="choice-footer">
              <span>{{ palette.useCase }}</span>
              <v-icon icon="mdi-arrow-top-right" size="16" aria-hidden="true"></v-icon>
            </span>
          </button>
        </div>
      </section>

      <section class="palette-detail" aria-labelledby="detail-title">
        <div class="section-heading detail-heading">
          <span class="section-number">02</span>
          <div>
            <p class="section-kicker">Color roles / {{ activePalette.name }}</p>
            <h2 id="detail-title">一套完整的界面语气。</h2>
            <p class="detail-description">{{ activePalette.description }}</p>
          </div>
        </div>

        <div class="detail-content">
          <div class="swatch-panel">
            <div class="panel-heading">
              <span>色彩角色</span>
              <strong>{{ activePalette.index }} / 04</strong>
            </div>
            <div class="swatch-list">
              <div v-for="swatch in activePalette.swatches" :key="swatch.role" class="swatch-row">
                <span class="swatch-chip" :style="{ backgroundColor: swatch.value }">
                  <v-icon icon="mdi-plus" size="14" aria-hidden="true"></v-icon>
                </span>
                <span class="swatch-copy">
                  <strong>{{ swatch.label }}</strong>
                  <small>{{ swatch.role }}</small>
                </span>
                <code>{{ swatch.value }}</code>
              </div>
            </div>
            <div class="swatch-note">
              <span class="note-mark"></span>
              <span>暖白承接内容，深色保持阅读秩序。</span>
            </div>
          </div>

          <div class="preview-panel">
            <div class="panel-heading preview-heading">
              <span>Interface preview</span>
              <span class="preview-live"><i></i>LIVE</span>
            </div>

            <div class="mock-app">
              <aside class="mock-sidebar">
                <div class="mock-brand">
                  <span class="mock-brand-mark"><img src="/logo.svg" alt="" /></span>
                  <span>酸橙云</span>
                </div>
                <nav class="mock-nav" aria-label="预览导航">
                  <span
                    v-for="item in previewNavigation"
                    :key="item.label"
                    class="mock-nav-item"
                    :class="{ 'mock-nav-item-active': item.active }"
                  >
                    <v-icon :icon="item.icon" size="15" aria-hidden="true"></v-icon>
                    {{ item.label }}
                  </span>
                </nav>
                <div class="mock-sidebar-foot">
                  <span class="mock-avatar">旅</span>
                  <span><strong>旅行者</strong><small>个人账号</small></span>
                  <v-icon icon="mdi-dots-horizontal" size="17" aria-hidden="true"></v-icon>
                </div>
              </aside>

              <div class="mock-main">
                <div class="mock-topline">
                  <span>周三，9 月 14 日</span>
                  <button type="button" aria-label="通知" title="通知">
                    <v-icon icon="mdi-bell-outline" size="16"></v-icon>
                  </button>
                </div>

                <div class="mock-welcome">
                  <div>
                    <span class="mock-eyebrow">ACCOUNT OVERVIEW</span>
                    <h3>今天也继续<br /><em>把数据留在云端。</em></h3>
                  </div>
                  <div class="mock-graphic" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
                </div>

                <div class="mock-metrics">
                  <div
                    v-for="metric in previewMetrics"
                    :key="metric.label"
                    class="mock-metric"
                    :class="`mock-metric-${metric.tone}`"
                  >
                    <span>{{ metric.label }}</span>
                    <strong>{{ metric.value }}</strong>
                    <small>{{ metric.note }}</small>
                  </div>
                </div>

                <div class="mock-lower-grid">
                  <div class="mock-tools">
                    <div class="mock-panel-topline">
                      <strong>最近使用的工具</strong>
                      <span>查看全部 <v-icon icon="mdi-arrow-top-right" size="12"></v-icon></span>
                    </div>
                    <div class="mock-tool-list">
                      <div v-for="tool in previewTools" :key="tool.name" class="mock-tool-row">
                        <span class="mock-tool-icon" :class="`mock-tool-icon-${tool.tone}`">
                          <v-icon icon="mdi-grid-small" size="18"></v-icon>
                        </span>
                        <span class="mock-tool-copy"
                          ><strong>{{ tool.name }}</strong
                          ><small>{{ tool.detail }}</small></span
                        >
                        <span class="mock-tool-status" :class="`mock-tool-status-${tool.tone}`"
                          ><i></i>{{ tool.status }}</span
                        >
                      </div>
                    </div>
                  </div>

                  <div class="mock-activity">
                    <div class="mock-panel-topline">
                      <strong>同步状态</strong>
                      <v-icon icon="mdi-dots-horizontal" size="17"></v-icon>
                    </div>
                    <div class="mock-chart" aria-hidden="true">
                      <span class="chart-value">86%</span>
                      <div class="chart-bars">
                        <i></i><i></i><i></i><i></i><i></i><i></i><i></i>
                      </div>
                      <div class="chart-axis"><span>周一</span><span>今天</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer class="color-footer">
        <span>酸橙云 / COLOR STUDY 03</span>
        <span
          >当前方案：<strong>{{ activePalette.name }}</strong></span
        >
      </footer>
    </div>
  </main>
</template>

<style scoped>
.color-page {
  min-height: calc(100vh - 72px);
  overflow: hidden;
  background: var(--lab-page);
  color: var(--lab-ink);
  transition:
    background-color 220ms ease,
    color 220ms ease;
}

.color-page-inner {
  width: min(1180px, calc(100% - 64px));
  margin: 0 auto;
  padding: 34px 0 30px;
}

.color-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(360px, 0.82fr);
  gap: 68px;
  align-items: center;
  min-height: 470px;
  padding: 20px 0 56px;
  border-bottom: 1px solid var(--lab-ink);
}

.hero-copy {
  min-width: 0;
}

.color-breadcrumb {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 70px;
  color: var(--lab-muted);
  font-size: 12px;
  font-weight: 750;
}

.color-breadcrumb a {
  color: var(--lab-primary);
}

.color-breadcrumb a:hover,
.color-breadcrumb a:focus-visible {
  color: var(--lab-primary-strong);
}

.color-breadcrumb a:focus-visible,
.palette-choice:focus-visible,
.mock-topline button:focus-visible {
  outline: 3px solid var(--lab-highlight);
  outline-offset: 4px;
}

.hero-kicker,
.section-kicker {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 0;
  color: var(--lab-primary);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.hero-kicker span {
  width: 9px;
  height: 9px;
  background: var(--lab-highlight);
}

.hero-copy h1 {
  max-width: 630px;
  margin: 19px 0 0;
  color: var(--lab-ink);
  font-size: 76px;
  font-weight: 650;
  letter-spacing: -0.06em;
  line-height: 0.99;
}

.hero-copy h1 em {
  color: var(--lab-primary);
  font-style: normal;
}

.hero-description {
  max-width: 470px;
  margin: 27px 0 0;
  color: var(--lab-muted);
  font-size: 14px;
  line-height: 1.8;
}

.hero-composition {
  position: relative;
  min-height: 250px;
}

.composition-label {
  position: absolute;
  z-index: 3;
  color: var(--lab-muted);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.16em;
}

.composition-label-top {
  top: 14px;
  left: 5px;
}

.composition-label-bottom {
  right: 5px;
  bottom: 6px;
}

.composition-sun {
  position: absolute;
  top: 45px;
  right: 14%;
  width: 112px;
  height: 112px;
  border: 1px solid var(--lab-ink);
  border-radius: 50%;
  background: var(--lab-highlight);
}

.composition-wave {
  position: absolute;
  right: 0;
  bottom: 45px;
  left: 0;
  height: 180px;
  border: 1px solid var(--lab-ink);
  transform: skewY(-7deg) rotate(-3deg);
}

.composition-wave-back {
  right: 7%;
  bottom: 75px;
  left: 7%;
  background: var(--lab-secondary);
}

.composition-wave-front {
  right: -4%;
  bottom: 25px;
  left: 18%;
  background: var(--lab-primary);
  box-shadow: 10px 10px 0 var(--lab-coral);
}

.composition-card {
  position: absolute;
  z-index: 2;
  bottom: 105px;
  left: 8%;
  display: grid;
  width: 210px;
  gap: 6px;
  padding: 18px;
  border: 1px solid var(--lab-ink);
  background: var(--lab-surface);
  box-shadow: 8px 8px 0 var(--lab-ink);
  transform: rotate(-4deg);
}

.composition-card span,
.composition-card small {
  color: var(--lab-muted);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.composition-card strong {
  color: var(--lab-ink);
  font-size: 22px;
  font-weight: 750;
  letter-spacing: -0.04em;
}

.palette-section,
.palette-detail {
  padding: 56px 0 62px;
  border-bottom: 1px solid var(--lab-line);
}

.section-heading {
  display: flex;
  align-items: flex-start;
  gap: 15px;
  min-width: 0;
}

.section-number {
  padding-top: 3px;
  color: var(--lab-coral);
  font-size: 12px;
  font-weight: 800;
}

.section-heading h2 {
  margin: 11px 0 0;
  color: var(--lab-ink);
  font-size: 32px;
  font-weight: 700;
  letter-spacing: -0.05em;
  line-height: 1.1;
}

.palette-choices {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-top: 34px;
}

.palette-choice {
  display: grid;
  min-height: 206px;
  gap: 18px;
  padding: 18px;
  border: 1px solid var(--lab-line);
  border-radius: 6px;
  background: var(--lab-surface);
  color: var(--lab-ink);
  cursor: pointer;
  text-align: left;
  transition:
    border-color 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;
}

.palette-choice:hover {
  border-color: var(--lab-primary);
  box-shadow: 7px 7px 0 var(--lab-primary-soft);
  transform: translateY(-3px);
}

.palette-choice-active {
  border-color: var(--lab-ink);
  box-shadow: 8px 8px 0 var(--lab-highlight);
  transform: translate(-2px, -2px);
}

.palette-choice-active:hover {
  box-shadow: 7px 7px 0 var(--lab-highlight);
}

.choice-topline,
.choice-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.choice-topline .v-icon {
  color: var(--lab-primary);
}

.choice-index {
  color: var(--lab-muted);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.1em;
}

.choice-title {
  display: grid;
  gap: 3px;
}

.choice-title strong {
  font-size: 23px;
  font-weight: 750;
  letter-spacing: -0.04em;
}

.choice-title small,
.choice-footer {
  color: var(--lab-muted);
  font-size: 10px;
  font-weight: 700;
}

.choice-strip {
  display: flex;
  height: 31px;
  border: 1px solid var(--lab-line);
}

.choice-strip i {
  flex: 1;
  min-width: 0;
}

.choice-footer {
  align-self: end;
}

.choice-footer .v-icon {
  color: var(--lab-primary);
}

.detail-heading {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 15px;
}

.detail-description {
  max-width: 590px;
  margin: 17px 0 0;
  color: var(--lab-muted);
  font-size: 13px;
  line-height: 1.75;
}

.detail-content {
  display: grid;
  grid-template-columns: 270px minmax(0, 1fr);
  gap: 32px;
  align-items: start;
  margin-top: 38px;
}

.swatch-panel,
.preview-panel {
  border: 1px solid var(--lab-line);
  background: var(--lab-surface);
}

.swatch-panel {
  padding: 20px;
}

.panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  min-height: 25px;
  color: var(--lab-ink);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.panel-heading strong {
  color: var(--lab-muted);
  font-size: 9px;
  font-weight: 800;
}

.swatch-list {
  display: grid;
  margin-top: 17px;
}

.swatch-row {
  display: grid;
  grid-template-columns: 27px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  min-height: 57px;
  border-top: 1px solid var(--lab-line);
}

.swatch-chip {
  display: grid;
  width: 27px;
  height: 27px;
  place-items: center;
  border: 1px solid rgb(18 57 75 / 0.18);
  color: rgb(18 57 75 / 0.48);
}

.swatch-copy {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.swatch-copy strong {
  overflow: hidden;
  color: var(--lab-ink);
  font-size: 11px;
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.swatch-copy small {
  color: var(--lab-muted);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.swatch-row code {
  color: var(--lab-muted);
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
  font-size: 9px;
  font-weight: 700;
}

.swatch-note {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin-top: 16px;
  padding-top: 15px;
  border-top: 1px solid var(--lab-line);
  color: var(--lab-muted);
  font-size: 10px;
  line-height: 1.55;
}

.note-mark {
  width: 7px;
  height: 7px;
  margin-top: 4px;
  flex-shrink: 0;
  background: var(--lab-highlight);
}

.preview-panel {
  min-width: 0;
  overflow: hidden;
}

.preview-heading {
  min-height: 57px;
  padding: 0 20px;
  border-bottom: 1px solid var(--lab-line);
}

.preview-live {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--lab-secondary);
  font-size: 9px;
}

.preview-live i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}

.mock-app {
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr);
  min-height: 440px;
  background: var(--lab-page);
}

.mock-sidebar {
  display: flex;
  min-width: 0;
  flex-direction: column;
  padding: 20px 12px 15px;
  border-right: 1px solid var(--lab-line);
  background: var(--lab-surface-strong);
}

.mock-brand {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--lab-ink);
  font-size: 12px;
  font-weight: 800;
}

.mock-brand-mark {
  display: grid;
  width: 23px;
  height: 23px;
  place-items: center;
  border-radius: 6px;
  background: transparent;
}

.mock-brand-mark img {
  width: 23px;
  height: 23px;
  filter: none;
}

.mock-nav {
  display: grid;
  gap: 5px;
  margin-top: 35px;
}

.mock-nav-item {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 31px;
  padding: 0 7px;
  color: var(--lab-muted);
  font-size: 9px;
  font-weight: 750;
}

.mock-nav-item-active {
  background: var(--lab-primary);
  color: var(--lab-on-primary);
}

.mock-sidebar-foot {
  display: grid;
  grid-template-columns: 23px minmax(0, 1fr) 15px;
  gap: 6px;
  align-items: center;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid var(--lab-line);
}

.mock-avatar {
  display: grid;
  width: 23px;
  height: 23px;
  place-items: center;
  border-radius: 50%;
  background: var(--lab-coral);
  color: var(--lab-surface);
  font-size: 10px;
  font-weight: 800;
}

.mock-sidebar-foot > span:nth-child(2) {
  display: grid;
  min-width: 0;
  gap: 1px;
}

.mock-sidebar-foot strong {
  overflow: hidden;
  color: var(--lab-ink);
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mock-sidebar-foot small {
  color: var(--lab-muted);
  font-size: 8px;
}

.mock-sidebar-foot > .v-icon {
  color: var(--lab-muted);
}

.mock-main {
  min-width: 0;
  padding: 22px 22px 24px;
}

.mock-topline,
.mock-panel-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.mock-topline {
  color: var(--lab-muted);
  font-size: 9px;
  font-weight: 700;
}

.mock-topline button {
  display: grid;
  width: 27px;
  height: 27px;
  place-items: center;
  border: 1px solid var(--lab-line);
  border-radius: 50%;
  background: var(--lab-surface);
  color: var(--lab-ink);
  cursor: pointer;
}

.mock-welcome {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  min-height: 120px;
  margin-top: 19px;
  padding: 20px 22px;
  overflow: hidden;
  background: var(--lab-primary);
  color: var(--lab-on-primary);
}

.mock-eyebrow {
  color: rgb(255 253 247 / 0.7);
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.mock-welcome h3 {
  position: relative;
  z-index: 1;
  margin: 10px 0 0;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.05em;
  line-height: 1;
}

.mock-welcome h3 em {
  color: var(--lab-highlight);
  font-style: normal;
}

.mock-graphic {
  position: relative;
  display: grid;
  width: 130px;
  height: 87px;
  grid-template-columns: repeat(4, 1fr);
  align-items: end;
  gap: 4px;
  opacity: 0.9;
  transform: skewX(-18deg) rotate(-4deg);
}

.mock-graphic::before,
.mock-graphic::after {
  position: absolute;
  display: block;
  content: '';
}

.mock-graphic::before {
  top: 4px;
  right: 12px;
  width: 41px;
  height: 41px;
  border-radius: 50%;
  background: var(--lab-highlight);
}

.mock-graphic::after {
  right: -10px;
  bottom: 3px;
  width: 94px;
  height: 54px;
  background: var(--lab-secondary);
}

.mock-graphic i {
  position: relative;
  z-index: 1;
  display: block;
  height: 34px;
  background: var(--lab-coral);
}

.mock-graphic i:nth-child(2) {
  height: 52px;
  background: var(--lab-highlight);
}

.mock-graphic i:nth-child(3) {
  height: 68px;
  background: var(--lab-surface);
}

.mock-graphic i:nth-child(4) {
  height: 42px;
  background: var(--lab-secondary);
}

.mock-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}

.mock-metric {
  display: grid;
  min-height: 86px;
  gap: 6px;
  padding: 12px;
  border: 1px solid var(--lab-line);
  background: var(--lab-surface);
}

.mock-metric > span,
.mock-metric > small {
  color: var(--lab-muted);
  font-size: 8px;
  font-weight: 700;
}

.mock-metric strong {
  color: var(--lab-ink);
  font-size: 23px;
  font-weight: 750;
  letter-spacing: -0.05em;
  line-height: 1;
}

.mock-metric-primary strong {
  color: var(--lab-primary);
}

.mock-metric-secondary strong {
  color: var(--lab-secondary);
}

.mock-metric-highlight strong {
  color: var(--lab-coral);
}

.mock-lower-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(150px, 0.7fr);
  gap: 8px;
  margin-top: 12px;
}

.mock-tools,
.mock-activity {
  min-width: 0;
  padding: 15px;
  border: 1px solid var(--lab-line);
  background: var(--lab-surface);
}

.mock-panel-topline strong {
  color: var(--lab-ink);
  font-size: 10px;
  font-weight: 800;
}

.mock-panel-topline > span,
.mock-panel-topline > .v-icon {
  color: var(--lab-primary);
  font-size: 8px;
  font-weight: 750;
}

.mock-tool-list {
  display: grid;
  margin-top: 10px;
}

.mock-tool-row {
  display: grid;
  grid-template-columns: 25px minmax(0, 1fr) auto;
  gap: 7px;
  align-items: center;
  min-height: 42px;
  border-top: 1px solid var(--lab-line);
}

.mock-tool-icon {
  display: grid;
  width: 25px;
  height: 25px;
  place-items: center;
  color: var(--lab-primary);
}

.mock-tool-icon-secondary {
  background: var(--lab-secondary-soft);
  color: var(--lab-secondary);
}

.mock-tool-icon-primary {
  background: var(--lab-primary-soft);
}

.mock-tool-icon-highlight {
  background: rgb(255 211 91 / 0.35);
  color: var(--lab-coral);
}

.mock-tool-copy {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.mock-tool-copy strong {
  overflow: hidden;
  color: var(--lab-ink);
  font-size: 8px;
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mock-tool-copy small {
  overflow: hidden;
  color: var(--lab-muted);
  font-size: 7px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mock-tool-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--lab-muted);
  font-size: 7px;
  font-weight: 750;
  white-space: nowrap;
}

.mock-tool-status i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}

.mock-tool-status-secondary {
  color: var(--lab-secondary);
}

.mock-tool-status-primary {
  color: var(--lab-primary);
}

.mock-tool-status-highlight {
  color: var(--lab-coral);
}

.mock-chart {
  position: relative;
  min-height: 120px;
  margin-top: 18px;
  padding-top: 29px;
  border-bottom: 1px solid var(--lab-line);
}

.chart-value {
  color: var(--lab-primary);
  font-size: 27px;
  font-weight: 750;
  letter-spacing: -0.05em;
}

.chart-bars {
  display: flex;
  align-items: flex-end;
  gap: 5px;
  height: 47px;
  margin-top: 10px;
}

.chart-bars i {
  flex: 1;
  background: var(--lab-primary-soft);
}

.chart-bars i:nth-child(1) {
  height: 22%;
}

.chart-bars i:nth-child(2) {
  height: 39%;
}

.chart-bars i:nth-child(3) {
  height: 32%;
}

.chart-bars i:nth-child(4) {
  height: 61%;
  background: var(--lab-secondary);
}

.chart-bars i:nth-child(5) {
  height: 52%;
  background: var(--lab-secondary);
}

.chart-bars i:nth-child(6) {
  height: 78%;
  background: var(--lab-primary);
}

.chart-bars i:nth-child(7) {
  height: 94%;
  background: var(--lab-highlight);
}

.chart-axis {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  color: var(--lab-muted);
  font-size: 7px;
}

.color-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding-top: 22px;
  color: var(--lab-muted);
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.color-footer strong {
  color: var(--lab-primary);
}

@media (max-width: 900px) {
  .color-page-inner {
    width: min(100% - 48px, 680px);
  }

  .color-hero {
    grid-template-columns: 1fr;
    gap: 28px;
    min-height: 0;
    padding-bottom: 42px;
  }

  .color-breadcrumb {
    margin-bottom: 44px;
  }

  .hero-composition {
    min-height: 300px;
  }

  .composition-sun {
    top: 24px;
    right: 18%;
  }

  .composition-wave {
    bottom: 28px;
  }

  .composition-card {
    bottom: 86px;
  }

  .palette-choices {
    grid-template-columns: 1fr;
  }

  .palette-choice {
    min-height: 0;
  }

  .detail-content {
    grid-template-columns: 1fr;
  }

  .swatch-panel {
    width: min(100%, 430px);
  }
}

@media (max-width: 600px) {
  .color-page {
    min-height: calc(100vh - 63px);
  }

  .color-page-inner {
    width: calc(100% - 32px);
    padding-top: 25px;
  }

  .color-hero {
    padding-bottom: 30px;
  }

  .color-breadcrumb {
    margin-bottom: 37px;
  }

  .hero-copy h1 {
    font-size: 50px;
  }

  .hero-description {
    font-size: 13px;
  }

  .hero-composition {
    min-height: 260px;
  }

  .composition-sun {
    width: 78px;
    height: 78px;
  }

  .composition-wave {
    height: 125px;
  }

  .composition-card {
    bottom: 61px;
    left: 4%;
    width: 175px;
    padding: 14px;
  }

  .composition-card strong {
    font-size: 18px;
  }

  .composition-label {
    font-size: 8px;
  }

  .palette-section,
  .palette-detail {
    padding: 42px 0;
  }

  .section-heading h2 {
    font-size: 27px;
  }

  .detail-content {
    gap: 24px;
    margin-top: 28px;
  }

  .swatch-row {
    grid-template-columns: 27px minmax(0, 1fr) auto;
  }

  .preview-heading {
    padding: 0 15px;
  }

  .mock-app {
    grid-template-columns: 1fr;
  }

  .mock-sidebar {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 12px;
    align-items: center;
    padding: 12px 15px;
    border-right: 0;
    border-bottom: 1px solid var(--lab-line);
  }

  .mock-nav {
    display: flex;
    justify-content: flex-end;
    gap: 4px;
    margin-top: 0;
    overflow-x: auto;
  }

  .mock-nav-item {
    flex-shrink: 0;
    min-height: 28px;
    padding: 0 6px;
    font-size: 8px;
  }

  .mock-sidebar-foot {
    display: none;
  }

  .mock-main {
    padding: 15px;
  }

  .mock-welcome {
    min-height: 112px;
    padding: 16px;
  }

  .mock-welcome h3 {
    font-size: 20px;
  }

  .mock-graphic {
    width: 93px;
    height: 70px;
  }

  .mock-lower-grid {
    grid-template-columns: 1fr;
  }

  .mock-activity {
    min-height: 176px;
  }

  .color-footer {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
    padding-bottom: 8px;
  }
}

@media (max-width: 400px) {
  .mock-metrics {
    grid-template-columns: 1fr;
  }

  .mock-metric {
    min-height: 68px;
  }

  .mock-metric strong {
    font-size: 20px;
  }

  .mock-welcome {
    align-items: flex-start;
  }

  .mock-graphic {
    position: absolute;
    right: -4px;
    bottom: -8px;
    opacity: 0.65;
  }
}
</style>
