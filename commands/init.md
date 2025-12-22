---
description: Initialize CLAUDE.md with behavioral tool rules for your project. Conversationally ask what you're building, then intelligently match your installed tools.
allowed-tools: Read, Write, Glob, Grep, Bash, AskUserQuestion
---

# Smart Router Init: Set Up Your Project Tools

## Purpose

Create a CLAUDE.md with **behavioral tool rules** that make Claude automatically use the right tools at the right time.

**Core Principle**: You are an intelligent AI. You don't need hardcoded mappings. Read the tool descriptions, understand what the user is building, and intelligently determine which tools are relevant.

## Process

### Step 1: Understand the Project

Ask the user conversationally:

"**What are you building?**

Tell me about your project:
- What type of project is it? (web app, API, game, CLI tool, MCP server, etc.)
- What technologies are you using?
- Any specific challenges or workflows you want help with?

For example: 'I'm building a React dashboard with a Node.js backend'"

**Wait for the user's response before proceeding.**

### Step 2: Load Your Tools

Read the registry to see ALL tools available:

```bash
cat .claude/.cache/agent-registry.json 2>/dev/null
```

If the registry doesn't exist, it will be automatically built when Smart Router is first used.
You can also trigger a rebuild:
```bash
# Use smart-router skill or run /smart-router:rebuild
# Registry builds on-demand when needed
```

The registry contains:
- `mcps`: Array of MCP servers with descriptions
- `capabilities`: Map of tools with descriptions, including:
  - **skills** (type: "skill") - Invoked with `/skill-name`, critical development workflows
  - **agents** (type: "agent") - Specialized agents for complex tasks
  - **workflows** (type: "workflow") - Multi-step guided processes
  - **commands** (type: "command") - Direct commands
- `enabledPlugins`: List of enabled plugins

**CRITICAL**: Skills are often the most important tools! They contain development best practices like TDD, debugging, testing patterns. Always check for skills and include them.

### Step 3: Identify Relevant Tools (USE YOUR INTELLIGENCE)

**DO NOT rely on hardcoded category mappings.**

Instead, use your intelligence to:

1. **Read each tool's description** - The registry has descriptions for everything
2. **Understand what the user is building** - From their response in Step 1
3. **Match tools to needs** - If a tool's description suggests it would help with what the user is building, include it

**Fundamentals (ALWAYS include if available):**
These are universally useful for any developer:

- **Documentation/Research tools** - Looking up library docs, API references
- **Memory/Conversation search tools** - Remembering past sessions, decisions
- **Web search** - General research capability

For everything else, use your judgment based on the tool descriptions.

### Step 4: Research Unknown Tools (IMPORTANT)

If a tool's description isn't clear or seems too simple, **DO YOUR RESEARCH**:

1. **Read the plugin files:**
```bash
# For skills
cat ~/.claude/plugins/cache/[marketplace]/[plugin]/[version]/skills/[skill]/SKILL.md

# For agents
cat ~/.claude/plugins/cache/[marketplace]/[plugin]/[version]/agents/[agent].md

# For plugin overview
cat ~/.claude/plugins/cache/[marketplace]/[plugin]/[version]/.claude-plugin/plugin.json
```

2. **Web search the tool** - Many tools have documentation, GitHub repos, or blog posts explaining their full capabilities.

3. **Don't assume** - A tool like "serena" might seem simple but actually provides:
   - Semantic code retrieval (not just grep)
   - IDE-like symbol navigation (find_symbol, find_referencing_symbols)
   - LSP integration for 30+ languages
   - Much more efficient than file-based approaches

4. **Write accurate descriptions** - Your behavioral rules are only as good as your understanding of what each tool actually does.

**The user has these tools installed for a reason. Take the time to understand them.**

### Step 5: Generate CLAUDE.md

Write behavioral rules using the **"When X, use Y"** pattern.

**Template Structure:**

