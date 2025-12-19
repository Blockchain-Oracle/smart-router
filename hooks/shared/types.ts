/**
 * Smart Router - Shared Type Definitions
 * =======================================
 *
 * Canonical type definitions used across all Smart Router hooks.
 * These types should be the single source of truth for the plugin.
 *
 * @module shared/types
 */

// ============================================================================
// Plugin Types
// ============================================================================

/**
 * Valid types of plugin components that can be registered
 */
export type PluginType = 'skill' | 'agent' | 'command' | 'workflow';

/**
 * Source location of a plugin component
 */
export type PluginSource = 'global' | 'local';

/**
 * Plugin manifest as defined in plugin.json
 */
export interface PluginManifest {
    /** Unique plugin identifier */
    name: string;
    /** Human-readable description of plugin functionality */
    description?: string;
    /** Keywords for capability matching */
    keywords?: string[];
    /** List of agent identifiers provided by this plugin */
    agents?: string[];
    /** List of skill identifiers provided by this plugin */
    skills?: string[];
    /** List of command identifiers provided by this plugin */
    commands?: string[];
}

/**
 * Plugin manifest with resolved filesystem path (internal use)
 * The _path field stores the absolute path to the versioned plugin directory
 */
export interface PluginManifestWithPath extends PluginManifest {
    /** Absolute path to the versioned plugin directory */
    _path: string;
}

// ============================================================================
// Registry Types
// ============================================================================

/**
 * A single entry in the capability registry representing a tool
 */
export interface RegistryEntry {
    /** Plugin name that provides this tool */
    plugin: string;
    /** Type of the tool (skill, agent, command, or workflow) */
    type: PluginType;
    /** Relative path to the tool within the plugin */
    entry: string;
    /** Human-readable description of tool functionality */
    description: string;
    /** Whether this tool is from global plugins or local project */
    source: PluginSource;
}

/**
 * The complete capability registry structure
 */
export interface Registry {
    /** Registry format version */
    version: string;
    /** ISO 8601 timestamp of last build */
    lastBuilt: string;
    /** SHA-256 hash for cache invalidation */
    hash: string;
    /** Map of capability names to arrays of matching tools */
    capabilities: Record<string, RegistryEntry[]>;
}

// ============================================================================
// Hook Input Types
// ============================================================================

/**
 * Input structure for Claude Code hooks
 * This is the JSON structure passed via stdin to hook scripts
 */
export interface HookInput {
    /** Unique session identifier */
    session_id: string;
    /** Path to the conversation transcript file */
    transcript_path: string;
    /** Current working directory */
    cwd: string;
    /** Current permission mode */
    permission_mode: string;
    /** The user's input prompt text */
    user_prompt: string;
}

// ============================================================================
// Result Types for Validation
// ============================================================================

/**
 * Result type for operations that can fail
 * Use this instead of throwing exceptions for expected failures
 */
export type Result<T, E = string> =
    | { ok: true; value: T }
    | { ok: false; error: E };

/**
 * Create a successful result
 */
export function ok<T>(value: T): Result<T, never> {
    return { ok: true, value };
}

/**
 * Create a failed result
 */
export function err<E>(error: E): Result<never, E> {
    return { ok: false, error };
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate and parse JSON into a HookInput structure
 * @param input Raw input string from stdin
 * @returns Result with parsed HookInput or error message
 */
export function parseHookInput(input: string): Result<HookInput> {
    let parsed: unknown;

    try {
        parsed = JSON.parse(input);
    } catch (e) {
        return err('Invalid JSON input');
    }

    if (!parsed || typeof parsed !== 'object') {
        return err('Expected JSON object');
    }

    const obj = parsed as Record<string, unknown>;

    if (typeof obj.user_prompt !== 'string') {
        return err('Missing or invalid user_prompt field');
    }

    return ok({
        session_id: String(obj.session_id || ''),
        transcript_path: String(obj.transcript_path || ''),
        cwd: String(obj.cwd || ''),
        permission_mode: String(obj.permission_mode || ''),
        user_prompt: obj.user_prompt,
    });
}

/**
 * Validate and parse a Registry JSON file
 * @param content Raw JSON string
 * @returns Result with parsed Registry or error message
 */
export function parseRegistry(content: string): Result<Registry> {
    let parsed: unknown;

    try {
        parsed = JSON.parse(content);
    } catch (e) {
        return err('Invalid registry JSON - file may be corrupted');
    }

    if (!parsed || typeof parsed !== 'object') {
        return err('Registry must be a JSON object');
    }

    const obj = parsed as Record<string, unknown>;

    if (typeof obj.version !== 'string') {
        return err('Registry missing version field');
    }

    if (!obj.capabilities || typeof obj.capabilities !== 'object') {
        return err('Registry missing capabilities field');
    }

    return ok(parsed as Registry);
}
