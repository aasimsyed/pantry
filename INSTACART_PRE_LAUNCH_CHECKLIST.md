# Instacart Pre-Launch Checklist

Reference: [Instacart Pre-Launch Checklist](https://docs.instacart.com/developer_platform_api/guide/concepts/launch_activities/pre-launch_checklist). Complete these **before** requesting a Production API key.

---

## Pre-launch checklist (exact items)

| Instacart requirement | Done? | Evidence |
|------------------------|-------|----------|
| **All requests are formatted according to the Instacart Developer Platform API specification.** | **Yes** | `src/instacart_service.py`: Recipe requests use `POST /idp/v1/products/recipe` with `title`, `author`, `ingredients` (each with `name`, optional `display_text`, `measurements` with `quantity`/`unit`), `expires_in`, and optional `instructions`, `servings`, `cooking_time`, `landing_page_configuration`. Shopping list requests use `POST /idp/v1/products/products_link` with `title`, `link_type`, `line_items` (each with `name`, optional `display_text`, `quantity`, `unit`), `expires_in`. Headers: `Authorization: Bearer`, `Content-Type: application/json`. |
| **Error handling exists for all the implemented endpoints.** | **Yes** | `api/routers/instacart.py`: `GET /api/instacart/status` has no external call (only reads config), so no handler needed. `POST /api/instacart/recipe-link` and `POST /api/instacart/shopping-list-link` both catch `InstacartConfigError` → 503, `InstacartAPIError` → 502, and generic `Exception` → 500. Service layer (`instacart_service.py`) catches `httpx.TimeoutException` and `httpx.RequestError` and non-200 responses, and raises `InstacartAPIError` with message/status. |

---

## Done (implementation)

| Requirement | Status | Where |
|-------------|--------|--------|
| **Format requests per API spec** | Done | `src/instacart_service.py`: recipe payload (`title`, `author`, `ingredients` with `measurements`), shopping list payload (`title`, `line_items`); units and structure match IDP API. |
| **Error handling for all endpoints** | Done | `api/routers/instacart.py`: `/status`, `/recipe-link`, `/shopping-list-link` handle `InstacartConfigError` (503), `InstacartAPIError` (502), and generic `Exception` (500). Service layer catches timeouts and request errors. |
| **Recipe page API** | Done | `create_recipe_link()` → `POST /idp/v1/products/recipe` with optional instructions, servings, cooking_time, linkback. |
| **Shopping list API** | Done | `create_shopping_list_link()` → `POST /idp/v1/products/products_link` with line items. |
| **Branding** | Done | `InstacartLogo` (lockup), approved green/cashew colors, min 14px, clearspace; used on Recipe Detail. |
| **Privacy** | Done | Instacart called out in `PRIVACY_POLICY.md` (optional feature, user-triggered). |
| **Affiliate (optional)** | Ready | `_append_affiliate_params()` when `INSTACART_AFFILIATE_PARTNER_ID` is set; UTM format per Instacart docs. |

---

## Left (your actions)

| Item | Action |
|------|--------|
| **1. Enterprise Service Desk account** | Required before Production API key. Get invitation/set up at [Enterprise Service Desk](https://enterprise-servicedesk.instacart.com). See [Request technical support](https://docs.instacart.com/support/request_technical_support/). |
| **2. Terms & conditions** | **Done.** See [INSTACART_TERMS_COMPLIANCE.md](INSTACART_TERMS_COMPLIANCE.md) for a clause-by-clause review (data use, attribution, branding). Conclusion: compliant. |
| **3. Request Production API key** | After 1 and 2, request Production API key via Instacart (dashboard/process they provide). Keep using dev/sandbox URL and key until approved. |
| **4. (Optional) Linkback URL** | To show “Back to Smart Pantry” on Instacart recipe/shopping pages: set a public app or web URL and pass it as `linkback_url` from API to `create_recipe_link` / `create_shopping_list_link` (service already supports it; API models and mobile don’t pass it yet). |

---

## Suggested order

1. Create/verify Enterprise Service Desk account.  
2. ~~Review Developer Platform terms~~ (done; see [INSTACART_TERMS_COMPLIANCE.md](INSTACART_TERMS_COMPLIANCE.md)).  
3. Request Production API key.  
4. (Optional) Add linkback URL for better UX and “back to app” compliance.  
5. After approval, enable conversion tracking (Impact/affiliate) if desired.
