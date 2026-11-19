<template>
  <article class="oauth-updates" aria-labelledby="oauth-updates-title">
    <header class="updates-header">
      <p class="updates-kicker">OAuth2 · 开发者公告</p>
      <h2 id="oauth-updates-title">版本更新与兼容性说明</h2>
      <p>了解接口变化、对现有应用的影响，以及需要采取的接入调整。</p>
    </header>

    <section class="release-note" aria-labelledby="scope-update-title">
      <div class="release-meta">
        <time datetime="2026-11-19">说明更新：2026-11-19</time>
        <v-chip size="small" color="warning" variant="tonal">权限标识调整</v-chip>
      </div>
      <h3 id="scope-update-title">游戏数据权限使用完整游戏名称</h3>
      <p class="release-summary">
        明日方舟与终末地的细粒度权限已在当前权限目录中改名。自行构造 scope 的应用、 客户端注册 /
        编辑和个人访问令牌签发请求，请使用以下新标识。
      </p>
      <p class="effective-time">生效时间以后端部署公告为准，以上日期为说明更新日期。</p>
      <div class="updates-table-wrap" role="region" aria-label="游戏权限名称对照" tabindex="0">
        <table>
          <thead>
            <tr>
              <th scope="col">权限</th>
              <th scope="col">旧标识</th>
              <th scope="col">当前标识</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>读取明日方舟数据</td>
              <td><code>ak-data.read</code></td>
              <td><code>arknights-data.read</code></td>
            </tr>
            <tr>
              <td>写入明日方舟数据</td>
              <td><code>ak-data.write</code></td>
              <td><code>arknights-data.write</code></td>
            </tr>
            <tr>
              <td>读取终末地数据</td>
              <td><code>ef-data.read</code></td>
              <td><code>endfield-data.read</code></td>
            </tr>
            <tr>
              <td>写入终末地数据</td>
              <td><code>ef-data.write</code></td>
              <td><code>endfield-data.write</code></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        上级权限 <code>gama-data.read</code> / <code>gama-data.write</code> 保持原名，
        分别覆盖两个游戏的读取 / 写入权限；单个游戏的权限仅覆盖该游戏，读取与写入权限相互独立。
      </p>
      <p>
        接入时请以客户端管理页加载的权限目录为准。旧标识不在当前目录中；
        旧客户端登记和已签发令牌的处理以后端迁移安排为准。 下方 UC → TCL 更新中的旧请求头 /
        参数兼容规则不适用于此次 scope 改名。
      </p>
    </section>

    <section class="release-note" aria-labelledby="tcl-update-title">
      <div class="release-meta">
        <time datetime="2026-11-19">说明更新：2026-11-19</time>
        <v-chip size="small" color="primary" variant="tonal">兼容更新</v-chip>
        <v-chip size="small" color="warning" variant="tonal">在途流程受影响</v-chip>
      </div>
      <h3 id="tcl-update-title">UC → TCL：接口名称统一</h3>
      <p class="release-summary">
        已接入的 OAuth2 应用无需因本次改名强制升级。旧请求头和旧票据参数继续支持；
        部署切换前已签发、尚未完成消费的授权码与短期票据可能失效，需要重新发起流程。
      </p>
      <p class="effective-time">生效时间以后端部署公告为准，以上日期为说明更新日期。</p>

      <h4>名称变化与兼容规则</h4>
      <div class="updates-table-wrap" role="region" aria-label="接口名称兼容对照" tabindex="0">
        <table>
          <thead>
            <tr>
              <th scope="col">旧名称</th>
              <th scope="col">推荐名称</th>
              <th scope="col">接入方如何处理</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>UC-Token</code></td>
              <td><code>TCL-Token</code></td>
              <td>旧头继续支持；已使用 Authorization: Bearer 的应用保持原用法。</td>
            </tr>
            <tr>
              <td><code>UC-Client-Id</code></td>
              <td><code>TCL-Client-Id</code></td>
              <td>旧头继续支持；客户端 ID 的实际值保持不变。</td>
            </tr>
            <tr>
              <td><code>uc_ticket</code></td>
              <td><code>tcl_ticket</code></td>
              <td>旧参数继续支持；自行构造登录回跳的应用可在后端更新后切换新名称。</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        令牌解析仍优先使用 <code>Authorization: Bearer</code>。新旧名称同时携带时，
        去除首尾空白后的非空值必须一致，否则返回业务码 <code>10001</code>； 优先命中 Bearer
        的令牌请求不再比较新旧令牌头。 切换票据参数时，应先移除 URL 中旧的
        <code>uc_ticket</code>，再写入新票据。
      </p>

      <h4>部署切换时，哪些操作可能需要重试</h4>
      <ul>
        <li>部署前取得的授权码，在部署后调用 <code>POST /oauth2/token</code> 兑换时可能失效。</li>
        <li>跨站登录票据、授权确认单，以及直连认证的临时 channel / ticket 可能失效。</li>
        <li>部署前发送的邮箱验证码可能失效，需要重新获取验证码。</li>
      </ul>
      <p>
        例如：用户在切换前完成登录并取得授权码，切换后应用才换取 token，此次兑换可能失败。 请重新从
        <code>GET /oauth2/authorize</code> 发起授权，并重新生成 state 和 PKCE 参数，
        不要反复提交同一枚旧授权码或旧票据。
      </p>
      <div class="updates-table-wrap" role="region" aria-label="切换期间错误处理" tabindex="0">
        <table>
          <thead>
            <tr>
              <th scope="col">业务码</th>
              <th scope="col">含义</th>
              <th scope="col">处理方式</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>90004</code></td>
              <td>授权码无效或已过期</td>
              <td>重新发起授权，取得新的 code 后兑换。</td>
            </tr>
            <tr>
              <td><code>90010</code></td>
              <td>登录票据无效或已过期</td>
              <td>重新进入登录 / 授权流程，获取新票据。</td>
            </tr>
            <tr>
              <td><code>90011</code></td>
              <td>授权确认单无效或已过期</td>
              <td>重新发起授权，获取新的确认单。</td>
            </tr>
            <tr>
              <td><code>10001</code></td>
              <td>参数错误；可能是新旧名称值冲突</td>
              <td>按响应 msg 检查参数，移除旧值或统一新旧值。</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="table-note">以上为业务响应体中的 code；这些错误也可能由正常过期或参数问题引起。</p>

      <h4>现有应用可以继续使用什么</h4>
      <p>
        API 路径、client_id / client_secret、已登记的回调地址、scope 和标准 OAuth2 参数保持原约定。
        已签发的 access_token、refresh_token 及关联数据不因改名主动失效，仍遵循原有效期、
        刷新轮转和吊销规则。无需批量退出用户、重新注册客户端或更换密钥。
      </p>
      <p>
        浏览器已有会话与 PKCE 存储键，以及 <code>tlc_pat_</code> 凭证前缀保持原样。
        请勿仅为统一简称改动现有存储键、客户端标识值或令牌内容。
      </p>

      <h4>接入方行动建议</h4>
      <ol>
        <li>现有应用可继续沿用旧名称；确认授权码或票据失效时，能引导用户重新授权。</li>
        <li>需要采用新名称时，先确认服务端已部署兼容版本，再更新请求头和自定义登录回跳。</li>
        <li>回归登录、授权码兑换、令牌刷新和退出 / 吊销；无需迁移现有令牌或清空浏览器登录状态。</li>
      </ol>
    </section>
  </article>
