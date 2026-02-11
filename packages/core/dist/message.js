/**
 * SIWA Message Creation and Parsing
 */
const SIWA_VERSION = '1';
/**
 * Generate a cryptographically secure nonce using rejection sampling
 * to avoid modulo bias.
 */
export function generateNonce(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const maxValid = 256 - (256 % chars.length); // 248 for 62 chars - reject >= 248
    const result = [];
    while (result.length < length) {
        const array = new Uint8Array(length - result.length);
        crypto.getRandomValues(array);
        for (const byte of array) {
            if (byte < maxValid && result.length < length) {
                result.push(chars[byte % chars.length]);
            }
        }
    }
    return result.join('');
}
/**
 * Validate a domain string
 */
function isValidDomain(domain) {
    if (!domain || domain.length > 253)
        return false;
    // Allow localhost for development
    if (domain === 'localhost')
        return true;
    // Basic domain validation - alphanumeric, hyphens, dots
    return /^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$/.test(domain);
}
/**
 * Validate a Solana base58 address (32-44 chars, base58 alphabet)
 */
function isValidSolanaAddress(address) {
    if (!address || address.length < 32 || address.length > 44)
        return false;
    return /^[1-9A-HJ-NP-Za-km-z]+$/.test(address);
}
/**
 * Create a SIWA message object with defaults
 */
export function createMessage(params) {
    // Validate domain
    if (!isValidDomain(params.domain)) {
        throw new Error('Invalid domain format');
    }
    // Validate URI
    try {
        new URL(params.uri);
    }
    catch {
        throw new Error('Invalid URI format');
    }
    // Validate address
    if (!isValidSolanaAddress(params.address)) {
        throw new Error('Invalid Solana address format');
    }
    const now = new Date();
    const expirationMinutes = params.expirationMinutes ?? 5;
    const expiresAt = new Date(now.getTime() + expirationMinutes * 60 * 1000);
    return {
        domain: params.domain,
        address: params.address,
        uri: params.uri,
        version: SIWA_VERSION,
        chainId: params.chainId ?? 'mainnet-beta',
        nonce: params.nonce ?? generateNonce(),
        issuedAt: now.toISOString(),
        expirationTime: expiresAt.toISOString(),
        statement: params.statement,
        resources: params.resources,
        requestId: params.requestId,
    };
}
/**
 * Serialize a SIWA message to the standard string format
 */
export function serializeMessage(message) {
    const lines = [];
    // Header
    lines.push(`${message.domain} wants you to sign in with your Solana account:`);
    lines.push(message.address);
    // Statement (optional)
    if (message.statement) {
        lines.push('');
        lines.push(message.statement);
    }
    // Blank line before fields
    lines.push('');
    // Required fields
    lines.push(`URI: ${message.uri}`);
    lines.push(`Version: ${message.version}`);
    lines.push(`Chain ID: ${message.chainId}`);
    lines.push(`Nonce: ${message.nonce}`);
    lines.push(`Issued At: ${message.issuedAt}`);
    // Optional fields
    if (message.expirationTime) {
        lines.push(`Expiration Time: ${message.expirationTime}`);
    }
    if (message.notBefore) {
        lines.push(`Not Before: ${message.notBefore}`);
    }
    if (message.requestId) {
        lines.push(`Request ID: ${message.requestId}`);
    }
    // Resources
    if (message.resources && message.resources.length > 0) {
        lines.push('Resources:');
        for (const resource of message.resources) {
            lines.push(`- ${resource}`);
        }
    }
    return lines.join('\n');
}
/**
 * Parse a SIWA message string back into a message object
 */
export function parseMessage(text) {
    const lines = text.split('\n');
    // Parse header
    const headerMatch = lines[0]?.match(/^(.+) wants you to sign in with your Solana account:$/);
    if (!headerMatch) {
        throw new Error('Invalid SIWA message: missing header');
    }
    const domain = headerMatch[1];
    // Parse address (line 2)
    const address = lines[1]?.trim();
    if (!address) {
        throw new Error('Invalid SIWA message: missing address');
    }
    // Find statement (between address and URI)
    let statement;
    let fieldStartIndex = 2;
    for (let i = 2; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('URI:')) {
            fieldStartIndex = i;
            break;
        }
        if (line.trim() && !statement) {
            statement = line.trim();
        }
    }
    // Parse fields
    const fields = {};
    const resources = [];
    let inResources = false;
    for (let i = fieldStartIndex; i < lines.length; i++) {
        const line = lines[i];
        if (line === 'Resources:') {
            inResources = true;
            continue;
        }
        if (inResources && line.startsWith('- ')) {
            resources.push(line.slice(2));
            continue;
        }
        const fieldMatch = line.match(/^([^:]+):\s*(.+)$/);
        if (fieldMatch) {
            fields[fieldMatch[1]] = fieldMatch[2];
            inResources = false;
        }
    }
    // Validate required fields
    const required = ['URI', 'Version', 'Chain ID', 'Nonce', 'Issued At'];
    for (const field of required) {
        if (!fields[field]) {
            throw new Error(`Invalid SIWA message: missing ${field}`);
        }
    }
    return {
        domain,
        address,
        statement,
        uri: fields['URI'],
        version: fields['Version'],
        chainId: fields['Chain ID'],
        nonce: fields['Nonce'],
        issuedAt: fields['Issued At'],
        expirationTime: fields['Expiration Time'],
        notBefore: fields['Not Before'],
        requestId: fields['Request ID'],
        resources: resources.length > 0 ? resources : undefined,
    };
}
/**
 * Validate message timing (not expired, not before)
 */
export function validateTiming(message) {
    const now = new Date();
    if (message.expirationTime) {
        const expiration = new Date(message.expirationTime);
        if (now > expiration) {
            return { valid: false, error: 'Message has expired' };
        }
    }
    if (message.notBefore) {
        const notBefore = new Date(message.notBefore);
        if (now < notBefore) {
            return { valid: false, error: 'Message not yet valid' };
        }
    }
    // Check issued at isn't too far in the future (clock skew tolerance: 5 min)
    const issuedAt = new Date(message.issuedAt);
    const maxSkew = 5 * 60 * 1000;
    if (issuedAt.getTime() > now.getTime() + maxSkew) {
        return { valid: false, error: 'Message issued in the future' };
    }
    return { valid: true };
}
//# sourceMappingURL=message.js.map