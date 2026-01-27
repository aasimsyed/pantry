# Privacy Policy for Smart Pantry AI

**Last Updated:** January 25, 2026

## Introduction

Smart Pantry AI ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application.

## Information We Collect

### Account Information
- Email address
- Password (encrypted)
- Full name (optional)

### Usage Data
- Pantry inventory items (product names, quantities, expiration dates, storage locations)
- Photos you upload (product labels, receipts)
- Recipes you save or generate
- User preferences and settings

### Camera and Photo Library
- We access your camera to scan barcodes and product labels
- We access your photo library when you choose to upload product photos
- These images are processed to extract product information using OCR and AI

### Automatically Collected Information
- Device information (OS version, app version)
- Usage analytics and error logs (via Sentry)
- API request logs for debugging and security

## How We Use Your Information

We use your information to:
- Provide and maintain the Smart Pantry AI service
- Process and store your pantry inventory
- Generate recipe recommendations based on your inventory
- Scan and identify products from photos and barcodes
- Send notifications about expiring items
- Improve our services and user experience
- Detect and prevent fraud or security issues

## Third-Party Services

We use the following third-party services:

### AI Services
- **OpenAI (GPT models)** - For recipe generation and product identification
- **Anthropic (Claude models)** - Alternative AI provider for recipe generation
- Usage: Your inventory data and photos may be sent to these services to generate recipes and analyze product information
- Privacy: These services process data according to their privacy policies

### Barcode and Product Data
- **Open Food Facts API** - For barcode product lookup
- **UPCitemdb API** - For additional barcode product lookup
- Usage: Barcode data is sent to these services to retrieve product information

### Error Tracking
- **Sentry** - For error monitoring and crash reporting
- Usage: Error logs and diagnostic information

### Cloud Infrastructure
- **Google Cloud Platform (Cloud Run, Cloud SQL)** - For hosting our backend services
- **PostgreSQL** - For database storage

## Data Security

We implement appropriate security measures including:
- Password encryption using industry-standard hashing (bcrypt)
- HTTPS encryption for all data transmission
- Secure token-based authentication with refresh tokens
- Rate limiting to prevent abuse
- Regular security audits

## Data Retention

- Account data is retained as long as your account is active
- You can delete individual inventory items, recipes, or your entire account at any time
- Deleted data is permanently removed from our systems

## Your Rights

You have the right to:
- Access your personal data
- Correct inaccurate data
- Delete your account and all associated data
- Export your data
- Opt-out of analytics tracking

To exercise these rights, contact us at **aasim.ss@gmail.com**

## Children's Privacy

Smart Pantry AI is not intended for users under the age of 13. We do not knowingly collect personal information from children under 13.

## Changes to This Privacy Policy

We may update this Privacy Policy from time to time. We will notify you of any changes by updating the "Last Updated" date and posting the new policy in the app.

## International Data Transfers

Your data may be processed and stored in the United States or other countries where our service providers operate. By using Smart Pantry AI, you consent to the transfer of your data to these locations.

## Data Sharing

We do NOT:
- Sell your personal information to third parties
- Share your data with advertisers
- Use your data for marketing purposes without consent

We MAY share data:
- With service providers who help us operate the app (cloud hosting, AI services)
- When required by law or to protect our legal rights
- In connection with a business transfer (merger, acquisition)

## Contact Us

If you have questions about this Privacy Policy, please contact:

**Email:** aasim.ss@gmail.com  
**Website:** https://github.com/aasimsyed/pantry

## Consent

By using Smart Pantry AI, you consent to this Privacy Policy and agree to its terms.

---

## Technical Details for Transparency

### Data Processing Locations
- Backend: Google Cloud Run (us-south1 region)
- Database: Google Cloud SQL (PostgreSQL)
- AI Processing: OpenAI/Anthropic APIs

### Encryption
- Data in transit: TLS 1.2+
- Data at rest: Encrypted database storage
- Passwords: bcrypt hashing with salt

### Permissions Explained
- **Camera:** Required to scan barcodes and product labels for inventory management
- **Photo Library:** Optional, allows you to upload existing photos of products
- **Notifications:** Optional, to alert you about expiring items (future feature)

### Data Deletion
To delete your account and all data:
1. Open the app
2. Go to Settings
3. Scroll to "Account Management"
4. Tap "Delete Account"
5. Confirm deletion

All your data will be permanently deleted within 30 days.
