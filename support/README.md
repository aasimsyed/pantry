# Smart Pantry AI - Support Website

Minimal support website with contact form for Smart Pantry AI.

## Features

- Clean, minimal design matching the app aesthetic
- Contact form with validation
- Quick links to Privacy Policy, Terms of Service, and GitHub
- Serverless contact form handler
- Mobile responsive

## Local Development

```bash
cd support
npm run dev
# Open http://localhost:3000
```

## Deploy to Vercel

### First Time Setup:

```bash
cd support
vercel
# Follow prompts to link to your Vercel account
```

### Subsequent Deploys:

```bash
npm run deploy
```

Or use GitHub integration for automatic deploys.

## Email Integration

The contact form currently logs submissions. To enable email delivery:

1. Choose an email service:
   - **Resend** (recommended, simple): https://resend.com
   - **SendGrid**: https://sendgrid.com
   - **AWS SES**: For production scale

2. Add API key to Vercel environment variables:
   ```bash
   vercel env add SENDGRID_API_KEY
   # or
   vercel env add RESEND_API_KEY
   ```

3. Update `api/contact.js` with your preferred service integration

### Example: Resend Integration

```bash
npm install resend
```

```javascript
// api/contact.js
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  // ... validation ...
  
  await resend.emails.send({
    from: 'support@yourdomain.com',
    to: 'aasim.ss@gmail.com',
    replyTo: email,
    subject: `Support: ${subject}`,
    html: `<p><strong>From:</strong> ${name} (${email})</p><p>${message}</p>`,
  });
  
  return res.status(200).json({ success: true });
}
```

## URLs

After deployment, update these in your app:

- `mobile/app.json`: `supportUrl: "https://support.smartpantryai.com"`
- App Store Connect: Support URL field

## Custom Domain

1. Add domain in Vercel dashboard
2. Update DNS with Vercel's records
3. SSL is automatic
