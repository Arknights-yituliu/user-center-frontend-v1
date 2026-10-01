<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import SecondaryPageHeader from '../components/SecondaryPageHeader.vue'

interface GuideQuestion {
  question: string
  answer: string
}

const guideQuestions: GuideQuestion[] = [
  {
    question: '酸橙云会保存我的哪些内容？',
    answer:
      '酸橙云主要保存已接入工具允许同步的个人配置和使用数据，例如偏好设置、收藏内容或工具进度。它不会读取你设备上的所有文件，具体保存范围以每个工具展示的说明和授权范围为准。',
  },
  {
    question: '换了设备，怎样找回之前的数据？',
    answer:
      '在新设备上登录同一个酸橙云账号，然后打开已经接入酸橙云的工具。工具确认你的身份并获得必要授权后，就可以读取属于你的云端数据。',
  },
  {
    question: '不登录还能使用工具吗？',
    answer:
      '这取决于具体工具。有些基础功能可以直接使用，但需要跨设备保存、同步或恢复个人数据的功能通常需要登录酸橙云账号。',
  },
  {
    question: '授权之后，工具能看到我的登录密码吗？',
    answer:
      '不能。登录密码由酸橙云账号体系负责保护，接入工具只会在你同意的范围内访问对应的功能或数据，不会拿到你的登录密码。',
  },
  {
    question: '我可以取消某个工具的授权吗？',
    answer:
      '可以。在个人中心的“我的授权应用”中找到对应工具并撤销授权。撤销后，该工具将不能继续使用这份授权访问你的数据；已经保存的数据是否保留、如何删除，以工具提供的管理方式为准。',
  },
  {
    question: '酸橙云和浏览器缓存有什么区别？',
    answer:
      '浏览器缓存只存在于当前浏览器和设备中，清理缓存或更换设备后可能找不回来。酸橙云把支持同步的数据和账号关联起来，登录后可以在不同设备上继续使用。',
  },
]

const openQuestion = ref(0)

function toggleQuestion(index: number): void {
  openQuestion.value = openQuestion.value === index ? -1 : index
}
</script>

