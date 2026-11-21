<template>
  <aside class="oauth-update-notice" aria-label="OAuth2 更新提示">
    <v-icon icon="mdi-information-outline" size="21" aria-hidden="true" />
    <p>UC → TCL 名称更新继续兼容旧接入；部署切换时，在途登录与授权可能需要重新发起。</p>
    <RouterLink :to="{ path: '/developer', query: { tab: 'updates' } }">
      查看更新与兼容说明 <span aria-hidden="true">↗</span>
    </RouterLink>
  </aside>
</template>

<style scoped>
.oauth-update-notice {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 24px 0;
  padding: 16px 20px;
  border: 1px solid rgba(var(--v-theme-primary), 0.25);
  border-radius: 8px;
  background: rgba(var(--v-theme-primary), 0.06);
  color: rgb(var(--v-theme-on-surface));
  font-size: 13px;
  line-height: 1.7;
}

.oauth-update-notice > .v-icon {
  flex-shrink: 0;
  color: rgb(var(--v-theme-primary));
}

.oauth-update-notice p {
  flex: 1;
  margin: 0;
}

.oauth-update-notice a {
  flex-shrink: 0;
  color: rgb(var(--v-theme-primary));
  font-weight: 700;
  text-underline-offset: 4px;
}

@media (max-width: 640px) {
  .oauth-update-notice {
    flex-wrap: wrap;
    align-items: flex-start;
    padding: 14px;
  }

  .oauth-update-notice p {
    flex-basis: calc(100% - 33px);
  }

  .oauth-update-notice a {
    margin-left: 33px;
  }
}
</style>
