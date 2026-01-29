import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { useRoute } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { getDesignSystem } from '../utils/designSystem';

type LegalDocType = 'privacy' | 'terms';

// Import legal documents
const PRIVACY_POLICY = `# Privacy Policy for Smart Pantry AI

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

### Barcode and Product Data
- **Open Food Facts API** - For barcode product lookup
- **UPCitemdb API** - For additional barcode product lookup

### Error Tracking
- **Sentry** - For error monitoring and crash reporting

### Cloud Infrastructure
- **Google Cloud Platform (Cloud Run, Cloud SQL)** - For hosting our backend services

## Data Security

We implement appropriate security measures including:
- Password encryption using industry-standard hashing (bcrypt)
- HTTPS encryption for all data transmission
- Secure token-based authentication with refresh tokens
- Rate limiting to prevent abuse
- Regular security audits

## Your Rights

You have the right to:
- Access your personal data
- Correct inaccurate data
- Delete your account and all associated data
- Export your data

To exercise these rights, go to Settings > Account Management or contact support.

## Children's Privacy

Smart Pantry AI is not intended for users under the age of 13. We do not knowingly collect personal information from children under 13.

## Changes to This Privacy Policy

We may update this Privacy Policy from time to time. We will notify you of any changes by updating the "Last Updated" date and posting the new policy in the app.

## Contact Us

If you have questions about this Privacy Policy, please contact us through the app's Settings screen.

---

**Copyright © 2026 Smart Pantry AI. All rights reserved.**`;

const TERMS_OF_SERVICE = `# Terms of Service for Smart Pantry AI

**Last Updated:** January 25, 2026

## 1. Acceptance of Terms

By accessing or using Smart Pantry AI (the "App"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the App.

## 2. Description of Service

Smart Pantry AI is a mobile application that helps users:
- Track food inventory and expiration dates
- Scan product barcodes and labels
- Generate recipe suggestions using AI
- Manage multiple pantries
- Save and organize recipes

## 3. User Accounts

### Account Creation
- You must provide a valid email address and create a password
- You must be at least 13 years of age to use this App
- You are responsible for maintaining the security of your account

### Account Security
- Keep your password confidential
- Notify us immediately of any unauthorized access
- We are not liable for losses due to unauthorized account use

### Account Termination
- You may delete your account at any time through the Settings screen
- We reserve the right to suspend or terminate accounts that violate these Terms
- Upon termination, your data will be permanently deleted within 30 days

## 4. User Content

### Your Data
- You retain ownership of all data you input into the App
- You grant us a limited license to process your data to provide the service
- You are responsible for the accuracy of information you provide

### Acceptable Use
You agree NOT to:
- Upload illegal, harmful, or offensive content
- Attempt to hack, reverse engineer, or exploit the App
- Use the App for commercial purposes without permission
- Violate any applicable laws or regulations
- Spam or abuse the service with excessive requests

## 5. AI-Generated Content

### Recipe Generation
- Recipes are generated by AI and may not always be accurate
- We do not guarantee the safety, taste, or nutritional value of AI-generated recipes
- You are responsible for verifying recipe safety and suitability
- Follow proper food safety guidelines when cooking

### Product Information
- Barcode and OCR data may be inaccurate
- Always verify expiration dates and product information
- We are not liable for food safety issues or spoiled products

## 6. Disclaimer of Warranties

THE APP IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. YOU USE THE APP AT YOUR OWN RISK.

## 7. Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW:
- We are not liable for any indirect, incidental, or consequential damages
- We are not liable for food poisoning, allergic reactions, or health issues
- We are not liable for data loss, though we take reasonable precautions
- Our total liability shall not exceed the amount you paid us (currently $0)

## 8. Food Safety Disclaimer

**IMPORTANT:**
- Always verify expiration dates on physical products
- Follow proper food storage and handling guidelines
- Check for allergies before consuming AI-suggested recipes
- When in doubt, throw it out
- We are not responsible for foodborne illnesses

## 9. Privacy

Your use of the App is also governed by our Privacy Policy. By using the App, you consent to our collection and use of your data as described in the Privacy Policy.

## 10. Changes to Terms

We may modify these Terms at any time. We will notify you of material changes by updating the "Last Updated" date and posting a notice in the App.

Continued use after changes constitutes acceptance of the new Terms.

## 11. Contact Information

For questions about these Terms, contact us through the app's Settings screen.

---

## Summary (Plain English)

**What you can do:**
- Use the app to track your pantry and get recipe ideas
- Upload photos and scan barcodes
- Save and organize recipes
- Delete your account anytime

**What you can't do:**
- Be under 13 years old
- Upload illegal or harmful content
- Try to hack or abuse the service

**What we provide:**
- A tool to help manage your pantry
- AI-generated recipes (verify before cooking!)
- Barcode and OCR scanning

**What we don't guarantee:**
- 100% accurate expiration dates (always check!)
- Perfect recipes every time (AI makes mistakes)

**Important:**
- We're not liable if you get food poisoning (check expiration dates!)
- We're not liable if an AI recipe doesn't work out
- Your data is processed according to our Privacy Policy
- We can update these terms (we'll notify you)

**Your rights:**
- Delete your account and data anytime
- Contact us with questions or concerns
- Stop using the app if you disagree with terms

---

**Copyright © 2026 Smart Pantry AI. All rights reserved.**`;

