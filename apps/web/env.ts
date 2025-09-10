import { match, P } from 'ts-pattern'

const alphaWebDomain = 'alpha.solounicorn.lol'
const prodWebDomain = 'solounicorn.lol'
const alphaServerDomain = 'server.alpha.solounicorn.lol'
const prodServerDomain = 'server.solounicorn.lol'

const availableStages = ['alpha', 'production', 'development', 'test'] as const
type Stage = (typeof availableStages)[number]
/**
 *
 * Vite auto load env after vite.config.ts defineConfig().
 * Before invoking vite.config.ts defineConfig(), import.meta.env is undefined.
 * If we want to use env.ts in vite.config.ts, consumer need to first fire vite.loadEnv()
 * and pass its output to this function.
 *
 * @example
 * ```ts
 * import { getEnv } from './env'
 * import { loadEnv } from 'vite'
 *
 * const viteEnv = vite.loadEnv(
      process.env.NODE_ENV || 'development',
      process.cwd(),
    )
 * const env = getEnv('development', { viteEnv })
 * ```
 */
export function getEnv(stageInput?: string, opts?: { viteEnv?: Record<string, string> }) {
  const viteEnv = opts?.viteEnv || import.meta.env

  const stage = parseStage(stageInput)

  if (!availableStages.includes(stage)) {
    throw new Error(`Invalid stage: ${stage}`)
  }

  return match(stage)
    .with('production', () => ({
      stage,
      webUrl: 'https://' + prodWebDomain,
      serverUrl: 'https://' + prodServerDomain,
    }))
    .with('alpha', () => ({
      stage,
      webUrl: 'https://' + alphaWebDomain,
      serverUrl: 'https://' + alphaServerDomain,
    }))
    .with(P.union('development', 'test'), () => {
      if (
        [viteEnv.VITE_SERVER_URL, viteEnv.VITE_WEB_URL].some(
          (envVar) => !envVar,
        )
      ) {
        throw new Error('VITE_SERVER_URL, VITE_WEB_URL must be set')
      }
      return {
        stage,
        webUrl: viteEnv.VITE_WEB_URL!,
        serverUrl: viteEnv.VITE_SERVER_URL!,
      }
    })
    .exhaustive()
}

export function parseUrl(url?: string) {
  const emptyResult = {
    host: undefined,
    port: undefined,
    protocol: undefined,
  }
  if (!url) {
    return emptyResult
  }
  const normalizedUrl
    = url.startsWith('http://') || url.startsWith('https://')
      ? url
      : `http://${url}`

  let host: string | undefined
  let port: number | undefined
  let protocol: string | undefined
  try {
    const parsed = new URL(normalizedUrl)
    host = parsed.hostname
    if (parsed.port) {
      port = Number(parsed.port)
    }
    protocol = parsed.protocol
  } catch {
    return emptyResult
  }

  return {
    host,
    port,
    protocol,
  }
}

function parseStage(stage?: string): Stage {
  if (!stage) {
    return 'development'
  }

  if (!availableStages.includes(stage as Stage)) {
    throw new Error(`Invalid stage: ${stage}`)
  }

  return stage as Stage
}
