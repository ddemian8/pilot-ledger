import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { moldovaDate, validRate, toMDL, convertOriginal, validOriginal, formatMDL } from '../src/fx.ts'
import { parseBNM, getBNMRate, exchangeEndpoint } from '../server/bnm.ts'
const xml = readFileSync(new URL('./fixtures/bnm-2026-09-11.xml', import.meta.url), 'utf8')
const date = '2026-09-11'
const rate = parseBNM(xml, date)

test('real BNM XML yields verified EUR rate and source date', () => {
  assert.equal(rate.date, date)
  assert.equal(rate.source, 'BNM')
  assert.equal(rate.mdlPerEur, 20.0545)
  assert.equal(validRate(rate), true)
  assert.equal(parseBNM(xml.replace('<Nominal>1</Nominal>', '<Nominal>10</Nominal>'), date).mdlPerEur, 2.00545)
})
test('reject wrong dates, malformed rates, HTML errors and entity declarations', () => {
  for (const bad of [xml.replace('Date="11.09.2026"', 'Date="10.09.2026"'), xml.replace('<CharCode>EUR</CharCode>', '<CharCode>USD</CharCode>'), xml.replace('<Value>20.0545</Value>', '<Value>0</Value>'), xml.replace('<Nominal>1</Nominal>', '<Nominal>0</Nominal>'), '<html>Error</html>', '<!DOCTYPE bad>' + xml]) assert.throws(() => parseBNM(bad, date))
})
test('Moldova day changes at local midnight, including winter time', () => {
  assert.equal(moldovaDate(new Date('2026-09-10T20:59:59Z')), '2026-09-10')
  assert.equal(moldovaDate(new Date('2026-09-10T21:00:00Z')), '2026-09-11')
  assert.equal(moldovaDate(new Date('2026-01-01T22:00:00Z')), '2026-01-02')
})
test('conversion keeps original cents and date-specific rate without drift', () => {
  const converted = convertOriginal(100000, 'MDL', rate, date)
  assert.equal(converted.cents, 4986)
  assert.equal(converted.originalCents, 100000)
  assert.equal(validOriginal({ ...converted, date }), true)
  assert.equal(toMDL(10000, rate), 200545)
  const saved = JSON.stringify(converted)
  const tomorrow = { ...rate, mdlPerEur: 21, date: '2026-09-12' }
  assert.notEqual(toMDL(converted.cents, tomorrow), converted.originalCents)
  assert.equal(JSON.stringify(converted), saved)
})
test('EUR works without a rate; MDL requires an exact-date rate and positive EUR cents', () => {
  assert.deepEqual(convertOriginal(12345, 'EUR', null, date), { cents: 12345, originalCurrency: 'EUR', originalCents: 12345 })
  assert.throws(() => convertOriginal(10000, 'MDL', null, date))
  assert.throws(() => convertOriginal(10000, 'MDL', rate, '2026-09-10'))
  assert.throws(() => convertOriginal(1, 'MDL', rate, date))
  assert.equal(validOriginal({ cents: 10, date }), true)
  assert.equal(validOriginal({ cents: 10, date, originalCurrency: 'MDL', originalCents: 1000 }), false)
})
test('display rounds MDL to whole units while stored cents retain precision', () => {
  assert.match(formatMDL(12349), /123/)
  assert.match(formatMDL(12350), /124/)
  assert.doesNotMatch(formatMDL(12300), /,00/)
})
test('server deduplicates in-flight requests and caches validated responses', async () => {
  const originalFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => { calls++; return { ok: true, text: async () => xml } }
  try {
    const [first, second] = await Promise.all([getBNMRate(date), getBNMRate(date)])
    assert.equal(first.mdlPerEur, 20.0545)
    assert.deepEqual(second, first)
    await getBNMRate(date)
    assert.equal(calls, 1)
  } finally { globalThis.fetch = originalFetch }
})
test('endpoint rejects invalid and future dates without contacting BNM', async () => {
  for (const url of ['/api/exchange-rate?date=2026-02-30', '/api/exchange-rate?date=2999-01-01', '/api/exchange-rate?date=https://attacker.invalid']) {
    let body = ''
    const res = { statusCode: 200, setHeader() {}, end(data) { body = data } }
    await exchangeEndpoint({ method: 'GET', url }, res)
    assert.equal(res.statusCode, 400)
    assert.ok(JSON.parse(body).error)
  }
})
test('upstream failures yield explicit unavailability and never invented rates', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => { throw new Error('Offline') }
  try {
    let body = ''
    const res = { statusCode: 200, setHeader() {}, end(data) { body = data } }
    await exchangeEndpoint({ method: 'GET', url: '/api/exchange-rate?date=2026-09-09' }, res)
    assert.equal(res.statusCode, 503)
    assert.equal(JSON.parse(body).mdlPerEur, undefined)
    assert.ok(JSON.parse(body).error)
  } finally { globalThis.fetch = originalFetch }
})
