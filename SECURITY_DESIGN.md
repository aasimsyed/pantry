# Production Security System Design Plan
## Smart Pantry Inventory System

> **Purpose**: Comprehensive security architecture and implementation plan for production deployment

---

## 📋 Executive Summary

This document outlines a production-grade security system for the Smart Pantry application, covering authentication, authorization, API security, data protection, infrastructure hardening, and compliance considerations.

**Security Goals:**
- Protect user data and privacy
- Prevent unauthorized access
- Secure API endpoints
- Protect against common attacks (OWASP Top 10)
- Ensure data integrity and availability
- Comply with data protection regulations

---

## 🔐 1. Authentication & Authorization

### 1.1 Authentication Strategy

**Recommended: JWT (JSON Web Tokens) with Refresh Tokens**

#### Architecture:
```
User Login → Validate Credentials → Generate Access Token (short-lived) + Refresh Token (long-lived)
         → Store Refresh Token Hash in Database
         → Return Tokens to Client
         
Client Requests → Include Access Token in Authorization Header
               → Server Validates Token
               → Grant/Deny Access
               
Token Expiry → Use Refresh Token to Get New Access Token
```

#### Implementation Plan:

**Phase 1: User Management**
- [ ] Create `User` model in database
- [ ] Password hashing with bcrypt/argon2
- [ ] Email verification system
- [ ] Password reset flow
- [ ] Account lockout after failed attempts

**Phase 2: JWT Implementation**
- [ ] Install `python-jose[cryptography]` for JWT
- [ ] Create token generation service
- [ ] Implement refresh token rotation
- [ ] Token blacklisting for logout
- [ ] Secure token storage (httpOnly cookies for web, secure storage for mobile)

**Phase 3: Authentication Endpoints**
- [ ] `POST /api/auth/register` - User registration
- [ ] `POST /api/auth/login` - User login
- [ ] `POST /api/auth/refresh` - Refresh access token
- [ ] `POST /api/auth/logout` - Invalidate tokens
- [ ] `POST /api/auth/forgot-password` - Password reset request
- [ ] `POST /api/auth/reset-password` - Password reset confirmation
- [ ] `GET /api/auth/me` - Get current user info

### 1.2 Authorization (RBAC - Role-Based Access Control)

**Roles:**
- **Admin**: Full system access
- **User**: Own data access only
- **Guest**: Read-only access (optional)

**Permissions Matrix:**
| Resource | Admin | User | Guest |
|----------|-------|------|-------|
| View own inventory | ✅ | ✅ | ✅ |
| Edit own inventory | ✅ | ✅ | ❌ |
| Delete own items | ✅ | ✅ | ❌ |
| View all users | ✅ | ❌ | ❌ |
| Manage users | ✅ | ❌ | ❌ |
| System settings | ✅ | ❌ | ❌ |

**Implementation:**
- [ ] Create `Role` and `Permission` models
- [ ] Implement dependency injection for role checking
- [ ] Add permission decorators to endpoints
- [ ] Row-level security (users can only access their own data)

---

## 🛡️ 2. API Security

### 2.1 Rate Limiting

**Current State**: Only OCR service has rate limiting

**Required:**
- [ ] Global API rate limiting (per IP/user)
- [ ] Endpoint-specific rate limits
- [ ] Authentication endpoint rate limiting (prevent brute force)
- [ ] File upload rate limiting

**Implementation:**
```python
# Use slowapi or fastapi-limiter
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

# Example limits:
# - Public endpoints: 100 requests/minute
# - Authenticated: 1000 requests/minute
# - Login endpoint: 5 requests/minute
# - File upload: 10 requests/minute
```

### 2.2 Input Validation & Sanitization

**Current State**: Basic Pydantic validation

**Enhancements:**
- [ ] SQL injection prevention (use parameterized queries - already done with SQLAlchemy)
- [ ] XSS prevention (sanitize user inputs)
- [ ] File upload validation (type, size, content scanning)
- [ ] Path traversal prevention
- [ ] Command injection prevention

