#!/usr/bin/env node
/**
 * Smart Router - Routing Detector Hook
 * =====================================
 *
 * This hook runs on UserPromptSubmit to detect if the user's prompt
 * matches any known capabilities and suggests relevant tools.
 *
 * Hook Event: UserPromptSubmit
 * Input: JSON via stdin with user_prompt field
 * Output: Routing suggestions printed to stdout
 *
 * @module hooks/routing-detector
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

import type { HookInput, Registry, RegistryEntry } from './shared/types';
import { parseHookInput, parseRegistry } from './shared/types';

// ============================================================================
// Routing Triggers Configuration
// ============================================================================

/**
 * Keywords and intent patterns for detecting routing needs.
 * Each capability maps to keywords (exact matches) and regex patterns (fuzzy matching).
 */
const ROUTING_TRIGGERS: Record<string, { keywords: string[]; intentPatterns: RegExp[] }> = {
    'code-review': {
        keywords: ['code review', 'review code', 'review this', 'pr review', 'check code'],
        intentPatterns: [
            /(review|check|analyze|evaluate).*code/i,
            /(review|analyze).*(pr|pull request)/i,
            /code.*(review|quality|check)/i
        ]
    },
    'brainstorming': {
        keywords: ['brainstorm', 'design', 'plan', 'architect', 'think through'],
        intentPatterns: [
            /(help|need).*design/i,
            /(brainstorm|ideate|plan|architect)/i,
            /(think through|explore).*approach/i
        ]
    },
    'testing': {
        keywords: ['test', 'testing', 'write tests', 'test this', 'qa'],
        intentPatterns: [
            /(write|create|add|generate).*test/i,
            /(test|verify|validate).*code/i,
            /test.*(coverage|suite|cases)/i
        ]
    },
    'debugging': {
        keywords: ['debug', 'fix', 'error', 'bug', 'troubleshoot', 'investigate'],
        intentPatterns: [
            /(debug|fix|solve|troubleshoot).*(error|bug|issue)/i,
            /(investigate|find).*problem/i,
            /(error|bug|issue).*(fix|solve)/i
        ]
    },
    'refactoring': {
        keywords: ['refactor', 'cleanup', 'reorganize', 'improve'],
        intentPatterns: [
            /(refactor|cleanup|reorganize|improve).*code/i,
            /clean.*up|improve.*structure/i
        ]
    },
    'database': {
        keywords: ['database', 'sql', 'query', 'migration', 'schema'],
        intentPatterns: [
            /(database|db).*(query|migration|schema)/i,
            /(create|write|execute).*sql/i
        ]
    },
    'game-development': {
        keywords: ['game', 'game dev', 'unity', 'unreal', 'godot'],
        intentPatterns: [
            /(build|create|develop).*game/i,
            /game.*(mechanic|system|feature)/i
        ]
    }
};

// ============================================================================
// Detection Functions
// ============================================================================

/**
 * Detect which capabilities are relevant to the user's prompt
 */