<template>
  <main class="user-guide-page">
    <SecondaryPageHeader
      title-id="guide-title"
      kicker="USER GUIDE"
      title-a="用户指南"
      description="了解酸橙云如何保存、同步和管理你的个人数据"
      visual-bottom="USER GUIDE"
    >
      <template #visual>
        <div class="guide-hero-texture" aria-hidden="true">
          <span class="guide-texture-route guide-texture-route-primary"></span>
          <span class="guide-texture-route guide-texture-route-secondary"></span>
          <span class="guide-texture-route guide-texture-route-cross"></span>
          <span class="guide-texture-node guide-texture-node-origin"></span>
          <span class="guide-texture-node guide-texture-node-cloud"></span>
          <span class="guide-texture-node guide-texture-node-sync"></span>
          <span class="guide-texture-node guide-texture-node-device"></span>
        </div>

        <div class="guide-hero-mark" aria-hidden="true">
          <img src="/logo.svg" alt="" width="76" height="76" />
          <span>USER GUIDE</span>
        </div>
      </template>
    </SecondaryPageHeader>

    <nav class="guide-index" aria-label="用户指南章节导航">
      <div class="guide-index-tabs">
        <a class="guide-index-tab guide-index-tab-blue" href="#overview">
          <span class="guide-index-tab-meta">
            <span>01</span>
            <v-icon icon="mdi-arrow-top-right" size="18"></v-icon>
          </span>
          <strong>它有什么用</strong>
        </a>
        <a class="guide-index-tab guide-index-tab-yellow" href="#how-it-works">
          <span class="guide-index-tab-meta">
            <span>02</span>
            <v-icon icon="mdi-arrow-top-right" size="18"></v-icon>
          </span>
          <strong>怎么工作</strong>
        </a>
        <a class="guide-index-tab guide-index-tab-pink" href="#using-it">
          <span class="guide-index-tab-meta">
            <span>03</span>
            <v-icon icon="mdi-arrow-top-right" size="18"></v-icon>
          </span>
          <strong>可以做什么</strong>
        </a>
        <a class="guide-index-tab guide-index-tab-green" href="#faq">
          <span class="guide-index-tab-meta">
            <span>04</span>
            <v-icon icon="mdi-arrow-top-right" size="18"></v-icon>
          </span>
          <strong>常见问题</strong>
        </a>
      </div>
    </nav>

    <section id="overview" class="guide-section guide-overview" aria-labelledby="overview-title">
      <div class="guide-section-heading">
        <p class="section-label">01 / 为什么需要酸橙云</p>
        <h2 id="overview-title">把“只在这台设备上”的数据，变成“登录后随时可取”的个人数据。</h2>
        <p>
          你使用的每个工具，都可能积累一部分设置、收藏和进度。酸橙云负责把这些支持同步的数据和你的账号关联起来，让工具可以在得到你同意后，为你保存和恢复它们。
        </p>
      </div>

      <div class="guide-benefit-grid">
        <article class="guide-benefit">
          <span class="benefit-number">01</span>
          <v-icon class="benefit-icon" icon="mdi-laptop-account" size="28"></v-icon>
          <h3>换设备，也能接着用</h3>
          <p>从电脑换到手机，或更换浏览器后，登录账号即可找回已经同步的数据。</p>
        </article>
        <article class="guide-benefit guide-benefit-yellow">
          <span class="benefit-number">02</span>
          <v-icon class="benefit-icon" icon="mdi-content-save-sync-outline" size="28"></v-icon>
          <h3>减少重复设置</h3>
          <p>常用的偏好、收藏和进度可以交给云端保存，不用每次重新配置。</p>
        </article>
        <article class="guide-benefit guide-benefit-pink">
          <span class="benefit-number">03</span>
          <v-icon class="benefit-icon" icon="mdi-shield-check-outline" size="28"></v-icon>
          <h3>授权范围由你掌握</h3>
          <p>每个工具只在你同意的范围内访问数据，你可以随时查看或撤销已有授权。</p>
        </article>
      </div>
    </section>

    <section
      id="how-it-works"
      class="guide-section guide-process"
      aria-labelledby="how-it-works-title"
    >
      <div class="guide-section-heading guide-section-heading-wide">
        <p class="section-label">02 / 大致工作原理</p>
        <h2 id="how-it-works-title">一次登录，完成身份确认；一次授权，建立数据连接。</h2>
        <p>
          你不需要理解复杂的技术名词，只要记住：工具先确认“你是谁”，再确认“它可以访问什么”，最后才会读取或保存对应数据。
        </p>
      </div>

      <ol class="guide-process-list">
        <li class="process-step">
          <div class="process-step-number">1</div>
          <div class="process-step-icon"><v-icon icon="mdi-open-in-new" size="24"></v-icon></div>
          <div>
            <h3>打开已接入的工具</h3>
            <p>工具发现需要账号数据时，会引导你进入酸橙云完成连接。</p>
          </div>
        </li>
        <li class="process-step">
          <div class="process-step-number">2</div>
          <div class="process-step-icon">
            <v-icon icon="mdi-account-check-outline" size="24"></v-icon>
          </div>
          <div>
            <h3>登录酸橙云账号</h3>
            <p>酸橙云确认当前操作属于你，工具不需要接触你的登录密码。</p>
          </div>
        </li>
        <li class="process-step">
          <div class="process-step-number">3</div>
          <div class="process-step-icon"><v-icon icon="mdi-tune-variant" size="24"></v-icon></div>
          <div>
            <h3>确认授权范围</h3>
            <p>你可以看到工具想要使用的能力，并决定是否允许这次连接。</p>
          </div>
        </li>
        <li class="process-step">
          <div class="process-step-number">4</div>
          <div class="process-step-icon">
            <v-icon icon="mdi-cloud-sync-outline" size="24"></v-icon>
          </div>
          <div>
            <h3>开始同步和恢复</h3>
            <p>连接建立后，工具按约定保存或读取属于你的数据。</p>
          </div>
        </li>
      </ol>

      <div class="guide-note">
        <v-icon icon="mdi-lightbulb-on-outline" size="22"></v-icon>
        <p>
          <strong>简单理解：</strong
          >酸橙云像一个只为你开放的云端抽屉，工具需要经过你的允许，才能拿到抽屉里对应的东西。
        </p>
      </div>
    </section>

    <section id="using-it" class="guide-section guide-usage" aria-labelledby="using-it-title">
      <div class="guide-section-heading">
        <p class="section-label">03 / 你可以用它做什么</p>
        <h2 id="using-it-title">让账号成为工具之间稳定的连接点。</h2>
      </div>

      <div class="guide-usage-layout">
        <div class="guide-usage-list">
          <article class="usage-row">
            <span class="usage-row-icon"
              ><v-icon icon="mdi-swap-horizontal" size="23"></v-icon
            ></span>
            <div>
              <h3>在不同设备间继续使用</h3>
              <p>登录同一个账号，支持同步的内容就能跟随你移动，而不是跟随某个浏览器。</p>
            </div>
          </article>
          <article class="usage-row">
            <span class="usage-row-icon usage-row-icon-yellow"
              ><v-icon icon="mdi-apps" size="23"></v-icon
            ></span>
            <div>
              <h3>管理多个工具的数据连接</h3>
              <p>在个人中心查看哪些工具已经连接、可以访问哪些数据，以及最近的授权状态。</p>
            </div>
          </article>
          <article class="usage-row">
            <span class="usage-row-icon usage-row-icon-pink"
              ><v-icon icon="mdi-shield-account-outline" size="23"></v-icon
            ></span>
            <div>
              <h3>随时收回不再需要的访问</h3>
              <p>不再使用某个工具时，可以撤销授权，让账号里的数据连接保持清晰可控。</p>
            </div>
          </article>
        </div>

        <aside class="guide-usage-aside">
          <v-icon icon="mdi-account-lock-outline" size="30"></v-icon>
          <p class="usage-aside-label">你始终是数据的主人</p>
          <p>
            酸橙云提供保存和连接能力，但不会替你决定哪些工具值得信任。每次授权前看一眼范围，定期清理不再使用的连接，就能保持账号整洁。
          </p>
          <RouterLink to="/home" class="usage-aside-link">
            查看我的账号设置
            <v-icon icon="mdi-arrow-top-right" size="16"></v-icon>
          </RouterLink>
        </aside>
      </div>
    </section>

    <section id="faq" class="guide-section guide-faq" aria-labelledby="faq-title">
      <div class="guide-section-heading guide-section-heading-faq">
        <p class="section-label">04 / 常见问题</p>
        <h2 id="faq-title">第一次使用时，最容易遇到的几个问题。</h2>
        <p>下面的回答尽量用日常语言说明。如果某个工具有额外规则，请以它自己的提示为准。</p>
      </div>

      <div class="faq-list">
        <article v-for="(item, index) in guideQuestions" :key="item.question" class="faq-item">
          <button
            class="faq-trigger"
            type="button"
            :aria-expanded="openQuestion === index"
            :aria-controls="`faq-answer-${index}`"
            @click="toggleQuestion(index)"
          >
            <span class="faq-index">Q{{ String(index + 1).padStart(2, '0') }}</span>
            <span class="faq-question">{{ item.question }}</span>
            <v-icon
              class="faq-chevron"
              :class="{ 'faq-chevron-open': openQuestion === index }"
              icon="mdi-chevron-down"
              size="22"
            ></v-icon>
          </button>
          <div v-if="openQuestion === index" :id="`faq-answer-${index}`" class="faq-answer">
            <p>{{ item.answer }}</p>
          </div>
        </article>
      </div>
    </section>
  </main>
