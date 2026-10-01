# WCAG 2.1 Level AA – Automated Test Mapping

This document maps each **WCAG 2.1 Level A and AA** success criterion to the **fully automated** a11y suite: **Automated** (tested by the suite) or **N/A** (not automatable; requires human judgment or design review).

Certification is based **only on automated results**. All automatable criteria are tested; N/A criteria are documented for reference.

---

## Automated criteria (tested by the suite)

| Criterion | Name | How tested |
|-----------|------|------------|
| **1.4.3** | Contrast (Minimum) (AA) | Apple performAccessibilityAudit – Contrast |
| **1.4.4** | Resize Text (AA) | Apple audit – Dynamic Type, Text Clipped |
| **1.4.10** | Reflow (AA) | Apple audit – Text Clipped / Dynamic Type |
| **1.4.11** | Non-text Contrast (AA) | Apple audit – Contrast (UI components) |
| **2.4.2** | Page Titled (A) | E2E – each screen has title (we only audit after title is present) |
| **2.4.4** | Link Purpose (A) | Apple audit – Sufficient Element Description |
| **2.4.6** | Headings and Labels (AA) | Apple audit – Sufficient Element Description, Trait |
| **2.5.3** | Label in Name (A) | Apple audit – Sufficient Element Description |
| **3.3.1** | Error Identification (A) | E2E – Login: submit empty, assert error text present (login-error) |
| **3.3.2** | Labels or Instructions (A) | Apple audit – Sufficient Element Description |
| **4.1.2** | Name, Role, Value (A) | Apple audit – Trait, Sufficient Element Description |

---

## N/A criteria (not automatable)

These require human judgment, design review, or one-off verification. The suite reports them as **N/A**; they are not required for the automated certification.

**Perceivable:** 1.1.1, 1.2.x, 1.3.2, 1.3.3, 1.3.4, 1.3.5, 1.4.1, 1.4.2, 1.4.5, 1.4.12, 1.4.13  
**Operable:** 2.1.1, 2.1.2, 2.2.1, 2.2.2, 2.3.1, 2.4.1, 2.4.3, 2.4.5, 2.4.7, 2.5.1, 2.5.2, 2.5.4  
**Understandable:** 3.1.1, 3.1.2, 3.2.1, 3.2.2, 3.2.3, 3.2.4, 3.3.3, 3.3.4  
**Robust:** 4.1.1, 4.1.3  

Reference: [WCAG 2.1 Quick Reference (Level AA)](https://www.w3.org/WAI/WCAG21/quickref/?currentsidebar=%23col_customize&level=aa).