**File Upload Security:**
```python
# Validate file types
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

# Scan for malware (optional but recommended)
# Use ClamAV or cloud scanning service
```

### 2.3 API Key Management

**Current State**: API keys in environment variables

**Enhancements:**
- [ ] Use secrets management (Railway Secrets, AWS Secrets Manager, HashiCorp Vault)
- [ ] Rotate API keys regularly
- [ ] Separate keys for different environments
- [ ] Monitor API key usage
- [ ] Alert on unusual usage patterns

### 2.4 CORS Configuration

**Current State**: Permissive CORS

**Production Configuration:**
```python
cors_origins = [
    "https://your-frontend-domain.com",  # Production frontend
    "https://your-mobile-app-domain.com",  # If web-based
    # Remove localhost in production
]
allow_credentials=True,
allow_methods=["GET", "POST", "PUT", "DELETE"],  # Specific methods
allow_headers=["Authorization", "Content-Type"],  # Specific headers
```

---

## 🔒 3. Data Protection

### 3.1 Database Security

**PostgreSQL Security:**
- [ ] Use connection pooling with SSL
- [ ] Encrypt database at rest
- [ ] Regular backups with encryption
- [ ] Database user with least privilege
- [ ] Enable PostgreSQL logging
- [ ] Use parameterized queries (already done)

**Data Encryption:**
- [ ] Encrypt sensitive fields (PII) at application level
- [ ] Use field-level encryption for:
  - User emails
  - Personal notes
  - Image paths (if sensitive)

### 3.2 Data Privacy

**GDPR/CCPA Compliance:**
- [ ] User data export endpoint (`GET /api/users/me/export`)
- [ ] User data deletion endpoint (`DELETE /api/users/me`)
- [ ] Privacy policy endpoint
- [ ] Consent management
- [ ] Data retention policies
- [ ] Right to be forgotten implementation

### 3.3 Secure File Storage

**Current State**: Local file storage

**Production Recommendations:**
- [ ] Use cloud storage (AWS S3, Google Cloud Storage)
- [ ] Enable encryption at rest
- [ ] Use signed URLs for file access
- [ ] Implement file access controls
- [ ] Scan uploaded files for malware
- [ ] Set file size limits
- [ ] Implement file lifecycle policies

---

## 🏗️ 4. Infrastructure Security

### 4.1 Network Security

**HTTPS/TLS:**
- [ ] Enforce HTTPS only (HSTS headers)
- [ ] Use TLS 1.3 minimum
- [ ] Valid SSL certificates (Railway provides this)
- [ ] Certificate pinning for mobile apps

**Firewall Rules:**
- [ ] Restrict database access to application servers only
- [ ] Use VPC/private networks where possible
- [ ] Implement network segmentation

### 4.2 Server Hardening

**Security Headers:**
```python
from fastapi.middleware.trustedhost import TrustedHostMiddleware

# Add security headers
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = "default-src 'self'"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response
```

**Environment Security:**
- [ ] Disable debug mode in production
- [ ] Remove development endpoints (`/docs` in production - or password protect)
- [ ] Use environment-specific configurations
- [ ] Secure environment variable storage

### 4.3 Container Security (Docker)

**Dockerfile Security:**
- [ ] Use non-root user
- [ ] Minimal base images
- [ ] Scan images for vulnerabilities
- [ ] Keep dependencies updated
- [ ] Use multi-stage builds
- [ ] Remove build tools from production image

---

## 🔍 5. Application Security

### 5.1 Logging & Monitoring

**Security Logging:**
- [ ] Log all authentication attempts (success/failure)
- [ ] Log authorization failures
- [ ] Log sensitive operations (data deletion, user creation)
- [ ] Log API errors and exceptions
- [ ] Implement log rotation
- [ ] Secure log storage (encrypted)

