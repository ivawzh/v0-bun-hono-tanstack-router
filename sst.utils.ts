/**
 * Cannot use Bun's API like `$` in `sst.utils.ts` because it's not
 * available in `sst.config.js` which runs Node.js only.
 */
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { availableStages, type Stage } from "./sst.vars"
import type { Resource } from 'sst'

/**
 * Map ENV_BASE64 env var to another env var.
 */
const secretEnvToEnvMappings = {
  // The TF_VAR_ format is used by Terraform/Pulumi/SST for OCI provider auth.
  // The OCI_CLI_ format is used by OCI CLI for manual debugging.
  'TF_VAR_user_ocid': 'OCI_CLI_USER',
  'TF_VAR_fingerprint': 'OCI_CLI_FINGERPRINT',
  'TF_VAR_tenancy_ocid': 'OCI_CLI_TENANCY',
  'TF_VAR_region': 'OCI_CLI_REGION',
  'TF_VAR_private_key': 'OCI_CLI_KEY_CONTENT',
}

/**
 * Execute a command asynchronously. Cannot use Bun's `$`.
 */
const execAsync = promisify(exec)

export function parseStage(stage: string): Stage {
  if (!stage) {
    return 'development'
  }

  return stage as Stage
}

export type SstSecrets = Omit<{
  [K in keyof Resource]: string
}, 'App'>

/**
 * Find all env vars with values wrapped in ENV_BASE64::...::ENV_BASE64 and decode them.
 * Return only the decoded env vars. Also add mapped env vars to the returned object.
 *
 * @example
 * ```bash
 * FOO=ENV_BASE64::${bun --print "{TF_VAR_oci_creds: 1, TF_VAR_oci_tenancy_ocid: 2}" | base64}::ENV_BASE64
 *
 * # will be decoded to
 * ENV_VARS:
 * { TF_VAR_oci_creds: 1, TF_VAR_oci_tenancy_ocid: 2 }
 * ```
 */
export function decodeBase64Env(secrets: Record<string, string>): Record<string, string> {
  const base64EnvRegex = /ENV_BASE64::(.*?)::ENV_BASE64/gm

  return Object.keys(secrets).reduce((env, key) => {
    const value = secrets[key]
    const matches = Array.from(value?.matchAll(base64EnvRegex) ?? [])
    const isBase64Env = matches.length > 0
    if (isBase64Env) {
      const decodedEnvObjects = matches.map(match => {
        const decodedEnvObj = JSON.parse(Buffer.from(match[1] ?? '', 'base64').toString())
        return Object.entries(decodedEnvObj).reduce((acc, [key, value]) => {
          acc[key] = value as string
          if (secretEnvToEnvMappings[key as keyof typeof secretEnvToEnvMappings]) {
            acc[secretEnvToEnvMappings[key as keyof typeof secretEnvToEnvMappings]] = value as string
          }
          return acc
        }, {} as Record<string, string>)
      })
      const duplicateEnvKeys = Object.keys(env).filter(key =>
        decodedEnvObjects.some(envObj =>
          envObj !== env && Object.hasOwn(envObj, key)
        )
      )

      if (duplicateEnvKeys.length > 0) {
        console.error(
          `⚠️ Error: Found duplicate environment variables when decoding base64 env from secrets:
🔑 Duplicate ENV var key(s): ${duplicateEnvKeys.join(', ')} from ${key}.
❌ This means multiple base64-encoded secrets are trying to set the same environment variables.`
        )
        process.exit(1)
      }
      Object.assign(env, ...decodedEnvObjects)
    }
    return env
  }, {})
}

export function gbToBytes(gb: number): string {
  return `${gb * 1073741824}`
}

export function cpuToRelativeWeightUnits(cpu: number): string {
  return `${cpu * 1000000000}`
}

export function bytesToGbDisplay(bytes: string): string {
  const gb = Number(bytes) / 1073741824
  return `${gb.toFixed(1)}GB`
}

export function cpuUnitsToCpuDisplay(cpuUnits: string): string {
  const cpu = Number(cpuUnits) / 1000000000
  return `${cpu.toFixed(2)} CPU cores`
}
