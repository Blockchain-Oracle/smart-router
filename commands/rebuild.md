---
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
- You updated an existing plugin manually (outside package manager)
- Registry seems stale or missing tools
- Debugging routing issues
- You deleted the cache and want to rebuild it

**Note:** Smart Router skill automatically rebuilds registry when:
- Registry file doesn't exist
- Plugin hash changes (plugins were added/updated/removed)

So manual rebuild is rarely needed, but useful for troubleshooting.

## How It Works

This command triggers the same registry-building logic that the Smart Router skill uses, but forces a complete rebuild regardless of hash status.

The registry-building process:
1. Scans all plugin directories
2. Extracts descriptions and capabilities
3. Computes hash of plugin modification times
4. Writes registry to `.claude/.cache/agent-registry.json`
5. Writes hash to `.claude/.cache/plugin-hash.txt`

## Execution

Simply invoke the smart-router skill with a request to rebuild:

```bash
Use the smart-router skill and ask it to rebuild the registry
```

Or trigger a routing operation - the skill will detect missing/stale registry and rebuild automatically:

```bash
"Which tool should I use for code review?"
```

## Output

You should see:
```
✅ Registry built - X capabilities, Y tools, Z MCPs
```

If you see errors, check:
- Plugin directory permissions (`~/.claude/plugins/cache/`)
- `.claude/.cache/` directory exists and is writable

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

**Registry empty:**
- Check plugins are installed in `~/.claude/plugins/cache/`
- Verify plugin.json files exist in plugin directories
- Ensure plugins have `agents/`, `skills/`, or `commands/` directories
- Check capability keyword matching (descriptions must contain recognizable keywords)

**Permissions error:**
- Ensure `.claude/.cache/` directory is writable
- Check plugin directories are readable
- Verify `~/.claude.json` is readable (for MCP discovery)

**Tools missing from registry:**
- Verify plugin is enabled in `~/.claude/settings.json`
- Check plugin manifest (`.claude-plugin/plugin.json`) exists
- Ensure tool descriptions contain capability keywords (code-review, testing, etc.)
- Look for scan errors in output

## Related

- Smart Router skill (auto-rebuilds registry when needed)
- `/smart-router:configure` - Configure routing preferences
- `.claude/.cache/agent-registry.json` - Registry output file

---

After rebuilding, the Smart Router skill will use fresh registry data for routing decisions.
