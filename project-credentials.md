# Project Credentials

Here is a consolidated list of the credentials and configuration keys currently available in your workspace (extracted from your `.env` and configuration files):

## Supabase
- **URL**: `https://rnelxupyiejsqekmcrcz.supabase.co`
- **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZWx4dXB5aWVqc3Fla21jcmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTgzODcsImV4cCI6MjA5OTU5NDM4N30.Cc4z8mFO4YoPbuHC40bnvEy6SQOyEbFobvMRqUqnmIQ`

## Emergent LLM (AI Provider)
- **API Key**: `sk-emergent-d623c9878Bd44C82aC`

## Backend / Expo Config
- **Backend URL**: `https://upsc-4-0-pilot.preview.emergentagent.com`

---

### Cloudflare R2 / AWS S3
_Note: The Cloudflare R2 and S3 credentials (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, etc.) are actively referenced by your Supabase edge functions (e.g., `upload-image`, `r2-presigned-url`), but they are securely stored in the Supabase Dashboard's Edge Function Secrets (`Deno.env.get()`) rather than being hardcoded in your local files._
