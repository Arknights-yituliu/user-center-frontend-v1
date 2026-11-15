import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const server = await createServer({
  configFile: false,
  root: fileURLToPath(new URL('../', import.meta.url)),
  server: { middlewareMode: true, watch: null },
  appType: 'custom',
})
after(() => server.close())
const { buildRosterRows, buildManualUploadPayload } = await server.ssrLoadModule(
  '/src/utils/operator-roster.ts',
)
const data = {
  operators: Object.fromEntries(
    Array.from({ length: 65 }, (_, index) => {
      const id = `char_${index}`
      return [id, { charId: id, name: id, rarity: 6 }]
    }),
  ),
  professionLabels: {},
  subProfessionLabels: {},
}

test('full catalog includes unowned operators and preserves explicit owned=0', () => {
  const rows = buildRosterRows(
    [
      { id: 'char_0', level: 90 },
      { id: 'char_1', owned: 0, level: 80 },
    ],
    data,
  )
  assert.equal(rows.length, 65)
  assert.equal(rows.find((row) => row.id === 'char_0').owned, 1)
  assert.equal(rows.find((row) => row.id === 'char_1').owned, 0)
  assert.equal(rows.find((row) => row.id === 'char_2').owned, 0)
})

test('unrecruiting in a local draft retains progression without mutating saved data', () => {
  const operators = [{ id: 'char_0', owned: 1, level: 90, equipX: 3 }]
  const [original] = buildRosterRows(operators, data)
  const rows = buildRosterRows(operators, data, { char_0: { ...original, owned: 0 } })
  assert.equal(rows[0].owned, 0)
  assert.equal(rows[0].level, 90)
  assert.equal(rows[0].equipX, 3)
  assert.equal(rows[0].dirty, true)
  assert.equal(operators[0].owned, 1)
})

test('batch upload includes edited operators from every page and every progression field', () => {
  const operators = [
    { id: 'char_0', owned: 1 },
    { id: 'char_50', owned: 1 },
    { id: 'char_64', owned: 1 },
  ]
  const original = buildRosterRows(operators, data)
  const drafts = Object.fromEntries(
    original.filter((row) => row.owned === 1).map((row) => [row.id, { ...row, level: 80 }]),
  )
  const rows = buildRosterRows(operators, data, drafts)
  const payload = buildManualUploadPayload(rows)
  assert.equal(payload.length, 3)
  assert.deepEqual(new Set(payload.map((row) => row.id)), new Set(['char_0', 'char_50', 'char_64']))
  assert.equal(
    payload.every((row) => row.owned === 1),
    true,
  )
  for (const item of payload) {
    for (const field of [
      'owned',
      'rarity',
      'level',
      'evolvePhase',
      'mainSkillLevel',
      'skill1',
      'skill2',
      'skill3',
      'equipX',
      'equipY',
      'equipD',
      'equipA',
      'equipB',
      'potentialRank',
    ]) {
      assert.equal(typeof item[field], 'number', `${item.id}.${field}`)
    }
    assert.equal('dirty' in item, false)
    assert.equal('manual' in item, false)
  }
})

test('an operator absent from the manual owned-only response stays unowned', () => {
  const automatic = buildRosterRows([{ id: 'char_0', owned: 1 }], data)
  const manual = buildRosterRows([], data, {}, true)
  assert.equal(automatic[0].owned, 1)
  assert.equal(manual.find((row) => row.id === 'char_0').owned, 0)
  assert.equal(
    manual.every((row) => row.manual),
    true,
  )
})

test('unknown server operators can still be edited and uploaded', () => {
  const operators = [{ id: 'char_future', owned: 1, level: 50 }]
  const [original] = buildRosterRows(operators, data)
  const payload = buildManualUploadPayload(
    buildRosterRows(operators, data, {
      char_future: { ...original, level: 60 },
    }),
  )
  assert.equal(payload.length, 1)
  assert.equal(payload.find((row) => row.id === 'char_future').owned, 1)
  assert.equal(payload.find((row) => row.id === 'char_future').level, 60)
})

test('upload follows draft ownership changes without mutating saved ownership', () => {
  const operators = [{ id: 'char_0', owned: 1, level: 90 }]
  const original = buildRosterRows(operators, data)
  const rows = buildRosterRows(operators, data, {
    char_0: { ...original.find((row) => row.id === 'char_0'), owned: 0 },
    char_64: { ...original.find((row) => row.id === 'char_64'), owned: 1, level: 50 },
  })
  const payload = buildManualUploadPayload(rows)
  assert.equal(payload.length, 2)
  assert.equal(payload.find((row) => row.id === 'char_0').owned, 0)
  assert.equal(payload.find((row) => row.id === 'char_64').owned, 1)
  assert.equal(payload.find((row) => row.id === 'char_64').level, 50)
  assert.equal(operators[0].owned, 1)
})

test('unedited catalog and owned entries never enter the upload payload', () => {
  assert.deepEqual(buildManualUploadPayload(buildRosterRows([], data)), [])
  assert.deepEqual(
    buildManualUploadPayload(buildRosterRows([{ id: 'char_0', owned: 1 }], data)),
    [],
  )
})
