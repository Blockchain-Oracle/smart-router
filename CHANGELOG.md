# Changelog

## [Unreleased]

### Added
- **Smart Router Early Reminder Hook** - New optional UserPromptSubmit hook that reminds Claude to check Smart Router BEFORE making tool decisions
  - Located in `hooks/smart-router-enforcer.py`
  - Fires on task-related prompts (training mode)
  - Smart keyword filtering (only fires on relevant prompts)
  - Shows registry stats and reminds to check Smart Router first

- **Hook Setup in /configure Command** - The `/smart-router:configure` command now includes optional hook setup
  - Step 6 asks if user wants to enable the early reminder hook
  - **MERGE logic** - Never overwrites existing `.claude/settings.json`
  - Preserves user's existing hooks from other plugins
  - Option to copy hook script to project for version control

### Changed
- Updated `commands/configure.md` with Step 6 for hook configuration
- Updated `README.md` with Early Reminder Hook section
- Hook merge logic checks for existing Smart Router hook before adding
- Changed from PreToolUse to UserPromptSubmit for early decision-making

### Technical Details

**Hook Event: UserPromptSubmit** (not PreToolUse)
- **Why:** Fires BEFORE Claude makes decisions, not after
- **Benefit:** Claude checks Smart Router first, sees all available tools
- **Example:** "I want to test" → hook fires → Claude checks Smart Router → sees all testing tools → picks best one

**Smart Filtering:**
- Task keywords: test, brainstorm, review, debug, build, design, game, etc.
- Silent on simple prompts (no spam on "what's 2+2")
- Training mode - builds good habits over time

**Merge Logic:**
- Reads existing `.claude/settings.json` if it exists
- Initializes hooks structure if needed
- Checks if Smart Router hook already exists
- Adds hook to UserPromptSubmit array (preserving other hooks)
- Writes back merged configuration

**Hook Behavior:**
- Fires on task-related prompts only (smart filtering)
- Silently skips if no registry exists
- Shows early reminder with registry stats
- Output added to Claude's context (training)
- Graceful error handling (never breaks Claude's workflow)

## Previous Releases

See GitHub releases for full history.