function detectCapability(prompt: string): string[] {
    const matched: string[] = [];
    const lowerPrompt = prompt.toLowerCase();

    for (const [capability, triggers] of Object.entries(ROUTING_TRIGGERS)) {
        // Check keywords first (faster)
        if (triggers.keywords.some(kw => lowerPrompt.includes(kw))) {
            matched.push(capability);
            continue;
        }

        // Check intent patterns (regex matching)
        if (triggers.intentPatterns.some(pattern => pattern.test(prompt))) {
            matched.push(capability);
        }
    }

    return matched;
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
    try {
        // Read and validate input from stdin
        const input = readFileSync(0, 'utf-8');
        const parseResult = parseHookInput(input);

        if (!parseResult.ok) {
            console.error(`Smart Router: ${parseResult.error}`);
            process.exit(1);
        }

        const data = parseResult.value;
        const prompt = data.user_prompt;

        if (!prompt) {
            // No prompt to process
            process.exit(0);
        }

        const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
        const registryPath = join(projectDir, '.claude', '.cache', 'agent-registry.json');

        // Check if registry exists
        if (!existsSync(registryPath)) {
            // Registry not built - provide helpful message
            console.log(`\n⚠️  Smart Router: Registry not found.`);
            console.log(`   Run the registry builder or start a new session to build it.`);
            console.log(`   Expected location: ${registryPath}\n`);
            process.exit(0);
        }

        // Load and validate registry
        let registry: Registry;
        try {
            const content = readFileSync(registryPath, 'utf-8');
            const registryResult = parseRegistry(content);

            if (!registryResult.ok) {
                console.error(`Smart Router: ${registryResult.error}`);
                console.error(`   Try deleting ${registryPath} and restarting to rebuild.`);
                process.exit(1);
            }

            registry = registryResult.value;
        } catch (err) {
            console.error(`Smart Router: Failed to read registry file: ${err}`);
            console.error(`   Try deleting ${registryPath} and restarting to rebuild.`);
            process.exit(1);
        }

        // Detect capabilities from prompt
        const capabilities = detectCapability(prompt);

        if (capabilities.length === 0) {
            // No routing needed - prompt doesn't match any known capabilities
            process.exit(0);
        }

        // Collect all matching tools
        const allMatches: Array<{ capability: string; tools: RegistryEntry[] }> = [];

        for (const cap of capabilities) {
            const tools = registry.capabilities[cap];
            if (tools && tools.length > 0) {
                allMatches.push({ capability: cap, tools });
            }
        }

        if (allMatches.length === 0) {
            // Capabilities detected but no tools installed for them
            console.log(`\nℹ️  Smart Router: Detected capabilities [${capabilities.join(', ')}]`);
            console.log(`   but no matching tools are installed.\n`);
            process.exit(0);
        }

        // Generate output based on matches
        let output = '';

        if (allMatches.length === 1 && allMatches[0].tools.length === 1) {
            // Single tool available → Auto-suggest
            const tool = allMatches[0].tools[0];
            output = `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            output += `💡 SMART ROUTER SUGGESTION\n`;
            output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
            output += `Detected: ${allMatches[0].capability}\n`;
            output += `Suggested tool: ${tool.plugin}\n`;
            output += `Type: ${tool.type}\n`;
            output += `Description: ${tool.description}\n\n`;
            output += `Consider using this tool for best results.\n`;
            output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        } else {
            // Multiple tools available → Tell Claude to use smart-router skill
            const totalTools = allMatches.reduce((sum, m) => sum + m.tools.length, 0);

            output = `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            output += `🎯 SMART ROUTER: MULTIPLE TOOLS AVAILABLE\n`;
            output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

            for (const match of allMatches) {
                output += `**${match.capability}** (${match.tools.length} tool${match.tools.length > 1 ? 's' : ''}):\n`;
                match.tools.slice(0, 3).forEach(tool => {
                    output += `  → ${tool.plugin} (${tool.type})\n`;
                });
                if (match.tools.length > 3) {
                    output += `  → ... and ${match.tools.length - 3} more\n`;
                }
                output += `\n`;
            }

            output += `**ACTION REQUIRED:**\n`;
            output += `Use the 'smart-router' skill to intelligently choose the best tool.\n`;
            output += `The skill will analyze your context and either:\n`;
            output += `- Auto-route to the best tool (if user preference is 'auto')\n`;
            output += `- Show ranked options for you to choose (if preference is 'ask')\n\n`;
            output += `Total: ${totalTools} available tools across ${allMatches.length} categor${allMatches.length > 1 ? 'ies' : 'y'}\n`;
            output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        }

        console.log(output);
        process.exit(0);
    } catch (err) {
        console.error('Smart Router routing detector error:', err);
        process.exit(1);
    }
}

main();
