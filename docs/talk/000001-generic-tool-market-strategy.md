# Master Plan: Solo Unicorn as Generic Dev Tool & Market Launch

**Executive Summary**: Transform Solo Unicorn from single-user internal tool to multi-tenant SaaS platform with CLI-first architecture, enabling distributed AI task orchestration across teams while maintaining coding execution on client machines.

## Original Task Context

**Title**: master plan to become a generic tool and push to market  
**Description**: Transform Solo Unicorn into a dev tool focused purely on AI task management, with coding execution remaining on client machines. Add CLI/SDK for user authentication, repo registration, MCP integration, and agent spawning. Consider WebSocket solutions for real-time communication.

---

## First-Principles Analysis

### Core Problem Statement
Currently Solo Unicorn is a single-user, single-machine tool. To become a market-ready product, we need to solve:
1. **Multi-tenancy**: Support multiple users/teams without conflicts
2. **Distribution**: Enable remote task orchestration while keeping code execution local
3. **Authentication**: Secure multi-user access control
4. **Real-time Communication**: Reliable task pushing and status updates

### Essential Components Breakdown

**What Solo Unicorn Actually Does**:
- Task lifecycle management (clarify → plan → execute)
- AI agent orchestration and spawning
- Project memory and context preservation
- Real-time status synchronization

**What Stays Client-Side**:
- Code repositories and execution
- AI agent processes (Claude Code, etc.)
- File system operations
- Git operations

**What Moves to Cloud**:
- Task data and state
- Project configurations
- User authentication
- Real-time communication hub

---

## Architecture Options Analysis

### Option 1: CLI + WebSocket Server (Recommended)
**Pros**:
- Minimal backend changes required
- Leverages existing Hono/oRPC architecture
- Real-time bidirectional communication
- Familiar development experience

**Cons**:
- WebSocket infrastructure complexity
- Always-on connection requirements

**Implementation**:
```
Cloud (Backend)          CLI Client           Local Agent
    │                        │                     │
    ├── Task Management      ├── Auth & Login      │
    ├── User/Project Data    ├── Repo Registration │
    ├── WebSocket Hub        ├── MCP Integration   │
    └── Push Notifications   └── Agent Spawning ───┤
                                                   │
                                              [Claude Code]
```

### Option 2: Polling-Based CLI
**Pros**:
- Simpler infrastructure (no WebSocket)
- Lambda-compatible
- Easier local development

**Cons**:
- Higher latency for task updates
- More API calls and potential rate limiting
- Less responsive user experience

### Option 3: Hybrid Event-Driven
**Pros**:
- Best of both worlds
- Graceful degradation
- Cost-optimized

**Cons**:
- More complex implementation
- Multiple communication channels to maintain

---

## WebSocket Technology Comparison

### AWS Lambda + API Gateway WebSocket
**Pros**: Serverless scaling, integrated with existing SST setup  
**Cons**: Connection limits, cold start issues, complexity  
**Cost**: Pay-per-connection + invocation  
**Dev Experience**: Complex local testing  

### Elixir + Phoenix Channels (on EC2)
**Pros**: Built for real-time, excellent concurrency, battle-tested  
**Cons**: New language/ecosystem, separate deployment  
**Cost**: Fixed EC2 costs regardless of usage  
**Dev Experience**: Requires Elixir knowledge  

### Bun WebSocket (on EC2/Railway)
**Pros**: Same language stack, simpler deployment, excellent performance  
**Cons**: Always-on server required, scaling considerations  
**Cost**: Predictable server costs  
**Dev Experience**: Familiar, easy local development  

**Recommendation**: Start with Bun WebSocket on Railway/EC2 for speed to market.

---

## CLI Architecture Design

### Authentication Flow
```bash
# Initial setup
solo-unicorn login
# Opens browser → OAuth flow → stores tokens locally

# Project initialization
cd /path/to/repo
solo-unicorn init
# Registers repo + agent with backend
# Sets up MCP configuration
# Downloads project context
```

### Core CLI Commands
```bash
solo-unicorn login/logout          # Auth management
solo-unicorn init                  # Repo registration
solo-unicorn status                # Show active tasks/agents  
solo-unicorn sync                  # Manual sync with backend
solo-unicorn config                # Local configuration
solo-unicorn agent <command>       # Agent management
```

### MCP Integration Pattern
```typescript
// CLI spawns agents with embedded MCP tools
const agentProcess = spawn('claude', {
  env: {
    ...process.env,
    SOLO_UNICORN_API_TOKEN: userToken,
    SOLO_UNICORN_TASK_ID: taskId,
    SOLO_UNICORN_PROJECT_ID: projectId
  }
})
```

---

## Implementation Roadmap