```markdown
# Project: [Project Name from user]

## Tool Usage Rules (MANDATORY)

### Research & Documentation
[Include if documentation/research tools exist]
When you don't understand something, encounter an unfamiliar library, or need API docs:
1. FIRST: Use `[actual tool name]` to search documentation
2. THEN: Use web search for additional context
YOU MUST do this before guessing or making assumptions.

### Memory & Context
[Include if memory/episodic tools exist]
When context from past sessions would help:
- Search past conversations with `[actual tool name]`
- Reference previous architectural decisions before making new ones

### [Project-Specific Section]
[Based on what user is building and what relevant tools you found]
When [specific situation relevant to their project]:
- Use `[actual tool name]` to [what it does]
- [Additional behavioral rules]

## Quick Reference

| When You Need | Use This |
|---------------|----------|
[Only include tools you determined are relevant]
```

### Step 6: Write the File

Check if CLAUDE.md exists:
- If YES: Ask user if they want to append or replace
- If NO: Create new file

Write to `./CLAUDE.md`

### Step 7: Confirm

"**CLAUDE.md has been set up!**

I've configured behavioral rules based on your installed tools.

**Included tools:**
- [List each tool you included and why]

Claude will now automatically:
- [Key behavior 1]
- [Key behavior 2]
- [Key behavior 3]

To update later, run `/smart-router:init` again."

## Important Rules

1. **Trust your intelligence** - Don't rely on hardcoded mappings. Read descriptions and reason about relevance.

2. **Use actual tool names** - Never use placeholder names like `[DOC_TOOL]` in the final output. Use the real names from the registry (e.g., `context7`, `episodic-memory:search-conversations`).

3. **Only include installed tools** - Never recommend a tool that isn't in the registry.

4. **Include ALL similar tools** - If user has multiple tools that do similar things (e.g., `chrome`, `playwright`, `MCP_DOCKER` for browser automation), include ALL of them. Don't pick favorites. Let the LLM decide at runtime which to use.

5. **Research unknown tools** - If you don't understand what a tool does, research it (read plugin files, web search). Don't make assumptions.

6. **Fundamentals are universal** - Documentation lookup, memory search, and research tools benefit everyone. Always include if available.

7. **Behavioral triggers** - Write "When X, use Y" not just "Y exists".

8. **Keep it organized** - Group similar tools together. Target under 250 lines but include all relevant tools.

9. **NEVER forget skills** - Skills (type: "skill") are critical! They contain best practices like TDD, debugging, testing. Filter registry for `type == "skill"` and include relevant ones. Skills are invoked with `/skill-name`.

10. **Check ALL types** - The registry has agents, workflows, commands, skills, AND MCPs. Scan all of them, not just one type.

## Example Output Structure

**IMPORTANT**: The example below shows the STRUCTURE and PATTERN to follow. The actual tool names come from the user's registry - do NOT copy these specific tools.

```markdown
# Project: [User's project description]

## Tool Usage Rules (MANDATORY)

### Research & Documentation
[If documentation tools exist in registry]
When you don't understand a library or need API documentation:
1. FIRST: Use `[doc-tool-from-registry]` to search library documentation
2. THEN: Use web search for additional context
YOU MUST do this before guessing. Never assume - always verify.

### Memory & Context
[If memory tools exist in registry]
When context from past sessions would help:
- Search past conversations with `[memory-tool-from-registry]`
- Reference previous architectural decisions before making new ones

### [Category Based on Project Type]
[If relevant tools exist in registry]
When [situation relevant to user's project]:
- `[tool-1-from-registry]` - [brief description from registry]
- `[tool-2-from-registry]` - [brief description from registry]
[Include ALL similar tools, let LLM decide at runtime]

### Code Quality & Review
[If code review tools exist in registry]
Before completing significant work:
- `[review-tool-1]` - [description]
- `[review-tool-2]` - [description]

### Development Skills (CRITICAL)
[If skill-type tools exist - ALWAYS check for these!]
When implementing features or fixing bugs:
- Use `/[tdd-skill]` BEFORE writing implementation code
- Use `/[debugging-skill]` BEFORE proposing bug fixes
- Use `/[testing-skill]` when writing tests
Skills use the `/skill-name` invocation pattern.

## Quick Reference

| When You Need | Use This |
|---------------|----------|
| [Need 1] | `[tool(s) from registry]` |
| [Need 2] | `[tool(s) from registry]` |
```

**Key principles:**
1. Read the ACTUAL registry to get tool names and descriptions
2. Include ALL similar tools (don't pick favorites)
3. Group tools by what they help with
4. Use "When X, use Y" pattern
5. Only include tools that exist in THIS user's registry
