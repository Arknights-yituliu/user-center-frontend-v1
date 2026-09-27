<script setup>
import {onMounted, ref} from "vue";
import '../../assets/css/account/login.v2.scss'
import {createMessage} from "../../utils/message";
import {useRoute, useRouter} from "vue-router";
import {getUcToken, setUcSession, ucRequest} from "../../api/uc/uc-api";

const props = defineProps({
    embedded: {
        type: Boolean,
        default: false,
    },
})
const emit = defineEmits(['success'])

/** 登录表单：accountType=password 时用 账号(邮箱或用户名)+密码；accountType=email 时用 邮箱+验证码 */
const inputContent = ref({
    accountType: 'password',
    account: '',
    password: '',
    email: '',
    verificationCode: '',
})

/** 登录 / 发送验证码 的加载状态 */
const loginLoading = ref(false)
const sendCodeLoading = ref(false)

/** 发送验证码倒计时（秒） */
const codeCountdown = ref(0)

const router = useRouter()
const route = useRoute()

/** OAuth 授权回跳地址：authorize 未登录时会 302 到本页并携带 ?redirect=<authorize完整地址>，登录成功后换取一次性票据并回跳继续授权 */
const oauthRedirect = ref("")
/** 普通站内登录成功后的回跳地址，由登录守卫通过 ?returnTo= 传入 */
const returnTo = ref("")

/**
 * 登录成功后若处于 OAuth 授权回跳流程：
 * 1. 用刚登录的会话 token 调 POST /oauth2/ticket 换取一次性票据
 * 2. 携带 uc_ticket 回跳 authorize（跨站票据方案，不依赖 Cookie，登录页与 UC 不同域名也可用）
 */
async function redirectIfOAuth() {
    if (!oauthRedirect.value || !getUcToken()) {
        return
    }
    try {
        const resp = await ucRequest({method: "POST", url: "/oauth2/ticket"})
        const ticket = resp.data && resp.data.ticket
        if (!ticket) {
            createMessage({text: "换取登录票据失败：响应中无 ticket", type: "error"})
            return
        }
        // 携带 uc_ticket 回跳原 authorize 地址；replace 避免票据残留浏览器历史
        const target = new URL(oauthRedirect.value)
        target.searchParams.set("uc_ticket", ticket)
        createMessage({text: "登录成功，已换取票据，正在回跳授权页…", type: "success"})
        window.location.replace(target.toString())
    } catch {
        // 错误提示已在 ucRequest 内部统一弹出
    }
}

onMounted(() => {
    // 解析 OAuth 授权回跳参数（authorize 未登录时 302 带 ?redirect=<authorize地址> 跳到本页）
    oauthRedirect.value = new URLSearchParams(window.location.search).get("redirect") || ""
    const candidate = new URLSearchParams(window.location.search).get("returnTo") || ""
    // 只接受站内绝对路径，避免把登录页变成外部跳转入口
    returnTo.value = candidate.startsWith("/") && !candidate.startsWith("//") ? candidate : ""
    // 已有本地 UC 会话且处于 OAuth 回跳流程：直接用现有会话换票回跳，无需再次手动登录
    if (oauthRedirect.value && getUcToken()) {
        redirectIfOAuth()
    }
})

/** 跳转注册页：处于 OAuth 回跳流程时携带 redirect，供注册成功后回跳授权 */
function toRegister() {
    router.push({name: 'REGISTER', query: oauthRedirect.value ? {redirect: oauthRedirect.value} : {}})
}

/** 跳转忘记密码页 */
function toRetrieve() {
    router.push({name: "RETRIEVE"})
}

/** 基础非空校验 */
function checkField(value, label) {
    if (!value) {
        createMessage({text: `${label}不能为空`, type: "warning"})
        return false
    }
    return true
}

/**
 * 发送登录邮箱验证码（UC POST /auth/send-code，usage=login），成功后 60s 倒计时
 */
