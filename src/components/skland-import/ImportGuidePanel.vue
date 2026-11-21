<script setup lang="ts">
import { computed } from 'vue'
import type { CredentialMethod } from '../../composables/useSklandCredential'
import { copyText } from '../../utils/copy-text'
import sklandStepImage from '../../assets/skland-step1.jpg'

interface GuideLink {
  label: string
  href: string
}

interface GuideStep {
  text: string
  links?: GuideLink[]
  note?: string
  image?: string
  code?: string
  copyLabel?: string
  openLabel?: string
  openUrl?: string
}

interface GuideContent {
  steps: GuideStep[]
  purpose: string[]
  purposeNote?: string
  safety: string[]
  tone: 'warning' | 'danger'
}

const props = defineProps<{
  method: CredentialMethod
}>()

const SKLAND_LINK = 'https://www.skland.com/index'
const OFFICIAL_SITE_LINK = 'https://ak.hypergryph.com/user/home'
const HG_ACCOUNT_INFO_URL = 'https://web-api.hypergryph.com/account/info/hg'

async function copyGuideText(value: string): Promise<void> {
  try {
    await copyText(value)
  } catch {
    // 复制失败时保留当前页面内容，不增加额外提示。
  }
}

const guideContent: Record<CredentialMethod, GuideContent> = {
  credential: {
    steps: [
      {
        text: '首先登录森空岛网页版。',
        links: [{ label: '打开森空岛官网', href: SKLAND_LINK }],
        note: '此导入方式仅适合电脑，Windows系统建议使用Microsoft Edge浏览器，macOS系统建议使用Safari浏览器',
      },
      {
        text: '登录森空岛后，在森空岛首页按键盘 F12 调出开发者工具，在下方选择控制台（Console），输入以下命令：',
        image: sklandStepImage,
        code: "copy(localStorage.getItem('SK_OAUTH_CRED_KEY')+','+localStorage.getItem('SK_TOKEN_CACHE_KEY')),console.log('已复制到粘贴板')",
        copyLabel: '点击复制命令',
      },
      {
        text: '输入后按 Enter 键执行，会自动复制凭证字符串到剪贴板。将获取到的完整 cred,token 内容粘贴到上方输入框。',
        note: '如果遇到了无法粘贴的情况，可以输入“allow pasting”或者“允许粘贴”，然后回车即可。',
      },
    ],
    purpose: [
      '可以获取森空岛账号绑定的明日方舟账号列表。',
      '可以获取账号 UID、昵称、区服等信息。',
      '可以获取干员持有情况、等级、精英化、潜能、技能等级、模组等级。',
      '可以获取仓库物资数量。',
    ],
    purposeNote: '酸橙云仅在本次导入中使用该 token，以获取相关游戏数据。',
    safety: [
      '凭证属于敏感信息，泄露后可能被用于读取上述数据。请勿分享给他人或粘贴到无关页面。',
    ],
    tone: 'warning',
  },
  official: {
    steps: [
      {
        text: '首先打开并登录明日方舟官网。',
        links: [{ label: '打开明日方舟官网', href: OFFICIAL_SITE_LINK }],
      },
      {
        text: '登录后访问以下地址，复制全部内容：',
        code: HG_ACCOUNT_INFO_URL,
        copyLabel: '复制地址',
        openLabel: '直接访问',
        openUrl: HG_ACCOUNT_INFO_URL,
      },
      {
        text: '将获取到的内容粘贴到上方输入框，系统会继续读取账号。',
      },
    ],
    purpose: [
      '使用官网 Token 换取森空岛凭证。',
      '读取森空岛绑定的明日方舟与终末地账号列表。',
      '读取当前导入所需的游戏数据并写入酸橙云。',
    ],
    safety: [
      '官网Token 属于极度敏感信息，泄露后可能被用于生成包括但不限于森空岛凭证在内的很多信息，分享官网Token给他人的危险程度不亚于公开你的账号密码！',
      '无论何时何地，使用官网Token前，请务必确认您已1000%信任该工具，使用该途径则视为您已知晓相关风险。',
      '使用时请确保环境安全，尤其小心会读取剪贴板的程序/APP，复制Token后请尽快使用！',
      '为保障您的账号安全，请在导入后退出明日方舟官网登录，退出登录后Token就会失效了',
    ],
    tone: 'danger',
  },
  qr: {
    steps: [
      { text: '使用手机上的森空岛 APP 扫描页面中的二维码。' },
      { text: '在森空岛 APP 内确认本次授权。' },
      { text: '保持页面打开，系统会自动轮询并在二维码过期后重新生成。' },
    ],
    purpose: [
      '可以获取森空岛账号绑定的明日方舟账号列表。',
      '可以获取账号 UID、昵称、区服等信息。',
      '可以获取干员持有情况、等级、精英化、潜能、技能等级、模组等级。',
      '可以获取仓库物资数量。',
    ],
    purposeNote: '酸橙云仅在本次导入中使用该 token，以获取相关游戏数据。',
    safety: [
      '请仅在森空岛 APP 内确认授权，不要将二维码截图或转发给他人。',
      '扫码会话会自动失效，页面会在二维码过期后自动重新生成。',
    ],
    tone: 'warning',
  },
}

