---
name: smart-router
description: Use when multiple tools are available for a task and intelligent routing is needed. Activates when routing-detector hook suggests it, or when user asks "which tool should I use" or "what's the best plugin for this". Provides context-aware tool ranking based on file context, user preferences, and tool specialization.
version: 0.1.0
---

# Smart Router: Context-Aware Tool Selection

## Overview

When multiple plugins can handle the same task, smart routing ensures the best tool is selected based on context and user preferences. This skill loads the agent registry, analyzes the current situation, ranks available tools, and either auto-routes or presents ranked options.

## When This Skill Activates

Use this skill when:
- routing-detector hook suggests "ACTION: Use smart-router skill"
- User has multiple tools for the same capability (3+ code review agents, 2+ brainstorming skills, etc.)
- User asks "which tool should I use?" or "what's best for this?"
- Multiple capabilities detected in a single request

**Do NOT use this skill when:**
- Only one tool is available (just use it)
- User explicitly named a specific tool/plugin
- No routing-detector suggestion appeared

## Process

### Step 0: Build/Update Registry (if needed)

**Registry location:** `.claude/.cache/agent-registry.json`

Before routing, ensure registry is current:

1. **Check if registry exists:**
   - If `.claude/.cache/agent-registry.json` doesn't exist → rebuild required
   - If exists → check hash for cache invalidation

2. **Hash-based cache invalidation:**
   - Read `.claude/.cache/plugin-hash.txt`
   - Compute new hash from plugin directories' modification times
   - If hashes match → registry is current, skip rebuild
   - If hashes differ → plugins changed, rebuild required

3. **If rebuild needed, scan all plugin sources:**

   a. **Global plugins** (`~/.claude/plugins/cache/[marketplace]/[plugin]/[version]/`)
      - Scan `agents/` directory → agent files (*.md)
      - Scan `skills/` directory → skill subdirectories (*/SKILL.md)
      - Scan `commands/` directory → command files (*.md)

   b. **Local commands** (`.claude/commands/`)
      - Recursively scan up to depth 10
      - Skip symlinks (prevent circular references)

   c. **Global MCPs** (`~/.claude.json` mcpServers field)
      - Read MCP configuration
      - Map known MCPs to capabilities (context7, playwright, serena, etc.)

   d. **Plugin-provided MCPs** (from plugin manifests)
      - Read `plugin.json` mcpServers field
      - Read `.mcp.json` files in plugin directories

4. **Extract descriptions and infer capabilities:**
   - Parse YAML frontmatter for `description:` field
   - Fallback to first non-comment line
   - Match against capability keywords:
     - `code-review`, `brainstorming`, `testing`, `debugging`, `refactoring`
     - `documentation`, `database`, `deployment`, `security`, `performance`
     - `git`, `game-development`, `backend-development`, `frontend-development`
     - `conversation-search`

5. **Build registry structure:**
   ```json
   {
     "version": "1.0",
     "lastBuilt": "ISO-8601-timestamp",
     "hash": "sha256-of-plugin-mtimes",
     "capabilities": {
       "code-review": [
         {
           "plugin": "superpowers",
           "type": "skill",
           "entry": "skills/code-reviewer/SKILL.md",
           "description": "...",
           "source": "global"
         }
       ]
     },
     "mcps": [
       {
         "name": "context7",
         "command": "npx -y context7-mcp",
         "capabilities": ["documentation", "research"],
         "description": "Library documentation lookup",
         "source": "global"
       }
     ],
     "enabledPlugins": ["superpowers", "bmad", ...]
   }
   ```

6. **Write registry and hash:**
   - Write `.claude/.cache/agent-registry.json`
   - Write `.claude/.cache/plugin-hash.txt`
   - Show stats: "✅ Registry built - X capabilities, Y tools, Z MCPs"

