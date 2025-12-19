#!/usr/bin/env node
/**
 * Smart Router - Registry Builder Hook
 * =====================================
 *
 * This hook runs on SessionStart to build a capability registry of all
 * installed plugins, skills, agents, and commands. The registry enables
 * Smart Router to quickly find relevant tools for user requests.
 *
 * Hook Event: SessionStart
 * Output: Writes agent-registry.json to .claude/.cache/
 *
 * @module hooks/registry-builder
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, lstatSync, realpathSync } from 'fs';
import { join, basename, resolve } from 'path';
import { createHash } from 'crypto';
import { homedir } from 'os';

import type { PluginManifest, PluginManifestWithPath, RegistryEntry, Registry } from './shared/types';

// ============================================================================
// Configuration
// ============================================================================

/** Maximum directory depth for local command scanning (prevents infinite recursion) */
const MAX_SCAN_DEPTH = 10;

/**
 * Capability keywords mapping
 *
 * Maps capability names to arrays of keywords that indicate that capability.
 * When a plugin's description contains any of these keywords, it will be
 * registered under that capability.
 *
 * To add new capabilities:
 * 1. Add a new key with a descriptive capability name
 * 2. Add an array of 3-5 specific keywords that strongly indicate that capability
 * 3. Prefer multi-word phrases over single words to reduce false positives
 */
const CAPABILITY_KEYWORDS: Record<string, string[]> = {
    'code-review': ['code review', 'review code', 'pr review', 'pull request review', 'code quality'],
    'brainstorming': ['brainstorm', 'design', 'ideation', 'planning', 'architecture'],
    'testing': ['test', 'testing', 'qa', 'quality assurance', 'test generation'],
    'debugging': ['debug', 'troubleshoot', 'fix', 'error', 'bug'],
    'refactoring': ['refactor', 'cleanup', 'code organization', 'restructure'],
    'documentation': ['docs', 'documentation', 'readme', 'api docs'],
    'database': ['database', 'sql', 'query', 'migration', 'schema'],
    'deployment': ['deploy', 'deployment', 'ci', 'cd', 'release'],
    'security': ['security', 'auth', 'authentication', 'authorization', 'vulnerability'],
    'performance': ['performance', 'optimization', 'speed', 'profiling'],
    'git': ['git', 'version control', 'commit', 'merge', 'branch'],
    'game-development': ['game', 'game dev', 'unity', 'unreal', 'godot'],
    'backend-development': ['backend', 'api', 'server', 'microservice'],
    'frontend-development': ['frontend', 'ui', 'react', 'component', 'styling'],
    'conversation-search': ['memory', 'search conversations', 'episodic', 'history'],
};

// ============================================================================
// Tracking for Error Aggregation
// ============================================================================

const scanErrors: { path: string; error: string }[] = [];
const scanWarnings: string[] = [];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Compute a hash of file modification times for cache invalidation
 */
function computeHash(paths: string[]): string {
    const hash = createHash('sha256');
    for (const path of paths.sort()) {
        try {
            if (existsSync(path)) {
                const stat = statSync(path);
                hash.update(`${path}:${stat.mtimeMs}`);
            }
        } catch (err) {
            // Skip paths we can't stat
            scanWarnings.push(`Cannot stat ${path}: ${err}`);
        }
    }
    return hash.digest('hex');
}

/**
 * Safely read a directory, returning empty array on error
 */
function safeReaddir(dir: string, context: string): string[] {
    try {
        return readdirSync(dir);
    } catch (err) {
        scanErrors.push({
            path: dir,
            error: `Cannot read ${context}: ${err instanceof Error ? err.message : String(err)}`
        });
        return [];
    }
}

/**
 * Safely check if path is a directory
 */
function safeIsDirectory(path: string): boolean {
    try {
        return statSync(path).isDirectory();
    } catch (err) {
        return false;
    }
}

/**
 * Check if a path escapes its expected root (path traversal protection)
 */
function isPathSafe(path: string, expectedRoot: string): boolean {
    try {
        const realPath = realpathSync(path);
        const realRoot = realpathSync(expectedRoot);
        return realPath.startsWith(realRoot);
    } catch (err) {
        // If we can't resolve the path, it's not safe
        return false;
    }
}

/**
 * Scan plugin directories and return manifest information
 * Includes path traversal protection via symlink and realpath checks
 */
