---
name: rebuild
description: Force rebuild the plugin registry cache
argument-hint: (no arguments)
---

# Rebuild Smart Router Registry

Force a complete rebuild of the plugin discovery registry.

## What This Does

1. Scans `~/.claude/plugins/cache/` for all installed plugins
2. Scans `.claude/commands/` for local commands (e.g., BMAD)
3. Extracts capabilities from plugin manifests and component descriptions
4. Rebuilds `.claude/.cache/agent-registry.json`
5. Updates plugin hash for cache invalidation

## When to Use

Run this command when:
- You installed a new plugin and want it discovered immediately
- You updated an existing plugin
- Registry seems stale or missing tools
- Debugging routing issues
- SessionStart hook didn't run (rare)

## How It Works

This command runs the same registry-builder script that SessionStart hook uses, but forces a complete rebuild regardless of hash status.

## Execution

Run the registry builder script directly:

```bash
node ${CLAUDE_PLUGIN_ROOT}/hooks/registry-builder.js
```

## Output

You should see:
```
✅ Smart Router: Registry built - X capabilities, Y tools
```

If you see errors, check:
- Plugin directory permissions
- `.claude/.cache/` directory exists
- TypeScript files compiled (`.js` files exist in hooks/)

## Verify Registry

After rebuild, check the registry file:

```bash
cat .claude/.cache/agent-registry.json
```

You should see:
- `version`: Registry version
- `lastBuilt`: Timestamp
- `hash`: Plugin directory hash
- `capabilities`: Discovered tools grouped by capability

## Troubleshooting

**Command not found:**
- Ensure smart-router plugin is installed
- Check hooks/ directory has compiled .js files
- Verify plugin.json is in .claude-plugin/

**Registry empty:**
- Check plugins are installed in `~/.claude/plugins/cache/`
- Verify plugin.json files exist in plugin directories
- Check capability keywords match (see registry-builder.ts)

**Permissions error:**
- Ensure `.claude/.cache/` directory is writable
- Check plugin directories are readable

## Related

- SessionStart hook (auto-rebuild on session start)
- `/smart-router:rebuild` - This command
- Smart Router skill (routing logic)

---

After rebuilding, the next user prompt will trigger routing-detector with fresh registry data.
