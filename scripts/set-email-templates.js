/**
 * Sets the "Confirm sign up" and "Reset password" emails to show ONLY the verification code
 * (no links), via the Supabase Management API. Use this instead of the dashboard editor, which
 * can mangle the {{ .Token }} placeholder.
 *
 *   1. Create an access token: https://supabase.com/dashboard/account/tokens  (name it anything).
 *      Permissions: set "Project Settings" and "Auth Config" to read-write, everything else None.
 *   2. Run it (token stays on your machine, don't commit it):
 *        PowerShell:  $env:SUPABASE_ACCESS_TOKEN="sbp_..."; node scripts/set-email-templates.js
 *        cmd:         set SUPABASE_ACCESS_TOKEN=sbp_...   then   node scripts/set-email-templates.js
 *   3. Delete the token from the Supabase dashboard when you're done.
 *
 * Target project: defaults to the one in .env.local (the TEST project). To change the PRODUCTION project
 * instead, also set SUPABASE_URL to its URL, e.g.  $env:SUPABASE_URL="https://xxxx.supabase.co"
 *
 * Custom SMTP must already be configured (it is, if you can edit templates in the dashboard).
 */
const fs = require("fs");

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("="))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
);

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("Set SUPABASE_ACCESS_TOKEN first (see the comment at the top of this file).");
  process.exit(1);
}

const projectRef = new URL(process.env.SUPABASE_URL || env.EXPO_PUBLIC_SUPABASE_URL).hostname.split(".")[0];

const codeEmail = (heading, intro) => `<div style="font-family:Arial,sans-serif;text-align:center;padding:24px">
  <h2 style="margin:0 0 8px">${heading}</h2>
  <p style="margin:0 0 16px;color:#555">${intro}</p>
  <p style="font-size:36px;font-weight:bold;letter-spacing:8px;margin:0">{{ .Token }}</p>
  <p style="margin:16px 0 0;color:#888;font-size:13px">If you didn't request this, you can ignore this email.</p>
</div>`;

const body = {
  mailer_subjects_confirmation: "Your Cockers verification code",
  mailer_templates_confirmation_content: codeEmail(
    "Confirm your email",
    "Enter this code in the app to finish creating your account:",
  ),
  mailer_subjects_recovery: "Your Cockers password reset code",
  mailer_templates_recovery_content: codeEmail(
    "Reset your password",
    "Enter this code in the app to choose a new password:",
  ),
};

(async () => {
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    console.error(`FAILED (${response.status}):`, await response.text());
    process.exitCode = 1; // not process.exit(): exiting mid-request crashes Node on Windows
    return;
  }

  console.log(`Done. Project ${projectRef}: confirmation and recovery emails now contain only the code.`);
})();
