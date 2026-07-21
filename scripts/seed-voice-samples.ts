import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

type SeedTarget = {
  accent: string
  voiceId: string
  name: string
  speeds: Array<number>
}

type SeedTargets = {
  targets: Array<SeedTarget>
}

type SeedOneResult = {
  status: 'created' | 'updated' | 'skipped' | 'error'
  message?: string
}

function formatAccentLabel(accent: string): string {
  return accent.replace(/\b\w/g, (char) => char.toUpperCase())
}

function convexRun<T>(functionName: string, args?: Record<string, unknown>): T {
  const commandArgs = ['convex', 'run', functionName]
  if (args) {
    commandArgs.push(JSON.stringify(args))
  }

  const output = execFileSync('bunx', commandArgs, {
    cwd: root,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'inherit'],
  })
  return JSON.parse(output.trim()) as T
}

console.log('Seeding voice preview samples via Convex…\n')

const { targets } = convexRun<SeedTargets>(
  'voicePreviewSamples:fetchSeedTargets',
)

let created = 0
let updated = 0
let skipped = 0
let failed = 0
let jobIndex = 0
const jobTotal = targets.reduce((sum, target) => sum + target.speeds.length, 0)

for (const target of targets) {
  const accentLabel = formatAccentLabel(target.accent)
  for (let speedIndex = 0; speedIndex < target.speeds.length; speedIndex++) {
    const speed = target.speeds[speedIndex]
    jobIndex++
    const label = `${accentLabel} · ${target.name} · speed ${speedIndex + 1}/${target.speeds.length} (${speed}x) [${jobIndex}/${jobTotal}]…`
    process.stdout.write(`${label} `)

    const result = convexRun<SeedOneResult>('voicePreviewSamples:seedOne', {
      voiceId: target.voiceId,
      speed,
    })

    if (result.status === 'created') {
      created++
      console.log('ok')
    } else if (result.status === 'updated') {
      updated++
      console.log('updated')
    } else if (result.status === 'skipped') {
      skipped++
      console.log('skipped')
    } else {
      failed++
      console.log(`failed: ${result.message ?? 'Unknown error'}`)
    }
  }
}

console.log(
  `\nDone. Created: ${created}, updated: ${updated}, skipped: ${skipped}, failed: ${failed}`,
)

if (failed > 0) {
  process.exit(1)
}
