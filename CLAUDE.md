# Solo Unicorn - Claude Code Instructions

This document provides context and instructions for Claude Code when working on the Solo Unicorn project.

## Project Overview

@docs/overview.md

Solo Unicorn is a comprehensive project management system designed for solo developers and small teams. It integrates with Claude Code to enable AI-assisted development workflows.

## UI/UX Design

@docs/uiux-design.md

## Principles

@.ai/rules/shared/rules/principles.mdc

## Key Development Guidelines

@.ai/rules/shared/rules/js-rules.mdc

## Communication Style

@.ai/rules/shared/rules/communication.mdc

## Quick Commands

- Development server: `bun dev` (in apps/server or apps/web). However, I manually keep `bun dev` running in the background. So that please don't run it from your side.
- Database migrations: `bun run db:push` (in apps/server).
- Run type checks: `bun typecheck`

## Integration Points

- **WebSocket Server**: Port 8500 at `/ws/agent`
- **Claude Code UI**: UI Port 8303, Server Port 8501
- **Web Application**: Port 8302
- **API Server**: Port 8500

## Environment Variables

Required environment variables are documented in `.env.example` files in each application directory.

## Feature flows

@docs/feature-flows/_index.md
