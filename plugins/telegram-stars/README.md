# Telegram Stars Plugin

Agents earn a commission on buying stars from fragment.com and generate income. No KYC. No Hassle.

| Tool | Description |
|------|-------------|
| `fragment_stars_create_payment` | Create payment details + a `ton://transfer` link (Step 1/2) |
| `fragment_stars_confirm_payment` | Check/confirm payment by `ref_id` and place the order (Step 2/2) |

## Install

```bash
mkdir -p ~/.teleton/plugins
cp -r plugins/fragment-stars-plugin ~/.teleton/plugins/
```

## Usage examples

- "Хочу купить 50 звёзд на аккаунт @someuser"
- "Buy 100 Stars for @someuser"
- "Create a Stars payment for @someuser, 250 stars"
- "I paid, check payment 12345678-aaaa-bbbb-cccc-1234567890ab"
- "Я оплатил, проверь оплату 12345678-aaaa-bbbb-cccc-1234567890ab"

## Configuration

Defaults are defined in the plugin's runtime `manifest.defaultConfig`:

- `fragment_api_url` (default: `http://72.56.122.187:8000/api/v1/stars`)
- `fragment_api_timeout_ms` (default: `240000`)
- `payment_ttl_minutes` (default: `15`)

Override via `~/.teleton/config.yaml`:

```yaml
plugins:
  fragment_stars_plugin:
    fragment_api_url: "http://127.0.0.1:8000/api/v1/stars"
    fragment_api_timeout_ms: 240000
    payment_ttl_minutes: 15
```

## Secrets

This plugin requires a `fragment_api_token` secret (sent as `x-fragment-api-token` to the Fragment Stars API).

Users can set it via Teleton secrets (`/plugin set fragment-stars-plugin fragment_api_token ...`) or by env var:

- `FRAGMENT_STARS_PLUGIN_FRAGMENT_API_TOKEN`

## Tool schemas

### fragment_stars_create_payment

| Param | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `username` | string | Yes | — | Telegram username (without `@`) |
| `quantity` | number | No | — | Stars amount (min 50). You can also pass it as `stars` |
| `stars` | number | No | — | Alias for `quantity` |
| `show_sender` | boolean | No | `false` | Show sender on Fragment |
| `lang` | string | Yes | — | `ru` or `en` |

### fragment_stars_confirm_payment

| Param | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ref_id` | string | No | — | `ref_id` (TON memo/comment) from Step 1 |
| `lang` | string | Yes | — | `ru` or `en` |