async function sendVerificationCode() {
    const email = inputContent.value.email
    if (!checkField(email, "邮箱")) {
        return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        createMessage({text: "邮箱格式不正确", type: "warning"})
        return
    }
    sendCodeLoading.value = true
    try {
        await ucRequest({
            method: "POST",
            url: "/auth/send-code",
            data: {email, usage: "login"},
            auth: false,
        })
        createMessage({text: "验证码发送成功", type: "success"})
        // 发送成功后开始 60s 倒计时
        codeCountdown.value = 60
        const timer = setInterval(() => {
            codeCountdown.value--
            if (codeCountdown.value <= 0) {
                clearInterval(timer)
            }
        }, 1000)
    } catch {
        // 错误提示已在 ucRequest 内部统一弹出
    } finally {
        sendCodeLoading.value = false
    }
}

/**
 * 登录成功后的统一处理：保存 UC 会话并跳转
 * @param {{token:string, uid:string|number}} data UC 登录返回的 LoginVO
 */
function handleLoginSuccess(data) {
    setUcSession(data.token, data.uid)
    if (props.embedded) {
        createMessage({type: 'success', text: '登录成功'})
        emit('success', data)
        return
    }
    // 处于 OAuth 授权回跳流程时，直接换票回跳继续授权，不走普通跳转
    if (oauthRedirect.value) {
        redirectIfOAuth()
        return
    }
    if (route.name === 'ACCOUNT_HOME' || route.path === '/account/home') {
        createMessage({type: 'success', text: '登录成功'})
        // 站内会话（OAUTH_TOKEN）由 /account/home 解析 OAuth 回调 ?token= 时建立，此处无需处理
        setTimeout(() => {
            window.location.reload()
        }, 600)
        return
    }
    createMessage({type: 'success', text: returnTo.value ? '登录成功，正在返回原页面' : '登录成功，即将转跳到首页'})
    setTimeout(() => {
        window.location.href = returnTo.value || '/'
    }, 1500)
}

/**
 * 登录：按当前 tab 调 UC /auth/login
 * - 密码登录：accountType=password，账号含 @ 视为邮箱否则视为用户名（兼容迁移用户）
 * - 邮箱登录：accountType=email，用验证码免密登录
 */
async function toLogin() {
    const form = inputContent.value
    if (form.accountType === 'password') {
        if (!checkField(form.account, "账号") || !checkField(form.password, "密码")) {
            return
        }
    } else {
        if (!checkField(form.email, "邮箱") || !checkField(form.verificationCode, "验证码")) {
            return
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
            createMessage({text: "邮箱格式不正确", type: "warning"})
            return
        }
    }

    loginLoading.value = true
    try {
        // 密码登录：邮箱与用户名二选一；邮箱验证码登录：email + verificationCode
        const payload = {accountType: form.accountType}
        if (form.accountType === 'password') {
            if (form.account.includes("@")) {
                payload.email = form.account
            } else {
                payload.userName = form.account
            }
            payload.password = form.password
        } else {
            payload.email = form.email
            payload.verificationCode = form.verificationCode
        }
        const resp = await ucRequest({
            method: "POST",
            url: "/auth/login",
            data: payload,
            auth: false,
        })
        handleLoginSuccess(resp.data || {})
    } catch {
        // 错误提示已在 ucRequest 内部统一弹出
    } finally {
        loginLoading.value = false
    }
}
</script>

