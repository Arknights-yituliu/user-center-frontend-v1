<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { getProject } from '../data/projects'

const route = useRoute()
const project = computed(() => getProject(String(route.params.slug)))
</script>

<template>
  <main v-if="project" class="project-detail-page">
    <div class="detail-breadcrumb">
      <RouterLink to="/projects">工具列表</RouterLink>
      <v-icon icon="mdi-chevron-right" size="16"></v-icon>
      <span>{{ project.name }}</span>
    </div>

    <section class="detail-hero">
      <div>
        <p class="detail-kicker">{{ project.category }}</p>
        <h1>{{ project.name }}</h1>
        <p class="detail-description">{{ project.detail }}</p>
        <div class="detail-actions">
          <RouterLink class="detail-primary" to="/home">
            进入个人中心
            <v-icon icon="mdi-arrow-top-right" size="17"></v-icon>
          </RouterLink>
        </div>
      </div>
      <div class="detail-symbol">
        <v-icon :icon="project.icon" size="64"></v-icon>
      </div>
    </section>

    <section class="detail-section user-section">
      <div class="section-heading">
        <span>对用户</span>
        <h2>登录后，数据可以保存下来。</h2>
      </div>
      <div class="detail-columns">
        <div>
          <p class="column-label">可以保存</p>
          <ul>
            <li v-for="item in project.savedData" :key="item">
              <v-icon icon="mdi-check" size="17"></v-icon>
              {{ item }}
            </li>
          </ul>
        </div>
        <div>
          <p class="column-label">你可以获得</p>
          <ul>
            <li v-for="item in project.capabilities" :key="item">
              <v-icon icon="mdi-check" size="17"></v-icon>
              {{ item }}
            </li>
          </ul>
        </div>
      </div>
    </section>

    <section class="detail-section developer-section">
      <div class="section-heading">
        <span>对开发者</span>
        <h2>让你的前端工具，也能保存用户数据。</h2>
      </div>
      <p class="developer-description">
        接入酸橙云，为应用提供账号登录和按用户隔离的数据保存能力，不必为每个简单工具单独搭建后端。
      </p>
      <div class="developer-actions">
        <RouterLink class="developer-primary" to="/user/oauth-clients">
          开始接入
          <v-icon icon="mdi-arrow-top-right" size="17"></v-icon>
        </RouterLink>
        <RouterLink class="developer-secondary" to="/user/oauth-config-guide">
          查看数据服务说明
        </RouterLink>
      </div>
    </section>
  </main>

  <main v-else class="not-found-page">
    <p class="detail-kicker">酸橙云 / 工具</p>
    <h1>这个工具还没有找到。</h1>
    <RouterLink class="detail-primary" to="/projects">返回工具列表</RouterLink>
  </main>
</template>

<style scoped>
.project-detail-page,
.not-found-page {
  width: min(1000px, calc(100% - 64px));
  margin: 0 auto;
  padding: 42px 0 90px;
}

.detail-breadcrumb {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--site-muted);
  font-size: 12px;
}

.detail-breadcrumb a:hover {
  color: var(--site-accent);
}

.detail-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 70px;
  align-items: center;
  min-height: 430px;
  border-bottom: 1px solid var(--site-ink);
}

.detail-kicker {
  margin: 0;
  color: var(--site-accent);
  font-size: 13px;
  font-weight: 750;
  letter-spacing: 0.08em;
}

.detail-hero h1,
.not-found-page h1 {
  margin: 18px 0 0;
  color: var(--site-ink);
  font-size: clamp(48px, 7vw, 84px);
  font-weight: 650;
  letter-spacing: -0.06em;
  line-height: 0.98;
}

.detail-description {
  max-width: 480px;
  margin: 24px 0 0;
  color: var(--site-muted);
  font-size: 16px;
  line-height: 1.8;
}

.detail-actions {
  margin-top: 30px;
}

.detail-primary,
.developer-primary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 13px 17px;
  border: 0;
  background: var(--site-accent);
  color: var(--site-surface);
  font-size: 13px;
  font-weight: 750;
}

.detail-symbol {
  display: grid;
  width: 220px;
  aspect-ratio: 1;
  place-items: center;
  border-radius: 50%;
  background: var(--site-cyan);
  box-shadow: 22px 22px 0 var(--site-warm);
}

.detail-section {
  padding: 48px 0;
  border-bottom: 1px solid var(--site-line);
}

.section-heading {
  display: grid;
  grid-template-columns: 100px minmax(0, 1fr);
  gap: 22px;
  align-items: start;
}

.section-heading > span {
  color: var(--site-accent);
  font-size: 12px;
  font-weight: 750;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.section-heading h2 {
  max-width: 620px;
  margin: 0;
  color: var(--site-ink);
  font-size: clamp(28px, 4vw, 46px);
  font-weight: 650;
  letter-spacing: -0.05em;
  line-height: 1.05;
}

.detail-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 30px;
  margin: 38px 0 0 122px;
}

.column-label {
  margin: 0 0 13px;
  color: var(--site-muted);
  font-size: 12px;
  font-weight: 750;
}

.detail-columns ul {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.detail-columns li {
  display: flex;
  align-items: center;
  gap: 9px;
  color: var(--site-ink);
  font-size: 14px;
}

.detail-columns .v-icon {
  color: var(--site-accent);
}

.developer-section {
  border-bottom: 0;
}

.developer-description {
  max-width: 610px;
  margin: 24px 0 0 122px;
  color: var(--site-muted);
  font-size: 14px;
  line-height: 1.8;
}

.developer-actions {
  display: flex;
  align-items: center;
  gap: 22px;
  margin: 26px 0 0 122px;
}

.developer-secondary {
  color: var(--site-ink);
  font-size: 13px;
  font-weight: 700;
}

.developer-secondary:hover {
  color: var(--site-accent);
}

.not-found-page h1 {
  max-width: 560px;
}

.not-found-page .detail-primary {
  margin-top: 30px;
}

@media (max-width: 760px) {
  .project-detail-page,
  .not-found-page {
    width: min(100% - 48px, 620px);
  }

  .detail-hero {
    grid-template-columns: 1fr;
    gap: 44px;
    padding: 46px 0 58px;
  }

  .detail-symbol {
    width: 170px;
    box-shadow: 15px 15px 0 var(--site-warm);
  }

  .section-heading {
    grid-template-columns: 1fr;
    gap: 13px;
  }

  .detail-columns,
  .developer-description,
  .developer-actions {
    margin-left: 0;
  }

  .detail-columns {
    grid-template-columns: 1fr;
    gap: 25px;
  }
}

@media (max-width: 520px) {
  .project-detail-page,
  .not-found-page {
    width: calc(100% - 32px);
    padding-top: 30px;
  }

  .detail-hero h1,
  .not-found-page h1 {
    font-size: 52px;
  }

  .developer-actions {
    align-items: flex-start;
    flex-direction: column;
    gap: 16px;
  }
}
</style>
