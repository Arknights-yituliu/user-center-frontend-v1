<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="landing-page">
    <section class="landing-hero">
      <div class="landing-copy">
        <div class="landing-kicker">
          <span class="kicker-mark"></span>
          酸橙云 / Orange Cloud
        </div>
        <h1>你的工具数据，<br /><em>登录就能找回。</em></h1>
        <p class="landing-description">
          酸橙云可以把你的个人配置和使用数据会保存到云端。更换设备或浏览器后，也能继续之前的体验。
        </p>

        <div class="landing-actions">
          <RouterLink
            class="landing-primary"
            to="/home"
          >
            进入个人中心
            <v-icon icon="mdi-arrow-top-right" size="18"></v-icon>
          </RouterLink>
          <RouterLink class="landing-secondary" to="/projects">
            查看已入驻工具
            <v-icon icon="mdi-arrow-top-right" size="17"></v-icon>
          </RouterLink>
        </div>

        <div class="landing-note">
          <span class="note-line"></span>
          <span>已入驻 4 个工具</span>
          <span class="note-line note-line-short"></span>
        </div>
      </div>

      <div class="landing-visual" aria-hidden="true">
        <div class="visual-corner visual-corner-yellow"></div>
        <div class="visual-corner visual-corner-pink"></div>
        <div class="visual-label visual-label-top">CLOUD DATA / 01</div>
        <div class="visual-window">
          <div class="window-toolbar">
            <span class="window-dots"><i></i><i></i><i></i></span>
            <span>酸橙云</span>
            <span>SYNCED</span>
          </div>
          <div class="window-body">
            <div class="window-brand">
              <img src="/logo.png" alt="" width="76" height="76" />
              <div>
                <span>你的数据</span>
                <strong>会留下来</strong>
              </div>
            </div>
            <div class="window-divider"></div>
            <div class="window-list">
              <div><span>明日方舟一图流</span><b>已保存</b></div>
              <div><span>终末地一图流</span><b>已保存</b></div>
              <div><span>明日方舟工具箱</span><b>已保存</b></div>
            </div>
            <div class="window-footer">
              <span>云端数据</span>
              <strong><i></i> 已连接</strong>
            </div>
          </div>
        </div>
        <div class="visual-label visual-label-bottom">ACCOUNT / STORAGE / SYNC</div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.landing-page {
  max-width: 1280px;
  margin: 0 auto;
  padding: 24px 32px 72px;
}

.landing-hero {
  position: relative;
  overflow: hidden;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(380px, 0.88fr);
  gap: 52px;
  align-items: center;
  min-height: min(650px, calc(100vh - 112px));
  padding: 64px 66px;
  background: var(--site-accent);
  box-shadow: 14px 14px 0 var(--site-warm);
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
  font-size: clamp(50px, 6.8vw, 86px);
  font-weight: 650;
  letter-spacing: -0.06em;
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
  transition: background 160ms ease, transform 160ms ease;
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
  display: flex;
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
  min-height: 470px;
  place-items: center;
}

.visual-corner {
  position: absolute;
  width: 56px;
  height: 56px;
  transform: rotate(12deg);
}

.visual-corner-yellow {
  top: 10px;
  right: 5%;
  background: var(--site-warm);
}

.visual-corner-pink {
  bottom: 2px;
  left: 2%;
  width: 40px;
  height: 82px;
  background: var(--site-pink);
  transform: rotate(-12deg);
}

.visual-label {
  position: absolute;
  color: rgb(255 253 246 / 0.72);
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.16em;
}

.visual-label-top {
  top: 42px;
  left: 1%;
}

.visual-label-bottom {
  right: 1%;
  bottom: 38px;
}

.visual-window {
  position: relative;
  width: min(100%, 390px);
  border: 1px solid var(--site-ink);
  background: var(--site-surface);
  box-shadow: 16px 16px 0 var(--site-pink);
  transform: rotate(3deg);
}

.window-toolbar {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  min-height: 42px;
  padding: 0 15px;
  border-bottom: 1px solid var(--site-line);
  color: var(--site-muted);
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.1em;
}

.window-toolbar > span:nth-child(2) {
  color: var(--site-ink);
  letter-spacing: 0.04em;
}

.window-toolbar > span:last-child {
  color: var(--site-accent);
  text-align: right;
}

.window-dots {
  display: flex;
  gap: 5px;
}

.window-dots i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--site-pink);
}

.window-dots i:nth-child(2) {
  background: var(--site-warm);
}

.window-dots i:nth-child(3) {
  background: var(--site-cyan);
}

.window-body {
  padding: 26px 24px 20px;
}

.window-brand {
  display: flex;
  align-items: center;
  gap: 17px;
}

.window-brand img {
  display: block;
  width: 68px;
  height: 68px;
  filter: brightness(0) invert(1);
}

.window-brand span,
.window-footer span {
  color: var(--site-muted);
  font-size: 11px;
  font-weight: 700;
}

.window-brand strong {
  display: block;
  margin-top: 4px;
  color: var(--site-ink);
  font-size: 27px;
  font-weight: 700;
  letter-spacing: -0.05em;
}

.window-divider {
  height: 1px;
  margin: 24px 0 16px;
  background: var(--site-line);
}

.window-list {
  display: grid;
  gap: 11px;
}

.window-list div,
.window-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
}

.window-list div {
  color: var(--site-ink);
  font-size: 12px;
}

.window-list b {
  color: var(--site-green);
  font-size: 10px;
  font-weight: 750;
}

.window-footer {
  margin-top: 24px;
  padding-top: 14px;
  border-top: 1px solid var(--site-line);
}

.window-footer strong {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--site-green);
  font-size: 11px;
}

.window-footer i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}

@media (max-width: 800px) {
  .landing-page {
    padding: 38px 24px 60px;
  }

  .landing-hero {
    grid-template-columns: 1fr;
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
    font-size: 52px;
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

  .visual-window {
    width: min(100%, 330px);
  }

  .window-body {
    padding-right: 18px;
    padding-left: 18px;
  }

  .visual-label {
    font-size: 8px;
  }
}
</style>
