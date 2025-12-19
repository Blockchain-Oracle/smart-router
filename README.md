# Smart Router

Plugin discovery and context-aware routing system for Claude Code.

## Overview

Smart Router solves the problem of having many installed plugins without knowing which one to use. It automatically discovers all your installed plugins (21+ in most setups) and intelligently routes you to the best tool based on your task context and preferences.

## Problem It Solves

When you have multiple plugins installed:
- **3+ code review agents** - Which one should you use?
- **Multiple brainstorming skills** - Which fits your task?
- **Various testing tools** - What's best for this situation?

Without Smart Router, Claude Code may not consistently use your installed tools, or you have to manually remember and select them each time.

## How It Works

1. **SessionStart Hook** - Scans your plugins on session start, builds a registry
2. **UserPromptSubmit Hook** - Detects when you need a tool, suggests matches
3. **Smart Router Skill** - Ranks options by context and routes intelligently

## Features

- ✅ **Auto-discovery** - Scans `~/.claude/plugins/` and `.claude/commands/`
- ✅ **Smart caching** - Hash-based invalidation, rebuilds only when plugins change
- ✅ **Context-aware** - Routes based on file types, project structure
- ✅ **User preferences** - Auto-route, show menu, or context-based (configurable)
- ✅ **Lightweight** - Fast registry lookup, minimal overhead

## Installation

### From Marketplace (Recommended)

**Step 1: Add the marketplace**
```bash
/plugin marketplace add Blockchain-Oracle/smart-router
```

**Step 2: Install the plugin**
```bash
/plugin install smart-router@smart-router-marketplace
```

That's it! Smart Router is now active and will automatically discover your plugins on the next session.

### Alternative: Direct Git Clone
```bash
# Clone directly to your global plugins directory
git clone https://github.com/Blockchain-Oracle/smart-router ~/.claude/plugins/smart-router
```

### Local Development
```bash
# Test locally before installing
cd /path/to/smart-router
claude --plugin-dir .
```

## Configuration

### Quick Setup (Recommended)

Use the interactive configuration command:

```bash
/smart-router:configure
```

This will guide you through setting up your preferences with questions and validation.

### Manual Setup

Alternatively, create `.claude/smart-router.local.md` manually:

```yaml
---
routingMode: auto          # auto | ask | context
showReasoning: true        # Show why tool was chosen
excludePlugins:            # Plugins to ignore
  - plugin-name
priorityOrder:             # Override default ranking
  - superpowers
  - pr-review-toolkit
---
```

### Routing Modes

- **`auto`** - Automatically picks best tool, no questions asked (fastest)
- **`ask`** - Shows menu of options, lets you choose (most control)
- **`context`** - Uses file context to decide automatically (balanced)

### Early Reminder Hook (New!)

Smart Router now includes an optional UserPromptSubmit hook that reminds Claude to check Smart Router BEFORE making tool decisions.

**What it does:**
- Fires when you submit task-related prompts (testing, brainstorming, debugging, etc.)
- Reminds Claude to check Smart Router first
- Shows registry stats (how many tools available)
- Trains Claude to always consider all available tools

**Smart filtering:**
- Only fires on task keywords: test, brainstorm, review, debug, build, design, game, etc.
- Silent on simple prompts like "what's 2+2" (no spam!)
- Training mode - builds good habits over time

**Example:**

```
You: "I want to test my code"
    ↓
Hook: "🎯 Before I start, let me check Smart Router first..."
    ↓
Claude: [checks Smart Router, sees all testing tools, picks best one]
```

**Setup:**

The `/smart-router:configure` command now asks if you want to enable the hook. It will:
1. Read your existing `.claude/settings.json` (if it exists)
2. **MERGE** the hook configuration (never overwrites existing hooks)
3. Set up the early reminder hook

**Manual setup:**