function scanPlugins(pluginDir: string): PluginManifestWithPath[] {
    const manifests: PluginManifestWithPath[] = [];

    if (!existsSync(pluginDir)) {
        return manifests;
    }

    const marketplaces = safeReaddir(pluginDir, 'plugin directory');
    for (const marketplace of marketplaces) {
        const marketplacePath = join(pluginDir, marketplace);

        // Path traversal protection: verify path stays within plugin directory
        if (!isPathSafe(marketplacePath, pluginDir)) {
            scanWarnings.push(`Skipping potential path traversal: ${marketplacePath}`);
            continue;
        }

        if (!safeIsDirectory(marketplacePath)) continue;

        const plugins = safeReaddir(marketplacePath, `marketplace ${marketplace}`);
        for (const plugin of plugins) {
            const pluginPath = join(marketplacePath, plugin);

            if (!isPathSafe(pluginPath, pluginDir)) {
                scanWarnings.push(`Skipping potential path traversal: ${pluginPath}`);
                continue;
            }

            if (!safeIsDirectory(pluginPath)) continue;

            const versions = safeReaddir(pluginPath, `plugin ${plugin}`);
            for (const version of versions) {
                const versionPath = join(pluginPath, version);
                const manifestPath = join(versionPath, '.claude-plugin', 'plugin.json');

                if (!isPathSafe(versionPath, pluginDir)) {
                    scanWarnings.push(`Skipping potential path traversal: ${versionPath}`);
                    continue;
                }

                if (existsSync(manifestPath)) {
                    try {
                        const content = readFileSync(manifestPath, 'utf-8');
                        const manifest: PluginManifest = JSON.parse(content);

                        if (!manifest.name || typeof manifest.name !== 'string') {
                            scanErrors.push({
                                path: manifestPath,
                                error: 'Invalid manifest: missing or invalid name field'
                            });
                            continue;
                        }

                        manifests.push({
                            ...manifest,
                            _path: versionPath
                        });
                    } catch (err) {
                        scanErrors.push({
                            path: manifestPath,
                            error: `Failed to parse: ${err instanceof Error ? err.message : String(err)}`
                        });
                    }
                }
            }
        }
    }

    return manifests;
}

/**
 * Infer capabilities from text based on keyword matching
 */
function inferCapability(text: string): string[] {
    const capabilities: string[] = [];
    const lowerText = text.toLowerCase();

    for (const [capability, keywords] of Object.entries(CAPABILITY_KEYWORDS)) {
        for (const keyword of keywords) {
            if (lowerText.includes(keyword)) {
                capabilities.push(capability);
                break;
            }
        }
    }

    return capabilities;
}

/**
 * Extract description from a markdown file (YAML frontmatter or first line)
 */
function extractDescription(filePath: string): string {
    try {
        const content = readFileSync(filePath, 'utf-8');

        // Try to extract from YAML frontmatter
        const yamlMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
        if (yamlMatch) {
            const descMatch = yamlMatch[1].match(/description:\s*(.+)/);
            if (descMatch) {
                return descMatch[1].trim().replace(/['"]/g, '');
            }
        }

        // Fallback: first non-comment, non-frontmatter line
        const lines = content.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('---')) {
                return trimmed.substring(0, 100);
            }
        }
    } catch (err) {
        // Log the error for debugging but return default
        // This is expected for permission issues or race conditions
        if (process.env.DEBUG) {
            console.warn(`Smart Router: Could not read ${filePath}: ${err}`);
        }
        scanWarnings.push(`Could not extract description from ${filePath}`);
    }
    return 'No description available';
}

/**
 * Build the complete capability registry
 */
