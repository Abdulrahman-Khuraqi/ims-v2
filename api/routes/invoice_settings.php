<?php
defined('APP') or exit;

const INVOICE_LOGO_MAX_BYTES = 400000; // data URL length; plenty for an SVG or a resized PNG

/** Invoice template of every store the user can see. Stores without saved settings get empty defaults. */
function invoice_settings_list(): void
{
    $u = require_user();
    [$scope, $params] = store_scope_sql($u, 's.id');
    $rows = all(
        "SELECT s.id AS store_id, s.name AS store_name, s.color AS store_color, s.website,
                t.logo, t.seal, t.legal_name, t.tax_number, t.cr_number, t.address, t.phone, t.email,
                t.accent_color, COALESCE(t.vat_rate, 0) AS vat_rate, t.footer_note
         FROM stores s LEFT JOIN store_invoice_settings t ON t.store_id = s.id
         WHERE $scope ORDER BY s.is_active DESC, s.sort, s.id",
        $params
    );
    foreach ($rows as &$r) {
        $r['store_id'] = (int)$r['store_id'];
        $r['vat_rate'] = (float)$r['vat_rate'];
    }
    json_out(['settings' => $rows]);
}

/** An image sent as a data: URL (PNG, JPEG, WebP or SVG); empty means none. */
function invoice_image_in($v, string $label): ?string
{
    if ($v === '' || $v === null) {
        return null;
    }
    if (!is_string($v) || !preg_match('#^data:image/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$#', $v)) {
        fail(422, "$label يجب أن يكون صورة PNG أو JPG أو WebP أو SVG");
    }
    if (strlen($v) > INVOICE_LOGO_MAX_BYTES) {
        fail(422, "حجم $label كبير، استخدم صورة أصغر من 300 كيلوبايت");
    }
    return $v;
}

function invoice_settings_save(string $storeId): void
{
    $u = require_user('admin');
    $store = find_store((int)$storeId);
    $b = body();

    $logo = invoice_image_in($b['logo'] ?? null, 'الشعار');
    $seal = invoice_image_in($b['seal'] ?? null, 'الختم');

    $email = str_in($b['email'] ?? null, 160);
    if ($email !== null && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        fail(422, 'البريد الإلكتروني غير صحيح');
    }
    $vat = money_in($b['vat_rate'] ?? null) ?? 0.0;
    if ($vat < 0 || $vat > 100) {
        fail(422, 'نسبة الضريبة يجب أن تكون بين 0 و 100');
    }
    $accent = ($b['accent_color'] ?? '') === '' ? null : color_in($b['accent_color'], $store['color']);

    q(
        'INSERT INTO store_invoice_settings
            (store_id, logo, seal, legal_name, tax_number, cr_number, address, phone, email, accent_color, vat_rate, footer_note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE logo = VALUES(logo), seal = VALUES(seal), legal_name = VALUES(legal_name), tax_number = VALUES(tax_number),
            cr_number = VALUES(cr_number), address = VALUES(address), phone = VALUES(phone), email = VALUES(email),
            accent_color = VALUES(accent_color), vat_rate = VALUES(vat_rate), footer_note = VALUES(footer_note)',
        [
            (int)$storeId, $logo, $seal,
            str_in($b['legal_name'] ?? null, 160),
            str_in($b['tax_number'] ?? null, 40),
            str_in($b['cr_number'] ?? null, 40),
            str_in($b['address'] ?? null, 255),
            str_in($b['phone'] ?? null, 40),
            $email, $accent, $vat,
            str_in($b['footer_note'] ?? null, 500),
        ]
    );
    log_activity($u, 'update', 'store', (int)$storeId, 'تعديل إعدادات فاتورة: ' . $store['name']);
    json_out(['ok' => true]);
}