</template>

<style scoped>
.oauth-updates {
  max-width: 1040px;
  margin: 0 auto;
  padding: 36px 0 20px;
  color: rgb(var(--v-theme-on-surface));
  font-size: 14px;
  line-height: 1.85;
}

.updates-header {
  margin-bottom: 28px;
}

.updates-kicker {
  color: rgb(var(--v-theme-primary));
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.updates-header h2 {
  margin: 8px 0;
  font-size: clamp(24px, 4vw, 32px);
  line-height: 1.4;
}

.updates-header > p:last-child,
.effective-time,
.table-note {
  opacity: 0.7;
}

.release-note {
  padding: 28px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.15);
  border-radius: 10px;
  background: rgb(var(--v-theme-surface));
}

.release-note + .release-note {
  margin-top: 24px;
}

.release-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  font-size: 12px;
}

.release-note h3 {
  margin: 18px 0 12px;
  font-size: 22px;
  line-height: 1.5;
}

.release-note h4 {
  margin: 28px 0 12px;
  font-size: 17px;
}

.release-note p + p {
  margin-top: 12px;
}

.release-summary {
  font-weight: 600;
}

.effective-time,
.table-note {
  font-size: 12px;
}

.updates-table-wrap {
  overflow-x: auto;
  margin: 14px 0;
}

table {
  width: 100%;
  min-width: 580px;
  border-collapse: collapse;
  text-align: left;
}

th,
td {
  padding: 12px 14px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.15);
  vertical-align: top;
}

th {
  background: rgba(var(--v-theme-primary), 0.07);
  font-weight: 700;
}

code {
  overflow-wrap: anywhere;
  font-size: 0.92em;
}

td code {
  white-space: nowrap;
}

ul,
ol {
  margin: 12px 0;
  padding-left: 22px;
}

li + li {
  margin-top: 8px;
}

@media (max-width: 640px) {
  .oauth-updates {
    padding-top: 24px;
  }

  .release-note {
    padding: 18px 14px;
  }
}
</style>