function buildRegistry(): Registry {
    const registry: Registry = {
        version: '1.0',
        lastBuilt: new Date().toISOString(),
        hash: '',
        capabilities: {}
    };

    const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const homeDir = homedir();
    const globalPluginDir = join(homeDir, '.claude', 'plugins', 'cache');
    const localCommandDir = join(projectDir, '.claude', 'commands');

    // Scan global plugins
    const plugins = scanPlugins(globalPluginDir);

    for (const plugin of plugins) {
        const pluginPath = plugin._path;

        // Scan agents
        const agentsDir = join(pluginPath, 'agents');
        if (existsSync(agentsDir)) {
            const agentFiles = safeReaddir(agentsDir, `agents in ${plugin.name}`).filter(f => f.endsWith('.md'));
            for (const agentFile of agentFiles) {
                const agentPath = join(agentsDir, agentFile);
                const description = extractDescription(agentPath);
                const capabilities = inferCapability(description + ' ' + (plugin.description || ''));

                for (const cap of capabilities) {
                    if (!registry.capabilities[cap]) {
                        registry.capabilities[cap] = [];
                    }

                    registry.capabilities[cap].push({
                        plugin: plugin.name,
                        type: 'agent',
                        entry: `agents/${agentFile}`,
                        description,
                        source: 'global'
                    });
                }
            }
        }

        // Scan skills
        const skillsDir = join(pluginPath, 'skills');
        if (existsSync(skillsDir)) {
            const skillDirs = safeReaddir(skillsDir, `skills in ${plugin.name}`).filter(f => {
                const skillPath = join(skillsDir, f);
                return safeIsDirectory(skillPath);
            });

            for (const skillDir of skillDirs) {
                const skillFile = join(skillsDir, skillDir, 'SKILL.md');
                if (existsSync(skillFile)) {
                    const description = extractDescription(skillFile);
                    const capabilities = inferCapability(description + ' ' + (plugin.description || ''));

                    for (const cap of capabilities) {
                        if (!registry.capabilities[cap]) {
                            registry.capabilities[cap] = [];
                        }

                        registry.capabilities[cap].push({
                            plugin: plugin.name,
                            type: 'skill',
                            entry: `skills/${skillDir}/SKILL.md`,
                            description,
                            source: 'global'
                        });
                    }
                }
            }
        }

        // Scan commands
        const commandsDir = join(pluginPath, 'commands');
        if (existsSync(commandsDir)) {
            const commandFiles = safeReaddir(commandsDir, `commands in ${plugin.name}`).filter(f => f.endsWith('.md'));
            for (const commandFile of commandFiles) {
                const commandPath = join(commandsDir, commandFile);
                const description = extractDescription(commandPath);
                const capabilities = inferCapability(description + ' ' + (plugin.description || ''));

                for (const cap of capabilities) {
                    if (!registry.capabilities[cap]) {
                        registry.capabilities[cap] = [];
                    }

                    registry.capabilities[cap].push({
                        plugin: plugin.name,
                        type: 'command',
                        entry: `commands/${commandFile}`,
                        description,
                        source: 'global'
                    });
                }
            }
        }
    }

    // Scan local commands (e.g., BMAD workflows)
    if (existsSync(localCommandDir)) {
        function scanLocalDir(dir: string, basePath: string = '', depth: number = 0) {
            if (depth > MAX_SCAN_DEPTH) {
                scanWarnings.push(`Skipping deep directory (depth > ${MAX_SCAN_DEPTH}): ${dir}`);
                return;
            }

            const items = safeReaddir(dir, `local commands at depth ${depth}`);

            for (const item of items) {
                const itemPath = join(dir, item);

                try {
                    const lstat = lstatSync(itemPath);

                    // Skip symlinks to prevent circular references
                    if (lstat.isSymbolicLink()) {
                        continue;
                    }

                    if (lstat.isDirectory()) {
                        scanLocalDir(itemPath, join(basePath, item), depth + 1);
                    } else if (item.endsWith('.md')) {
                        const description = extractDescription(itemPath);
                        const capabilities = inferCapability(description + ' ' + basename(item));

                        for (const cap of capabilities) {
                            if (!registry.capabilities[cap]) {
                                registry.capabilities[cap] = [];
                            }

                            registry.capabilities[cap].push({
                                plugin: `local:${basePath.split('/')[0] || 'commands'}`,
                                type: 'workflow',
                                entry: join(basePath, item),
                                description,
                                source: 'local'
                            });
                        }
                    }
                } catch (err) {
                    scanWarnings.push(`Could not stat ${itemPath}: ${err}`);
                }
            }
        }

        scanLocalDir(localCommandDir);
    }

    // Compute hash for cache invalidation
    const pluginPaths = plugins.map(p => p._path);
    if (existsSync(localCommandDir)) {
        pluginPaths.push(localCommandDir);
    }
    registry.hash = computeHash(pluginPaths);

    return registry;
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
    try {
        const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
        const cacheDir = join(projectDir, '.claude', '.cache');
        const registryPath = join(cacheDir, 'agent-registry.json');
        const hashPath = join(cacheDir, 'plugin-hash.txt');

        // Ensure cache directory exists
        if (!existsSync(cacheDir)) {
            mkdirSync(cacheDir, { recursive: true });
        }

        // Build new registry
        const newRegistry = buildRegistry();

        // Check if rebuild is needed
        let shouldRebuild = true;
        if (existsSync(hashPath) && existsSync(registryPath)) {
            try {
                const oldHash = readFileSync(hashPath, 'utf-8').trim();
                if (oldHash === newRegistry.hash) {
                    shouldRebuild = false;
                }
            } catch (err) {
                // If we can't read the hash, rebuild anyway
                shouldRebuild = true;
            }
        }

        if (shouldRebuild) {
            // Write registry first
            try {
                writeFileSync(registryPath, JSON.stringify(newRegistry, null, 2));
            } catch (err) {
                console.error(`Smart Router: Failed to write registry: ${err}`);
                process.exit(1);
            }

            // Then write hash
            try {
                writeFileSync(hashPath, newRegistry.hash);
            } catch (err) {
                console.error(`Smart Router: Failed to write hash: ${err}`);
                // Registry is already written, so this is a partial failure
            }

            const capCount = Object.keys(newRegistry.capabilities).length;
            const toolCount = Object.values(newRegistry.capabilities).reduce((sum, tools) => sum + tools.length, 0);

            console.log(`✅ Smart Router: Registry built - ${capCount} capabilities, ${toolCount} tools`);

            // Report any errors/warnings that occurred during scan
            if (scanErrors.length > 0) {
                console.warn(`⚠️  Smart Router: ${scanErrors.length} plugin(s) failed to load:`);
                for (const { path, error } of scanErrors.slice(0, 5)) {
                    console.warn(`   - ${basename(path)}: ${error}`);
                }
                if (scanErrors.length > 5) {
                    console.warn(`   ... and ${scanErrors.length - 5} more`);
                }
            }
        }

        process.exit(0);
    } catch (err) {
        console.error('Smart Router registry builder error:', err);
        process.exit(1);
    }
}

main();
