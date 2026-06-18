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
    },

    /**
     * Authenticate a user by email + password against the database.
     * On success, updates last_login_at and returns a signed JWT.
     *
     * @param {string} email
     * @param {string} password  - Plain-text password to compare
     * @param {object} userRepo  - UserRepository instance
     * @returns {Promise<{ token: string, user: object }>}
     * @throws {Error} with code 'INVALID_CREDENTIALS' or 'ACCOUNT_INACTIVE'
     */
    async login(email, password, userRepo) {
        if (!email || !password) {
            const err = new Error('E-mail e senha são obrigatórios.');
            err.code  = 'INVALID_CREDENTIALS';
            throw err;
        }

        const user = await userRepo.findByEmail(email);

        if (!user) {
            const err = new Error('Credenciais inválidas.');
            err.code  = 'INVALID_CREDENTIALS';
            throw err;
        }

        if (!user.is_active) {
            const err = new Error('Conta desativada. Contacte o administrador.');
            err.code  = 'ACCOUNT_INACTIVE';
            throw err;
        }

        const passwordMatch = await this.comparePassword(password, user.password_hash);
        if (!passwordMatch) {
            const err = new Error('Credenciais inválidas.');
            err.code  = 'INVALID_CREDENTIALS';
            throw err;
        }

        // Update last access timestamp (fire-and-forget, non-blocking)
        userRepo.touchLastLogin(user.id).catch(e =>
            console.error('⚠️ [AuthService] Failed to touch last_login_at:', e.message)
        );

        const payload = { id: user.id, role: user.role, email: user.email };
        const token   = this.generateToken(payload);

        return {
            token,
            user: { id: user.id, name: user.name, email: user.email, role: user.role }
        };
    }
};

module.exports = AuthService;