**Monitoring:**
- [ ] Set up error tracking (Sentry, Rollbar)
- [ ] Monitor API response times
- [ ] Alert on suspicious activity
- [ ] Track failed login attempts
- [ ] Monitor API usage patterns

### 5.2 Error Handling

**Security Best Practices:**
- [ ] Don't expose internal errors to clients
- [ ] Generic error messages for authentication failures
- [ ] Log detailed errors server-side only
- [ ] Implement proper exception handling

### 5.3 Session Management

**For Web Applications:**
- [ ] Use httpOnly cookies for tokens
- [ ] Implement CSRF protection
- [ ] Set secure cookie flags
- [ ] Implement session timeout
- [ ] Invalidate sessions on logout

---

## 📱 6. Mobile App Security

### 6.1 Secure Storage

**React Native:**
- [ ] Use `react-native-keychain` for sensitive data
- [ ] Never store tokens in AsyncStorage
- [ ] Encrypt local database (if using SQLite)
- [ ] Implement certificate pinning

### 6.2 API Communication

- [ ] Always use HTTPS
- [ ] Implement certificate pinning
- [ ] Validate API responses
- [ ] Handle network errors gracefully
- [ ] Implement request retry with exponential backoff

### 6.3 Code Obfuscation

- [ ] Obfuscate JavaScript bundle
- [ ] Use ProGuard/R8 for Android
- [ ] Enable code signing
- [ ] Disable debugging in production builds

---

## 🌐 7. Web Frontend Security

### 7.1 Client-Side Security

- [ ] Never store tokens in localStorage (use httpOnly cookies)
- [ ] Implement CSRF tokens
- [ ] Sanitize user inputs
- [ ] Use Content Security Policy (CSP)
- [ ] Implement XSS protection
- [ ] Validate all user inputs client-side (and server-side)

### 7.2 Secure Communication