const activeGuide = computed(() => guideContent[props.method])
</script>

<template>
  <section class="si-guide" aria-labelledby="si-import-guide-title">
    <div class="si-guide-header">
      <div>
        <p class="si-label">IMPORT GUIDE</p>
        <h2 id="si-import-guide-title" class="si-title">如何获取数据</h2>
      </div>
    </div>

    <div class="si-guide-steps" aria-label="获取步骤">
      <article v-for="(step, index) in activeGuide.steps" :key="step.text" class="si-guide-step">
        <span class="si-guide-step-number">{{ index + 1 }}</span>
        <div class="si-guide-step-copy">
          <img
            v-if="step.image"
            :src="step.image"
            alt="步骤1"
            class="si-guide-step-image"
          />
          <p>{{ step.text }}</p>
          <div v-if="step.links?.length" class="si-guide-step-links">
            <a
              v-for="link in step.links"
              :key="link.href"
              :href="link.href"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ link.label }}
              <v-icon icon="mdi-open-in-new" size="13" aria-hidden="true" />
            </a>
          </div>
          <p v-if="step.note" class="si-guide-step-note">{{ step.note }}</p>
          <pre v-if="step.code" class="si-guide-code"><code>{{ step.code }}</code></pre>
          <div v-if="step.copyLabel || step.openUrl" class="si-guide-step-actions">
            <v-btn
              v-if="step.copyLabel"
              type="button"
              variant="outlined"
              color="primary"
              @click="copyGuideText(step.code || '')"
            >
              <v-icon icon="mdi-content-copy" size="16" />
              {{ step.copyLabel }}
            </v-btn>
            <v-btn
              v-if="step.openUrl"
              :href="step.openUrl"
              target="_blank"
              rel="noopener noreferrer"
              variant="flat"
              color="primary"
            >
              <v-icon icon="mdi-open-in-new" size="16" />
              {{ step.openLabel }}
            </v-btn>
          </div>
        </div>
      </article>
    </div>

    <div class="si-guide-notices">
      <section class="si-guide-notice" aria-labelledby="si-guide-purpose-title">
        <h3 id="si-guide-purpose-title">用途说明</h3>
        <ul>
          <li v-for="item in activeGuide.purpose" :key="item">{{ item }}</li>
        </ul>
        <p v-if="activeGuide.purposeNote">{{ activeGuide.purposeNote }}</p>
      </section>

      <section
        class="si-guide-notice"
        :class="`si-guide-notice--${activeGuide.tone}`"
        aria-labelledby="si-guide-safety-title"
      >
        <h3 id="si-guide-safety-title">安全提示</h3>
        <p v-for="item in activeGuide.safety" :key="item">{{ item }}</p>
      </section>
    </div>

  </section>
</template>

<style scoped>
.si-guide {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-top: 28px;
  padding: 24px;
  border: 1px solid var(--site-line);
  background: var(--site-surface);
  box-shadow: 8px 8px 0 var(--site-accent-soft);
}

.si-guide-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.si-guide-steps {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  padding-top: 4px;
}

.si-guide-step {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
  padding: 14px 0;
  border-top: 1px solid var(--site-line);
}

.si-guide-step-number {
  display: grid;
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  place-items: center;
  background: var(--site-accent);
  color: var(--site-surface);
  font-size: 12px;
  font-weight: 800;
}

.si-guide-step p,
.si-guide-notice p {
  margin: 0;
  color: var(--site-muted);
  font-size: 12.5px;
  line-height: 1.7;
}

.si-guide-step-copy {
  min-width: 0;
}

.si-guide-step-image {
  display: block;
  max-width: 100%;
  margin: 0 0 12px;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.15);
}

.si-guide-step-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.si-guide-step-links a {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  color: var(--site-accent);
  font-size: 12px;
  font-weight: 750;
  overflow-wrap: anywhere;
  text-decoration: underline;
}

.si-guide-step-note {
  margin-top: 8px !important;
}

.si-guide-step-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
}

.si-guide-code {
  max-width: 100%;
  margin: 12px 0 0;
  padding: 12px 14px;
  overflow-x: auto;
  border: 1px solid var(--site-line);
  background: var(--site-ink);
  color: var(--site-surface);
  font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
  font-size: 11.5px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}

.si-guide-notices {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
  padding-top: 4px;
}

.si-guide-notice {
  min-width: 0;
  padding: 16px 0 0;
  border-top: 1px solid var(--site-line);
}

.si-guide-notice--warning {
  border-top-color: var(--site-warm);
}

.si-guide-notice--danger {
  border-top-color: var(--site-pink);
}

.si-guide-notice h3 {
  margin: 0 0 10px;
  color: var(--site-ink);
  font-size: 14px;
  font-weight: 800;
}

.si-guide-notice ul {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin: 0 0 10px;
  padding-left: 18px;
  color: var(--site-muted);
  font-size: 12.5px;
  line-height: 1.7;
}

.si-guide-notice--warning p,
.si-guide-notice--warning li {
  color: #8a5b00;
}

.si-guide-notice--danger p,
.si-guide-notice--danger li {
  color: #9c2451;
}

@media (max-width: 880px) {
  .si-guide-steps,
  .si-guide-notices {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .si-guide {
    padding: 18px;
  }
}
</style>
