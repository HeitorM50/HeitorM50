import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderStats, renderLanguages } from './generate-stats.mjs'

test('statistics exclude private and forked repositories', () => {
  const svg = renderStats({ followers: 3 }, [
    { fork: false, private: false, stargazers_count: 2, forks_count: 1 },
    { fork: true, private: false, stargazers_count: 999, forks_count: 999 },
    { fork: false, private: true, stargazers_count: 888, forks_count: 888 }
  ])
  assert.match(svg, />2<\/text>/)
  assert.doesNotMatch(svg, /999|888/)
})

test('languages use all byte counts as denominator and escape XML', () => {
  const svg = renderLanguages({ 'C++ & <test>': 3, TypeScript: 1 })
  assert.match(svg, /75.0%/)
  assert.match(svg, /25.0%/)
  assert.match(svg, /C\+\+ &amp; &lt;test&gt;/)
  assert.doesNotMatch(renderLanguages({}), /NaN|Infinity/)
})

test('invalid statistics fail before publication', () => {
  assert.throws(() => renderStats({ followers: -1 }, []), /Invalid/)
  assert.throws(() => renderLanguages({ JavaScript: '100' }), /Invalid/)
})
