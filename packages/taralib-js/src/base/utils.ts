const UUID4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validate UUID v4 format.
 */
export function isValidUuid4(id: string): boolean {
    return UUID4_REGEX.test(id);
}

/**
 * Prefix a string with current YYYYMM month.
 * Example: YYYYMM_prefix('foo') -> '202601-foo'
 */
export function YYYYMM_prefix(rest: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}${month}-${rest}`;
}
