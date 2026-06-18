// ==========================================
// 🛡️ RBAC MIDDLEWARE
// ==========================================
// Factory function returning an Express middleware that validates
// req.user.role against an explicit allowedRoles array.
//
// Usage:
//   router.get('/users', authMiddleware, rbac(['admin']), handler)
//   router.get('/orders', authMiddleware, rbac(['basico','premium','admin']), handler)
//
// Requires authMiddleware to run first (populates req.user from JWT).
// Terminates the request with 403 if the role is not in the allowed list.
//
// Complexity: O(1) — Array.includes on a small, bounded set of roles.

/**
 * @param {string[]} allowedRoles - Roles that may access the route
 * @returns {Function} Express middleware
 */
module.exports = function rbac(allowedRoles) {
    if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
        throw new Error('[rbac] allowedRoles must be a non-empty array of role strings.');
    }

    return (req, res, next) => {
        const role = req.user?.role;

        if (!role || !allowedRoles.includes(role)) {
            return res.status(403).json({
                error:   'Acesso negado: perfil insuficiente.',
                code:    'FORBIDDEN',
                required: allowedRoles,
                current:  role || null
            });
        }

        next();
    };
};
