import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

export function renderActivity(days) {
  if (!Array.isArray(days) || !days.length || days.some(day =>
    !/^\d{4}-\d{2}-\d{2}$/.test(day.date) ||
    !Number.isSafeInteger(day.contributionCount) || day.contributionCount < 0
  )) throw new Error('Invalid contribution data')

  const maximum = Math.max(1, ...days.map(day => day.contributionCount))
  const total = days.reduce((sum, day) => sum + day.contributionCount, 0)
  const x = index => 60 + index * 910 / Math.max(1, days.length - 1)
  const y = count => 235 - count * 145 / maximum
  const points = days.map((day, i) => x(i).toFixed(2) + ',' + y(day.contributionCount).toFixed(2)).join(' ')
  const ticks = [0, maximum].map(count =>
    '<line x1="60" y1="' + y(count) + '" x2="970" y2="' + y(count) + '" stroke="#16417C"/>' +
    '<text x="48" y="' + (y(count) + 4) + '" text-anchor="end">' + count + '</text>'
  ).join('')
  const markers = days.map((day, i) =>
    '<circle cx="' + x(i) + '" cy="' + y(day.contributionCount) + '" r="3" fill="#CAF0F8"><title>' +
    day.date + ': ' + day.contributionCount + ' contributions</title></circle>'
  ).join('')
  const labels = [...new Set([0, Math.floor((days.length - 1) / 2), days.length - 1])].map(i =>
    '<text x="' + x(i) + '" y="265" text-anchor="middle">' + days[i].date.slice(5) + '</text>'
  ).join('')
  return '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="290" viewBox="0 0 1000 290" role="img" aria-labelledby="title description">' +
    '<title id="title">GitHub activity — last 31 days</title>' +
    '<desc id="description">' + total + ' public contributions from ' + days[0].date + ' to ' + days.at(-1).date + '. Updated daily.</desc>' +
    '<rect width="1000" height="290" rx="12" fill="#0A0F2C"/>' +
    '<g font-family="ui-monospace,monospace" fill="#8ECAE6" font-size="13">' +
    '<text x="32" y="35" fill="#48CAE4" font-size="20" font-weight="600">GitHub activity · last 31 days</text>' +
    '<text x="32" y="60">' + total + ' public contributions · ' + days[0].date + ' — ' + days.at(-1).date + '</text>' +
    ticks + '<polygon points="60,235 ' + points + ' ' + x(days.length - 1) + ',235" fill="#16417C" opacity=".5"/>' +
    '<polyline points="' + points + '" fill="none" stroke="#00B4D8" stroke-width="3" stroke-linejoin="round"/>' +
    markers + labels + '</g></svg>\n'
}

async function main() {
  const login = process.env.PROFILE_USER || 'HeitorM50'
  const token = process.env.GH_TOKEN
  if (!token) throw new Error('GH_TOKEN is required; use the workflow token for public data only')
  const to = new Date()
  const from = new Date(to)
  from.setUTCHours(0, 0, 0, 0)
  from.setUTCDate(from.getUTCDate() - 30)
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'query($login:String!,$from:DateTime!,$to:DateTime!){user(login:$login){contributionsCollection(from:$from,to:$to){contributionCalendar{weeks{contributionDays{date contributionCount}}}}}}',
      variables: { login, from: from.toISOString(), to: to.toISOString() }
    }),
    signal: AbortSignal.timeout(30000)
  })
  if (!response.ok) throw new Error('GitHub API returned HTTP ' + response.status)
  const result = await response.json()
  if (result.errors || !result.data?.user) throw new Error('GitHub did not return contribution data')
  const days = result.data.user.contributionsCollection.contributionCalendar.weeks
    .flatMap(week => week.contributionDays)
    .filter(day => day.date >= from.toISOString().slice(0, 10) && day.date <= to.toISOString().slice(0, 10))
    .sort((a, b) => a.date.localeCompare(b.date))
  if (days.length !== 31) throw new Error('GitHub returned an incomplete 31-day calendar')
  const svg = renderActivity(days)
  await mkdir('dist', { recursive: true })
  await writeFile('dist/activity.svg', svg)
  console.log('Generated activity.svg from the public contribution calendar')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1 })
}
