import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import axios from 'axios'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))
const operators = JSON.parse(
  await readFile(
    new URL('../public/data/operator/character_table_simple.v2.json', import.meta.url),
  ),
)
const staticData = { operators, professionLabels: {}, subProfessionLabels: {} }
const emptyData = { operators: {}, professionLabels: {}, subProfessionLabels: {} }
const server = await createServer({
  configFile: false,
  root,
  server: { middlewareMode: true, watch: null },
  appType: 'custom',
})
after(() => server.close())
const { formattingOperatorData, getWarehouseInfo } =
  await server.ssrLoadModule('/src/utils/skland.ts')

function moduleFor(slot) {
  for (const [id, entry] of Object.entries(operators)) {
    const equip = entry.equip?.find((item) => item.typeName2 === slot)
    if (equip) return { id, entry, equip }
  }
  throw new Error(`Missing static module for slot ${slot}`)
}

test('raw id/level modules map to all five slots without typeName2', () => {
  for (const [index, slot] of ['X', 'Y', 'D', 'A', 'B'].entries()) {
    const { id, entry, equip } = moduleFor(slot)
    const level = (index % 3) + 1
    const [result] = formattingOperatorData(
      [{ id, equips: [{ id: equip.uniEquipId, level }], skills: [{ level: 2 }] }],
      staticData,
    )
    assert.equal(result[`equip${slot}`], level)
    assert.equal(result.rarity, entry.rarity)
    assert.equal(result.skill1, 2)
    for (const other of ['X', 'Y', 'D', 'A', 'B'].filter((item) => item !== slot)) {
      assert.equal(result[`equip${other}`], 0)
    }
  }
})

test('multiple modules resolve by id even when returned in reverse order', () => {
  const [id, entry] = Object.entries(operators).find(
    ([, item]) =>
      item.equip?.some((e) => e.typeName2 === 'X') && item.equip.some((e) => e.typeName2 === 'Y'),
  )
  const modules = entry.equip.filter((e) => ['X', 'Y'].includes(e.typeName2))
  const [result] = formattingOperatorData(
    [
      {
        id,
        equips: modules
          .toReversed()
          .map((e) => ({ id: e.uniEquipId, level: e.typeName2 === 'X' ? 1 : 3 })),
      },
    ],
    staticData,
  )
  assert.equal(result.equipX, 1)
  assert.equal(result.equipY, 3)
})

test('explicit branch remains supported when static metadata is unavailable', () => {
  const [result] = formattingOperatorData(
    [{ id: 'future-operator', equips: [{ id: 'future-module', typeName2: 'b', level: 2 }] }],
    emptyData,
  )
  assert.equal(result.equipB, 2)
})

test('an unresolved upgraded module stops import instead of silently uploading zero', () => {
  assert.throws(
    () =>
      formattingOperatorData(
        [{ id: 'future-operator', equips: [{ id: 'future-module', level: 3 }] }],
        emptyData,
      ),
    /已升级模组无法匹配静态数据/,
  )
})

test('locked modules and absent module lists remain zero', () => {
  const results = formattingOperatorData(
    [{ id: 'first', equips: [{ id: 'unknown-locked-module', level: 0 }] }, { id: 'second' }],
    emptyData,
  )
  for (const result of results) {
    for (const slot of ['X', 'Y', 'D', 'A', 'B']) assert.equal(result[`equip${slot}`], 0)
  }
})

test('warehouse import loads static metadata before formatting the upload payload', async () => {
  const { id, equip } = moduleFor('Y')
  const originalGet = axios.get
  const originalFetch = globalThis.fetch
  try {
    axios.get = async () => ({
      data: {
        code: 0,
        data: {
          characters: [{ id, equips: [{ id: equip.uniEquipId, level: 3 }] }],
          items: [{ id: '4001', count: 42 }],
        },
      },
    })
    globalThis.fetch = async (url) =>
      new Response(
        JSON.stringify(String(url).endsWith('character_table_simple.v2.json') ? operators : []),
      )
    const result = await getWarehouseInfo('test-account', 'test-cred', 'test-token')
    assert.equal(result.operators[0].equipY, 3)
    assert.deepEqual(result.playerInfo, { akUid: 'test-account' })
    assert.deepEqual(result.itemList, [{ itemId: '4001', quantity: 42 }])
  } finally {
    axios.get = originalGet
    globalThis.fetch = originalFetch
  }
})
