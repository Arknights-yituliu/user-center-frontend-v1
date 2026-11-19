<script setup lang="ts">
import { computed } from 'vue'
import {
  targetUidText,
  type AkTarget,
  type EfTarget,
  type GameScope,
} from '../../types/skland-import'

/**
 * 步骤 2：勾选要导入的游戏 + 双栏账号选择
 *
 * - 只有勾选的栏可选账号；未勾选的栏整体置灰
 * - 默认标记只在森空岛确实给出时展示，不做「你的默认账号」暗示
 */
const props = defineProps<{
  akTargets: AkTarget[]
  efTargets: EfTarget[]
  selectedAkKey: string
  selectedEfKey: string
  scope: Record<GameScope, boolean>
  loading: boolean
  errorMessage: string
}>()

const emit = defineEmits<{
  select: [game: GameScope, key: string]
  toggleScope: [game: GameScope, value: boolean]
}>()

const columns = computed(() => [
  {
    game: 'arknights' as GameScope,
    title: '明日方舟',
    unit: '游戏 UID',
    targets: props.akTargets as Array<AkTarget | EfTarget>,
    selected: props.selectedAkKey,
  },
  {
    game: 'endfield' as GameScope,
    title: '终末地',
    unit: '角色 roleId',
    targets: props.efTargets as Array<AkTarget | EfTarget>,
    selected: props.selectedEfKey,
  },
])

function onToggle(game: GameScope, event: Event): void {
  emit('toggleScope', game, (event.target as HTMLInputElement).checked)
}
</script>

<template>
  <div class="si-section">
    <div class="si-scope">
      <label
        v-for="column in columns"
        :key="column.game"
        class="si-scope-item"
        :class="{ 'is-disabled': !scope[column.game] }"
      >
        <input
          type="checkbox"
          :checked="scope[column.game]"
          :disabled="loading"
          @change="onToggle(column.game, $event)"
        />
        导入{{ column.title }}数据
      </label>
    </div>

    <p v-if="errorMessage" class="si-error" role="alert">{{ errorMessage }}</p>

    <div class="si-columns">
      <section
        v-for="column in columns"
        :key="column.game"
        class="si-column"
        :class="{ 'is-muted': !scope[column.game] }"
        :aria-label="`${column.title} 账号`"
      >
        <div class="si-column-head">
          <strong>{{ column.title }}</strong>
          <span>{{ column.targets.length }} 个已绑定 · {{ column.unit }}</span>
        </div>

        <p v-if="loading" class="si-empty">正在读取森空岛绑定账号…</p>
        <p v-else-if="!column.targets.length" class="si-empty">
          未找到该游戏的绑定角色。请先在森空岛 APP 内绑定，再重新读取。
        </p>

        <div v-else class="si-account-list">
          <button
            v-for="target in column.targets"
            :key="target.key"
            type="button"
            class="si-account"
            :class="{ 'is-active': column.selected === target.key }"
            :aria-pressed="column.selected === target.key"
            @click="emit('select', column.game, target.key)"
          >
            <span class="si-account-body">
              <span class="si-account-name">
                {{ target.nickname || targetUidText(target) }}
                <span v-if="target.isDefault" class="si-badge">森空岛标记的默认</span>
              </span>
              <span class="si-account-meta">
                {{ targetUidText(target) }} ·
                {{ target.serverName || (target.game === 'endfield' ? target.serverId : '默认') }}
              </span>
            </span>
            <span v-if="column.selected === target.key" class="si-account-check" aria-hidden="true">
              <v-icon icon="mdi-check-bold" size="16" />
            </span>
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
