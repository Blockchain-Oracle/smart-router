#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { createHash } from 'crypto';
import { homedir } from 'os';
// Capability keywords mapping
const CAPABILITY_KEYWORDS = {
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
function computeHash(paths) {
    const hash = createHash('sha256');
    for (const path of paths.sort()) {
        if (existsSync(path)) {
            const stat = statSync(path);
            hash.update(`${path}:${stat.mtimeMs}`);
        }
    }
    return hash.digest('hex');
}
function scanPlugins(pluginDir) {
    const manifests = [];
    if (!existsSync(pluginDir)) {
        return manifests;
    }
    // Scan all plugin directories
    const marketplaces = readdirSync(pluginDir);
    for (const marketplace of marketplaces) {
        const marketplacePath = join(pluginDir, marketplace);
        if (!statSync(marketplacePath).isDirectory())
            continue;
        const plugins = readdirSync(marketplacePath);
        for (const plugin of plugins) {
            const pluginPath = join(marketplacePath, plugin);
            if (!statSync(pluginPath).isDirectory())
                continue;
            // Find plugin.json in versioned directories
            const versions = readdirSync(pluginPath);
            for (const version of versions) {
                const versionPath = join(pluginPath, version);
                const manifestPath = join(versionPath, '.claude-plugin', 'plugin.json');
                if (existsSync(manifestPath)) {
                    try {
                        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
                        manifests.push({
                            ...manifest,
                            _path: versionPath // Store path for component scanning
                        });
                    }
                    catch (err) {
                        console.error(`Failed to parse ${manifestPath}:`, err);
                    }
                }
            }
        }
    }
    return manifests;
}
function inferCapability(text) {
    const capabilities = [];
    const lowerText = text.toLowerCase();
    for (const [capability, keywords] of Object.entries(CAPABILITY_KEYWORDS)) {
        for (const keyword of keywords) {
            if (lowerText.includes(keyword)) {
                capabilities.push(capability);
                break; // Only add each capability once
            }
        }
    }
    return capabilities;
}
function extractDescription(filePath) {
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
        // Fallback: first line of content after frontmatter
        const lines = content.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('---')) {
                return trimmed.substring(0, 100);
            }
        }
    }
    catch (err) {
        // Ignore errors
    }
    return 'No description available';
}
function buildRegistry() {
    const registry = {
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
            const agentFiles = readdirSync(agentsDir).filter(f => f.endsWith('.md'));
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
            const skillDirs = readdirSync(skillsDir).filter(f => {
                const skillPath = join(skillsDir, f);
                return statSync(skillPath).isDirectory();
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
            const commandFiles = readdirSync(commandsDir).filter(f => f.endsWith('.md'));
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
    // Scan local commands (e.g., BMAD)
    if (existsSync(localCommandDir)) {
        function scanLocalDir(dir, basePath = '') {
            const items = readdirSync(dir);
            for (const item of items) {
                const itemPath = join(dir, item);
                const stat = statSync(itemPath);
                if (stat.isDirectory()) {
                    // Recursively scan subdirectories
                    scanLocalDir(itemPath, join(basePath, item));
                }
                else if (item.endsWith('.md')) {
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
            const oldHash = readFileSync(hashPath, 'utf-8').trim();
            if (oldHash === newRegistry.hash) {
                shouldRebuild = false;
            }
        }
        if (shouldRebuild) {
            // Write registry and hash
            writeFileSync(registryPath, JSON.stringify(newRegistry, null, 2));
            writeFileSync(hashPath, newRegistry.hash);
            const capCount = Object.keys(newRegistry.capabilities).length;
            const toolCount = Object.values(newRegistry.capabilities).reduce((sum, tools) => sum + tools.length, 0);
            console.log(`✅ Smart Router: Registry built - ${capCount} capabilities, ${toolCount} tools`);
        }
        process.exit(0);
    }
    catch (err) {
        console.error('Smart Router registry builder error:', err);
        process.exit(1);
    }
}
main();
