# Changelog

All notable changes to Smart Pantry will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2026-01-25

### Fixed
- Fixed React Native rendering error where numbers must be wrapped in `<Text>` component
- Improved migration error handling for duplicate indexes
- Fixed GitHub Actions workflow to only deploy on push to main (not PRs)

## [1.1.0] - 2026-01-25

### Added
- **Recent Recipes Feature**: Users can now view and manage recently generated recipes
  - Backend: New `RecentRecipe` model and API endpoints (`/api/recipes/recent/*`)
  - Auto-save: Generated recipes are automatically saved to recent recipes
  - Mobile: Recent recipes section in Recipes screen with save/delete buttons
  - Frontend: Recent recipes section in Recipes page with save/delete functionality
  - Auto-cleanup: Recipes older than 7 days are automatically removed

### Changed
- Recipe generation endpoints now automatically save to recent recipes
- Improved error handling in recipe generation

## [1.0.0] - 2026-01-25

### Added
- Initial production release
- OCR image processing (Google Vision / Tesseract)
- AI-powered product extraction
- Recipe generation with flavor chemistry
- Multiple pantries per user
- Inventory management with expiration tracking
- Statistics and analytics
- Mobile app (React Native/Expo)
- Web frontend (React/Vite)
- Authentication & authorization
- Sentry error tracking
- Cloud Run deployment

---

[1.1.1]: https://github.com/aasimsyed/pantry/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/aasimsyed/pantry/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/aasimsyed/pantry/releases/tag/v1.0.0
