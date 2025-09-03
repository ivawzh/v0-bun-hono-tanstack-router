import { match, P } from 'ts-pattern'
import { Resource } from 'sst'

const alphaWebDomain = 'alpha.solounicorn.lol'
const prodWebDomain = 'solounicorn.lol'
const alphaServerDomain = 'server.alpha.solounicorn.lol'
const prodServerDomain = 'server.solounicorn.lol'

const availableStages = ['alpha', 'production', 'development', 'test'] as const
type Stage = (typeof availableStages)[number]

export function getEnv(stageInput?: string) {
  const stage = parseStage(stageInput)

  if (!availableStages.includes(stage)) {
    throw new Error(`Invalid stage: ${stage}`)
  }

  return match(stage)
    .with('production', () => ({
      stage,
      databaseUrl: Resource.SoloUnicornDatabaseUrl.value,
      webUrl: prodWebDomain,
      serverUrl: prodServerDomain,
      monsterAuthUrl: 'https://auth.monstermake.limited',
    }))
    .with('alpha', () => ({
      stage,
      databaseUrl: Resource.SoloUnicornDatabaseUrl.value,
      webUrl: alphaWebDomain,
      serverUrl: alphaServerDomain,
      monsterAuthUrl: 'https://auth.alpha.monstermake.limited',
    }))
    .with(P.union('development', 'test'), () => {
      if (
        [
          process.env.DATABASE_URL,
          process.env.WEB_URL,
          process.env.SERVER_URL,
        ].some((url) => !url)
      ) {
        throw new Error('DATABASE_URL, WEB_URL, and SERVER_URL must be set')
      }
      return {
        stage,
        databaseUrl: process.env.DATABASE_URL!,
        webUrl: process.env.WEB_URL!,
        serverUrl: process.env.SERVER_URL!,
        monsterAuthUrl: 'https://auth.alpha.monstermake.limited',
      }
    })
    .exhaustive()
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
