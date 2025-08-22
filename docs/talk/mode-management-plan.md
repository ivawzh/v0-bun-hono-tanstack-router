# Mode Management System - Architecture & UX Plan

## Original Request
Plan ability to Mode management, add, view, edit delete. We will provide the default Modes. The ones we have are reserved and cannot be changed. However, users can have their own namespace and create new modes customized for themselves.

## Analysis

### Current System Understanding
From analyzing the codebase, the current mode system has:

**Reserved System Modes:**
- `clarify` - Agent refines raw title/description 
- `plan` - Agent creates solution options and implementation plan
- `execute` - Agent implements the planned solution
- `loop` - Infinite cycle mode for repeatable tasks
- `talk` - Research/analysis mode without code implementation

**Current Architecture:**
- Modes are hardcoded in `apps/server/src/agents/prompts/index.ts` as `TaskMode = 'clarify' | 'plan' | 'execute' | 'loop' | 'talk'`
- Each mode has a dedicated prompt generator function
- Tasks have a `mode` field in the database schema (line 132 in schema/index.ts)
- Mode transitions are handled in the agent workflow system

## Research & Findings

### Similar Systems Analysis

**1. VSCode Extension System:**
- Supports custom commands through `package.json` contribution points
- Users can create extensions with custom commands and code action providers
- Template-based file generation extensions (like CFFT)
- Multi-command extension allows users to define custom commands without full extension development

**2. Project Management Template Systems:**
- Monday.com, Atlassian, and Motion offer customizable workflow templates
- Sequential, state machine, and rules-driven workflow modes
- Template libraries with customization options
- Low-code/no-code workflow builders

**3. Key Patterns Identified:**
- **Namespacing**: System vs. user-defined separation
- **Template inheritance**: Base templates with customization layers
- **Plugin architecture**: Core system + extensible user additions
- **Visual builders**: Drag-and-drop workflow configuration
- **Version control**: Template versioning and rollback capabilities

### User Experience Insights

**Best Practices:**
- Provide rich template library with common patterns
- Enable quick customization without technical complexity
- Support both GUI builders and code-based editing
- Implement smart defaults and progressive disclosure
- Maintain clear separation between system and user modes

## Recommendations

### Architecture Design

#### 1. Mode Namespace System

```typescript
// Enhanced Mode Type System
type SystemMode = 'clarify' | 'plan' | 'execute' | 'loop' | 'talk'
type CustomModeId = `custom:${string}` // e.g., 'custom:debug-analysis'

type TaskMode = SystemMode | CustomModeId

interface CustomMode {
  id: CustomModeId
  name: string
  description: string
  prompt: string
  projectId: string
  isActive: boolean
  createdBy: string
  createdAt: Date
  updatedAt: Date
  
  // Advanced features
  parentMode?: SystemMode // Inherit behavior from system mode
  variables?: Record<string, any> // Template variables
  validation?: ModeValidationRules
}
```

#### 2. Database Schema Extensions

**New Table: `custom_modes`**
- Store user-defined modes per project
- Support template variables and inheritance
- Enable version control and collaboration

**Task Schema Updates:**
- Extend `mode` field to support custom mode references
- Add `modeVersion` for tracking mode changes
- Store mode-specific metadata

#### 3. Prompt System Enhancement

```typescript
// Enhanced Prompt Generator
export function generatePrompt(mode: TaskMode, context: PromptParams): string {
  if (isSystemMode(mode)) {
    return generateSystemPrompt(mode, context)
  } else {
    return generateCustomPrompt(mode, context)
  }
}

function generateCustomPrompt(customModeId: CustomModeId, context: PromptParams): string {
  const customMode = loadCustomMode(customModeId, context.project.id)
  return interpolateTemplate(customMode.prompt, {
    ...context,
    ...customMode.variables
  })
}
```

### UX Design Patterns

#### 1. Mode Management Interface

