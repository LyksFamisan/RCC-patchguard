# Render Free + Neon Free

The default render.yaml now uses **Free** compute, no persistent disk, and an external Neon PostgreSQL database. It cannot silently fall back to an ephemeral SQLite database. Existing local SQLite data is not automatically copied to the new cloud database.

## Deploy

1. Install/connect Render in ChatGPT, or sign in to Render with GitHub.
2. In Render choose **New → Blueprint**, select **LyksFamisan/RCC-patchguard**, branch **main**, and **render.yaml**. Confirm the service plan is **Free** and there is no disk.
3. Set **DATABASE_URL** to the production branch's pooled connection string from the Neon project's Connect panel. Keep the password private; do not paste it into chat or GitHub. The database project is named **rcc-patchguard**, in Singapore. Use the production branch, not dev-postgres-migration.
4. Set **PATCHGUARD_ADMIN_EMAIL** and a new unique **PATCHGUARD_ADMIN_PASSWORD** of at least 14 characters. These credentials create the first engineer in the new database.
5. Deploy. Open the provided HTTPS service URL plus **/api/health**; it must return **{"ok":true}**. The same Render URL also serves the dashboard.
6. Sign in on that Render URL and validate device enrollment and scan upload.
7. To retain the Vercel dashboard URL, configure its /api external rewrite to the actual Render service. Set PATCHGUARD_PUBLIC_ORIGIN on Render to the Vercel origin when doing so. Do not add an invented backend hostname.

Remote jobs remain disabled (PATCHGUARD_REMOTE_JOBS=0). Before enabling them, complete the Windows worker pilot in DEPLOYMENT.md and create a separate client approver. Free Render services do not provide a persistent shell; use a trusted local Python environment with the production DATABASE_URL set privately and run:

    python -m pip install -r backend/requirements.txt
    python backend/manage_user.py approver@your-company.example client_approver

The command prompts for the approver password. It must run against the intended production database. It does not grant the browser demo persona real permissions.

## Limits

Render Free can sleep, restart, or hit usage limits. Neon Free also has compute/storage limits. Records remain in Neon when Render restarts, but free hosting does not guarantee timely critical patch execution. Suitable for a test/pilot; monitor limits before wider deployment. No paid plan or paid disk is required by this Blueprint.

The development workspace cannot resolve Neon's database hostname, so driver-to-Neon connectivity must be verified from Render. Schema creation is validated through the Neon connection; local HTTP integration tests cover SQLite compatibility. Do not report a completed deployment until Render's API and sign-in flow pass.