</template>

<style scoped>
.user-guide-page {
  width: min(1200px, calc(100% - 64px));
  margin: 0 auto;
  padding: 32px 0 80px;
  color: var(--site-ink);
}

.guide-hero {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  display: grid;
  grid-template-rows: auto 1fr;
  align-items: stretch;
  gap: 20px;
  min-height: clamp(280px, 34vh, 360px);
  padding: 32px 66px 36px;
  border-left: 12px solid var(--site-accent);
  background: var(--site-surface);
  box-shadow: 10px 10px 0 var(--site-pink);
}

.guide-hero-top {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  min-width: 0;
}

.guide-hero-copy {
  position: relative;
  z-index: 1;
  align-self: center;
  max-width: calc(100% - 180px);
}

.guide-breadcrumb {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-size: 14px;
  font-weight: 750;
  line-height: 1.4;
}

.guide-breadcrumb a {
  color: var(--site-accent);
}

.guide-breadcrumb span {
  color: var(--site-muted);
}

.guide-breadcrumb span[aria-current='page'] {
  color: var(--site-ink);
}

.guide-breadcrumb a:hover,
.guide-breadcrumb a:focus-visible {
  color: var(--site-accent);
}

.guide-breadcrumb a:focus-visible {
  outline: 2px solid var(--site-accent);
  outline-offset: 4px;
}

