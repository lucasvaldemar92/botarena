const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');

const SALT_ROUNDS  = 10;
const TOKEN_EXPIRY = '8h';

const AuthService = {
    /**
     * Hash a plain-text password.
     * @param {string} plain
     * @returns {Promise<string>}
     */
    async hashPassword(plain) {
        return bcrypt.hash(plain, SALT_ROUNDS);
    },

    /**
     * Compare a plain-text password against a hash.
     * @param {string} plain
     * @param {string} hash
     * @returns {Promise<boolean>}
     */
    async comparePassword(plain, hash) {
        return bcrypt.compare(plain, hash);
    },

    /**
     * Sign a JWT with the given payload.
     * @param {object} payload
     * @returns {string}
     */
    generateToken(payload) {
        return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
    },

    /**
     * Verify and decode a JWT.
     * @param {string} token
     * @returns {object} decoded payload
     */
    verifyToken(token) {
        return jwt.verify(token, process.env.JWT_SECRET);
    },

    /**
     * Dev-Mock: Generate a token with a mock admin user.
     * Bypasses DB check — only available when NODE_ENV === 'development'.
     * @returns {string|null} token or null if not in dev mode
     */
    generateMockToken() {
        if (process.env.NODE_ENV !== 'development') return null;

        const mockPayload = {
            id:    1,
            role:  'admin',
            email: 'dev@botarena.local'
        };
        return jwt.sign(mockPayload, process.env.JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
    }
};

module.exports = AuthService;
