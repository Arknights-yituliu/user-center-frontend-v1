<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

const toolNodes = [
  'mdi-apps',
  'mdi-view-grid-outline',
  'mdi-shape-outline',
  'mdi-view-dashboard-outline',
]

type SyncConnection = {
  d: string
  key: string
}

const syncConnectionNodes = [
  { key: 'tool-1', selector: '.sync-tool-node-1', bend: 0.24 },
  { key: 'tool-2', selector: '.sync-tool-node-2', bend: -0.38 },
  { key: 'tool-3', selector: '.sync-tool-node-3', bend: -0.24 },
  { key: 'tool-4', selector: '.sync-tool-node-4', bend: 0.28 },
  { key: 'laptop', selector: '.sync-device-laptop', bend: 0.22 },
  { key: 'tablet', selector: '.sync-device-tablet', bend: -0.12 },
  { key: 'phone', selector: '.sync-device-phone', bend: 0.2 },
  { key: 'monitor', selector: '.sync-device-monitor', bend: -0.2 },
  { key: 'watch', selector: '.sync-device-watch', bend: 0 },
]

const diagramRef = ref<HTMLElement | null>(null)
const coreLogoRef = ref<HTMLImageElement | null>(null)
const syncConnections = ref<SyncConnection[]>([])
const diagramSize = ref({ width: 520, height: 470 })
let syncResizeObserver: ResizeObserver | null = null

