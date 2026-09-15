<script setup lang="ts">
import { RouterLink } from 'vue-router'
import SecondaryPageHeader from '../components/SecondaryPageHeader.vue'

const projectCapabilities = [
  {
    icon: 'mdi-account-circle-outline',
    title: '统一账号',
    description: '提供注册、登录、邮箱和个人资料等账号能力。',
  },
  {
    icon: 'mdi-view-dashboard-outline',
    title: '项目连接',
    description: '提供 OAuth 2.0 项目注册、授权连接和访问凭证管理。',
  },
  {
    icon: 'mdi-database-cog-outline',
    title: '通用数据',
    description: '支持干员数据的导入、编辑与云端保存，作为多个项目可调用的数据。',
  },
  {
    icon: 'mdi-console-line',
    title: '开发接入',
    description: '提供无后端 Web、加密客户端和用户配置等接入方案。',
  },
]

const technicalDetails = [
  { label: '项目类型', value: 'Web 前端' },
  { label: '核心框架', value: 'Vue 3 · TypeScript' },
  { label: '构建工具', value: 'Vite' },
  { label: '界面组件', value: 'Vuetify · Material Design Icons' },
  { label: '接口通信', value: 'Axios · HTTP API' },
  { label: '授权协议', value: 'OAuth 2.0 · Authorization Code · PKCE' },
]

const developmentDetails = [
  { label: '项目状态', value: '持续开发中' },
  { label: '当前版本', value: '0.0.0' },
  { label: '已有能力', value: '统一账号、项目授权、通用数据、开发接入' },
  { label: '运行环境', value: 'Node.js 22.18+ 或 24.12+' },
]
</script>

<template>
  <main class="about-page">
    <SecondaryPageHeader
      title-id="about-title"
      kicker="ABOUT THIS LAND CLOUD"
      title-a="关于酸橙云"
      description="面向工具与开发者的账号、数据和接入服务。"
    >
      <template #visual>
        <div class="about-header-mark">
          <img src="/logo.svg" alt="" width="62" height="62" />
          <span>ABOUT</span>
        </div>
      </template>
    </SecondaryPageHeader>

    <section class="about-section about-overview" aria-labelledby="about-overview-title">
      <div class="about-section-heading">
        <p class="section-label">01 / 为什么有这个项目</p>
        <h2 id="about-overview-title">数据分散在不同工具和设备中，用户难以持续使用。</h2>
      </div>
      <div class="about-overview-content">
        <p class="about-section-copy">
          用户在不同工具、设备和浏览器之间切换时，账号、配置和使用数据往往分散在各处，换设备后也难以继续。开发者需要账号、授权和数据服务时，也缺少一个可以按需接入的独立基础设施。酸橙云针对的就是这两类问题：提供可选的账号、授权、数据保存和接口能力，让用户的数据能够在明确授权下被需要的工具继续使用。
        </p>
        <p class="about-overview-note">
          <strong>项目关系：</strong
          >酸橙云是独立的公共服务项目，不替代工具本身，也不规定工具必须如何实现；工具保留自己的定位、数据和技术方案。
        </p>
      </div>
    </section>

    <section class="about-section about-capabilities" aria-labelledby="about-capabilities-title">
      <div class="about-section-heading">
        <p class="section-label">02 / 当前能力</p>
        <h2 id="about-capabilities-title">目前，酸橙云先把账号、授权和数据服务搭起来。</h2>
      </div>

      <div class="about-capability-grid">
        <article v-for="item in projectCapabilities" :key="item.title" class="about-capability">
          <span class="about-capability-icon">
            <v-icon :icon="item.icon" size="24"></v-icon>
          </span>
          <div>
            <h3>{{ item.title }}</h3>
            <p>{{ item.description }}</p>
          </div>
        </article>
      </div>
    </section>

    <section class="about-section about-technology" aria-labelledby="about-technology-title">
      <div class="about-section-heading">
        <p class="section-label">03 / 技术信息</p>
        <h2 id="about-technology-title">当前仓库是酸橙云的 Web 前端。</h2>
      </div>

      <div class="about-technology-content">
        <p class="about-section-copy">
          当前仓库主要负责用户中心前端，通过 HTTP API
          连接账号服务、项目授权服务和数据服务；外部干员数据由森空岛接口提供。它是酸橙云的一部分，不等同于完整的后端服务。
        </p>
        <dl class="about-facts about-technical-facts">
          <div v-for="item in technicalDetails" :key="item.label">
            <dt>{{ item.label }}</dt>
            <dd>{{ item.value }}</dd>
          </div>
        </dl>
      </div>
    </section>

    <section class="about-section about-development" aria-labelledby="about-development-title">
      <div class="about-section-heading">
        <p class="section-label">04 / 开发信息</p>
        <h2 id="about-development-title">项目仍在持续开发，功能和接口会继续变化。</h2>
      </div>

      <div class="about-development-content">
        <div class="about-development-copy">
          <p class="about-section-copy">
            页面、接口和接入流程仍在调整，当前重点是验证账号、数据和项目接入的整体结构。
          </p>
          <RouterLink to="/developer" class="about-development-link">
            查看开发者中心
            <v-icon icon="mdi-arrow-top-right" size="16"></v-icon>
          </RouterLink>
        </div>

        <dl class="about-facts">
          <div v-for="item in developmentDetails" :key="item.label">
            <dt>{{ item.label }}</dt>
            <dd>{{ item.value }}</dd>
          </div>
        </dl>
      </div>
    </section>
  </main>
