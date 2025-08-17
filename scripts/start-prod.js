#!/usr/bin/env bun

/**
 * Production startup script for Solo Unicorn
 * 
 * This script:
 * 1. Checks if Cloudflare tunnel is properly configured
 * 2. Auto-configures tunnel if needed
 * 3. Starts tunnel alongside development servers
 */

import { spawn, spawnSync } from 'child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

const TUNNEL_NAME = 'solo-unicorn'
const TUNNEL_UUID = '92323cf0-b490-41e1-ae89-3a39575eecc5'
const CLOUDFLARED_DIR = join(homedir(), '.cloudflared')
const CONFIG_FILE = join(CLOUDFLARED_DIR, 'config.yml')
const CREDENTIALS_FILE = join(CLOUDFLARED_DIR, `${TUNNEL_UUID}.json`)

function log(message, type = 'info') {
  const prefix = {
    info: '🔵',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    tunnel: '🚇'
  }[type] || '📝'
  
  console.log(`${prefix} ${message}`)
}

function checkCloudflaredInstalled() {
  log('Checking if cloudflared is installed...')
  const result = spawnSync('cloudflared', ['--version'], { stdio: 'pipe' })
  if (result.error) {
    log('cloudflared is not installed. Please install it first:', 'error')
    log('  macOS: brew install cloudflared', 'error')
    log('  Linux: See docs/hosting.md for installation instructions', 'error')
    process.exit(1)
  }
  log('cloudflared is installed', 'success')
}

function checkTunnelExists() {
  log('Checking if tunnel exists...')
  const result = spawnSync('cloudflared', ['tunnel', 'info', TUNNEL_NAME], { stdio: 'pipe' })
  if (result.status !== 0) {
    log(`Tunnel "${TUNNEL_NAME}" does not exist`, 'warning')
    return false
  }
  log(`Tunnel "${TUNNEL_NAME}" exists`, 'success')
  return true
}

function checkCredentialsFile() {
  log('Checking credentials file...')
  if (!existsSync(CREDENTIALS_FILE)) {
    log(`Credentials file missing: ${CREDENTIALS_FILE}`, 'warning')
    return false
  }
  log('Credentials file exists', 'success')
  return true
}

function createConfigFile() {
  log('Creating tunnel configuration...')
  
  if (!existsSync(CLOUDFLARED_DIR)) {
    mkdirSync(CLOUDFLARED_DIR, { recursive: true })
  }

  const config = `tunnel: ${TUNNEL_NAME}
credentials-file: ${CREDENTIALS_FILE}

ingress:
  # Web UI
  - hostname: solounicorn.lol
    service: http://localhost:8302
  # API Server  
  - hostname: api.solounicorn.lol
    service: http://localhost:8500
  # Catch-all rule (required)
  - service: http_status:404
`

  writeFileSync(CONFIG_FILE, config)
  log(`Configuration written to ${CONFIG_FILE}`, 'success')
}

function checkConfigFile() {
  log('Checking tunnel configuration...')
  if (!existsSync(CONFIG_FILE)) {
    log('Configuration file missing, creating it...', 'warning')
    createConfigFile()
    return true
  }
  
  const config = readFileSync(CONFIG_FILE, 'utf8')
  if (!config.includes(TUNNEL_UUID) || !config.includes('solounicorn.lol')) {
    log('Configuration file exists but seems incorrect, recreating...', 'warning')
    createConfigFile()
    return true
  }
  
  log('Configuration file is correct', 'success')
  return true
}

function setupTunnel() {
  log('Setting up Cloudflare tunnel...', 'warning')
  log('Please follow these steps:', 'warning')
  log('1. Run: cloudflared tunnel login', 'warning')
  log('2. Authenticate in browser and select solounicorn.lol domain', 'warning')
  log('3. Run: cloudflared tunnel create solo-unicorn', 'warning')
  log('4. Run: cloudflared tunnel route dns solo-unicorn solounicorn.lol', 'warning')
  log('5. Run: cloudflared tunnel route dns solo-unicorn api.solounicorn.lol', 'warning')
  log('6. Run this script again', 'warning')
  log('', 'warning')
  log('Or follow the complete guide in docs/hosting.md', 'warning')
  process.exit(1)
}

function validateTunnelConfig() {
  log('Validating tunnel configuration...')
  const result = spawnSync('cloudflared', ['tunnel', 'ingress', 'validate'], { 
    stdio: 'pipe',
    cwd: homedir()
  })
  
  if (result.status !== 0) {
    log('Tunnel configuration validation failed:', 'error')
    console.log(result.stderr?.toString())
    log('Please check your configuration or run setup again', 'error')
    process.exit(1)
  }
  
  log('Tunnel configuration is valid', 'success')
}

function startTunnel() {
  log('Starting Cloudflare tunnel...', 'tunnel')
  
  const tunnel = spawn('cloudflared', ['tunnel', '--config', CONFIG_FILE, 'run', TUNNEL_NAME], {
    stdio: 'pipe'
  })
  
  tunnel.stdout?.on('data', (data) => {
    const message = data.toString().trim()
    if (message) {
      log(`[tunnel] ${message}`, 'tunnel')
    }
  })
  
  tunnel.stderr?.on('data', (data) => {
    const message = data.toString().trim()
    if (message && !message.includes('level=info')) {
      log(`[tunnel] ${message}`, 'tunnel')
    }
  })
  
  tunnel.on('error', (error) => {
    log(`Tunnel error: ${error.message}`, 'error')
  })
  
  return tunnel
}

function startDevServers() {
  log('Starting development servers...')
  
  const dev = spawn('bun', ['dev'], {
    stdio: 'inherit',
    cwd: process.cwd()
  })
  
  dev.on('error', (error) => {
    log(`Development server error: ${error.message}`, 'error')
  })
  
  return dev
}

function main() {
  log('🚀 Starting Solo Unicorn in production mode...')
  
  // Check requirements
  checkCloudflaredInstalled()
  
  // Check tunnel setup
  if (!checkTunnelExists() || !checkCredentialsFile()) {
    setupTunnel()
    return
  }
  
  // Ensure config is correct
  checkConfigFile()
  validateTunnelConfig()
  
  // Start services
  const tunnel = startTunnel()
  const dev = startDevServers()
  
  // Handle cleanup
  const cleanup = () => {
    log('Shutting down services...')
    tunnel.kill()
    dev.kill()
    process.exit(0)
  }
  
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
  
  // Success message
  setTimeout(() => {
    log('🎉 Solo Unicorn is running in production mode!')
    log('   Web UI: https://solounicorn.lol')
    log('   API: https://api.solounicorn.lol')
    log('   Local Web: http://localhost:8302')
    log('   Local API: http://localhost:8500')
    log('')
    log('Press Ctrl+C to stop all services')
  }, 3000)
}

if (import.meta.main) {
  main()
}