- [ ] Enforce HTTPS
- [ ] Implement certificate pinning (if possible)
- [ ] Use secure WebSocket connections (wss://)

---

## 🚨 8. Threat Protection

### 8.1 Common Attacks

**OWASP Top 10 Protection:**

1. **Injection Attacks**
   - ✅ Use parameterized queries (SQLAlchemy)
   - [ ] Input validation and sanitization
   - [ ] Use ORM methods instead of raw SQL

2. **Broken Authentication**
   - [ ] Implement strong password policies
   - [ ] Multi-factor authentication (MFA)
   - [ ] Session management
   - [ ] Account lockout

3. **Sensitive Data Exposure**
   - [ ] Encrypt sensitive data at rest
   - [ ] Use HTTPS everywhere
   - [ ] Don't log sensitive data
   - [ ] Hash passwords properly

4. **XML External Entities (XXE)**
   - [ ] Disable XML processing (if not needed)
   - [ ] Validate XML inputs

5. **Broken Access Control**
   - [ ] Implement RBAC
   - [ ] Row-level security
   - [ ] Validate permissions on every request

6. **Security Misconfiguration**
   - [ ] Remove default credentials
   - [ ] Disable debug mode
   - [ ] Secure headers
   - [ ] Update dependencies

7. **XSS (Cross-Site Scripting)**
   - [ ] Input sanitization
   - [ ] Output encoding
   - [ ] CSP headers

8. **Insecure Deserialization**
   - [ ] Validate serialized data
   - [ ] Use safe serialization formats (JSON)

9. **Using Components with Known Vulnerabilities**
   - [ ] Regular dependency updates
   - [ ] Use `safety` or `pip-audit` for Python
   - [ ] Use `npm audit` for Node.js

10. **Insufficient Logging & Monitoring**
    - [ ] Comprehensive logging
    - [ ] Security event monitoring
    - [ ] Alerting system

### 8.2 DDoS Protection

- [ ] Rate limiting (already planned)
- [ ] Use CDN (Cloudflare, AWS CloudFront)
- [ ] Implement request throttling
- [ ] Use Railway's built-in DDoS protection

---

## 📊 9. Compliance & Auditing

### 9.1 Data Protection Regulations

**GDPR Compliance:**
- [ ] Privacy policy
- [ ] User consent management
- [ ] Data export functionality
- [ ] Right to deletion
- [ ] Data breach notification procedures

**CCPA Compliance:**
- [ ] Privacy notice
- [ ] Opt-out mechanisms
- [ ] Data access rights

### 9.2 Security Auditing

- [ ] Regular security audits
- [ ] Penetration testing
- [ ] Code reviews
- [ ] Dependency vulnerability scanning
- [ ] Infrastructure security scans

### 9.3 Incident Response Plan

- [ ] Define incident response procedures
- [ ] Establish security team contacts
- [ ] Create runbooks for common incidents
- [ ] Regular incident response drills

---

## 🛠️ 10. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
**Priority: Critical**

- [ ] User authentication system (JWT)
- [ ] Password hashing and storage
- [ ] Basic authorization (user/admin roles)
- [ ] Secure API endpoints (require authentication)
- [ ] Rate limiting on all endpoints
- [ ] Security headers middleware
- [ ] Input validation enhancements
- [ ] Error handling improvements

**Deliverables:**
- Working authentication system
- Protected API endpoints
- User registration/login flow

### Phase 2: Hardening (Week 3-4)
**Priority: High**

- [ ] Multi-factor authentication (MFA)
- [ ] Advanced rate limiting
- [ ] File upload security
- [ ] Database encryption
- [ ] Secure file storage (cloud)
- [ ] Enhanced logging and monitoring
- [ ] Security audit logging

**Deliverables:**
- Production-ready security features
- Monitoring and alerting

### Phase 3: Advanced Security (Week 5-6)
**Priority: Medium**

- [ ] OAuth2 integration (Google, Apple)
- [ ] API key management system
- [ ] Advanced threat detection
- [ ] Compliance features (GDPR)
- [ ] Security testing automation
- [ ] Penetration testing

**Deliverables:**
- Enterprise-grade security
- Compliance-ready system

### Phase 4: Continuous Improvement (Ongoing)
**Priority: Low-Medium**

- [ ] Regular security audits
- [ ] Dependency updates
- [ ] Security training
- [ ] Incident response improvements
- [ ] Security documentation updates

---

## 📦 11. Required Dependencies

### Python Packages:
```txt
# Authentication & Security
python-jose[cryptography]>=3.3.0  # JWT tokens
passlib[bcrypt]>=1.7.4  # Password hashing
python-multipart>=0.0.6  # Form data (already installed)
slowapi>=0.1.9  # Rate limiting
email-validator>=2.1.0  # Email validation

# Security Utilities
cryptography>=41.0.0  # Encryption
python-json-logger>=2.0.7  # Structured logging
```

### Frontend (React):
```json
{
  "js-cookie": "^3.0.5",  // Secure cookie handling
  "axios": "^1.6.0"  // Already installed
}
```

### Mobile (React Native):
```json
{
  "react-native-keychain": "^8.1.3",  // Secure storage
  "@react-native-async-storage/async-storage": "^1.21.0"  // For non-sensitive data
}
```

---

## 🔧 12. Configuration Examples

### 12.1 Environment Variables

```bash
# Security Configuration
SECRET_KEY=your-secret-key-here  # For JWT signing (generate strong random key)
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRE_DAYS=30

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_PER_MINUTE=100
RATE_LIMIT_AUTH_PER_MINUTE=5

# Security Features
ENABLE_MFA=false  # Enable after Phase 2
ALLOW_REGISTRATION=true
REQUIRE_EMAIL_VERIFICATION=true

# File Upload
MAX_FILE_SIZE_MB=10
ALLOWED_FILE_TYPES=jpg,jpeg,png
SCAN_FILES_FOR_MALWARE=false  # Enable with ClamAV

# Database
DB_ENCRYPTION_KEY=your-encryption-key  # For field-level encryption

# Monitoring
SENTRY_DSN=your-sentry-dsn  # Error tracking
LOG_LEVEL=INFO
```

### 12.2 Database Schema Additions

```python
# New tables needed:
- users (id, email, password_hash, role, created_at, updated_at, email_verified)
- refresh_tokens (id, user_id, token_hash, expires_at, created_at)
- user_sessions (id, user_id, ip_address, user_agent, created_at, last_activity)
- security_events (id, user_id, event_type, ip_address, details, created_at)
- api_keys (id, user_id, key_hash, name, permissions, expires_at, created_at)
```

---

## 📋 13. Security Checklist

### Pre-Production Checklist:

**Authentication & Authorization:**
- [ ] JWT authentication implemented
- [ ] Refresh token rotation
- [ ] Password strength requirements
- [ ] Account lockout after failed attempts
- [ ] Email verification
- [ ] Role-based access control

**API Security:**
- [ ] All endpoints require authentication (except public ones)
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] File upload restrictions
- [ ] CORS properly configured
- [ ] Security headers set

