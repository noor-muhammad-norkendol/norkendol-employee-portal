# Norkendol Employee Portal — Setup Notes

## NOOR: Email Notifications Need Resend API Key

Email notifications were built (Apr 5, 2026) but **will not send until Resend is configured**.

### What to do:
1. Go to https://resend.com and create an account
2. Add and verify a sending domain (e.g. `norkendol.com`)
3. Create an API key
4. Add these two lines to `.env.local`:
   ```
   RESEND_API_KEY=re_your_key_here
   EMAIL_FROM=notifications@norkendol.com
   ```
5. Restart the dev server

### What's already wired up:
- Training assignment emails (sent automatically when admin assigns a course)
- User notification preferences at `/dashboard/my-settings` (users can turn off any notification type)
- `notification_preferences` table in Supabase
- `/api/email/send-notification` endpoint ready to go
- Future notification types just need to be added to the `NOTIFICATION_TYPES` array in `src/lib/email.ts`

### For production (Vercel):
Add `RESEND_API_KEY` and `EMAIL_FROM` to the Vercel environment variables.