<template>
  <div class="auth-page" :class="{'auth-page-embedded': props.embedded}">
    <section v-if="!props.embedded" class="auth-intro">
      <div class="auth-intro-top">
        <img src="/logo.svg" alt="" width="40" height="40" />
        <span>一图流 / ACCOUNT</span>
      </div>
      <div class="auth-intro-copy">
        <p class="auth-kicker">ONE FLOW ACCOUNT</p>
        <h1>把重要的，<br /><em>放在一起。</em></h1>
        <p>一个账号，连接一图流相关服务。管理资料、保护账号，也让你的数据始终跟着你。</p>
      </div>
      <div class="auth-intro-foot">
        <span>01</span>
        <span>简洁 · 安全 · 属于你</span>
      </div>
    </section>

    <v-card class="login-card m-a" max-width="440" width="100%">
      <!-- 标题区 -->
      <div class="login-header">
        <div class="login-eyebrow">一图流账号中心</div>
        <div class="login-title">登录一图流账号</div>
        <div class="login-sub">管理你的账号信息，并在支持的一图流服务中使用同一个账号</div>
      </div>

      <v-tabs v-model="inputContent.accountType" bg-color="primary" grow>
        <v-tab value="password">密码登录</v-tab>
        <v-tab value="email">邮箱验证码登录</v-tab>
      </v-tabs>

      <v-card-text>
        <v-tabs-window v-model="inputContent.accountType">
          <!-- 密码登录 -->
          <v-tabs-window-item value="password">
            <div class="m-0-4">账号（邮箱或用户名）</div>
            <v-text-field
                density="compact"
                v-model="inputContent.account"
                placeholder="绑定邮箱或用户名"
                color="primary"
                variant="outlined"
                class="m-4"
                @keyup.enter="toLogin"
            ></v-text-field>

            <div class="m-0-4">密码</div>
            <v-text-field
                density="compact"
                color="primary"
                v-model="inputContent.password"
                variant="outlined"
                type="password"
                placeholder="请输入登录密码"
                hide-details="auto"
                class="m-4"
                @keyup.enter="toLogin"
            ></v-text-field>
          </v-tabs-window-item>

          <!-- 邮箱验证码登录 -->
          <v-tabs-window-item value="email">
            <div class="m-0-4">邮箱</div>
            <v-text-field
                v-model="inputContent.email"
                color="primary"
                density="compact"
                variant="outlined"
                placeholder="请输入邮箱"
                class="m-4"
                @keyup.enter="toLogin"
            ></v-text-field>

            <div class="m-0-4">验证码</div>
            <!-- 6 位验证码分格输入，输完自动触发登录（不设 color，避免 OTP 格子背景被染成主色） -->
            <v-otp-input
                v-model="inputContent.verificationCode"
                length="6"
                type="number"
                density="compact"
                variant="outlined"
                class="m-4"
                @finish="toLogin"
            ></v-otp-input>

            <!-- 获取验证码按钮放在验证码输入框下方，上间距收紧 -->
            <div class="flex justify-center mt-1 mb-4">
              <v-btn
                  color="primary"
                  variant="text"
                  :loading="sendCodeLoading"
                  :disabled="codeCountdown > 0"
                  @click="sendVerificationCode"
              >{{ codeCountdown > 0 ? `${codeCountdown}s 后重发` : '获取验证码' }}</v-btn>
            </div>
          </v-tabs-window-item>
        </v-tabs-window>

        <div class="flex justify-center m-4">
          <v-btn
              @click="toLogin"
              text="登录"
              color="primary"
              variant="flat"
              size="large"
              class="login-btn"
              :loading="loginLoading"
          ></v-btn>
        </div>

        <div class="flex justify-center">
          <v-btn text="忘记密码？" variant="text" color="primary" @click="toRetrieve()"></v-btn>
          <v-btn text="没有账号，去注册" color="primary" variant="text" @click="toRegister()"></v-btn>
        </div>

        <v-card title="第一次来？" color="primary" variant="tonal" class="m-12-4 account-note">
          <v-card-text>
            <p>
              这是用于一图流相关服务的账号，不是鹰角网络通行证或明日方舟游戏账号。还没有账号的话，可以直接注册一个。
            </p>
            <p>
              如果你已经绑定邮箱，也可以直接使用邮箱作为账号登录。
            </p>
          </v-card-text>
        </v-card>
      </v-card-text>
    </v-card>
  </div>
</template>

<style scoped>
.auth-page {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(360px, 440px);
  gap: clamp(48px, 9vw, 150px);
  align-items: center;
  max-width: 1180px;
  min-height: calc(100vh - 79px);
  margin: 0 auto;
  padding: 64px 42px;
}

.auth-page-embedded {
  display: block;
  min-height: 0;
  max-width: none;
  padding: 0;
}

.auth-intro {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 560px;
  padding: 12px 0 0;
}

.auth-intro-top {
  display: flex;
  align-items: center;
  gap: 14px;
  color: var(--site-muted);
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.16em;
}

