/**
 * Generate a random base32 secret for TOTP
 */
export declare function generateSecret(): string;
/**
 * Generate backup codes (8 codes, 8 characters each)
 */
export declare function generateBackupCodes(count?: number): string[];
/**
 * Hash a backup code for storage
 */
export declare function hashBackupCode(code: string): string;
/**
 * Generate TOTP code for current time
 */
export declare function generateTOTP(secret: string): string;
/**
 * Verify TOTP code with window for clock drift
 */
export declare function verifyTOTP(secret: string, code: string): boolean;
/**
 * Generate otpauth:// URI for authenticator apps
 */
export declare function generateOtpauthUri(secret: string, email: string, issuer?: string): string;
//# sourceMappingURL=two-factor.d.ts.map