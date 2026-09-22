# SIAOS account backend setup

The public account interface now uses immediate browser-local access. Visitors enter their name, email and mobile number and continue without a password, verification link or OTP.

1. Create a Supabase project owned by SIAOS.
2. Run `supabase/schema.sql` in the project's SQL editor.
3. Keep public account access independent from Supabase Auth. Supabase remains the protected database for backend and operator workflows.
4. Copy `auth-config.example.js` to the values in `auth-config.js` using the project URL and **publishable** key.
5. Add `https://siaos.in` and the final GitHub Pages preview URL to the backend origin allow-list.
6. Keep the service-role key and SMS-provider secrets only in the backend environment—never in the website files.
7. When Razorpay is connected, its verified payment webhook must create the `report_purchases` and `report_documents` rows. The database trigger fixes access expiry at exactly 15 days after `purchased_at`.

Public account details and unpaid reading history are stored only in that visitor's browser. Paid reports, orders and admin records must never be exposed by matching an unverified email address or phone number; they require a secure purchase link or protected backend workflow.
