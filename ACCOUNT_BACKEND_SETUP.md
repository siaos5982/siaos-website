# SIAOS account backend setup

The account interface is complete and runs in a safe localhost preview mode. Live accounts require a Supabase project and an SMS provider supported by Supabase Auth.

1. Create a Supabase project owned by SIAOS.
2. Run `supabase/schema.sql` in the project's SQL editor.
3. Enable phone authentication and connect the chosen SMS provider.
4. Copy `auth-config.example.js` to the values in `auth-config.js` using the project URL and **publishable** key.
5. Add `https://siaos.in` and the final GitHub Pages preview URL to the authentication redirect allow-list.
6. Keep the service-role key and SMS-provider secrets only in the backend environment—never in the website files.
7. When Razorpay is connected, its verified payment webhook must create the `report_purchases` and `report_documents` rows. The database trigger fixes access expiry at exactly 15 days after `purchased_at`.

On `localhost`, the OTP is `123456` only for design testing. That preview shortcut is automatically disabled on a public domain.