.guide-hero h1 {
  max-width: 660px;
  margin: 0;
  color: var(--site-ink);
  font-size: clamp(42px, 5.5vw, 70px);
  font-weight: 650;
  letter-spacing: 0;
  line-height: 1;
}

.guide-hero-intro {
  max-width: 500px;
  margin: 20px 0 0;
  color: var(--site-muted);
  font-size: 15px;
  line-height: 1.8;
}

.guide-hero-mark {
  position: absolute;
  z-index: 1;
  top: 50%;
  right: 66px;
  display: flex;
  width: 150px;
  height: 150px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  transform: translateY(-50%);
  border: 1px solid var(--site-line);
  background: var(--site-accent-soft);
  color: var(--site-accent);
}

.guide-hero-mark img {
  display: block;
  width: 76px;
  height: 76px;
  padding: 11px;
  border: 1px solid var(--site-ink);
  background: var(--site-warm);
  filter: brightness(0);
}

.guide-hero-mark span {
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.16em;
}

.guide-hero-texture {
  --guide-texture-grid-size: 26px;
  --guide-texture-grid-color: rgb(25 118 197 / 0.08);
  --guide-texture-line-color: rgb(25 118 197 / 0.28);
  --guide-texture-highlight-color: rgb(239 120 168 / 0.5);
  --guide-texture-node-color: var(--site-accent);
  --guide-texture-flow-duration: 6s;
  --guide-texture-scan-duration: 8s;
  position: absolute;
  z-index: 0;
  inset: 0 0 0 auto;
  width: 100%;
  overflow: hidden;
  pointer-events: none;
}