If you prefer manual control, add to `.claude/settings.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ${CLAUDE_PLUGIN_ROOT}/hooks/smart-router-enforcer.py",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

**Note:** The merge logic ensures your existing hooks (from other plugins or custom setup) are preserved.

## Usage

### Automatic Routing

Just work normally! Smart Router runs in the background:

```
You: "I need a code review"
→ Smart Router detects need
→ Auto-routes to best code review tool
→ Review happens seamlessly
```

### Configuration Setup

Set up your routing preferences interactively:

```bash
/smart-router:configure
```

Guides you through:
- Routing mode selection (auto/ask/context)
- Display preferences (show reasoning)
- Priority order (preferred plugins)
- Exclusions (plugins to ignore)

### Manual Registry Rebuild

Force rebuild the plugin registry:

```bash
/smart-router:rebuild
```

Useful after:
- Installing new plugins
- Updating existing plugins
- Debugging routing issues

## How Registry Works

### Build Process (SessionStart)

1. Scans `~/.claude/plugins/cache/` for installed plugins
2. Scans `.claude/commands/` for local commands (e.g., BMAD)
3. Extracts capabilities from plugin manifests and descriptions
4. Computes hash of plugin directories
5. Builds `.claude/.cache/agent-registry.json` (if changed)

### Registry Format

```json
{
  "version": "1.0",
  "lastBuilt": "2025-12-19T12:00:00Z",
  "hash": "abc123...",
  "capabilities": {
    "code-review": [
      {
        "plugin": "superpowers",
        "type": "skill",
        "entry": "skills/code-reviewer/SKILL.md",
        "description": "General code review with TDD focus"
      }
    ]
  }
}
```

### Ranking Logic

Tools are ranked by (in order of priority):
1. **User Priority Order** (Highest) - From `.claude/smart-router.local.md` priorityOrder setting
2. **Tool Specialty** (High) - How well tool description matches the task keywords
3. **File Context** (Medium) - Game files prefer game-dev agents, etc.
4. **Tool Type** (Low) - Skills > Agents > Commands > Workflows
5. **Alphabetical** - Tie-breaker for equal scores

## Examples

### Example 1: Code Review

```
You: "Review this PR"

Smart Router:
- Detects: code-review capability needed
- Finds: 3 matching tools
- Context: Backend API files
- Routes to: pr-review-toolkit (specialized for PRs)
```

### Example 2: Brainstorming

```
You: "Help me design this feature"

Smart Router:
- Detects: brainstorming capability needed
- Finds: 2 matching tools
- User preference: auto mode
- Routes to: superpowers:brainstorming (highest priority)
```

### Example 3: Multiple Specializations

```
You: "Build a game with backend API"

Smart Router:
- Detects: Multiple specializations needed
- Suggests: Use git3 workflow for parallel agents
- Routes to: dispatching-parallel-agents skill
- Result: game-dev + backend-dev agents work concurrently
```

## Architecture

```
┌─────────────────────────────────────────┐
│         SessionStart Hook               │
│   (Build/Update Registry on Start)      │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│      .claude/.cache/                    │
│        agent-registry.json              │
│   (Cached Plugin Capabilities)          │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│      UserPromptSubmit Hook              │
│   (Detect Routing Needs)                │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│       Smart Router Skill                │
│   (Rank, Select, Route)                 │
└─────────────────────────────────────────┘
```

## Development

### Prerequisites

- Node.js 18+ (for TypeScript hooks)
- pnpm (for installing dependencies)
- Claude Code

### Setup

The hooks are already compiled and ready to use! If you need to modify them:

```bash
cd smart-router/hooks

# Install dependencies (already done if node_modules/ exists)
pnpm install

# Recompile TypeScript after changes
npx tsc
```

### Testing Hooks

Hooks run automatically when Claude Code triggers their events. To manually test:

**Test Registry Builder (runs on SessionStart):**
```bash
cd smart-router/hooks
echo '{"session_id":"test","cwd":"/tmp"}' | node registry-builder.js
```

**Test Routing Detector (runs on UserPromptSubmit):**
```bash
cd smart-router/hooks
echo '{"prompt":"I need code review","cwd":"/tmp"}' | node routing-detector.js
```

**See hooks in action:**
```bash
# Install the plugin and start a session - hooks run automatically!
/plugin marketplace add Blockchain-Oracle/smart-router
/plugin install smart-router@smart-router-marketplace

# Registry builds on session start (SessionStart hook)
# Routing suggestions appear when you ask for help (UserPromptSubmit hook)
```

## Troubleshooting

**Registry not building:**
- Check `.claude/.cache/` directory exists
- Run `/smart-router:rebuild` manually
- Check hook logs with `claude --debug`

**Tools not being suggested:**
- Verify plugins are installed and enabled
- Check `.claude/smart-router.local.md` excludePlugins
- Ensure descriptions match common capability keywords

**Wrong tool being selected:**
- Adjust `priorityOrder` in settings
- Switch `routingMode` to `ask` to see all options
- Check file context is being detected correctly

## Contributing

This plugin is designed to work with the broader Claude Code plugin ecosystem. To add support for new capability types or improve ranking logic, see `skills/smart-router/references/` for architecture details.

## License

MIT

## Author

**Blockchain Oracle**
Email: BlockchainOracle.dev@gmail.com
