<script setup lang="ts">
import { gameLabel, stageLabel, type ImportOutcome } from '../../types/skland-import'

/**
 * 步骤 4：分游戏进度与结果
 *
 * 失败项只在此处标记失败，错误明细统一由页面底部 ImportErrorFooter 展示；
 * 这里**不提供任何重试入口**。
 */
defineProps<{
  running: boolean
  results: ImportOutcome[]
}>()
</script>

<template>
  <div class="si-section">
    <p v-if="running" class="si-running">
      <v-progress-circular indeterminate size="18" color="primary" />
      正在按勾选的游戏分别拉取并上传，请勿关闭页面…
    </p>

    <div v-if="results.length" class="si-results">
      <article
        v-for="outcome in results"
        :key="outcome.game"
        class="si-result"
        :class="outcome.ok ? 'is-ok' : 'is-fail'"
      >
        <span class="si-result-game">{{ gameLabel(outcome.game) }}</span>
        <span class="si-result-text">
          {{ outcome.ok ? outcome.summary : `导入失败（${stageLabel(outcome.error!.stage)}），原因见页面底部。` }}
        </span>
      </article>
    </div>
  </div>
</template>