.guide-hero-texture::before {
  position: absolute;
  inset: 12px 0;
  background:
    repeating-linear-gradient(
      90deg,
      transparent 0 calc(var(--guide-texture-grid-size) - 1px),
      var(--guide-texture-grid-color) calc(var(--guide-texture-grid-size) - 1px)
        var(--guide-texture-grid-size)
    ),
    repeating-linear-gradient(
      0deg,
      transparent 0 calc(var(--guide-texture-grid-size) - 1px),
      var(--guide-texture-grid-color) calc(var(--guide-texture-grid-size) - 1px)
        var(--guide-texture-grid-size)
    );
  -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 30%, #000 100%);
  mask-image: linear-gradient(90deg, transparent 0%, #000 30%, #000 100%);
  content: '';
}

.guide-hero-texture::after {
  position: absolute;
  top: 12px;
  bottom: 12px;
  left: 18%;
  width: 1px;
  background: var(--guide-texture-highlight-color);
  content: '';
  animation: guide-texture-scan var(--guide-texture-scan-duration) ease-in-out infinite;
  opacity: 0;
}

.guide-texture-route {
  position: absolute;
  height: 3px;
  margin-top: -1px;
  overflow: hidden;
  transform-origin: left center;
  background: var(--guide-texture-line-color);
}

.guide-texture-route::after {
  position: absolute;
  top: -1px;
  left: 0;
  width: 38px;
  height: 3px;
  background: rgb(25 118 197 / 0.68);
  box-shadow: 0 0 6px rgb(25 118 197 / 0.24);
  content: '';
  animation: guide-texture-flow var(--guide-texture-flow-duration) linear infinite;
}

.guide-texture-route-primary {
  top: 64%;
  left: 8%;
  width: 82%;
  transform: rotate(-22deg);
}

.guide-texture-route-secondary {
  top: 30%;
  left: 20%;
  width: 72%;
  transform: rotate(24deg);
  background: var(--guide-texture-highlight-color);
}

.guide-texture-route-secondary::after {
  background: var(--guide-texture-highlight-color);
  box-shadow: 0 0 6px rgb(239 120 168 / 0.24);
  animation-delay: -1.2s;
}

.guide-texture-route-cross {
  top: 64%;
  left: 25%;
  width: 55%;
}

.guide-texture-route-cross::after {
  animation-delay: -2.2s;
}

.guide-texture-node {
  --guide-texture-node-pulse: rgb(25 118 197 / 0.1);
  position: absolute;
  width: 8px;
  height: 8px;
  border: 1px solid var(--guide-texture-node-color);
  background: var(--site-surface);
  animation: guide-texture-node-pulse var(--guide-texture-flow-duration) ease-in-out infinite;
}

.guide-texture-node-origin {
  top: 63%;
  left: 7%;
}

.guide-texture-node-cloud {
  --guide-texture-node-pulse: rgb(239 120 168 / 0.12);
  top: 26%;
  left: 88%;
  border-color: var(--guide-texture-highlight-color);
  animation-delay: -0.9s;
}

.guide-texture-node-sync {
  --guide-texture-node-pulse: rgb(239 120 168 / 0.12);
  top: 72%;
  left: 76%;
  border-color: var(--site-pink);
  animation-delay: -1.7s;
}

.guide-texture-node-device {
  --guide-texture-node-pulse: rgb(54 191 200 / 0.12);
  top: 61%;
  left: 48%;
  border-color: var(--site-green);
  animation-delay: -2.4s;
}

@keyframes guide-texture-flow {
  0% {
    opacity: 0;
    transform: translateX(-42px);
  }

  14%,
  84% {
    opacity: 0.95;
  }

  100% {
    opacity: 0;
    transform: translateX(calc(100% + 42px));
  }
}

@keyframes guide-texture-scan {
  0%,
  12% {
    left: 18%;
    opacity: 0;
  }

  28%,
  72% {
    opacity: 0.24;
  }

  88%,
  100% {
    left: 84%;
    opacity: 0;
  }
}

@keyframes guide-texture-node-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 transparent;
    transform: scale(1);
  }

  48% {
    box-shadow: 0 0 0 3px var(--guide-texture-node-pulse);
    transform: scale(1.06);
  }

  62% {
    box-shadow: 0 0 0 0 transparent;
    transform: scale(1);
  }
}

.section-label {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 0;
  color: var(--site-accent);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.12em;
  line-height: 1.4;
}

.guide-index {
  margin-top: 44px;
  padding-top: 28px;
  border-top: 1px solid var(--site-ink);
}

