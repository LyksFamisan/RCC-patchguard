# Deploy on Render

This Blueprint provisions a paid Starter web service and 1 GB persistent disk. Review Render's current billing estimate before creating the resources.

1. Sign in to Render with GitHub.
2. Choose **New → Blueprint**, select **LyksFamisan/RCC-patchguard**, and use **main** / **render.yaml**.
3. Enter PATCHGUARD_ADMIN_EMAIL and a new, unique PATCHGUARD_ADMIN_PASSWORD of at least 14 characters. These are login credentials for the new backend, not a reset of an existing deployment.
4. Review the paid service/disk estimate, then deploy.
5. After the service is Live, open its provided HTTPS URL and append /api/health. It must return {"ok":true}.
6. The Render URL serves the dashboard and API together; sign in there first. To keep the existing Vercel address, send the actual Render service URL so an external /api rewrite can be added. Set PATCHGUARD_PUBLIC_ORIGIN=https://rcc-patchguard.vercel.app on Render only when that rewrite is configured. Enrollment agents must use the same origin as the dashboard.

Remote jobs are off by default. First validate enrollment and scanning. Create a separate approver using Render Shell:

    runuser -u patchguard -- python manage_user.py approver@your-company.example client_approver

The command prompts for a new approver password. Do not paste passwords into chat or source code. Follow DEPLOYMENT.md for Windows worker pilot validation before enabling PATCHGUARD_REMOTE_JOBS=1.

Render deployment, Docker image build, and Windows pilot are not validated by adding this Blueprint. The existing Vercel API remains unavailable until real hosting is deployed and routed.
