# Instacart Developer Platform Terms – Compliance Review

**Reference:** [Instacart Developer Platform Terms and Conditions](https://docs.instacart.com/developer_platform_api/guide/terms_and_policies/developer_terms)  
**Review date:** January 2026  
**Conclusion:** Smart Pantry’s use of the Instacart API is compliant with the Agreement for **data use**, **attribution**, and **branding** as implemented today.

---

## 1. Purpose and use (Section 2.3, 3.1)

| Term | Requirement | Our implementation | Status |
|------|-------------|--------------------|--------|
| **Purpose** | Use API to (a) direct users to Instacart and/or (b) display Merchant Content with Developer Content. | We only **direct users** to Instacart: we send recipe/shopping list data to the API, receive a `products_link_url`, and open it in the Instacart app or web. We do not display Merchant Content (e.g. product catalog or prices) in our app. | **Compliant** |
| **Attribution** | Comply with attribution requirements (e.g. third party copyright notices). | We use the **official full-color Instacart logo** (`instacart-carrot.png`) inside the approved `InstacartCTAButton` with approved CTA text ("Shop ingredients", "Shop on Instacart"). We do not remove or obscure any Instacart Marks or notices. The API does not return copyright text for us to display. | **Compliant** |

---

## 2. Data use and restrictions (Section 3.5, 9)

| Term | Requirement | Our implementation | Status |
|------|-------------|--------------------|--------|
| **Data sent** | Request only the minimum data needed (3.5(o)). | We send only **Developer Content**: recipe title, ingredient names, quantities, units, and optional instructions/servings/cook time for recipe links; item names/quantities/units for shopping list links. No PII of end users is sent to Instacart. | **Compliant** |
| **Data received** | No misuse of Instacart Data or Merchant Content. | We receive only **products_link_url** and optional **expires_at**. We do not receive or store Instacart Data (e.g. Covered PI). We do not build user profiles or target users from API interactions (3.5(r)). | **Compliant** |
| **No resale/transfer** (3.5(c)) | Do not sell, lease, share, or transfer Instacart Materials/Merchant Content. | We do not share API responses with third parties; we use the URL only to open Instacart for the user. | **Compliant** |
| **No improper use** (3.5(d),(e),(j),(k),(l),(n)) | No scraping, replicating Instacart, multi-retailer pricing on same screen, moving items between retailer baskets, or primary purpose to migrate users off Instacart. | We do none of these; our integration sends users **to** Instacart for checkout. | **Compliant** |
| **Privacy** (Section 9) | If processing Covered PI, comply with Privacy Addendum and Privacy Laws. | We do **not** process Covered PI from Instacart. We disclose in [PRIVACY_POLICY.md](PRIVACY_POLICY.md) that ingredient names/quantities are sent to Instacart when the user explicitly triggers the feature, and link to Instacart’s privacy policy. | **Compliant / N/A** |

---

## 3. Branding and Instacart Marks (Section 5.1, Instacart Marks Guidelines)

| Term | Requirement | Our implementation | Status |
|------|-------------|--------------------|--------|
| **Marks usage** | Use Instacart Marks only to indicate compatibility with Instacart; use in strict compliance with Instacart Marks Guidelines. | We use the **official logo lockup** (symbol + wordmark) from approved assets. | **Compliant** |
| **Logo** | Per [Design – Logos](https://docs.instacart.com/developer_platform_api/guide/concepts/design/logos/): use most recent logos from Instacart_logos.zip. | We use `instacart-carrot.png` at 22px, full color and unmodified, per the [CTA design](https://docs.instacart.com/developer_platform_api/guide/concepts/design/cta_design) spec. | **Compliant** |
| **Colors** | Use approved colors. | CTA uses the **Dark** theme: background `#003D29`, text `#FAF1E5`. | **Compliant** |
| **Notices** (3.5(b)) | Do not remove legal, copyright, trademark, or other proprietary notices. | We do not remove or alter any Instacart notices; we add clear Instacart attribution (logo + “Shop on Instacart”–style CTAs). | **Compliant** |

---

## 4. Security and confidentiality (Sections 3.3, 7, 8)

| Term | Requirement | Our implementation | Status |
|------|-------------|--------------------|--------|
| **API key** | Do not share API Key; protect Developer Account. | API key is stored in environment variables (e.g. `INSTACART_API_KEY`), not in code or client. Not shared with third parties. | **Compliant** |
| **Confidential Information** | Protect and do not disclose Confidential Information. | We do not receive Instacart confidential data (we receive only link URLs). API key and config are server-side only. | **Compliant** |
| **Security incident** (8.4) | Notify Instacart of unauthorized access/disclosure (security-incidents@instacart.com, legal@instacart.com). | Process: if we become aware of unauthorized access to API key or Instacart-related data, we will notify per Section 8.4. | **Acknowledged** |

---

## 5. Other incorporated terms

- **Instacart Privacy Policy / Instacart Terms:** We do not display Instacart’s consumer-facing terms or privacy policy in-app; we link to Instacart’s privacy policy in our [PRIVACY_POLICY.md](PRIVACY_POLICY.md) for the shopping integration.
- **Developer Guidelines / RMF:** We use the API only for creating recipe and shopping list links and direct users to Instacart for checkout; we do not bypass API restrictions or use alternative checkout (3.5(r)).

---

## Summary

- **Data use:** We send only Developer Content (recipe/shopping list data) and receive only link URLs; no Instacart Data or Covered PI is stored or used for profiling/targeting. Disclosed in our privacy policy.
- **Attribution:** We use the official Instacart logo lockup and clear “Shop on Instacart”–style CTAs; we do not remove any Instacart notices.
- **Branding:** We follow Instacart Marks and design guidance (lockup, minimum size, approved colors).

**No changes required** for current data use, attribution, or branding to meet the reviewed terms. When Instacart updates the Agreement or Guidelines, this review should be re-checked.
