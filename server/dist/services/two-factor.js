"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSecret = generateSecret;
exports.generateBackupCodes = generateBackupCodes;
exports.hashBackupCode = hashBackupCode;
exports.generateTOTP = generateTOTP;
exports.verifyTOTP = verifyTOTP;
exports.generateOtpauthUri = generateOtpauthUri;
const crypto_1 = __importDefault(require("crypto"));
// TOTP Configuration
const TOTP_DIGITS = 6;
const TOTP_PERIOD = 30; // seconds
const TOTP_WINDOW = 1; // Allow 1 period before/after for clock drift
/**
 * Generate a random base32 secret for TOTP
 */
function generateSecret() {
    const buffer = crypto_1.default.randomBytes(20);
    return base32Encode(buffer);
}
/**
 * Generate backup codes (8 codes, 8 characters each)
 */
function generateBackupCodes(count = 8) {
    const codes = [];
    for (let i = 0; i < count; i++) {
        const code = crypto_1.default.randomBytes(4).toString('hex').toUpperCase();
        // Format as XXXX-XXXX for readability
        codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
    }
    return codes;
}
/**
 * Hash a backup code for storage
 */
function hashBackupCode(code) {
    // Remove dashes and lowercase for comparison
    const normalizedCode = code.replace(/-/g, '').toUpperCase();
    return crypto_1.default.createHash('sha256').update(normalizedCode).digest('hex');
}
/**
 * Generate TOTP code for current time
 */
function generateTOTP(secret) {
    const counter = Math.floor(Date.now() / 1000 / TOTP_PERIOD);
    return generateHOTP(secret, counter);
}
/**
 * Verify TOTP code with window for clock drift
 */
function verifyTOTP(secret, code) {
    const counter = Math.floor(Date.now() / 1000 / TOTP_PERIOD);
    // Check current period and adjacent periods for clock drift
    for (let i = -TOTP_WINDOW; i <= TOTP_WINDOW; i++) {
        const expectedCode = generateHOTP(secret, counter + i);
        if (timingSafeEqual(code, expectedCode)) {
            return true;
        }
    }
    return false;
}
/**
 * Generate otpauth:// URI for authenticator apps
 */
function generateOtpauthUri(secret, email, issuer = 'Let\'s Vibe It') {
    const encodedIssuer = encodeURIComponent(issuer);
    const encodedEmail = encodeURIComponent(email);
    return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`;
}
// ============= Helper Functions =============
/**
 * Generate HOTP (counter-based OTP)
 */
function generateHOTP(secret, counter) {
    const decodedSecret = base32Decode(secret);
    const buffer = Buffer.alloc(8);
    // Write counter as big-endian 64-bit integer
    for (let i = 7; i >= 0; i--) {
        buffer[i] = counter & 0xff;
        counter = Math.floor(counter / 256);
    }
    // Create HMAC-SHA1
    const hmac = crypto_1.default.createHmac('sha1', decodedSecret);
    hmac.update(buffer);
    const digest = hmac.digest();
    // Dynamic truncation
    const offset = digest[digest.length - 1] & 0x0f;
    const binary = ((digest[offset] & 0x7f) << 24) |
        ((digest[offset + 1] & 0xff) << 16) |
        ((digest[offset + 2] & 0xff) << 8) |
        (digest[offset + 3] & 0xff);
    // Generate OTP
    const otp = binary % Math.pow(10, TOTP_DIGITS);
    return otp.toString().padStart(TOTP_DIGITS, '0');
}
/**
 * Base32 encoding (RFC 4648)
 */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Encode(buffer) {
    let result = '';
    let bits = 0;
    let value = 0;
    for (const byte of buffer) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            result += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
            bits -= 5;
        }
    }
    if (bits > 0) {
        result += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
    }
    return result;
}
function base32Decode(encoded) {
    const bytes = [];
    let bits = 0;
    let value = 0;
    for (const char of encoded.toUpperCase()) {
        const index = BASE32_ALPHABET.indexOf(char);
        if (index === -1)
            continue; // Skip invalid characters
        value = (value << 5) | index;
        bits += 5;
        if (bits >= 8) {
            bytes.push((value >>> (bits - 8)) & 0xff);
            bits -= 8;
        }
    }
    return Buffer.from(bytes);
}
/**
 * Timing-safe string comparison
 */
function timingSafeEqual(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return crypto_1.default.timingSafeEqual(bufA, bufB);
}
//# sourceMappingURL=two-factor.js.map