<script setup>
import {onMounted, ref} from "vue";
import '../../assets/css/account/login.v2.scss'
import '../../assets/css/account/login.v2.phone.scss'
import {createMessage} from "../../utils/message";
import {useRoute, useRouter} from "vue-router";
import {setUcSession, setUcTmpToken, ucRequest} from "../../api/uc/uc-api";

/** 注册表单：用户名、密码、确认密码、邮箱、邮箱验证码均为必填，昵称选填 */
const inputContent = ref({
    userName: '',
    password: '',
    confirmPassword: '',
    email: '',
    verificationCode: '',
    nickname: '',
})

/** 注册 / 发送验证码 加载状态 */
const registerLoading = ref(false)
const sendCodeLoading = ref(false)

/** 发送验证码倒计时（秒） */
const codeCountdown = ref(0)

const router = useRouter()
const route = useRoute()

/** OAuth 授权回跳地址：从登录页 / OAuth 安全登录页"去注册"跳转时携带（?redirect=<authorize完整地址>） */
const oauthRedirect = ref("")

/** 跳转登录页（保留 OAuth 授权回跳参数） */
function toLogin() {
    router.push({name: 'LOGIN', query: oauthRedirect.value ? {redirect: oauthRedirect.value} : {}})
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
 * 注册成功且处于 OAuth 授权回跳流程时：
 * 1. 用本次注册返回的内存 token 调 POST /oauth2/ticket 换取一次性票据（不写入 localStorage，与 OAuth 安全登录页一致）
 * 2. 携带 uc_ticket 回跳 authorize 继续授权
 * @param token 注册接口返回的 UC token
 */
async function redirectIfOAuth(token) {
    if (!oauthRedirect.value || !token) {
        return
    }
    try {
        // 显式传入本次注册 token（ucRequest 中 token 参数优先级高于本地 localStorage）
        const resp = await ucRequest({method: "POST", url: "/oauth2/ticket", token})
        const ticket = resp.data && resp.data.ticket
        if (!ticket) {
            createMessage({text: "换取登录票据失败：响应中无 ticket", type: "error"})
            return
        }
        // 携带 uc_ticket 回跳原 authorize 地址；replace 避免票据残留浏览器历史
        const target = new URL(oauthRedirect.value)
        target.searchParams.set("uc_ticket", ticket)
        createMessage({text: "注册成功，已换取票据，正在回跳授权页…", type: "success"})
        window.location.replace(target.toString())
    } catch {
        // 错误提示已在 ucRequest 内部统一弹出
    }
}

onMounted(() => {
    // 解析登录页跳转时携带的 OAuth 授权回跳参数
    oauthRedirect.value = route.query.redirect ? String(route.query.redirect) : ""
})

/** 校验密码规则（与 UC 一致：6-32 位，数字、字母、@、下划线） */
function checkPassword(password) {
    if (!/^[A-Za-z0-9@_]{6,32}$/.test(password)) {
        createMessage({text: "密码需为 6-32 位，仅允许数字、字母、@、下划线", type: "warning"})
        return false
    }
    return true
}

/**
 * 发送注册邮箱验证码（UC POST /auth/send-code，usage=register），成功后 60s 倒计时
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
            data: {email, usage: "register"},
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
 * 注册：调用 UC POST /auth/register（注册即自动登录）
 * 仅有账号密码一种注册方式：用户名、邮箱、邮箱验证码、密码必填，昵称选填
 */
async function toRegister() {
    const form = inputContent.value
    const payload = {registerType: 'password'}

    if (!checkField(form.userName, "用户名")) {
        return
    }
    if (!/^[A-Za-z0-9_]{3,20}$/.test(form.userName)) {
        createMessage({text: "用户名仅支持字母、数字、下划线，长度 3-20 位", type: "warning"})
        return
    }
    payload.userName = form.userName

    if (!checkField(form.email, "邮箱")) {
        return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        createMessage({text: "邮箱格式不正确", type: "warning"})
        return
    }
    payload.email = form.email

    if (!checkField(form.verificationCode, "邮箱验证码")) {
        return
    }
    payload.verificationCode = form.verificationCode

    if (!checkField(form.password, "密码") || !checkPassword(form.password)) {
        return
    }
    if (form.confirmPassword !== form.password) {
        createMessage({text: "两次密码输入不一致", type: "warning"})
        return
    }
    payload.password = form.password

    // 昵称选填：填写时校验长度并提交
    const nickname = form.nickname.trim()
    if (nickname) {
        if (nickname.length > 20) {
            createMessage({text: "昵称长度不能超过 20 个字符", type: "warning"})
            return
        }
        payload.nickname = nickname
    }

    registerLoading.value = true
    try {
        const resp = await ucRequest({
            method: "POST",
            url: "/auth/register",
            data: payload,
            auth: false,
        })
        // 注册即自动登录
        const data = resp.data || {}
        // 处于 OAuth 授权回跳流程：不写入正式会话，临时 token 供授权确认页读取（授权完成后清除），换票回跳继续授权
        if (oauthRedirect.value) {
            setUcTmpToken(data.token)
            redirectIfOAuth(data.token)
            return
        }
        // 普通注册：保存 UC 会话并跳转首页
        setUcSession(data.token, data.uid)
        createMessage({type: 'success', text: '注册成功，即将转跳到首页'})
        // 原项目此处跳转 OperatorSurvey 干员导入流程（本项目无该路由），改为跳转首页
        setTimeout(() => {
            router.push({path: '/'})
        }, 1500)
    } catch {
        // 错误提示已在 ucRequest 内部统一弹出
    } finally {
        registerLoading.value = false
    }
}
</script>

<template>
  <div class="auth-page">
    <section class="auth-intro">
      <div class="auth-intro-top">
        <img src="/logo.svg" alt="" width="40" height="40" />
        <span>一图流 / ACCOUNT</span>
      </div>
      <div class="auth-intro-copy">
        <p class="auth-kicker">START HERE</p>
        <h1>你的数据，<br /><em>值得被带走。</em></h1>
        <p>创建一个一图流账号，在不同的一图流服务之间保持自己的资料和使用体验。</p>
      </div>
      <div class="auth-intro-foot">
        <span>02</span>
        <span>一个账号 · 多个入口</span>
      </div>
    </section>

    <v-card class="login-card m-a" max-width="440" width="100%">
      <!-- 标题区 -->
      <div class="login-header">
        <div class="login-eyebrow">一图流账号中心</div>
        <div class="login-title">创建一图流账号</div>
        <div class="login-sub">注册后可以在支持的一图流服务中使用同一个账号</div>
        <v-btn text="已有账号，去登录" variant="text" color="primary" @click="toLogin()"></v-btn>
      </div>

      <v-card-text>
        <div class="m-0-4">用户名</div>
        <v-text-field
            density="compact"
            v-model="inputContent.userName"
            placeholder="3-20 位，仅字母、数字、下划线"
            color="primary"
            variant="outlined"
            class="m-4"
        ></v-text-field>

        <div class="m-0-4">登录密码</div>
        <v-text-field
            density="compact"
            color="primary"
            v-model="inputContent.password"
            variant="outlined"
            type="password"
            placeholder="6-32 位，仅数字、字母、@、下划线"
            hide-details="auto"
            class="m-4"
        ></v-text-field>

        <div class="m-0-4">确认密码</div>
        <v-text-field
            density="compact"
            color="primary"
            v-model="inputContent.confirmPassword"
            variant="outlined"
            type="password"
            placeholder="再次输入密码"
            hide-details="auto"
            class="m-4"
        ></v-text-field>

        <div class="m-0-4">邮箱</div>
        <v-text-field
            density="compact"
            color="primary"
            v-model="inputContent.email"
            variant="outlined"
            placeholder="用于验证身份与找回密码"
            class="m-4"
        ></v-text-field>

        <div class="m-0-4">邮箱验证码</div>
        <!-- 6 位验证码分格输入（不设 color，避免 OTP 格子背景被染成主色） -->
        <v-otp-input
            v-model="inputContent.verificationCode"
            length="6"
            type="number"
            density="compact"
            variant="outlined"
            class="m-4"
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

        <div class="m-0-4">昵称（选填）</div>
        <v-text-field
            density="compact"
            color="primary"
            v-model="inputContent.nickname"
            variant="outlined"
            placeholder="最长 20 个字符"
            class="m-4"
        ></v-text-field>

        <div class="flex justify-center m-4">
          <v-btn
              @click="toRegister"
              text="注册"
              color="primary"
              variant="flat"
              size="large"
              class="login-btn"
              :loading="registerLoading"
          ></v-btn>
        </div>

        <v-card title="注册前了解一下" color="primary" variant="tonal" class="m-12-4 account-note">
          <v-card-text>
            <p>
              这是用于一图流相关服务的账号，不是鹰角网络通行证或明日方舟游戏账号。
            </p>
            <p>
              注册需填写用户名、邮箱与邮箱验证码；邮箱可用于找回密码和邮箱登录。
            </p>
            <p>
              为了账号安全，请不要使用与其他重要账号相同的密码。
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