**Error handling:**
- Aggregate scan errors (don't fail on single plugin)
- Warn about unreadable plugins
- Path traversal protection (verify symlinks stay within plugin dirs)

**Performance:**
- Registry builds in <3 seconds typically
- Cached for entire session (only rebuilds if plugins change)

### Step 1: Load Registry and Settings

After ensuring registry is current, load it along with user preferences:

```bash
# Registry (built/verified in Step 0)
.claude/.cache/agent-registry.json

# User preferences (if exists)
.claude/smart-router.local.md
```

**Registry structure:**
```json
{
  "capabilities": {
    "code-review": [
      {
        "plugin": "superpowers",
        "type": "skill",
        "entry": "skills/code-reviewer/SKILL.md",
        "description": "...",
        "source": "global"
      }
    ]
  }
}
```

**Settings structure:**
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

### Step 2: Identify Relevant Capabilities

Based on user prompt, determine which capabilities are needed. The routing-detector hook already identified these, but validate:

**Common capabilities:**
- `code-review` - Code review, PR review, code quality
- `brainstorming` - Design, ideation, planning, architecture
- `testing` - Test generation, QA, test coverage
- `debugging` - Debug, troubleshoot, fix bugs
- `refactoring` - Code cleanup, reorganization
- `game-development` - Game mechanics, Unity/Unreal/Godot
- `backend-development` - APIs, microservices, backend
- `frontend-development` - UI, React, components
- `conversation-search` - Search past conversations, memory

### Step 3: Collect Matching Tools

From registry, collect all tools matching the identified capabilities.

**Filter out:**
- Plugins in `excludePlugins` setting
- Tools with obviously wrong context (e.g., don't suggest game-dev for API code)

### Step 4: Rank Tools by Context

Rank tools using this priority order:

**1. User Priority Order (Highest Priority)**

If settings define `priorityOrder`, respect it first - user knows their workflow best:

```yaml
priorityOrder:
  - superpowers
  - pr-review-toolkit
  - feature-dev
```

**Example:** If user set superpowers first, always prefer superpowers tools when available.

**2. Tool Specialty (High Priority)**

From `description` field, prefer specialized tools:
- PR-specific reviewer > general code reviewer
- Game-specific debugger > general debugger
- Test generator for APIs > general test tool

**Example:** `pr-review-toolkit` (specialized for PR review) ranks higher than generic code reviewer, even if working on game files.

**Why specialty matters:** Specialized tools exist because they're better at specific tasks. Don't override specialty based on file context alone.

**3. File Context (Medium Priority)**

Analyze files in current directory and recently modified files:

```bash
# Check file types
*.cs, *.unity, *.prefab → Prefer game-development tools
*.tsx, *.jsx, *.css → Prefer frontend tools
*.py, *.go, *.ts (backend) → Prefer backend tools
*.test.ts, *.spec.js → Prefer testing tools
```

**Example:** When choosing between two game-dev tools with equal specialty, prefer the one matching file context.

**4. Tool Type (Low Priority)**

When tied, prefer in this order:
1. Skills (most flexible)
2. Agents (specialized)
3. Commands (manual invocation)
4. Workflows (local, project-specific)

**5. Alphabetical (Tie-Breaker)**

If still tied, sort alphabetically by plugin name.

### Step 5: Route Based on Mode

Read `routingMode` from settings (default: `context`):

#### Mode: `auto`

Automatically select the top-ranked tool and use it directly. No questions, no menu.

**Output:**
```
🎯 Smart Router: Auto-routing to [plugin-name]

Reason: [Brief explanation of why this tool was chosen]

[Proceeding with the task using this tool...]
```

**Then:** Use the Skill tool or invoke the agent/command directly.

#### Mode: `ask`

Present ranked options as a numbered menu, let user choose.

**Output:**
```
🎯 Smart Router: Multiple Tools Available

Based on your task and context, here are your options (ranked):

1. ⭐ superpowers:code-reviewer (RECOMMENDED)
   Type: Skill
   Why: General purpose, matches your file context (TypeScript backend)
   Description: Comprehensive code review with TDD focus

2. pr-review-toolkit:code-reviewer
   Type: Agent
   Why: Specialized for PR review workflows
   Description: Multi-aspect PR analysis (comments, tests, errors)

3. feature-dev:code-reviewer
   Type: Agent
   Why: Feature branch focused
   Description: Reviews feature branches before merge

Which tool would you like to use? (1-3)
```

**Then:** Wait for user response and use selected tool.

#### Mode: `context`

Use file context to make automatic decision, but show brief reasoning:

**Output:**
```
🎯 Smart Router: Context-aware routing

Detected context: TypeScript backend API files
Routing to: pr-review-toolkit:code-reviewer
Reason: Specialized for API code review

[Proceeding...]
```

**Then:** Use the selected tool.

### Step 6: Execute Routing Decision

Once tool is selected, invoke it using the appropriate method:

**For Skills:**
```bash
Skill tool: plugin-name:skill-name
```

**For Agents:**
```bash
Task tool (subagent_type): plugin-name:agent-name
```

**For Commands:**
```bash
/plugin-name:command-name
```

**For Workflows (local):**
```bash
SlashCommand: /path/to/workflow.md
```

## Advanced: Multi-Capability Scenarios

When user request spans multiple capabilities (e.g., "build a game with backend API"):

### Option 1: Suggest Parallel Dispatch

If git3/parallel agent skills are available:

```
🎯 Smart Router: Multi-Capability Detected

Your request requires:
- game-development (bmad:game-dev)
- backend-development (backend-api-dev)

RECOMMENDATION: Use parallel agent dispatch

Would you like to:
1. Use git3 to run both specialized agents concurrently (RECOMMENDED)
2. Pick one primary tool to handle both
3. Handle them sequentially

[Explain git3 workflow if user chooses option 1]
```

### Option 2: Primary Tool

If no parallel dispatch available, pick the primary capability:

```
🎯 Smart Router: Multi-Capability Request

Detected needs: game-development + backend-development

Primary capability: game-development (more specialized)
Routing to: bmad:game-dev

Note: This tool can handle backend API as well, though it's primarily game-focused.
```

## Settings Reference

Create `.claude/smart-router.local.md` in your project:

```yaml
---
# Routing behavior
routingMode: auto          # auto | ask | context
  # auto - Always pick best automatically (fastest)
  # ask - Always show menu (most control)
  # context - Use file context to decide automatically (balanced)

# Display options
showReasoning: true        # Show why tool was chosen

# Exclusions
excludePlugins:            # Never suggest these plugins
  - ralph-wiggum           # Example: exclude test plugin
  - old-plugin

# Priority overrides
priorityOrder:             # Prefer these plugins (in order)
  - superpowers            # Always try superpowers first
  - pr-review-toolkit      # Then pr-review-toolkit
  - bmad                   # Then BMAD tools

# Context overrides (advanced)
contextRules:
  - filePattern: "*.unity"
    preferPlugins: ["bmad"]
  - filePattern: "*.test.ts"
    preferPlugins: ["superpowers"]
---
```

## Troubleshooting

**Registry not found:**
- Registry builds on SessionStart
- Run `/smart-router:rebuild` to force rebuild
- Check `.claude/.cache/agent-registry.json` exists

**Wrong tool selected:**
- Check file context (are you in the right directory?)
- Adjust `priorityOrder` in settings
- Switch to `ask` mode to see all options

**No tools suggested:**
- Verify plugins are installed (`~/.claude/plugins/`)
- Check registry was built (SessionStart hook ran)
- Ensure capability keywords match (see registry-builder.ts)

**Multiple specialists for same task:**
- This is expected! (e.g., multiple code review agents)
- Use `priorityOrder` to set preference
- Use `excludePlugins` to remove unwanted options

## Examples

### Example 1: Auto-Routing Code Review

**User:** "Review this PR"

**Settings:** `routingMode: auto`

**Process:**
1. Load registry → finds 3 code-review tools
2. Analyze context → TypeScript backend files
3. Rank:
   - pr-review-toolkit (specialized for PRs)
   - superpowers (general)
   - feature-dev (feature branches)
4. Auto-route to pr-review-toolkit
5. Output: "🎯 Routing to pr-review-toolkit (specialized for PR review)"

### Example 2: Menu Selection

**User:** "Help me brainstorm this feature"

**Settings:** `routingMode: ask`

**Process:**
1. Load registry → finds 2 brainstorming tools
2. Show menu:
   ```
   1. ⭐ superpowers:brainstorming (RECOMMENDED)
   2. bmad:core-workflows:brainstorming
   ```
3. User selects 1
4. Use superpowers:brainstorming skill

### Example 3: Multi-Capability with Git3

**User:** "Build a multiplayer game with real-time backend"

**Process:**
1. Detect: game-development + backend-development
2. Check for git3 skills (dispatching-parallel-agents found)
3. Suggest:
   ```
   🎯 Multi-Capability Detected

   RECOMMENDATION: Parallel agent dispatch
   - bmad:game-dev → Game mechanics
   - backend-api-dev → Real-time API

   Both will work concurrently on separate branches.
   ```
4. If user approves, invoke dispatching-parallel-agents skill

## Integration with Existing Workflows

Smart Router is designed to work alongside your existing tools, not replace them. It simply helps you discover and select the right tool when multiple options exist.

**Key principle:** If you already know which tool to use, use it directly. Smart Router is for discovery and decision-making when uncertain.

---

For more details on registry building and capability detection, see `references/` directory.
