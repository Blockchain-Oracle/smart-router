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

1. **Smart Router Skill** - On first use, scans your plugins and builds a registry
2. **Smart Caching** - Registry cached using hash-based invalidation (rebuilds only when plugins change)
3. **Context-Aware Routing** - Ranks options by context, specialty, and user preferences

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
- **`context`** - Uses file context to decide automatically (balanced, recommended)

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

### Build Process (On-Demand)

The registry is built automatically when the Smart Router skill is invoked:

1. **Check if registry exists** - If `.claude/.cache/agent-registry.json` doesn't exist → build it
2. **Hash-based cache invalidation** - Compute hash of plugin mtimes, compare to cached hash
3. **Rebuild if needed** - Only rebuilds when plugins changed (added/updated/removed)
4. **Scan sources:**
   - `~/.claude/plugins/cache/` for installed plugins
   - `.claude/commands/` for local commands (e.g., BMAD workflows)
   - `~/.claude.json` for global MCPs
   - Plugin-provided MCPs (from plugin.json mcpServers field)
5. **Extract capabilities** from descriptions using keyword matching
6. **Write registry** to `.claude/.cache/agent-registry.json`

**Performance:** Registry builds in <3 seconds, cached for entire session

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
│      User: "I need code review"         │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│       Smart Router Skill Invoked        │
│   (Step 0: Build/Update Registry)       │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│   Check Registry Cache                  │
│   - Registry exists?                    │
│   - Hash matches? (plugins unchanged)   │
└─────────────────────────────────────────┘
           │                    │
      No changes           Plugins changed
           │                    │
           ▼                    ▼
┌─────────────────┐   ┌─────────────────────┐
│  Use Cached     │   │  Rebuild Registry   │
│  Registry       │   │  - Scan plugins     │
│                 │   │  - Extract caps     │
│                 │   │  - Compute hash     │
│                 │   │  - Write cache      │
└─────────────────┘   └─────────────────────┘
           │                    │
           └──────────┬─────────┘
                      ▼
┌─────────────────────────────────────────┐
│      .claude/.cache/                    │
│        agent-registry.json              │
│   (Cached Plugin Capabilities)          │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│       Smart Router Skill                │
│   (Rank, Select, Route)                 │
│   - Collect matching tools              │
│   - Rank by context & preferences       │
│   - Route to best tool                  │
└─────────────────────────────────────────┘
```

## Development

### Prerequisites

- Claude Code
- pnpm (optional, for local development)

### Testing Smart Router

To test the Smart Router skill:

1. **Install the plugin:**
```bash
/plugin marketplace add Blockchain-Oracle/smart-router
/plugin install smart-router@smart-router-marketplace
```

2. **Configure preferences:**
```bash
/smart-router:configure
```

3. **Test routing with a request:**
```bash
"I need a code review"
```

The Smart Router skill will:
- Build/update the registry on first use
- Scan your plugins and capabilities
- Show you matching tools and route to the best one

4. **Verify registry was built:**
```bash
cat .claude/.cache/agent-registry.json
```

You should see a JSON file with discovered plugins and capabilities.

### Manual Registry Rebuild

To force a registry rebuild for testing:

```bash
/smart-router:rebuild
```

Or simply invoke the smart-router skill - it will detect changes and rebuild automatically.

## Troubleshooting

**Registry not building:**
- Check `.claude/.cache/` directory exists and is writable
- Try invoking smart-router skill to trigger rebuild
- Verify plugin directories are readable (`~/.claude/plugins/cache/`)
- Check permissions on `~/.claude.json` (for MCP discovery)

**Tools not being suggested:**
- Verify plugins are installed and enabled in `~/.claude/settings.json`
- Check `.claude/smart-router.local.md` excludePlugins setting
- Ensure plugin descriptions contain capability keywords (code-review, testing, etc.)
- Run `/smart-router:rebuild` to force registry refresh

**Wrong tool being selected:**
- Adjust `priorityOrder` in `.claude/smart-router.local.md` settings
- Switch `routingMode` to `ask` to see all available options
- Check file context detection (are you in the right directory?)
- Verify tool descriptions match your task

**Registry seems stale:**
- Smart Router uses hash-based cache invalidation
- Registry automatically rebuilds when plugins change
- To force rebuild: invoke smart-router skill or run `/smart-router:rebuild`

## Contributing

This plugin is designed to work with the broader Claude Code plugin ecosystem. To add support for new capability types or improve ranking logic, see `skills/smart-router/references/` for architecture details.

## License

MIT

## Author

**Blockchain Oracle**
Email: BlockchainOracle.dev@gmail.com
