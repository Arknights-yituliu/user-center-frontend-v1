<script setup lang="ts">
import { computed } from 'vue'
import type { OAuthScopeVO } from '../api/user-center/oauth-client-api'

const props = defineProps<{
  modelValue: string[]
  options: OAuthScopeVO[]
  loading: boolean
  error: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [value: string[]]
  retry: []
}>()
const sensitiveScopes = computed(() =>
  props.options.filter((scope) => scope.sensitive && props.modelValue.includes(scope.code)),
)
</script>

<template>
  <div class="oauth-scope-selector">
    <v-select
      :model-value="modelValue"
      :items="options"
      item-title="code"
      item-value="code"
      label="授权范围"
      multiple
      chips
      closable-chips
      :loading="loading"
      :disabled="loading || error"
      :error-messages="error ? '授权范围加载失败，请重试后再保存' : []"
      hint="仅可选择平台支持的权限，请按实际需要申请"
      persistent-hint
      variant="outlined"
      density="compact"
      @update:model-value="emit('update:modelValue', $event)"
    >
      <template #item="{ item, props: itemProps }">
        <v-list-item
          v-bind="itemProps"
          :title="`${item.code} · ${item.name}`"
          :subtitle="item.description"
        >
          <template #append>
            <v-chip v-if="item.sensitive" color="warning" size="x-small">敏感权限</v-chip>
          </template>
        </v-list-item>
      </template>
    </v-select>
    <v-btn v-if="error" variant="text" size="small" @click="emit('retry')">重新加载授权范围</v-btn>
    <v-alert v-if="sensitiveScopes.length" type="warning" variant="tonal" density="compact">
      已选择敏感权限：{{ sensitiveScopes.map((scope) => scope.code).join('、') }}。
      涉及用户资料或游戏数据，请确认应用确实需要这些权限。
    </v-alert>
  </div>
</template>

<style scoped>
.oauth-scope-selector {
  display: grid;
  gap: 8px;
}
</style>
