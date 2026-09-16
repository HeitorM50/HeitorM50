import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderActivity } from './generate-activity.mjs'

test('renders actual totals, dates and accessible SVG labels', () => {
  const svg = renderActivity([
    { date: '2026-09-15', contributionCount: 2 },
    { date: '2026-09-16', contributionCount: 5 }
  ])
  assert.match(svg, /7 public contributions/)
  assert.match(svg, /2026-09-15 — 2026-09-16/)
  assert.match(svg, /aria-labelledby="title description"/)
  assert.equal((svg.match(/<circle /g) || []).length, 2)
})

test('zero contributions and a single point never produce invalid geometry', () => {
  const svg = renderActivity([{ date: '2026-09-16', contributionCount: 0 }])
  assert.doesNotMatch(svg, /NaN|Infinity|undefined/)
  assert.match(svg, /0 public contributions/)
})

test('rejects incomplete or unsafe data instead of publishing an error card', () => {
  for (const input of [[], null, [{ date: '<script>', contributionCount: 1 }], [{ date: '2026-09-16', contributionCount: -1 }]]) {
    assert.throws(() => renderActivity(input), /Invalid contribution data/)
  }
})
