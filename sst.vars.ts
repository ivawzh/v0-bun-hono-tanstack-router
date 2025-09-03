import { match } from 'ts-pattern'
import { getEnv as getWebEnv } from './apps/web/env'
import { getEnv as getServerEnv } from './apps/server/env'

export const availableStages = ['alpha', 'production', 'development'] as const
export type Stage = (typeof availableStages)[number]
export type SstVars = ReturnType<typeof getSstVars>

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

  return {
    webVars: {
      ...getWebEnv(stage),
    },
    serverVars: {
      ...getServerEnv(stage),
    },
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
