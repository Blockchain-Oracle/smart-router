# Changelog

## [Unreleased]

### BREAKING CHANGES - Hooks Removed
- **Removed all hooks** - Smart Router no longer uses SessionStart or UserPromptSubmit hooks
- **Skill-based registry building** - Registry is now built on-demand by the smart-router skill
  - Automatically rebuilds when registry is missing or plugins changed
  - Hash-based cache invalidation (only rebuilds when needed)
  - No background processes or session startup overhead
- **Simplified configuration** - `/smart-router:configure` now only configures routing preferences (no hook setup)

### Why This Change?
1. **Cloud Mode Compatibility** - Hooks are not needed with cloud-based initialization (cloud.md handles setup)
2. **Simpler Architecture** - Fewer moving parts, easier to understand and maintain
3. **Better Performance** - Registry builds only when actually used (lazy loading)
4. **Reduced Complexity** - No need to manage hook scripts, TypeScript compilation, or settings.json merging

### Migration Guide
- **If upgrading:** No action required! The skill will automatically build the registry on first use
- **If you configured hooks manually:** You can safely remove them from `.claude/settings.json`
- **Registry location unchanged:** `.claude/.cache/agent-registry.json` still used for caching

### Technical Details

**New Architecture:**
- Smart Router skill (Step 0) checks if registry exists and is current
- If missing or stale (hash mismatch) → rebuilds automatically
- Registry building logic moved into skill documentation
- Same plugin scanning, capability extraction, and hash-based invalidation
- Performance: Registry builds in <3 seconds, cached for session

**Removed Files:**
- `hooks/registry-builder.ts` - Registry building logic (moved to skill)
- `hooks/routing-detector.ts` - Routing detection (no longer needed)
- `hooks/smart-router-enforcer.py` - Early reminder (no longer needed)
- `hooks/hooks.json` - Hook configuration
- `hooks/package.json`, `hooks/tsconfig.json` - TypeScript dependencies

**Updated Files:**
- `skills/smart-router/SKILL.md` - Added Step 0 for registry building
- `commands/configure.md` - Removed hook setup (Steps 6-6.5)
- `commands/rebuild.md` - Updated to explain skill-based rebuild
- `README.md` - Updated architecture diagram and removed hook references

---

## [Previous Version] - Hook-Based Architecture (Deprecated)

### Added
- **Smart Router Early Reminder Hook** - Optional UserPromptSubmit hook
- **Hook Setup in /configure Command** - Hook configuration wizard

### Technical Details (Historical)
**Note:** This architecture has been replaced with skill-based registry building

## Previous Releases

See GitHub releases for full history.