function updateSyncConnections(): void {
  const diagram = diagramRef.value
  const coreLogo = coreLogoRef.value

  if (!diagram || !coreLogo) {
    return
  }

  const diagramRect = diagram.getBoundingClientRect()
  const coreRect = coreLogo.getBoundingClientRect()

  if (!diagramRect.width || !diagramRect.height || !coreRect.width) {
    return
  }

  diagramSize.value = {
    width: diagramRect.width,
    height: diagramRect.height,
  }

  const center = {
    x: coreRect.left - diagramRect.left + coreRect.width / 2,
    y: coreRect.top - diagramRect.top + coreRect.height / 2,
  }
  const coreRadius = Math.min(coreRect.width, coreRect.height) / 2
  const coreGap = Math.max(12, diagramRect.width * 0.025)
  const nodeGap = Math.max(10, diagramRect.width * 0.03)

  syncConnections.value = syncConnectionNodes.flatMap((node) => {
    const element = diagram.querySelector<HTMLElement>(node.selector)

    if (!element) {
      return []
    }

    const nodeRect = element.getBoundingClientRect()
    const nodeCenter = {
      x: nodeRect.left - diagramRect.left + nodeRect.width / 2,
      y: nodeRect.top - diagramRect.top + nodeRect.height / 2,
    }
    const deltaX = nodeCenter.x - center.x
    const deltaY = nodeCenter.y - center.y
    const distance = Math.hypot(deltaX, deltaY)

    if (!distance) {
      return []
    }

    const unit = {
      x: deltaX / distance,
      y: deltaY / distance,
    }
    const nodeRadius = Math.max(nodeRect.width, nodeRect.height) / 2
    const start = {
      x: nodeCenter.x - unit.x * (nodeRadius + nodeGap),
      y: nodeCenter.y - unit.y * (nodeRadius + nodeGap),
    }
    const end = {
      x: center.x + unit.x * (coreRadius + coreGap),
      y: center.y + unit.y * (coreRadius + coreGap),
    }
    const midpoint = {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
    }
    const bendAmount = Math.min(30, Math.max(14, diagramRect.width * 0.055)) * node.bend
    const control = {
      x: midpoint.x - unit.y * bendAmount,
      y: midpoint.y + unit.x * bendAmount,
    }

    return [
      {
        key: node.key,
        d: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`,
      },
    ]
  })
}

onMounted(async () => {
  await nextTick()
  updateSyncConnections()

  if (diagramRef.value) {
    syncResizeObserver = new ResizeObserver(updateSyncConnections)
    syncResizeObserver.observe(diagramRef.value)
  }

  coreLogoRef.value?.addEventListener('load', updateSyncConnections)
})

onBeforeUnmount(() => {
  syncResizeObserver?.disconnect()
  coreLogoRef.value?.removeEventListener('load', updateSyncConnections)
})
</script>

<template>
  <div class="landing-page">
    <section class="landing-hero">
      <div class="landing-copy">
        <div class="landing-kicker">
          <span class="kicker-mark"></span>
          酸橙云 / This Land Cloud
        </div>
        <h1>在设备和工具之间<br /><em>无缝同步你的数据</em></h1>
        <p class="landing-description">
          酸橙云可以把你的个人配置和使用数据会保存到云端。更换设备或浏览器后，也能继续之前的体验。
        </p>

        <div class="landing-actions">
          <RouterLink class="landing-primary" to="/home">
            进入个人中心
            <v-icon icon="mdi-arrow-top-right" size="18"></v-icon>
          </RouterLink>
          <RouterLink class="landing-secondary" to="/projects">
            进入授权控制台
            <v-icon icon="mdi-arrow-top-right" size="17"></v-icon>
          </RouterLink>
        </div>

        <div class="landing-note">
          <span class="note-line"></span>
          <span>连接多种工具</span>
          <span class="note-line note-line-short"></span>
        </div>
      </div>

      <div
        class="landing-visual"
        role="img"
        aria-label="酸橙云在多个工具与多种设备之间双向同步数据"
      >
        <div ref="diagramRef" class="sync-diagram">
          <svg
            class="sync-connections"
            :viewBox="`0 0 ${diagramSize.width} ${diagramSize.height}`"
            aria-hidden="true"
          >
            <defs>
              <marker
                id="sync-arrow"
                markerWidth="6"
                markerHeight="6"
                refX="5"
                refY="3"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 6 3 L 0 6 z" fill="#ffd23f" />
              </marker>
            </defs>
            <path
              v-for="connection in syncConnections"
              :key="connection.key"
              class="sync-connection-path"
              :d="connection.d"
            />
          </svg>

          <div class="sync-orbit" aria-hidden="true"></div>

          <img
            ref="coreLogoRef"
            class="sync-core-logo"
            src="/logo.svg"
            alt="酸橙云"
            width="166"
            height="166"
          />

          <div
            v-for="(toolIcon, index) in toolNodes"
            :key="toolIcon"
            class="sync-symbol sync-tool-symbol"
            :class="`sync-tool-node-${index + 1}`"
          >
            <v-icon :icon="toolIcon" size="21" aria-hidden="true"></v-icon>
          </div>

          <div class="sync-symbol sync-device-symbol sync-device-laptop">
            <v-icon icon="mdi-laptop" size="25" aria-hidden="true"></v-icon>
          </div>
          <div class="sync-symbol sync-device-symbol sync-device-tablet">
            <v-icon icon="mdi-tablet" size="25" aria-hidden="true"></v-icon>
          </div>
          <div class="sync-symbol sync-device-symbol sync-device-phone">
            <v-icon icon="mdi-cellphone" size="25" aria-hidden="true"></v-icon>
          </div>
          <div class="sync-symbol sync-device-symbol sync-device-monitor">
            <v-icon icon="mdi-monitor" size="25" aria-hidden="true"></v-icon>
          </div>
          <div class="sync-symbol sync-device-symbol sync-device-watch">
            <v-icon icon="mdi-watch-variant" size="24" aria-hidden="true"></v-icon>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.landing-page {
  width: 100%;
  min-width: 0;
  max-width: 1280px;
  margin: 0 auto;
  padding: 24px 32px 72px;
}

.landing-hero {
  position: relative;
  overflow: hidden;
  display: grid;
  width: 100%;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) minmax(380px, 0.88fr);
  gap: 52px;
  align-items: center;
  min-height: min(650px, calc(100vh - 112px));
  padding: 64px 66px;
  background: var(--site-accent);
  box-shadow: 14px 14px 0 var(--site-warm);
}

.landing-hero::before {
  position: absolute;
  inset: 0;
  z-index: 0;
  background-image: url('/landing-texture.png');
  background-size: 96px 96px;
  content: '';
  opacity: 1;
  pointer-events: none;
}

.landing-copy,
.landing-visual {
  position: relative;
  z-index: 1;
}

.landing-kicker {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 0;
  color: var(--site-warm);
  font-size: 13px;
  font-weight: 750;
  letter-spacing: 0.08em;
}

.kicker-mark {
  width: 9px;
  height: 9px;
  background: var(--site-warm);
}

.landing-copy h1 {
  margin: 20px 0 0;
  color: var(--site-surface);
  font-size: clamp(48px, 6vw, 68px);
  font-weight: 650;
  letter-spacing: 0;
  line-height: 0.98;
}

.landing-copy h1 em {
  color: var(--site-warm);
  font-style: normal;
}

.landing-description {
  max-width: 450px;
  margin: 26px 0 0;
  color: rgb(255 253 246 / 0.8);
  font-size: 15px;
  line-height: 1.75;
}

.landing-actions {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-top: 30px;
}

.landing-primary {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 14px 18px;
  background: var(--site-warm);
  color: var(--site-ink);
  font-size: 13px;
  font-weight: 750;
  transition:
    background 160ms ease,
    transform 160ms ease;
}

.landing-primary:hover {
  background: var(--site-surface);
  transform: translateY(-2px);
}

.landing-secondary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 13px 0;
  color: var(--site-surface);
  border-bottom: 1px solid rgb(255 253 246 / 0.65);
  font-size: 13px;
  font-weight: 750;
}

.landing-secondary:hover {
  color: var(--site-warm);
  border-color: var(--site-warm);
}

.landing-note {
  display: none;
  align-items: center;
  gap: 12px;
  margin-top: 52px;
  color: rgb(255 253 246 / 0.7);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.note-line {
  width: 38px;
  height: 1px;
  background: var(--site-warm);
}

.note-line-short {
  width: 18px;
}

.landing-visual {
  position: relative;
  display: grid;
  min-width: 0;
  min-height: 470px;
  place-items: center;
}

.sync-diagram {
  position: relative;
  width: min(100%, 520px);
  aspect-ratio: 520 / 470;
}

.sync-connections {
  position: absolute;
  inset: 0;
  z-index: 3;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.sync-connection-path {
  fill: none;
  stroke: rgb(255 253 246 / 0.56);
  stroke-dasharray: 4 8;
  stroke-linecap: round;
  stroke-width: 1.45;
  marker-start: url('#sync-arrow');
  marker-end: url('#sync-arrow');
  animation: sync-dash 16s linear infinite;
}

.sync-connection-path:nth-of-type(even) {
  animation-direction: reverse;
}

.sync-orbit {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 2;
  width: 78%;
  aspect-ratio: 1;
  border: 1px dashed rgb(255 253 246 / 0.28);
  border-radius: 50%;
  pointer-events: none;
  transform: translate(-50%, -50%);
  animation: sync-orbit 26s linear infinite;
}

.sync-core-logo {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 1;
  display: block;
  width: clamp(128px, 32%, 168px);
  height: auto;
  transform: translate(-50%, -50%);
}

.sync-symbol {
  position: absolute;
  z-index: 5;
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  color: var(--site-ink);
}

.sync-tool-symbol {
  border: 1px solid rgb(255 253 246 / 0.8);
  border-radius: 50%;
  background: var(--site-warm);
  box-shadow: 5px 5px 0 rgb(239 120 168 / 0.7);
}

.sync-tool-node-1 {
  top: 8%;
  left: 4%;
}

.sync-tool-node-2 {
  top: 26%;
  right: 16%;
  border-radius: 7px;
  background: var(--site-cyan);
  transform: rotate(45deg);
}

.sync-tool-node-3 {
  top: 64%;
  right: 3%;
  border-radius: 50% 50% 50% 8px;
  background: var(--site-pink);
  transform: rotate(-18deg);
}

.sync-tool-node-4 {
  top: 80%;
  left: 24%;
  border-radius: 5px;
  background: var(--site-green);
  transform: rotate(12deg);
}

.sync-tool-node-2 .v-icon {
  transform: rotate(-45deg);
}

.sync-tool-node-3 .v-icon {
  transform: rotate(18deg);
}

.sync-tool-node-4 .v-icon {
  transform: rotate(-12deg);
}

.sync-device-symbol {
  width: 52px;
  height: 52px;
  border: 1px solid rgb(255 253 246 / 0.78);
  border-radius: 50%;
  background: rgb(213 242 243 / 0.2);
  color: var(--site-surface);
  box-shadow: 5px 5px 0 rgb(91 199 212 / 0.7);
}

.sync-device-laptop {
  top: 5%;
  right: 8%;
}

.sync-device-tablet {
  top: 45%;
  right: 2%;
  box-shadow: 5px 5px 0 rgb(239 120 168 / 0.7);
}

.sync-device-phone {
  top: 72%;
  left: 2%;
  box-shadow: 5px 5px 0 rgb(255 210 63 / 0.75);
}

.sync-device-monitor {
  top: 38%;
  left: 1%;
  box-shadow: 5px 5px 0 rgb(91 199 212 / 0.7);
}

.sync-device-watch {
  top: 1%;
  right: 48%;
  width: 42px;
  height: 42px;
  box-shadow: 5px 5px 0 rgb(255 210 63 / 0.75);
}

@keyframes sync-dash {
  to {
    stroke-dashoffset: -48;
  }
}

@keyframes sync-orbit {
  to {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .sync-connection-path,
  .sync-orbit {
    animation: none;
  }
}

@media (max-width: 800px) {
  .landing-page {
    padding: 38px 24px 60px;
  }

  .landing-hero {
    grid-template-columns: minmax(0, 1fr);
    gap: 34px;
    min-height: 0;
    padding: 48px 36px 42px;
  }

  .landing-visual {
    min-height: 390px;
  }
}

@media (max-width: 520px) {
  .landing-page {
    padding-right: 16px;
    padding-left: 16px;
  }

  .landing-copy h1 {
    font-size: 38px;
  }

  .landing-hero {
    padding: 38px 22px 30px;
    box-shadow: 8px 8px 0 var(--site-warm);
  }

  .landing-actions {
    align-items: flex-start;
    flex-direction: column;
    gap: 13px;
  }

  .landing-visual {
    min-height: 330px;
  }

  .sync-symbol {
    width: 34px;
    height: 34px;
  }

  .sync-device-symbol {
    width: 42px;
    height: 42px;
  }

  .sync-device-watch {
    width: 34px;
    height: 34px;
  }

  .sync-symbol .v-icon {
    font-size: 18px !important;
  }
}

@media (max-width: 360px) {
  .landing-copy h1 {
    font-size: 30px;
  }

  .sync-core-logo {
    width: 90px;
  }

  .sync-symbol {
    width: 26px;
    height: 26px;
  }

  .sync-device-symbol {
    width: 34px;
    height: 34px;
  }

  .sync-device-watch {
    width: 28px;
    height: 28px;
  }

  .sync-symbol .v-icon {
    font-size: 15px !important;
  }

  .sync-tool-node-2 {
    top: 29%;
    right: 10%;
  }

  .sync-tool-node-3 {
    top: 65%;
  }

  .sync-tool-node-4 {
    left: 16%;
  }

  .sync-device-phone {
    left: 0;
  }
}
</style>
