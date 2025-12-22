/**
 * Smart Router - Shared Type Definitions
 * =======================================
 *
 * Canonical type definitions used across all Smart Router hooks.
 * These types should be the single source of truth for the plugin.
 *
 * @module shared/types
 */
/**
 * Create a successful result
 */
export function ok(value) {
    return { ok: true, value };
}
/**
 * Create a failed result
 */
export function err(error) {
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
export function parseHookInput(input) {
    let parsed;
    try {
        parsed = JSON.parse(input);
    }
    catch (e) {
        return err('Invalid JSON input');
    }
    if (!parsed || typeof parsed !== 'object') {
        return err('Expected JSON object');
    }
    const obj = parsed;
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
export function parseRegistry(content) {
    let parsed;
    try {
        parsed = JSON.parse(content);
    }
    catch (e) {
        return err('Invalid registry JSON - file may be corrupted');
    }
    if (!parsed || typeof parsed !== 'object') {
        return err('Registry must be a JSON object');
    }
    const obj = parsed;
    if (typeof obj.version !== 'string') {
        return err('Registry missing version field');
    }
    if (!obj.capabilities || typeof obj.capabilities !== 'object') {
        return err('Registry missing capabilities field');
    }
    return ok(parsed);
}