.guide-index-tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.guide-index-tab {
  display: flex;
  min-height: 112px;
  flex-direction: column;
  justify-content: space-between;
  padding: 17px 19px 19px;
  border: 1px solid var(--site-line);
  border-top: 4px solid var(--site-accent);
  background: var(--site-surface);
  color: var(--site-ink);
  transition:
    background 160ms ease,
    border-color 160ms ease,
    transform 160ms ease;
}

.guide-index-tab:hover {
  background: var(--site-accent-soft);
  border-color: var(--site-accent);
  transform: translateY(-3px);
}

.guide-index-tab:focus-visible {
  outline: 2px solid var(--site-accent);
  outline-offset: 4px;
}

.guide-index-tab-yellow {
  border-top-color: var(--site-warm);
}

.guide-index-tab-yellow:hover {
  background: rgb(255 210 63 / 0.24);
  border-color: var(--site-warm);
}

.guide-index-tab-pink {
  border-top-color: var(--site-pink);
}

.guide-index-tab-pink:hover {
  background: rgb(239 120 168 / 0.14);
  border-color: var(--site-pink);
}

.guide-index-tab-green {
  border-top-color: var(--site-green);
}

.guide-index-tab-green:hover {
  background: rgb(54 191 200 / 0.14);
  border-color: var(--site-green);
}

.guide-index-tab-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--site-muted);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.guide-index-tab-meta .v-icon {
  color: var(--site-accent);
  transition: transform 160ms ease;
}

.guide-index-tab:hover .guide-index-tab-meta .v-icon {
  transform: translate(2px, -2px);
}

.guide-index-tab strong {
  font-size: 17px;
  font-weight: 800;
  line-height: 1.35;
}

.guide-section {
  scroll-margin-top: 78px;
  padding: 76px 0 80px;
  border-bottom: 1px solid var(--site-line);
}

.guide-section-heading {
  max-width: 750px;
}

.guide-section-heading h2 {
  margin: 14px 0 0;
  color: var(--site-ink);
  font-size: clamp(28px, 3.3vw, 44px);
  font-weight: 700;
  letter-spacing: 0;
  line-height: 1.2;
}

.guide-section-heading > p:last-child {
  max-width: 660px;
  margin: 19px 0 0;
  color: var(--site-muted);
  font-size: 15px;
  line-height: 1.85;
}

.guide-benefit-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 15px;
  margin-top: 43px;
}

.guide-benefit {
  position: relative;
  min-height: 240px;
  padding: 27px 25px 26px;
  border: 1px solid var(--site-ink);
  background: var(--site-surface);
}

.guide-benefit-yellow {
  background: var(--site-warm);
}

.guide-benefit-pink {
  background: var(--site-pink);
}

.benefit-number {
  position: absolute;
  top: 17px;
  right: 20px;
  color: var(--site-muted);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.1em;
}

.guide-benefit-yellow .benefit-number,
.guide-benefit-pink .benefit-number {
  color: var(--site-ink);
}

.benefit-icon {
  margin-bottom: 33px;
  color: var(--site-accent);
}

.guide-benefit-yellow .benefit-icon,
.guide-benefit-pink .benefit-icon {
  color: var(--site-ink);
}

.guide-benefit h3,
.process-step h3,
.usage-row h3 {
  margin: 0;
  color: var(--site-ink);
  font-size: 17px;
  font-weight: 800;
  line-height: 1.35;
}

.guide-benefit p,
.process-step p,
.usage-row p,
.guide-usage-aside p {
  margin: 9px 0 0;
  color: var(--site-muted);
  font-size: 13px;
  line-height: 1.75;
}

.guide-benefit-yellow p,
.guide-benefit-pink p {
  color: rgb(23 58 99 / 0.78);
}

.guide-process {
  padding-right: 39px;
  padding-left: 39px;
  background: var(--site-surface);
}

.guide-section-heading-wide {
  max-width: 820px;
}

.guide-process-list {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
  margin: 49px 0 0;
  padding: 0;
  list-style: none;
}

.process-step {
  position: relative;
  min-height: 226px;
  padding: 0 23px 0 0;
}

