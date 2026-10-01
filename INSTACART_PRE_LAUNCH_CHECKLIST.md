# Instacart Pre-Launch Checklist

Reference: [Instacart Pre-Launch Checklist](https://docs.instacart.com/developer_platform_api/guide/concepts/launch_activities/pre-launch_checklist). Complete these **before** requesting a Production API key.

**Process:** request a Production key in the [Developer Dashboard](https://dashboard.instacart.com/). Instacart replies within 5 business days asking for a demo. If the demo meets the integration requirements the key is approved; otherwise revise and resubmit. After approval you receive an Impact.com affiliate invite.

---

## Integration requirements

| Instacart requirement | Done? | Evidence |
|------------------------|-------|----------|
| **Use the Platform API and link to Instacart landing pages.** | **Yes** | `src/instacart_service.py`: `POST /idp/v1/products/recipe` and `POST /idp/v1/products/products_link`; the app opens the returned `products_link_url`. |
| **Approved CTA text: "Shop ingredients" or "Shop on Instacart".** | **Yes** | `InstacartCTAButton` restricts `label` to those two strings. Recipe Detail: "Shop ingredients". Inventory: "Shop on Instacart". |
| **Approved CTA theme with exact hex codes.** | **Yes** | Dark theme: background `#003D29`, text `#FAF1E5`. |
| **CTA 46px tall, 29.5px border radius, 22px full-color logo.** | **Yes** | `mobile/src/components/InstacartCTAButton.tsx`, logo `instacart-carrot.png`. |
| **Logo in full color, unmodified, unrotated, on an approved background.** | **Yes** | Full-color carrot on the Dark CTA background. |
| **Logo used only to indicate an integration.** | **Yes** | Logo appears only inside the CTA; not paired with the Smart Pantry logo or used in marketing. |

## Customer-facing copy

| Must not appear | Done? |
|-----------------|-------|
| "Free Delivery" | **Yes** (not used) |
| "Partner" / "Partnership" describing Instacart | **Yes** (not used) |
| "Instacart delivers" or similar phrasings | **Yes** (not used) |
| Delivery speed references | **Yes** (not used) |

## API implementation

| Item | Done? | Evidence |
|------|-------|----------|
| Requests formatted per API spec | **Yes** | Recipe ingredients use `measurements`; shopping list items use `line_item_measurements`. Headers: `Authorization: Bearer`, `Content-Type` and `Accept: application/json`. |
| Error handling for all endpoints | **Yes** | `api/routers/instacart.py`: `InstacartConfigError` → 503, `InstacartAPIError` → 502, other exceptions → 500. Service layer handles timeouts, request errors, and non-200 responses. |
| Key matches host | **Yes** | `INSTACART_ENVIRONMENT` (`development` default) selects `connect.dev.instacart.tools` or `connect.instacart.com`. |
| Affiliate tracking | **Yes** | No manual UTM params; Instacart appends them to `products_link_url` once Impact is linked. |

---

## Left (your actions)

| Item | Action |
|------|--------|
| **1. Sandbox test** | With the development key on Cloud Run, tap both CTAs, check ingredient matching, and save one landing page URL. |
| **2. Demo recording** | Show the flow leading to the CTA, a tap on the CTA, and the Instacart landing page. Include the saved landing page URL. |
| **3. Request Production key** | Dashboard → API Keys → Create New API Key → Production. Wait for Instacart's demo request. |
| **4. Production cutover** | After approval, set `INSTACART_API_KEY` (production key) and `INSTACART_ENVIRONMENT=production` on Cloud Run. |
| **5. Impact affiliate** | Accept the invite using the same email and company name as the Developer Platform account. After 24-48h, confirm `utm_*` params appear once in returned links. |
| **6. Public announcements (optional)** | Only after approval; submit to Instacart at least 5 business days ahead. See [Developer messaging](https://docs.instacart.com/developer_platform_api/guide/terms_and_policies/developer_messaging). |
