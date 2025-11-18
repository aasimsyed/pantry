# Mobile App - Using Railway Backend

## ✅ Updated Configuration

The mobile app now **defaults to the Railway backend** (`https://pantry.up.railway.app`).

This means:
- ✅ No need to configure local IP address
- ✅ Works on any network (no need to be on same WiFi)
- ✅ API keys already configured on Railway
- ✅ Production-ready setup

## How It Works

The mobile app will use:
1. **EXPO_PUBLIC_API_URL** environment variable (if set)
2. **Railway backend** (`https://pantry.up.railway.app`) as default

## Reload the App

After the update:
1. **Reload the Expo app** (shake device → Reload, or `r` in terminal)
2. The app will now connect to Railway backend
3. All features should work:
   - ✅ Authentication (register/login)
   - ✅ View inventory
   - ✅ Process images (OCR + AI)
   - ✅ Generate recipes
   - ✅ View saved recipes

## Using Local Backend (Optional)

If you want to use your local backend for development:

1. **Set environment variable:**
   ```bash
   cd mobile
   export EXPO_PUBLIC_API_URL=http://YOUR_LOCAL_IP:8000
   npm start
   ```

2. **Or create `mobile/.env`:**
   ```
   EXPO_PUBLIC_API_URL=http://192.168.69.61:8000
   ```

3. **Restart Expo**

## Benefits of Railway Backend

- ✅ **Always available** - No need to keep local server running
- ✅ **API keys configured** - OCR and AI services work out of the box
- ✅ **Database persistent** - PostgreSQL, not ephemeral SQLite
- ✅ **Production ready** - Same backend as production
- ✅ **Works anywhere** - Phone doesn't need to be on same WiFi

## Testing

After reloading, try:
1. **Register/Login** - Should work immediately
2. **Process an image** - Should work (OCR + AI configured on Railway)
3. **View recipes** - Should load saved recipes

All errors should be resolved! 🎉

