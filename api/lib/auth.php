<?php
defined('APP') or exit;

const ROLE_RANK = ['viewer' => 1, 'editor' => 2, 'admin' => 3];
const SESSION_LIFETIME = 60 * 60 * 24 * 30; // stay signed in for 30 days, like an app

function start_session(): void
{
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    ini_set('session.gc_maxlifetime', (string)SESSION_LIFETIME);
    ini_set('session.use_strict_mode', '1');
    session_name('INVSESS');
    session_set_cookie_params([
        'lifetime' => SESSION_LIFETIME,
        'path' => '/',
        'secure' => $https,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
}

/**
 * Routes that may be called with the import key instead of a session: reading stores/catalog,
 * adding services, importing invoices and reading them back to verify. Nothing else.
 */
const IMPORT_KEY_ROUTES = [
    'GET stores', 'GET catalog/items', 'GET catalog/categories', 'POST catalog/items',
    'POST import/check', 'POST import', 'GET invoices',
];

/**
 * Automated imports send the "X-Import-Token" header. It must match config.php's import_token
 * (written by the deploy workflow from the IMPORT_TOKEN repository secret, at least 32 characters);
 * with no secret set the key is disabled. The request then acts as the first active admin.
 */
function import_key_user(): ?array
{
    $sent = (string)($_SERVER['HTTP_X_IMPORT_TOKEN'] ?? '');
    if ($sent === '') {
        return null;
    }
    // Why a sent key was refused, added to the 401 so a mis-set key can be told apart from a wrong one.
    $key = (string)(config()['import_token'] ?? '');
    $route = ($_SERVER['REQUEST_METHOD'] ?? 'GET') . ' ' . trim((string)($_GET['r'] ?? ''), '/');
    if (strlen($key) < 32) {
        $GLOBALS['import_key_refusal'] = $key === '' ? 'import key not set on the server' : 'import key on the server is shorter than 32 characters';
        return null;
    }
    if (!hash_equals($key, $sent)) {
        $GLOBALS['import_key_refusal'] = 'import key does not match';
        return null;
    }
    if (!in_array($route, IMPORT_KEY_ROUTES, true)) {
        $GLOBALS['import_key_refusal'] = 'import key is not allowed for this action';
        return null;
    }
    $id = scalar("SELECT id FROM users WHERE role = 'admin' AND is_active = 1 ORDER BY id LIMIT 1");
    return $id ? ['uid' => (int)$id] : null;
}

/** The signed-in user (fresh from the DB so role changes and deactivation apply immediately). */
function current_user(): ?array
{
    static $user = false;
    if ($user === false) {
        $user = null;
        $id = $_SESSION['uid'] ?? import_key_user()['uid'] ?? null;
        if ($id) {
            $row = one('SELECT id, username, display_name, role, is_active FROM users WHERE id = ?', [$id]);
            if ($row && (int)$row['is_active'] === 1) {
                $row['id'] = (int)$row['id'];
                $row['is_active'] = true;
                $row['store_ids'] = user_store_ids($row['id']);
                $user = $row;
            }
        }
    }
    return $user;
}

function user_store_ids(int $userId): array
{
    return array_map('intval', array_column(all('SELECT store_id FROM user_stores WHERE user_id = ?', [$userId]), 'store_id'));
}

function require_user(string $minRole = 'viewer'): array
{
    $u = current_user();
    if (!$u) {
        fail(401, 'يجب تسجيل الدخول', isset($GLOBALS['import_key_refusal']) ? ['import_key' => $GLOBALS['import_key_refusal']] : []);
    }
    if (ROLE_RANK[$u['role']] < ROLE_RANK[$minRole]) {
        fail(403, 'ليست لديك صلاحية لهذا الإجراء');
    }
    return $u;
}

/** Store ids the user may see, or null for "all stores". */
function allowed_stores(array $u): ?array
{
    return $u['role'] === 'admin' || !$u['store_ids'] ? null : $u['store_ids'];
}

function can_access_store(array $u, int $storeId): bool
{
    $allowed = allowed_stores($u);
    return $allowed === null || in_array($storeId, $allowed, true);
}

function assert_store_access(array $u, int $storeId): void
{
    if (!can_access_store($u, $storeId)) {
        fail(403, 'ليست لديك صلاحية على هذا المتجر');
    }
}

/** SQL fragment restricting a store_id column to the user's stores. */
function store_scope_sql(array $u, string $column): array
{
    $allowed = allowed_stores($u);
    if ($allowed === null) {
        return ['1=1', []];
    }
    return ["$column IN (" . placeholders($allowed) . ")", $allowed];
}

function login_throttled(): bool
{
    q('DELETE FROM login_attempts WHERE attempted_at < (NOW() - INTERVAL 1 DAY)');
    $n = (int)scalar(
        'SELECT COUNT(*) FROM login_attempts WHERE ip = ? AND attempted_at > (NOW() - INTERVAL 15 MINUTE)',
        [client_ip()]
    );
    return $n >= 10;
}

function log_activity(?array $u, string $action, string $entity, ?int $entityId, string $summary): void
{
    q(
        'INSERT INTO activity_log (user_id, action, entity, entity_id, summary) VALUES (?, ?, ?, ?, ?)',
        [$u['id'] ?? null, $action, $entity, $entityId, mb_substr($summary, 0, 255)]
    );
}
