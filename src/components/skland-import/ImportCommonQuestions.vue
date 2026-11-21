<template>
  <section class="si-common-questions" aria-labelledby="si-common-questions-title">
    <h2 id="si-common-questions-title" class="si-common-questions-title">常见问题</h2>

    <div class="si-common-questions-content">
      <section class="si-common-question">
        <h3>请勿修改设备本地时间</h3>
        <p>如果出现报错：请勿修改设备本地时间可能是系统时间不准确导致。Windows 同步方法：</p>
        <p>① 右键任务栏时间 → 调整日期/时间</p>
        <p>② 点击"立即同步"</p>
        <p>或 Win+R 输入 <code>timedate.cpl</code> → Internet 时间 → 更改设置 → 立即更新</p>
      </section>

      <section class="si-common-question">
        <h3>需要设备验证</h3>
        <p>
          如果提示需要设备验证，请打开森空岛APP，进入 设置 → 通行证与账号安全 → 账号安全管理 → 设备管理 →
          新设备登录身份验证，关闭"新设备登录身份验证"
        </p>
      </section>
    </div>
  </section>
</template>

<style scoped>
.si-common-questions {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin-top: 28px;
  padding: 24px;
  border: 1px solid var(--site-line);
  background: var(--site-surface);
  box-shadow: 8px 8px 0 var(--site-accent-soft);
}

.si-common-questions-title {
  margin: 0;
  color: var(--site-ink);
  font-size: 20px;
  font-weight: 800;
}

.si-common-questions-content {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
}

.si-common-question {
  min-width: 0;
  padding-top: 14px;
  border-top: 1px solid var(--site-line);
}

.si-common-question h3 {
  margin: 0 0 10px;
  color: var(--site-ink);
  font-size: 14px;
  font-weight: 800;
}

.si-common-question p {
  margin: 0 0 7px;
  color: var(--site-muted);
  font-size: 12.5px;
  line-height: 1.7;
}

.si-common-question p:last-child {
  margin-bottom: 0;
}

.si-common-question code {
  padding: 1px 4px;
  background: var(--site-ink);
  color: var(--site-surface);
  font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
  font-size: 11.5px;
}

@media (max-width: 880px) {
  .si-common-questions-content {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .si-common-questions {
    padding: 18px;
  }
}
</style>
