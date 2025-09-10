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

  let webVars
  let serverVars

  try {
    webVars = getWebEnv(stage)
  } catch (error) {
    console.warn('Error getting web env:', error)
    // Provide fallback values for development
    if (stage === 'development') {
      webVars = {
        stage,
        webUrl: process.env.VITE_WEB_URL || 'http://localhost:8888',
        serverUrl: process.env.VITE_SERVER_URL || 'http://localhost:3500',
      }
    } else {
      throw error
    }
  }

  try {
    serverVars = getServerEnv(stage)
  } catch (error) {
    console.warn('Error getting server env:', error)
    throw error
  }

  return {
    webVars,
    serverVars,
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
