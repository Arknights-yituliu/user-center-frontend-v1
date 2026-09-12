<script setup>
import {onMounted, ref} from "vue";
import '../../assets/css/account/login.v2.scss'
import {createMessage} from "../../utils/message";
import {useRouter} from "vue-router";
import {setUcTmpToken, ucRequest} from "../../api/uc/uc-api";

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

/** OAuth 授权回跳地址：authorize 未登录时会 302 到本页并携带 ?redirect=<authorize完整地址> */
const oauthRedirect = ref("")

/**
 * 本次登录返回的 UC token：
 * 仅保存在内存用于换取一次性票据，刻意不写入 localStorage，
 * 避免把 OAuth 授权流程的登录态污染到本机已登录的 UC 会话
 */
let sessionToken = ''

/**
 * 登录成功后若处于 OAuth 授权回跳流程：
 * 1. 用本次登录的内存 token 调 POST /oauth2/ticket 换取一次性票据
 * 2. 携带 uc_ticket 回跳 authorize（跨站票据方案，不依赖 Cookie，登录页与 UC 不同域名也可用）
 *
 * 与普通登录页 login.vue 的区别：不读取本地 UC_TOKEN 自动换票，
 * 即使本机已登录也要求用户重新输入账号密码，防止授权流程被本地会话"代确认"
 */
async function redirectIfOAuth() {
    if (!oauthRedirect.value || !sessionToken) {
        return
    }
    try {
        // 显式传入本次登录 token（ucRequest 中 token 参数优先级高于本地 localStorage）
        const resp = await ucRequest({method: "POST", url: "/oauth2/ticket", token: sessionToken})
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
    // 安全设计：本页刻意不读取本地 UC token 自动换票，要求用户重新登录
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
 * 登录成功后的统一处理：
 * - 本次登录 token 只存临时 key（UC_TMP_TOKEN），不写入正式会话 UC_TOKEN；授权完成回跳第三方前由授权确认页清除
 * - 处于 OAuth 授权回跳流程时换票回跳继续授权
 * - 非授权场景（直接访问本页）提示后转普通登录页
 * @param {{token:string, uid:string|number}} data UC 登录返回的 LoginVO
 */
function handleLoginSuccess(data) {
    sessionToken = (data && data.token) || ""
    if (oauthRedirect.value && sessionToken) {
        // 写入临时 token，供授权确认页读取（授权完成后清除）
        setUcTmpToken(sessionToken)
        redirectIfOAuth()
        return
    }
    createMessage({text: "本页为第三方授权专用登录页，请从第三方网站重新发起授权", type: "warning"})
    setTimeout(() => {
        router.replace({name: "LOGIN"})
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
  <div class="login-page">
    <!-- 渐变背景层 -->
    <div class="login-bg"></div>

    <v-card class="login-card m-a" max-width="440" width="100%">
      <!-- 标题区 -->
      <div class="login-header">
        <div class="login-title">一图流账号登录</div>
        <div class="login-sub">第三方授权登录，使用统一用户中心（UserCenter）账号</div>
      </div>

      <!-- 安全提示：区别于普通登录页，本页不使用已登录会话 -->
      <v-card title="安全提示" color="warning" variant="tonal" class="mx-4 mb-2">
        <v-card-text>
          授权流程为保护您的账号安全，不会使用本机已登录的会话，请重新输入账号密码登录。
        </v-card-text>
      </v-card>

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

        <v-card title="账号须知" color="primary" variant="tonal" class="m-12-4">
          <v-card-text>
            <p>
              使用密码登录时，如果账号绑定了邮箱，也可将邮箱作为账号进行登录。
            </p>
            <p>
              *此账号为一图流账号，与鹰角网络通行证(明日方舟游戏账号)无关，仅为保存您的干员练度数据使用
            </p>
            <p>
              *为了您的账号安全，注册时的密码不要与您其他重要账号的密码相同
            </p>
            <p>
              *请妥善保管好您的官网token和森空岛token
            </p>
          </v-card-text>
        </v-card>
      </v-card-text>
    </v-card>
  </div>
</template>

<style scoped>
.login-page {
    position: relative;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
}

/* 渐变背景层 */
.login-bg {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgb(var(--v-theme-primary) / 0.08) 100%);
    z-index: 0;
}

[data-theme="dark"] .login-bg {
    background: linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%);
}

.login-card {
    position: relative;
    z-index: 1;
    border-radius: 4px;
    overflow: hidden;
}

/* 标题区 */
.login-header {
    padding: 28px 24px 20px;
    text-align: center;
}

.login-title {
    font-size: 22px;
    font-weight: 600;
    margin-bottom: 6px;
}

.login-sub {
    font-size: 13px;
    opacity: 0.6;
}

/* 登录按钮 */
.login-btn {
    width: 200px;
    border-radius: 8px;
}
</style>
