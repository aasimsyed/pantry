"""
Email service for sending transactional emails via SMTP.
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import logging

from src.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """Service for sending emails via SMTP."""
    
    def __init__(self):
        self.smtp_host = settings.smtp_host
        self.smtp_port = settings.smtp_port
        self.smtp_username = settings.smtp_username
        self.smtp_password = settings.smtp_password
        self.from_email = settings.smtp_from_email or settings.smtp_username
        self.from_name = settings.smtp_from_name
        self.frontend_url = settings.frontend_url
        
        if not self.smtp_username or not self.smtp_password:
            logger.warning('SMTP credentials not configured. Email sending will fail.')
    
    def send_email(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: Optional[str] = None
    ) -> bool:
        """
        Send an email via SMTP.
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            html_body: HTML email body
            text_body: Plain text email body (fallback)
        
        Returns:
            True if email sent successfully, False otherwise
        """
        if not self.smtp_username or not self.smtp_password:
            logger.error('Cannot send email: SMTP credentials not configured')
            return False
        
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f'{self.from_name} <{self.from_email}>'
            msg['To'] = to_email
            
            # Add text and HTML parts
            if text_body:
                msg.attach(MIMEText(text_body, 'plain'))
            msg.attach(MIMEText(html_body, 'html'))
            
            # Send email
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_username, self.smtp_password)
                server.send_message(msg)
            
            logger.info(f'Email sent successfully to {to_email}')
            return True
            
        except Exception as e:
            logger.error(f'Failed to send email to {to_email}: {e}')
            return False
    
    def send_password_reset_email(self, to_email: str, reset_token: str) -> bool:
        """
        Send password reset email with token.
        
        Args:
            to_email: User's email address
            reset_token: Password reset token
        
        Returns:
            True if email sent successfully
        """
        reset_url = f'{self.frontend_url}/reset-password?token={reset_token}'
        
        subject = 'Reset Your Password - Smart Pantry'
        
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }}
                .container {{
                    background: #ffffff;
                    border-radius: 8px;
                    padding: 32px;
                }}
                h1 {{
                    color: #000;
                    font-size: 24px;
                    font-weight: 500;
                    margin-bottom: 24px;
                }}
                p {{
                    margin-bottom: 16px;
                    color: #666;
                }}
                .button {{
                    display: inline-block;
                    background: #000;
                    color: #fff;
                    padding: 12px 32px;
                    text-decoration: none;
                    border-radius: 6px;
                    margin: 24px 0;
                    font-weight: 500;
                }}
                .footer {{
                    margin-top: 32px;
                    padding-top: 24px;
                    border-top: 1px solid #eee;
                    font-size: 14px;
                    color: #999;
                }}
                .token {{
                    background: #f5f5f5;
                    padding: 12px;
                    border-radius: 4px;
                    font-family: monospace;
                    word-break: break-all;
                    margin: 16px 0;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Reset Your Password</h1>
                <p>You requested to reset your password for your Smart Pantry account.</p>
                <p>Tap the button below to reset your password:</p>
                <a href="{reset_url}" class="button">Reset Password</a>
                <p>Or copy and paste this link into your browser:</p>
                <div class="token">{reset_url}</div>
                <p>This link will expire in 1 hour for security reasons.</p>
                <p>If you didn't request a password reset, you can safely ignore this email.</p>
                <div class="footer">
                    <p>Smart Pantry<br>
                    This is an automated message, please do not reply.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_body = f"""
Reset Your Password

You requested to reset your password for your Smart Pantry account.

Click the link below to reset your password:
{reset_url}

This link will expire in 1 hour for security reasons.

If you didn't request a password reset, you can safely ignore this email.

---
Smart Pantry
This is an automated message, please do not reply.
        """
        
        return self.send_email(to_email, subject, html_body, text_body)


# Global email service instance
email_service = EmailService()
