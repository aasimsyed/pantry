#!/usr/bin/env python3
"""
Test SMTP email configuration.
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.email_service import email_service

def test_email():
    """Test sending an email."""
    print("=" * 60)
    print("Email Configuration Test")
    print("=" * 60)
    print()
    
    # Print configuration
    print("SMTP Configuration:")
    print(f"  Host: {email_service.smtp_host}")
    print(f"  Port: {email_service.smtp_port}")
    print(f"  Username: {email_service.smtp_username}")
    print(f"  Password: {'*' * 8 if email_service.smtp_password else 'NOT SET'}")
    print(f"  From Email: {email_service.from_email}")
    print(f"  From Name: {email_service.from_name}")
    print()
    
    if not email_service.smtp_username or not email_service.smtp_password:
        print("❌ SMTP credentials not configured!")
        print("   Check your .env file for SMTP_USERNAME and SMTP_PASSWORD")
        sys.exit(1)
    
    # Test email
    test_email = input("Enter test email address (default: aasim.ss@gmail.com): ").strip()
    if not test_email:
        test_email = "aasim.ss@gmail.com"
    
    print()
    print(f"Sending test email to {test_email}...")
    print()
    
    try:
        # Send test password reset email
        success = email_service.send_password_reset_email(
            test_email,
            "test-token-12345"
        )
        
        if success:
            print("✅ Email sent successfully!")
            print()
            print("Check your inbox (and spam folder) for the test email.")
        else:
            print("❌ Email sending failed!")
            print()
            print("Check the error messages above for details.")
            
    except Exception as e:
        print(f"❌ Error sending email: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    test_email()
