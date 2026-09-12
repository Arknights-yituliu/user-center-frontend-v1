<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { projects } from '../data/projects'
</script>

<template>
  <main class="projects-page">
    <header class="projects-header">
      <div>
        <p class="projects-kicker">酸橙云 / 一图流工具</p>
        <h1>选择一个工具，<em>开始使用。</em></h1>
        <p class="projects-intro">
          这里是已经接入或正在接入酸橙云的工具。支持云端保存的工具，登录后就能继续使用自己的数据。
        </p>
      </div>
      <RouterLink class="back-link" to="/">
        <v-icon icon="mdi-arrow-left" size="17"></v-icon>
        返回首页
      </RouterLink>
    </header>

    <section class="project-grid" aria-label="工具列表">
      <RouterLink
        v-for="(project, index) in projects"
        :key="project.slug"
        :to="{ name: 'PROJECT_DETAIL', params: { slug: project.slug } }"
        class="project-card"
      >
        <div class="project-card-top">
          <span class="project-index">{{ String(index + 1).padStart(2, '0') }}</span>
          <span class="project-status">{{ project.statusLabel }}</span>
        </div>
        <div class="project-icon">
          <v-icon :icon="project.icon" size="34"></v-icon>
        </div>
        <p class="project-category">{{ project.category }}</p>
        <h2>{{ project.name }}</h2>
        <p class="project-description">{{ project.description }}</p>
        <div class="project-card-bottom">
          <span>查看工具</span>
          <v-icon icon="mdi-arrow-top-right" size="18"></v-icon>
        </div>
      </RouterLink>
    </section>
  </main>
</template>

<style scoped>
.projects-page {
  width: min(1120px, calc(100% - 64px));
  margin: 0 auto;
  padding: 30px 0 90px;
}

.projects-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 32px;
  padding: 42px 44px;
  border-left: 12px solid var(--site-accent);
  background: var(--site-surface);
  box-shadow: 10px 10px 0 var(--site-pink);
}

.projects-kicker {
  margin: 0;
  color: var(--site-accent);
  font-size: 13px;
  font-weight: 750;
  letter-spacing: 0.08em;
}

.projects-header h1 {
  max-width: 660px;
  margin: 18px 0 0;
  color: var(--site-ink);
  font-size: clamp(42px, 5.5vw, 70px);
  font-weight: 650;
  letter-spacing: -0.06em;
  line-height: 1;
}

.projects-header h1 em {
  color: var(--site-accent);
  font-style: normal;
}

.projects-intro {
  max-width: 500px;
  margin: 24px 0 0;
  color: var(--site-muted);
  font-size: 15px;
  line-height: 1.8;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  flex-shrink: 0;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--site-ink);
  color: var(--site-ink);
  font-size: 13px;
  font-weight: 700;
}

.back-link:hover {
  color: var(--site-accent);
  border-color: var(--site-accent);
}

.project-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  padding-top: 40px;
}

.project-card {
  position: relative;
  overflow: hidden;
  display: flex;
  min-height: 350px;
  flex-direction: column;
  padding: 26px 28px;
  border: 0;
  border-radius: 8px;
  background: var(--site-cyan);
  color: var(--site-ink);
  transition: transform 180ms ease, box-shadow 180ms ease;
}

.project-card:nth-child(2) {
  background: var(--site-warm);
}

.project-card:nth-child(3) {
  background: var(--site-pink);
}

.project-card:nth-child(4) {
  background: var(--site-accent);
  color: var(--site-surface);
}

.project-card:hover {
  box-shadow: 9px 9px 0 var(--site-ink);
  transform: translateY(-4px);
}

.project-card-top,
.project-card-bottom {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.project-index,
.project-category {
  color: var(--site-muted);
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.project-status {
  padding: 5px 8px;
  color: var(--site-ink);
  background: var(--site-surface);
  font-size: 11px;
  font-weight: 700;
}

.project-icon {
  position: relative;
  z-index: 1;
  display: grid;
  width: 82px;
  height: 82px;
  margin: 48px 0 24px;
  place-items: center;
  border-radius: 24px;
  background: var(--site-surface);
  color: var(--site-ink);
}

.project-category {
  margin: 0;
}

.project-card h2 {
  position: relative;
  z-index: 1;
  margin: 9px 0 0;
  max-width: 380px;
  font-size: clamp(23px, 3vw, 31px);
  font-weight: 700;
  letter-spacing: -0.04em;
}

.project-description {
  position: relative;
  z-index: 1;
  margin: 12px 0 0;
  color: var(--site-muted);
  font-size: 13px;
  line-height: 1.75;
}

.project-card-bottom {
  margin-top: auto;
  padding-top: 26px;
  border-top: 1px solid rgb(23 58 99 / 0.28);
  font-size: 13px;
  font-weight: 750;
}

.project-card:nth-child(4) .project-index,
.project-card:nth-child(4) .project-category,
.project-card:nth-child(4) .project-description {
  color: rgb(255 253 246 / 0.78);
}

.project-card:nth-child(4) .project-card-bottom {
  border-color: rgb(255 253 246 / 0.35);
}

.project-card::after {
  position: absolute;
  right: -18px;
  bottom: -50px;
  width: 190px;
  height: 190px;
  border: 1px solid rgb(23 58 99 / 0.2);
  border-radius: 50%;
  content: '';
}

.project-card:nth-child(2)::after,
.project-card:nth-child(4)::after {
  right: -42px;
  bottom: -66px;
  width: 220px;
  height: 220px;
}

.project-card:nth-child(3)::after {
  border-color: rgb(255 253 246 / 0.35);
}

@media (max-width: 850px) {
  .projects-page {
    width: min(100% - 48px, 620px);
  }

  .projects-header {
    align-items: flex-start;
    flex-direction: column;
    padding: 34px 28px;
  }

  .project-grid {
    grid-template-columns: 1fr;
  }

  .project-card {
    min-height: 300px;
  }

  .project-icon {
    margin-top: 42px;
  }
}

@media (max-width: 520px) {
  .projects-page {
    width: calc(100% - 32px);
    padding-top: 36px;
  }

  .projects-header h1 {
    font-size: 50px;
  }
}
</style>
