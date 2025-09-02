import { match } from 'ts-pattern'

const alphaWebDomain = 'alpha.solounicorn.lol'
const prodWebDomain = 'solounicorn.lol'
const alphaServerDomain = 'server.alpha.solounicorn.lol'
const prodServerDomain = 'server.solounicorn.lol'

export const availableStages = ['alpha', 'production', 'development'] as const
export type Stage = (typeof availableStages)[number]
export type SstVars = ReturnType<typeof getSstVars>

export function parseStage(stage?: string): Stage {
  if (!stage) {
    return 'development'
  }

  if (!availableStages.includes(stage as Stage)) {
    throw new Error(`Invalid stage: ${stage}`)
  }

  return stage as Stage
}

export function getAwsProfile(stage: Stage): `monster-make-${Stage}` | undefined {
  return match(stage)
    .with('production', () => 'monster-make-production' as const)
    .with('alpha', () => 'monster-make-alpha' as const)
    .with('development', () => {
      throw new Error('Never deploy from development')
    })
    .otherwise(() => undefined)
}

export function getSstVars(stageInput?: string) {
  const stage = parseStage(stageInput)

  if (!availableStages.includes(stage)) {
    throw new Error(`Invalid stage: ${stage}`)
  }

  return match(stage)
    .with('production', () => ({
      webDomain: prodWebDomain,
      serverDomain: prodServerDomain,
    }))
    .with('alpha', () => ({
      webDomain: alphaWebDomain,
      serverDomain: alphaServerDomain,
    }))
    .with('development', () => ({
      webDomain: `localhost:${process.env.ENV_WEB_PORT}`,
      serverDomain: `localhost:${process.env.ENV_SERVER_PORT}`,
    }))
    .exhaustive()
}