</template>

<style scoped>
.about-page {
  width: min(1200px, calc(100% - 64px));
  margin: 0 auto;
  padding: 32px 0 80px;
  color: var(--site-ink);
}

.about-section {
  display: grid;
  grid-template-columns: minmax(240px, 0.8fr) minmax(0, 1.4fr);
  gap: 64px;
  align-items: start;
  padding: 72px 0;
  border-bottom: 1px solid var(--site-line);
}

.about-section-heading {
  min-width: 0;
}

.section-label {
  margin: 0;
  color: var(--site-accent);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
  line-height: 1.4;
}

.about-section h2 {
  max-width: 390px;
  margin: 16px 0 0;
  color: var(--site-ink);
  font-size: 30px;
  font-weight: 650;
  letter-spacing: 0;
  line-height: 1.2;
}

.about-section-copy {
  max-width: 700px;
  margin: 0;
  color: var(--site-muted);
  font-size: 18px;
  line-height: 1.8;
}

.about-overview-content {
  display: grid;
  gap: 26px;
  min-width: 0;
}

.about-overview-note {
  max-width: 700px;
  margin: 0;
  padding-top: 18px;
  border-top: 1px solid var(--site-line);
  color: var(--site-muted);
  font-size: 14px;
  line-height: 1.75;
}

.about-overview-note strong {
  color: var(--site-ink);
  font-weight: 750;
}

.about-header-mark {
  position: absolute;
  top: 50%;
  left: 43%;
  display: grid;
  width: 124px;
  height: 124px;
  place-items: center;
  transform: translate(-50%, -50%);
  border: 1px solid var(--site-ink);
  background: var(--site-warm);
  box-shadow: 12px 12px 0 var(--site-pink);
  color: var(--site-ink);
}

.about-header-mark img {
  display: block;
}

.about-header-mark span {
  position: absolute;
  right: 10px;
  bottom: 8px;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.14em;
}

.about-capability-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border-top: 1px solid var(--site-line);
  border-left: 1px solid var(--site-line);
}

.about-capability {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 18px;
  min-height: 146px;
  padding: 24px;
  border-right: 1px solid var(--site-line);
  border-bottom: 1px solid var(--site-line);
  background: var(--site-surface);
}

.about-capability-icon {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 50%;
  background: var(--site-accent-soft);
  color: var(--site-accent);
}

.about-capability h3 {
  margin: 0 0 8px;
  font-size: 17px;
  font-weight: 750;
}

.about-capability p {
  margin: 0;
  color: var(--site-muted);
  font-size: 14px;
  line-height: 1.7;
}

.about-technology-content,
.about-development-content {
  display: grid;
  gap: 34px;
  min-width: 0;
}

.about-facts {
  margin: 0;
  border-top: 1px solid var(--site-line);
}

.about-facts > div {
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr);
  gap: 22px;
  align-items: center;
  min-height: 58px;
  border-bottom: 1px solid var(--site-line);
}

.about-facts dt {
  color: var(--site-muted);
  font-size: 13px;
}

.about-facts dd {
  margin: 0;
  color: var(--site-ink);
  font-size: 14px;
  font-weight: 650;
}

.about-development-copy {
  display: grid;
  align-content: start;
  gap: 24px;
}

.about-development-link {
  display: inline-flex;
  align-items: center;
  justify-self: start;
  gap: 5px;
  color: var(--site-accent);
  font-size: 14px;
  font-weight: 750;
}

.about-development-link:hover,
.about-development-link:focus-visible {
  color: var(--site-ink);
}

@media (max-width: 820px) {
  .about-page {
    width: min(100% - 48px, 700px);
  }

  .about-section {
    grid-template-columns: 1fr;
    gap: 32px;
    padding: 52px 0;
  }

  .about-section h2 {
    max-width: 620px;
  }
}

@media (max-width: 560px) {
  .about-page {
    width: calc(100% - 32px);
    padding-top: 24px;
  }

  .about-capability-grid {
    grid-template-columns: 1fr;
  }

  .about-facts > div {
    grid-template-columns: 110px minmax(0, 1fr);
    gap: 14px;
  }
}
</style>
