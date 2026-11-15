<script setup lang="ts">
import { computed } from 'vue'
import type { EndfieldCardDetail } from '../api/skland-endfield-api'

const props = defineProps<{ detail: EndfieldCardDetail }>()
const stats = computed(() => [
  { label: '权限等阶', value: props.detail.base?.level ?? '—' },
  { label: '探索等级', value: props.detail.base?.worldLevel ?? '—' },
  { label: '干员', value: props.detail.base?.charNum ?? props.detail.chars?.length ?? '—' },
  { label: '武器', value: props.detail.base?.weaponNum ?? '—' },
  {
    label: '理智',
    value: `${props.detail.dungeon?.curStamina ?? '—'} / ${props.detail.dungeon?.maxStamina ?? '—'}`,
  },
  {
    label: '每日活跃',
    value: `${props.detail.dailyMission?.dailyActivation ?? '—'} / ${props.detail.dailyMission?.maxDailyActivation ?? '—'}`,
  },
  {
    label: '每周任务',
    value: `${props.detail.weeklyMission?.score ?? '—'} / ${props.detail.weeklyMission?.total ?? '—'}`,
  },
  {
    label: '通行证',
    value: `${props.detail.bpSystem?.curLevel ?? '—'} / ${props.detail.bpSystem?.maxLevel ?? '—'}`,
  },
])
const rawJson = computed(() => JSON.stringify(props.detail, null, 2))
</script>

<template>
  <div class="endfield-detail">
    <div class="profile">
      <v-avatar color="primary" size="52">
        <img
          v-if="detail.base?.avatarUrl"
          :src="detail.base.avatarUrl"
          alt="角色头像"
          referrerpolicy="no-referrer"
        />
        <v-icon v-else icon="mdi-account-outline" size="30" />
      </v-avatar>
      <div>
        <h3>{{ detail.base?.name || '终末地管理员' }}</h3>
        <p v-if="detail.base?.mainMission?.description">
          {{ detail.base.mainMission.description }}
        </p>
      </div>
    </div>
    <dl class="stats">
      <div v-for="stat in stats" :key="stat.label">
        <dt>{{ stat.label }}</dt>
        <dd>{{ stat.value }}</dd>
      </div>
    </dl>
    <section v-if="detail.chars?.length" class="detail-section">
      <h4>干员数据 · {{ detail.chars.length }}</h4>
      <div class="characters">
        <article
          v-for="(character, index) in detail.chars"
          :key="character.charData?.id || index"
          class="character"
        >
          <strong>{{
            character.charData?.name ||
            character.charData?.charName ||
            character.charData?.id ||
            '未知干员'
          }}</strong>
          <p>
            Lv.{{ character.level ?? '—' }} · 精英化 {{ character.evolvePhase ?? '—' }} · 潜能
            {{ character.potentialLevel ?? '—' }}
          </p>
          <small v-if="character.weapon?.weaponData">
            {{
              character.weapon.weaponData.name ||
              character.weapon.weaponData.weaponName ||
              character.weapon.weaponData.id
            }}
            · Lv.{{ character.weapon.level ?? '—' }}
          </small>
        </article>
      </div>
    </section>
    <section v-if="detail.domain?.length" class="detail-section">
      <h4>地区建设</h4>
      <div class="domains">
        <span v-for="(domain, index) in detail.domain" :key="index"
          >{{ domain.name || '未知地区' }} · Lv.{{ domain.level ?? '—' }}</span
        >
      </div>
    </section>
    <details class="raw-data">
      <summary>查看完整原始数据</summary>
      <pre>{{ rawJson }}</pre>
    </details>
  </div>
</template>

<style scoped>
.profile {
  display: flex;
  align-items: center;
  gap: 16px;
}
.profile img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.profile h3 {
  margin: 0;
  font-size: 20px;
}
.profile p,
.character p {
  margin: 6px 0 0;
  color: var(--site-muted);
  font-size: 13px;
}
.stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin: 24px 0;
}
.stats > div {
  padding: 14px;
  background: var(--site-paper);
  border: 1px solid var(--site-line);
}
.stats dt {
  color: var(--site-muted);
  font-size: 12px;
}
.stats dd {
  margin: 5px 0 0;
  font-size: 19px;
  font-weight: 750;
}
.detail-section {
  margin-top: 24px;
}
.detail-section h4 {
  margin: 0 0 12px;
  font-size: 15px;
}
.characters {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.character {
  min-width: 0;
  padding: 16px;
  border: 1px solid var(--site-line);
}
.character small {
  display: block;
  margin-top: 10px;
  color: var(--site-muted);
  overflow-wrap: anywhere;
}
.domains {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 13px;
}
.raw-data {
  margin-top: 24px;
  border-top: 1px solid var(--site-line);
  padding-top: 16px;
}
.raw-data summary {
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
}
.raw-data pre {
  max-height: 360px;
  margin: 16px 0 0;
  padding: 16px;
  overflow: auto;
  background: var(--site-paper);
  font-size: 12px;
}
@media (max-width: 700px) {
  .stats,
  .characters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 440px) {
  .characters {
    grid-template-columns: minmax(0, 1fr);
  }
  .stats > div {
    padding: 10px;
  }
  .stats dd {
    font-size: 16px;
  }
}
</style>