**Data Protection:**
- [ ] Passwords hashed (bcrypt/argon2)
- [ ] Sensitive data encrypted
- [ ] Database backups encrypted
- [ ] HTTPS enforced
- [ ] Secure file storage

**Infrastructure:**
- [ ] Debug mode disabled
- [ ] Development endpoints removed/protected
- [ ] Environment variables secured
- [ ] Dependencies updated
- [ ] Security headers configured

**Monitoring:**
- [ ] Error tracking configured
- [ ] Security event logging
- [ ] Alerting set up
- [ ] Log rotation configured

**Compliance:**
- [ ] Privacy policy
- [ ] Terms of service
- [ ] GDPR compliance features
- [ ] Data export/deletion endpoints

---

## 🎯 14. Quick Start: Phase 1 Implementation

### Step 1: Add Authentication Dependencies

```bash
pip install python-jose[cryptography] passlib[bcrypt] slowapi email-validator
```

### Step 2: Create User Model

```python
# src/database.py - Add User model
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="user")
    email_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    inventory_items = relationship("InventoryItem", back_populates="user")
```

### Step 3: Create Authentication Service

```python
# src/auth_service.py
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta):
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
```

### Step 4: Add Authentication Middleware

```python
# api/dependencies.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials
    # Validate token and return user
    # ...
```

### Step 5: Protect Endpoints

```python
# api/main.py
@app.get("/api/inventory")
async def get_inventory(
    current_user: User = Depends(get_current_user),
    service: PantryService = Depends(get_pantry_service)
):
    # Only return user's own inventory
    return service.get_user_inventory(current_user.id)
```

---

## 📚 15. Resources & References

### Security Standards:
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [GDPR Compliance Guide](https://gdpr.eu/)

### FastAPI Security:
- [FastAPI Security Documentation](https://fastapi.tiangolo.com/tutorial/security/)
- [FastAPI Advanced Security](https://fastapi.tiangolo.com/advanced/security/)

### Tools:
- **Dependency Scanning**: `safety`, `pip-audit`, `npm audit`
- **Code Analysis**: `bandit` (Python security linter)
- **Penetration Testing**: OWASP ZAP, Burp Suite
- **Error Tracking**: Sentry, Rollbar
- **Secrets Management**: HashiCorp Vault, AWS Secrets Manager

---

## 🚀 Next Steps

1. **Review this plan** and prioritize features
2. **Start with Phase 1** (authentication foundation)
3. **Set up monitoring** early (Sentry, logging)
4. **Regular security reviews** (monthly)
5. **Keep dependencies updated** (weekly checks)

---

## 📝 Notes

- This is a comprehensive plan - implement incrementally
- Start with critical security features first
- Test security features thoroughly
- Document all security decisions
- Regular security audits recommended

**Remember**: Security is an ongoing process, not a one-time implementation!

