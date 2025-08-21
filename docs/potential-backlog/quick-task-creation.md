# Quick Card Creation Magic

## Overview

Transform card creation from a multi-step dialog flow into a magical, instant experience through a floating action button with voice input, smart defaults, and contextual intelligence.

**Priority**: Phase 1 (High Impact, Low Effort)
**User Impact**: 5/5 | **Effort**: 2/5 | **Magic**: 5/5 | **Mobile**: 5/5

## Current Friction Points

1. **Multi-Step Dialog**: Current card creation requires opening dialog, filling multiple fields
2. **Context Switching**: Users must navigate to project board to create cards
3. **Mobile Complexity**: Small form fields difficult on mobile devices
4. **Repetitive Data Entry**: Similar card types require re-entering same information
5. **No Quick Capture**: Can't quickly capture card ideas while in flow state

## Proposed Solution

### Magic Floating Action Button (FAB)
- **Global Access**: Available on every page with `+` icon
- **Smart Positioning**: Bottom-right corner, follows mobile design patterns
- **One-Tap Creation**: Single tap opens quick creation mode
- **Voice Priority**: Microphone icon for voice-first creation

### Voice-First Card Creation
```
User Flow:
1. Tap FAB microphone → Voice recording starts
2. Speak: "Add card: Fix user login bug, high priority"
3. AI processes speech → Creates card with smart defaults
4. 2-second confirmation toast → Card appears in board
```

### Smart Defaults Engine
- **Auto-Select Project**: Current project context or last used
- **Auto-Select Repo Agent**: Single agent projects auto-fill
- **Intelligent Priority**: Parse voice/text for priority keywords ("urgent", "low priority")
- **Mode Detection**: Analyze description for mode hints ("plan the...", "implement...", "research...")

### Quick Text Mode
- **Inline Input**: Expandable text field with smart parsing
- **Natural Language**: "Make login page responsive P4" → Creates P4 card with title/description
- **Hashtag Support**: "#frontend #urgent Fix navbar layout" → Tags and priority
- **Template Shortcuts**: "/bug", "/feature", "/doc" expand to common card types

## UX Flow

### Desktop Experience
1. **FAB Hover**: Shows tooltip "Quick card (Ctrl+T)"
2. **Click FAB**: Inline composer appears with focus
3. **Type/Voice**: Natural language input with live preview
4. **Enter/Click**: Card created with smart defaults
5. **Success**: Subtle animation + toast confirmation

### Mobile Experience
1. **FAB Touch**: Haptic feedback + voice recorder opens
2. **Hold to Record**: Visual waveform indicator
3. **Release**: Processing spinner → Card created
4. **Alternative**: Tap for text input with large, thumb-friendly field

### Error Handling
- **Voice Unclear**: "I didn't catch that. Try typing instead?"
- **Missing Project**: Auto-suggest or prompt for project selection
- **No Repo Agents**: Guide to project settings with quick setup

## Technical Implementation

### Components Needed
```typescript
- FloatingActionButton.tsx (global component)
- VoiceRecorder.tsx (microphone input)
- QuickCardComposer.tsx (text input with parsing)
- SmartDefaultsEngine.ts (business logic)
- CardTemplateParser.ts (natural language processing)
```

### Smart Parsing Rules
```typescript
// Priority detection
"urgent|high|important" → Priority 5
"low|minor|small" → Priority 1
"medium|normal" → Priority 3

// Mode detection
"plan|design|spec" → Mode: plan
"implement|code|build" → Mode: execute
"research|investigate" → Mode: clarify

// Template expansion
"/bug" → "Bug: [title]" + bug template
"/feature" → "Feature: [title]" + feature template
```

### Voice Processing
- **Browser Web Speech API**: For real-time transcription
- **Fallback Text**: Auto-switch to text if voice not supported
- **Privacy First**: All processing client-side, no cloud services

## Data Schema Changes

### Card Creation Payload
```typescript
interface QuickCardInput {
  rawTitle: string
  rawDescription?: string
  priority?: Priority // Auto-detected from input
  projectId: string // Context-aware default
  repoAgentId?: string // Auto-selected if single option
  mode?: string // Smart-detected from content
  tags?: string[] // Parsed from hashtags
  templateType?: 'bug' | 'feature' | 'research' | 'doc'
}
```

### New API Endpoint
```typescript
POST /api/cards/quick-create
{
  input: string, // Raw voice/text input
  context: {
    projectId: string,
    currentRoute: string,
    lastUsedDefaults: CardDefaults
  }
}
```

## Success Metrics

### UX Improvements
- **Task Creation Time**: From 30+ seconds to 5 seconds
- **Steps Reduced**: From 7 steps to 1 action
- **Mobile Completion**: 90%+ mobile task creation success
- **Voice Adoption**: 60%+ of mobile tasks use voice input

### User Satisfaction
- **Flow State Preservation**: No context switching for quick capture
- **Accuracy Rate**: 95%+ correctly parsed tasks
- **Error Recovery**: Clear, helpful error states

## Future Enhancements

### Advanced Voice Commands
- "Create 3 tasks: Fix login, Update docs, Test API"
- "Schedule task for tomorrow: Deploy to staging"
- "Create subtasks for current task: Research, Plan, Implement"

### Context Awareness
- **Time-Based**: Morning → planning tasks, afternoon → execution
- **Project Type**: Frontend project → common UI tasks suggested
- **Recent Patterns**: Learn from user's task creation patterns

### Integration Points
- **Keyboard Shortcut**: Ctrl+T (Command+T) for quick access
- **URL Hash**: `/quick-task` for bookmarking/sharing
- **Mobile Gesture**: Long press on empty board space

## Implementation Notes

### Browser Compatibility
- **Web Speech API**: Chrome, Safari, Edge (95%+ coverage)
- **Graceful Degradation**: Text-only mode for unsupported browsers
- **Permissions**: Request microphone access on first use

### Performance Considerations
- **Debounced Parsing**: Wait 500ms after typing stops
- **Lazy Loading**: Voice components only load when needed
- **Offline Support**: Cache common templates for offline use

### Security & Privacy
- **No Cloud Audio**: All voice processing happens locally
- **User Data**: Never store audio files, only text transcriptions
- **Permissions**: Clear explanation of microphone usage

This feature transforms Solo Unicorn's task creation from a deliberate, multi-step process into a magical, instant capture system that preserves flow state and maximizes productivity for solo developers.
