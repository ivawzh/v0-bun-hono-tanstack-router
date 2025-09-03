/// <reference path="./.sst/platform/config.d.ts" />

import { Stage } from './sst.vars'

export default $config({
  async app(input) {
    const { getAwsProfile } = await import('./sst.vars')

    const stage = parseStage(input?.stage)

    const isProduction = stage === 'production'

    return {
      name: 'solo-unicorn',
      removal: isProduction ? 'retain' : 'remove',
      protect: isProduction,
      home: 'aws',
      providers: {
        aws: {
          profile: getAwsProfile(stage),
        },
      },
    }
  },
  async run() {
    const { getSstVars } = await import('./sst.vars')
    const { match } = await import('ts-pattern')

    const stage = parseStage($app.stage)
    const vars = getSstVars(stage)

    const dbUrlSecret = new sst.Secret('SoloUnicornDatabaseUrl')

    new sst.aws.Function('SoloUnicornServer', {
      url: true,
      handler: 'apps/server/src/index.handler',
      link: [dbUrlSecret],
    })

    // Outputs
    return {}
  },
})

function parseStage(stage: string): Stage {
  if (!stage) {
    return 'development'
  }

  return stage as Stage
}