export default function LegalScreen() {
  const route = useRoute();
  const { isDark } = useTheme();
  const ds = getDesignSystem(isDark);
  
  // @ts-expect-error - route params
  const docType: LegalDocType = route.params?.type || 'privacy';
  
  const content = docType === 'privacy' ? PRIVACY_POLICY : TERMS_OF_SERVICE;
  const title = docType === 'privacy' ? 'Privacy Policy' : 'Terms of Service';

  // Simple markdown-style rendering
  const renderContent = (text: string) => {
    const lines = text.split('\n');
    const elements: JSX.Element[] = [];
    
    lines.forEach((line, index) => {
      if (line.startsWith('# ')) {
        // H1 - Main title
        elements.push(
          <Text key={index} style={[styles.h1, { color: ds.colors.textPrimary }]}>
            {line.replace('# ', '')}
          </Text>
        );
      } else if (line.startsWith('## ')) {
        // H2 - Section title
        elements.push(
          <Text key={index} style={[styles.h2, { color: ds.colors.textPrimary, marginTop: index > 0 ? 24 : 0 }]}>
            {line.replace('## ', '')}
          </Text>
        );
      } else if (line.startsWith('### ')) {
        // H3 - Subsection
        elements.push(
          <Text key={index} style={[styles.h3, { color: ds.colors.textPrimary }]}>
            {line.replace('### ', '')}
          </Text>
        );
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        // Bullet point
        elements.push(
          <Text key={index} style={[styles.bullet, { color: ds.colors.textSecondary }]}>
            • {line.replace(/^[-*] /, '')}
          </Text>
        );
      } else if (line.startsWith('**') && line.endsWith('**')) {
        // Bold text
        elements.push(
          <Text key={index} style={[styles.bold, { color: ds.colors.textPrimary }]}>
            {line.replace(/\*\*/g, '')}
          </Text>
        );
      } else if (line.startsWith('---')) {
        // Divider
        elements.push(
          <View key={index} style={[styles.divider, { backgroundColor: ds.colors.border }]} />
        );
      } else if (line.trim() !== '') {
        // Regular paragraph
        elements.push(
          <Text key={index} style={[styles.paragraph, { color: ds.colors.textSecondary }]}>
            {line}
          </Text>
        );
      } else {
        // Empty line (spacing)
        elements.push(<View key={index} style={styles.spacing} />);
      }
    });
    
    return elements;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]} edges={['bottom']}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={true}
      >
        {renderContent(content)}
        
        {/* Bottom padding */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  h1: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 24,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  bullet: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
    paddingLeft: 8,
  },
  bold: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  divider: {
    height: 1,
    marginVertical: 20,
  },
  spacing: {
    height: 8,
  },
});