### Phase 1: Foundation (2-3 weeks)
1. **CLI Skeleton**: Basic auth, config management
2. **Multi-tenant Backend**: User/project isolation
3. **WebSocket Server**: Basic real-time communication
4. **MCP Tools**: Update existing tools for multi-user

### Phase 2: Core Features (3-4 weeks)
1. **Repo Registration**: CLI → Backend integration
2. **Task Distribution**: Push tasks to clients
3. **Agent Spawning**: Remote orchestration
4. **Status Synchronization**: Real-time updates

### Phase 3: Polish & Deploy (2-3 weeks)
1. **Error Handling**: Robust failure recovery
2. **Documentation**: User guides, API docs
3. **Deployment**: Production infrastructure
4. **Beta Testing**: Early user feedback

### Phase 4: Market Ready (2-3 weeks)
1. **Onboarding Flow**: Seamless user experience
2. **Billing Integration**: Usage-based pricing
3. **Support Systems**: Help docs, debugging tools
4. **Launch Marketing**: Product Hunt, social media

---

## Technical Considerations

### Docker Support Strategy
```dockerfile
# Option 1: CLI inside container
FROM node:alpine
RUN npm install -g @solo-unicorn/cli
WORKDIR /workspace
# Mount repo as volume

# Option 2: Agent container orchestration  
# CLI spawns containerized agents
solo-unicorn agent run --docker --image=claude-code
```

### Generic Auth Protocol
Reuse Monster Auth with project-based scoping:
```typescript
interface AuthContext {
  userId: string
  projectId: string
  permissions: string[]
  agentAccess: boolean
}
```

### Development Experience
```bash
# Local development
solo-unicorn dev --local-backend=http://localhost:8500
# Points CLI to local development server

# Production
solo-unicorn dev --backend=https://api.solo-unicorn.io
```

---

## Market Positioning & Pricing

### Target Segments
1. **Solo Developers**: AI task orchestration for personal projects
2. **Small Teams**: Collaborative AI development workflows  
3. **Agencies**: Client project management with AI assistance
4. **Enterprises**: Distributed AI development at scale

### Pricing Strategy
```
Free Tier:    1 project, 50 tasks/month, community support
Pro ($29/mo): 5 projects, unlimited tasks, priority support  
Team ($99/mo): Unlimited projects, team collaboration, SSO
Enterprise:   Custom pricing, on-premise, dedicated support
```

### Go-to-Market Strategy
1. **Developer Communities**: Launch on GitHub, Dev.to, Hacker News
2. **Content Marketing**: AI development workflows, productivity tips
3. **Integration Partners**: Claude Code, other AI coding tools
4. **Word of Mouth**: Beta user referral program

---

## Risk Assessment & Mitigation

### Technical Risks
- **WebSocket Reliability**: Implement fallback to polling
- **Agent Compatibility**: Version management and updates  
- **Network Issues**: Offline mode with sync-on-reconnect

### Business Risks
- **Competition**: Focus on unique AI orchestration value prop
- **User Adoption**: Exceptional onboarding and documentation
- **Scaling Costs**: Usage-based pricing aligned with costs

### Security Considerations
- **Token Management**: Secure local storage, rotation
- **Project Isolation**: Strict multi-tenant boundaries
- **Agent Security**: Sandboxed execution environments

---

## Alternative Strategic Options

### Option A: Open Source + Hosted Service
**Model**: GitLab/GitHub approach - open source CLI + paid hosting  
**Pros**: Community adoption, transparency, self-hosted option  
**Cons**: Monetization complexity, competitive pressure  

### Option B: Enterprise-First
**Model**: Target large organizations with custom deployments  
**Pros**: Higher ACV, predictable revenue  
**Cons**: Longer sales cycles, complex requirements  

### Option C: Integration Platform
**Model**: Focus on integrating existing tools rather than replacing  
**Pros**: Faster adoption, partnerships  
**Cons**: Dependency on external platforms, limited differentiation  

---

## Next Steps & Recommendations

### Immediate Actions (This Week)
1. **Architecture Decision**: Commit to Bun WebSocket approach
2. **CLI Framework**: Choose CLI framework (Commander.js vs Yargs)
3. **Deployment Platform**: Set up Railway/EC2 for WebSocket server
4. **Auth Integration**: Plan Monster Auth multi-tenant migration

### Month 1 Priority
Focus entirely on **Phase 1** - get basic multi-user functionality working with minimal viable CLI. Skip advanced features like Docker integration initially.

### Success Metrics
- **Technical**: CLI can authenticate and sync with backend
- **Business**: 10 beta users actively using the system
- **User Experience**: < 2 minutes from `solo-unicorn init` to first task execution

The key insight is that Solo Unicorn's unique value is **AI task orchestration**, not code execution. By keeping this focus clear and implementing the simplest possible multi-tenant architecture, we can achieve market readiness within 8-10 weeks.