**Main Modes Page:**
```
┌─────────────────────────────────────────────────────────────┐
│ Project Modes                                    [+ New Mode]│
├─────────────────────────────────────────────────────────────┤
│ System Modes (Read-only)                                    │
│ ┌─────────────────┐ ┌─────────────────┐ ┌────────────────┐  │
│ │ 🔍 Clarify      │ │ 📋 Plan         │ │ ⚡ Execute     │  │
│ │ Agent refines   │ │ Create solution │ │ Implement code │  │
│ │ requirements    │ │ & plan steps    │ │ & push changes │  │
│ └─────────────────┘ └─────────────────┘ └────────────────┘  │
│ ┌─────────────────┐ ┌─────────────────┐                     │
│ │ ♻️  Loop        │ │ 💭 Talk         │                     │
│ │ Repeatable      │ │ Research &      │                     │
│ │ maintenance     │ │ analysis only   │                     │
│ └─────────────────┘ └─────────────────┘                     │
│                                                             │
│ Custom Modes                                                │
│ ┌─────────────────┐ ┌─────────────────┐ ┌────────────────┐  │
│ │ 🐛 Debug Mode   │ │ 📚 Doc Review   │ │ 🔧 Refactor   │  │
│ │ [Edit] [Delete] │ │ [Edit] [Delete] │ │ [Edit] [Delete] │  │
│ │ Active: ✓       │ │ Active: ✓       │ │ Draft          │  │
│ └─────────────────┘ └─────────────────┘ └────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

#### 2. Mode Creation Wizard

**Step 1: Basic Information**
```
┌──────────────── Create Custom Mode ────────────────┐
│ Mode Name: [Bug Analysis & Fix]                    │
│ Description: [Comprehensive bug investigation...]   │
│ Based on: [Execute Mode ▼] (Optional inheritance)  │
│                                                    │
│ [Cancel]                      [Next: Configure]    │
└────────────────────────────────────────────────────┘
```

**Step 2: Prompt Configuration**
```
┌──────────────── Configure Mode Prompt ────────────────────┐
│ Template Variables:                          [+ Add Var]  │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ {{bugType}} - Type of bug (UI, Logic, Performance)    │ │
│ │ {{priority}} - Severity level (Critical, High, Med)   │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                            │
│ Prompt Template:                                           │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ You are debugging a {{bugType}} issue with            │ │
│ │ {{priority}} priority...                               │ │
│ │                                                        │ │
│ │ [Full prompt editor with syntax highlighting]          │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                            │
│ [Back]    [Preview]              [Save & Activate]        │
└────────────────────────────────────────────────────────────┘
```

#### 3. Mode Selection in Task Creation

**Enhanced Task Creation:**
```
┌──────────────── Create New Task ────────────────────┐
│ Title: [Fix login validation bug]                   │
│ Mode: [Custom: Bug Analysis ▼]                     │
│       ┌─────── System Modes ───────┐               │
│       │ Clarify → Plan → Execute    │               │
│       │ Loop (Repeatable)          │               │
│       │ Talk (Research Only)       │               │
│       ├─────── Custom Modes ───────┤               │
│       │ 🐛 Bug Analysis & Fix      │               │
│       │ 📚 Documentation Review    │               │
│       │ 🔧 Refactoring Assistant   │               │
│       └───────────────────────────┘               │
│                                                    │
│ Variables: (Auto-populated from mode)              │
│ Bug Type: [Logic ▼]  Priority: [High ▼]           │
└────────────────────────────────────────────────────┘
```

#### 4. Mode Management Actions

**Quick Actions:**
- **Duplicate System Mode**: Create custom mode based on system template
- **Share Mode**: Export mode configuration for team collaboration
- **Import Mode**: Import shared mode configurations
- **Version History**: Track and rollback mode changes
- **Usage Analytics**: Show which modes are most effective

### Technical Implementation Strategy

#### Phase 1: Foundation (Weeks 1-2)
1. **Database Schema**: Add `custom_modes` table and extend task schema
2. **Core API**: CRUD operations for custom modes
3. **Prompt System**: Extend generator to handle custom modes
4. **Basic UI**: Simple mode management interface

#### Phase 2: Advanced Features (Weeks 3-4)  
1. **Template Variables**: Support dynamic prompt interpolation
2. **Mode Inheritance**: Enable custom modes to extend system modes
3. **Validation System**: Ensure mode configuration integrity
4. **Import/Export**: Enable mode sharing between projects

#### Phase 3: UX Enhancement (Weeks 5-6)
1. **Visual Builder**: Drag-and-drop mode configuration
2. **Usage Analytics**: Track mode effectiveness and usage patterns
3. **Smart Suggestions**: Recommend modes based on task content
4. **Collaboration Features**: Team mode sharing and approval workflows

## Evaluation & Ranking of Approaches

### Option 1: Simple Template System ⭐⭐⭐
**Pros:**
- Quick to implement
- Familiar pattern (like email templates)
- Low complexity for users

**Cons:**
- Limited flexibility
- No advanced features like inheritance
- Harder to scale for complex workflows

### Option 2: Plugin-Style Architecture ⭐⭐⭐⭐⭐
**Pros:**
- Maximum flexibility and extensibility  
- Follows established patterns (VSCode extensions)
- Supports advanced features like template variables
- Clear separation between system and user modes
- Enables sophisticated workflow customization

**Cons:**
- Higher initial development complexity
- Requires more sophisticated UX design
- Potential learning curve for advanced features

### Option 3: Visual Workflow Builder ⭐⭐⭐⭐
**Pros:**
- Intuitive visual interface
- Powerful for complex workflows
- Appeals to non-technical users

**Cons:**
- Very complex to implement
- Potential UI/UX challenges
- May be overkill for current use case
- Higher maintenance overhead

**Recommendation: Option 2 (Plugin-Style Architecture)**

This approach provides the best balance of flexibility, user experience, and technical feasibility. It aligns with the Solo Unicorn principle of "maximum magic" while maintaining the "least powerful principle" by starting simple and evolving.

## Next Steps

### Immediate Actions:
1. **Database Design**: Create migration for `custom_modes` table
2. **API Design**: Define REST/oRPC endpoints for mode CRUD operations
3. **UI Mockups**: Create detailed wireframes for mode management interface
4. **Prompt Template Engine**: Design variable interpolation system

### Development Phases:
1. **Phase 1** (2 weeks): Basic custom mode CRUD + simple UI
2. **Phase 2** (2 weeks): Template variables + inheritance system  
3. **Phase 3** (2 weeks): Advanced UX + collaboration features

### Success Metrics:
- **User Adoption**: % of projects with custom modes
- **Mode Usage**: Average custom modes per project
- **Effectiveness**: Task completion rates by mode type
- **User Satisfaction**: Feedback scores on mode management UX

## Conclusion

The Mode Management system should follow a plugin-style architecture with clear namespacing between system and custom modes. This approach provides maximum flexibility while maintaining simplicity for basic use cases. The implementation should be phased to deliver immediate value while building toward more sophisticated features.

The key to success will be balancing power-user capabilities with intuitive defaults, ensuring that both technical and non-technical users can benefit from custom modes while preserving the reliability and effectiveness of the core system modes.