.auth-intro-top img {
  display: block;
  width: 40px;
  height: 40px;
  padding: 5px;
  border: 1px solid var(--site-ink);
  border-radius: 50%;
  background: var(--site-accent);
  filter: brightness(0) invert(1);
}

.auth-intro-copy {
  margin: auto 0;
  padding: 80px 0;
}

.auth-kicker {
  margin: 0;
  color: var(--site-accent);
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.16em;
}

.auth-intro h1 {
  margin: 20px 0 0;
  color: var(--site-ink);
  font-size: clamp(52px, 7vw, 92px);
  font-weight: 650;
  letter-spacing: -0.065em;
  line-height: 0.92;
}

.auth-intro h1 em {
  color: var(--site-accent);
  font-style: normal;
}

.auth-intro-copy > p:last-child {
  max-width: 390px;
  margin: 28px 0 0;
  color: var(--site-muted);
  font-size: 15px;
  line-height: 1.8;
}

.auth-intro-foot {
  display: flex;
  justify-content: space-between;
  padding-top: 18px;
  border-top: 1px solid var(--site-line);
  color: var(--site-muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.login-card {
  border: 1px solid var(--site-ink) !important;
  border-radius: 0 !important;
  background: var(--site-surface) !important;
  box-shadow: 14px 14px 0 var(--site-accent) !important;
  overflow: hidden;
}

.auth-page-embedded .login-card {
  max-width: none !important;
  border: 0 !important;
  box-shadow: none !important;
}

.login-header {
  padding: 34px 34px 26px;
  text-align: left;
}

.login-title {
  margin-bottom: 8px;
  color: var(--site-ink);
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.04em;
}

.login-eyebrow {
  margin-bottom: 10px;
  color: var(--site-accent);
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.15em;
}

.login-sub {
  max-width: 330px;
  color: var(--site-muted);
  font-size: 13px;
  line-height: 1.65;
}

.login-card :deep(.v-tabs) {
  border-top: 1px solid var(--site-line);
  border-bottom: 1px solid var(--site-line);
}

.login-card :deep(.v-tab) {
  min-height: 48px;
  color: rgb(255 255 255 / 0.72);
  font-size: 12px;
  font-weight: 700;
}

.login-card :deep(.v-tab--selected) {
  color: #fff;
}

.login-card :deep(.v-card-text) {
  padding: 28px 34px 34px;
}

.login-card :deep(.v-field) {
  border-radius: 0;
  background: transparent;
}

.login-card :deep(.v-label),
.login-card .m-0-4 {
  color: var(--site-muted);
  font-size: 12px;
  font-weight: 650;
}

.login-card :deep(.v-field--focused) {
  --v-field-border-opacity: 1;
}

.login-btn {
  width: 100%;
  border-radius: 0;
}

.account-note {
  border: 1px solid var(--site-line) !important;
  border-radius: 0 !important;
  background: var(--site-accent-soft) !important;
}

.account-note :deep(.v-card-title) {
  padding: 16px 18px 0;
  color: var(--site-ink);
  font-size: 13px;
  font-weight: 750;
}

.account-note :deep(.v-card-text) {
  padding: 10px 18px 16px;
  color: var(--site-ink);
  font-size: 12px;
  line-height: 1.7;
}

.account-note p + p {
  margin-top: 8px;
}

@media (max-width: 800px) {
  .auth-page {
    grid-template-columns: 1fr;
    gap: 28px;
    min-height: 0;
    padding: 42px 24px 56px;
  }

  .auth-intro {
    min-height: 0;
  }

  .auth-intro-copy {
    padding: 58px 0 42px;
  }

  .auth-intro h1 {
    font-size: 58px;
  }
}

@media (max-width: 480px) {
  .auth-page {
    padding-right: 16px;
    padding-left: 16px;
  }

  .auth-intro h1 {
    font-size: 48px;
  }

  .login-header,
  .login-card :deep(.v-card-text) {
    padding-right: 22px;
    padding-left: 22px;
  }

  .login-card {
    box-shadow: 8px 8px 0 var(--site-accent) !important;
  }
}
</style>
