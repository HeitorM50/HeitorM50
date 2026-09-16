import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char])
const count = value => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid public statistic')
  return value
}
const card = (title, description, body) => '<svg xmlns="http://www.w3.org/2000/svg" width="460" height="200" viewBox="0 0 460 200" role="img" aria-labelledby="title description">' +
  '<title id="title">' + escape(title) + '</title><desc id="description">' + escape(description) + '</desc>' +
  '<rect width="460" height="200" rx="12" fill="#0A0F2C"/>' +
  '<g font-family="ui-monospace,monospace" fill="#8ECAE6"><text x="24" y="32" fill="#48CAE4" font-size="18" font-weight="600">' + escape(title) + '</text>' + body + '</g></svg>\n'

export function renderStats(user, repositories) {
  const original = repositories.filter(repo => !repo.private && !repo.fork)
  const stars = original.reduce((sum, repo) => sum + count(repo.stargazers_count), 0)
  const forks = original.reduce((sum, repo) => sum + count(repo.forks_count), 0)
  const metrics = [['Original public repos', original.length], ['Stars received', stars], ['Followers', count(user.followers)], ['Repository forks', forks]]
  const body = metrics.map(([label, value], i) => '<text x="24" y="' + (65 + i * 29) + '" font-size="14">' + label + '</text><text x="432" y="' + (65 + i * 29) + '" text-anchor="end" fill="#CAF0F8" font-size="16">' + value + '</text>').join('')
  return card('Public GitHub stats', 'Public original repositories only. Updated daily.', body + '<text x="24" y="187" font-size="10">Public data · forks excluded from totals</text>')
}

export function renderLanguages(languages) {
  const entries = Object.entries(languages).filter(([, bytes]) => count(bytes) > 0).sort((a, b) => b[1] - a[1])
  const total = entries.reduce((sum, [, bytes]) => sum + bytes, 0)
  const colors = ['#48CAE4', '#C9B0FF', '#F2C879', '#64D9A3', '#F598B8', '#7EA9FF']
  const rows = entries.slice(0, 6).map(([language, bytes], i) => {
    const y = 56 + i * 22
    const percent = bytes / total * 100
    return '<circle cx="28" cy="' + (y - 4) + '" r="4" fill="' + colors[i] + '"/><text x="40" y="' + y + '" font-size="12">' + escape(language) + '</text><text x="432" y="' + y + '" text-anchor="end" font-size="12">' + percent.toFixed(1) + '%</text>'
  }).join('')
  return card('Languages in public repos', 'Language share by source-code bytes in original public repositories; not a measure of proficiency.', (rows || '<text x="24" y="80" font-size="14">No language data available</text>') + '<text x="24" y="187" font-size="10">Share of code bytes · forks excluded</text>')
}

async function api(path) {
  const url = 'https://api.github.com' + path
  const headers = { Accept: 'application/vnd.github+json' }
  if (process.env.GH_TOKEN) headers.Authorization = 'Bearer ' + process.env.GH_TOKEN
  let response = await fetch(url, { headers, signal: AbortSignal.timeout(30000) })
  // Only public endpoints are requested. A repository-scoped token may not
  // access another repository, while these same public endpoints need no auth.
  if (response.status === 403 && headers.Authorization) {
    response = await fetch(url, { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(30000) })
  }
  if (!response.ok) throw new Error('Public GitHub API returned HTTP ' + response.status + ' for ' + path)
  return response.json()
}

async function main() {
  const login = process.env.PROFILE_USER || 'HeitorM50'
  if (!/^[a-z\d-]+$/i.test(login)) throw new Error('Invalid GitHub username')
  const user = await api('/users/' + login)
  const repositories = []
  for (let page = 1; ; page++) {
    const batch = await api('/users/' + login + '/repos?type=owner&per_page=100&page=' + page)
    if (!Array.isArray(batch)) throw new Error('Invalid repository response')
    repositories.push(...batch.filter(repo => !repo.private && !repo.fork))
    if (batch.length < 100) break
  }
  const languages = {}
  for (const repo of repositories) {
    const data = await api('/repos/' + login + '/' + encodeURIComponent(repo.name) + '/languages')
    for (const [name, bytes] of Object.entries(data)) languages[name] = (languages[name] || 0) + count(bytes)
  }
  const stats = renderStats(user, repositories)
  const top = renderLanguages(languages)
  await mkdir('dist', { recursive: true })
  await writeFile('dist/stats.svg', stats)
  await writeFile('dist/top-langs.svg', top)
  console.log('Generated stats.svg and top-langs.svg from public repositories')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1 })
}