.process-step:not(:last-child)::after {
  position: absolute;
  top: 28px;
  right: 21px;
  left: calc(100% - 23px);
  height: 1px;
  background: var(--site-line);
  content: '';
}

.process-step-number {
  display: grid;
  width: 56px;
  height: 56px;
  place-items: center;
  border: 1px solid var(--site-ink);
  background: var(--site-warm);
  color: var(--site-ink);
  font-size: 18px;
  font-weight: 800;
}

.process-step:nth-child(3) .process-step-number {
  background: var(--site-pink);
}

.process-step-icon {
  margin-top: 27px;
  color: var(--site-accent);
}

.process-step h3 {
  margin-top: 14px;
  font-size: 16px;
}

.process-step p {
  max-width: 200px;
}

.guide-note {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-top: 12px;
  padding: 17px 19px;
  border-left: 4px solid var(--site-green);
  background: var(--site-accent-soft);
}

.guide-note > .v-icon {
  flex-shrink: 0;
  color: #218b67;
}

.guide-note p {
  margin: 0;
  color: var(--site-ink);
  font-size: 13px;
  line-height: 1.7;
}

.guide-note strong {
  font-weight: 800;
}

.guide-usage-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
  gap: 54px;
  align-items: start;
  margin-top: 44px;
}

.guide-usage-list {
  border-top: 1px solid var(--site-ink);
}

.usage-row {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  gap: 17px;
  align-items: start;
  padding: 21px 0;
  border-bottom: 1px solid var(--site-line);
}

.usage-row-icon {
  display: grid;
  width: 52px;
  height: 52px;
  place-items: center;
  border: 1px solid var(--site-ink);
  background: var(--site-accent-soft);
  color: var(--site-accent);
}

.usage-row-icon-yellow {
  background: var(--site-warm);
  color: var(--site-ink);
}

.usage-row-icon-pink {
  background: var(--site-pink);
  color: var(--site-ink);
}

.guide-usage-aside {
  padding: 25px;
  border: 1px solid var(--site-ink);
  background: var(--site-ink);
}

.guide-usage-aside > .v-icon {
  color: var(--site-warm);
}

.guide-usage-aside .usage-aside-label {
  margin-top: 24px;
  color: var(--site-surface);
  font-size: 20px;
  font-weight: 800;
  line-height: 1.35;
}

.guide-usage-aside > p:not(.usage-aside-label) {
  color: rgb(255 253 246 / 0.74);
}

.usage-aside-link {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-top: 22px;
  padding-bottom: 5px;
  border-bottom: 1px solid var(--site-warm);
  color: var(--site-warm);
  font-size: 12px;
  font-weight: 800;
}

.usage-aside-link:hover {
  color: var(--site-surface);
  border-color: var(--site-surface);
}

.guide-faq {
  display: grid;
  grid-template-columns: minmax(250px, 0.7fr) minmax(0, 1.3fr);
  gap: 72px;
  align-items: start;
}

.guide-section-heading-faq {
  position: sticky;
  top: 84px;
}

.faq-list {
  border-top: 1px solid var(--site-ink);
}

.faq-item {
  border-bottom: 1px solid var(--site-line);
}

.faq-trigger {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) 24px;
  gap: 15px;
  align-items: center;
  width: 100%;
  min-height: 70px;
  padding: 16px 0;
  border: 0;
  background: transparent;
  color: var(--site-ink);
  cursor: pointer;
  text-align: left;
}

.faq-trigger:hover .faq-question {
  color: var(--site-accent);
}

.faq-index {
  color: var(--site-accent);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.faq-question {
  font-size: 14px;
  font-weight: 750;
  line-height: 1.45;
  transition: color 160ms ease;
}

.faq-chevron {
  color: var(--site-muted);
  transition:
    transform 160ms ease,
    color 160ms ease;
}

.faq-chevron-open {
  transform: rotate(180deg);
  color: var(--site-accent);
}

.faq-answer {
  padding: 0 39px 20px 57px;
}

.faq-answer p {
  margin: 0;
  color: var(--site-muted);
  font-size: 13px;
  line-height: 1.8;
}

@media (max-width: 980px) {
  .guide-hero {
    gap: 32px;
    padding-right: 40px;
    padding-left: 40px;
  }

  .guide-hero-mark {
    right: 40px;
  }

  .guide-hero-texture {
    width: 100%;
    opacity: 0.72;
  }

  .guide-process-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 33px 20px;
  }

  .process-step:nth-child(2)::after {
    display: none;
  }

  .process-step:nth-child(3)::after {
    right: 21px;
    left: calc(100% - 23px);
  }

  .guide-faq {
    gap: 40px;
  }
}

@media (max-width: 760px) {
  .user-guide-page {
    width: min(100% - 32px, 620px);
    padding-top: 24px;
    padding-bottom: 48px;
  }

  .guide-hero {
    min-height: 0;
    padding: 34px 28px;
    box-shadow: 7px 7px 0 var(--site-warm);
  }

  .guide-breadcrumb {
    margin: 0;
  }

  .guide-hero h1 {
    font-size: 46px;
  }

  .guide-hero-intro {
    font-size: 14px;
  }

  .guide-hero-mark {
    right: 28px;
    width: 120px;
    height: 120px;
  }

  .guide-hero-mark img {
    width: 62px;
    height: 62px;
    padding: 8px;
  }

  .guide-hero-texture {
    width: 100%;
    opacity: 0.62;
  }

  .guide-index {
    margin-top: 32px;
    padding-top: 24px;
  }

  .guide-index-tabs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .guide-index-tab {
    min-height: 96px;
    padding: 15px 16px 17px;
  }

  .guide-section {
    padding: 53px 0 57px;
  }

  .guide-section-heading h2 {
    font-size: 30px;
  }

  .guide-section-heading > p:last-child {
    font-size: 14px;
  }

  .guide-benefit-grid,
  .guide-usage-layout,
  .guide-faq {
    grid-template-columns: 1fr;
  }

  .guide-benefit-grid {
    gap: 12px;
  }

  .guide-benefit {
    min-height: 0;
  }

  .guide-process {
    padding-right: 24px;
    padding-left: 24px;
  }

  .guide-process-list {
    grid-template-columns: 1fr;
    gap: 0;
    margin-top: 39px;
  }

  .process-step {
    display: grid;
    grid-template-columns: 56px minmax(0, 1fr);
    column-gap: 17px;
    min-height: 0;
    padding: 0 0 30px;
  }

  .process-step-number {
    grid-row: span 2;
  }

  .process-step-icon {
    margin: 0;
  }

  .process-step h3 {
    margin-top: 3px;
  }

  .process-step p {
    max-width: none;
  }

  .process-step:not(:last-child)::after,
  .process-step:nth-child(3)::after {
    top: 64px;
    right: auto;
    bottom: 0;
    left: 27px;
    width: 1px;
    height: auto;
  }

  .guide-note {
    margin-top: 4px;
  }

  .guide-usage-layout {
    gap: 30px;
  }

  .guide-section-heading-faq {
    position: static;
  }
}

@media (max-width: 480px) {
  .guide-hero-copy {
    max-width: none;
  }

  .guide-hero h1 {
    font-size: 40px;
  }

  .guide-hero-mark {
    display: none;
  }

  .faq-trigger {
    grid-template-columns: 36px minmax(0, 1fr) 22px;
    gap: 10px;
  }

  .faq-answer {
    padding-left: 46px;
  }
}

@media (max-width: 520px) {
  .guide-hero-texture {
    opacity: 0.46;
  }
}

@media (prefers-reduced-motion: reduce) {
  .guide-hero-texture::after,
  .guide-texture-route::after,
  .guide-texture-node {
    animation: none;
  }
}
</style>
