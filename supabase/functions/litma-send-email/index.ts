/**
 * Supabase Auth "Send Email" hook: Litma sends its own sign-in emails instead of Supabase's mailer.
 *
 * Why: Supabase's SMTP mailer sends no Message-ID header and the cPanel mail server doesn't add one,
 * which Gmail counts against the message. Here every email gets a Message-ID on getlitma.in, a
 * plain-text twin, Reply-To the support address and the usual automated-mail headers, and still
 * leaves through Litma's own mailbox (no third-party mail service).
 *
 * Templates: generated with the pasted dashboard templates by scripts/build-email-templates.mjs
 * (templates.ts). Turned on in Supabase → Authentication → Hooks → Send Email (HTTPS, this
 * function's URL); the dashboard's templates and SMTP settings are then not used.
 *
 * Secrets (Edge Functions → Secrets): SEND_EMAIL_HOOK_SECRET (from the hook, "v1,whsec_…") and
 * SMTP_PASSWORD (the no-reply mailbox). Optional: SMTP_HOST (mail.getlitma.in), SMTP_PORT (465),
 * SMTP_USER (no-reply@getlitma.in), EMAIL_FROM ("Litma <no-reply@getlitma.in>"),
 * EMAIL_REPLY_TO (support@getlitma.in). Edge Functions can't use ports 25 or 587, so SMTP goes
 * over TLS on 465.
 */
import nodemailer from "npm:nodemailer@6.9.16";
import { Webhook } from "npm:standardwebhooks@1.0.0";
import { TEMPLATES, type TemplateName } from "./templates.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const HOOK_SECRET = (Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "").replace(/^v1,whsec_/, "");
const SMTP_HOST = Deno.env.get("SMTP_HOST") ?? "mail.getlitma.in";
const SMTP_PORT = Number(Deno.env.get("SMTP_PORT") ?? 465);
const SMTP_USER = Deno.env.get("SMTP_USER") ?? "no-reply@getlitma.in";
const SMTP_PASSWORD = Deno.env.get("SMTP_PASSWORD") ?? "";
const FROM = Deno.env.get("EMAIL_FROM") ?? "Litma <no-reply@getlitma.in>";
const REPLY_TO = Deno.env.get("EMAIL_REPLY_TO") ?? "support@getlitma.in";
/** Domain for Message-IDs: the sender's own domain, so they line up with SPF/DKIM. */
const ID_DOMAIN = (FROM.match(/@([^>\s]+)/)?.[1] ?? "getlitma.in").toLowerCase();

type Json = Record<string, unknown>;

/** Which email each auth action sends, and the verify link's `type`. */
const ACTIONS: Record<string, { template: TemplateName; type: string }> = {
  signup: { template: "confirmation", type: "signup" },
  invite: { template: "invite", type: "invite" },
  magiclink: { template: "magic_link", type: "magiclink" },
  email: { template: "magic_link", type: "magiclink" },
  recovery: { template: "recovery", type: "recovery" },
  email_change: { template: "email_change", type: "email_change" },
  reauthentication: { template: "reauthentication", type: "reauthentication" },
};

const transport = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  // Supabase waits about 5 s for the hook: a stuck mail server must fail before that, so the
  // writer sees an error instead of a sign-up that never answers
  connectionTimeout: 3000,
  greetingTimeout: 2500,
  socketTimeout: 3500,
});

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Fill {{ .Name }} placeholders; HTML gets escaped values, text gets them as they are. */
function fill(template: string, vars: Record<string, string>, html: boolean) {
  return template.replace(/\{\{\s*\.(\w+)\s*\}\}/g, (_, k: string) => {
    const v = vars[k] ?? "";
    return html ? escape(v) : v;
  });
}

/** The link the email's button opens: Supabase verifies the token, then sends the writer on to redirect_to. */
function verifyUrl(tokenHash: string, type: string, redirectTo: string | undefined) {
  const u = new URL("/auth/v1/verify", SUPABASE_URL);
  u.searchParams.set("token", tokenHash);
  u.searchParams.set("type", type);
  if (redirectTo) u.searchParams.set("redirect_to", redirectTo);
  return u.toString();
}

async function send(to: string, template: TemplateName, vars: Record<string, string>) {
  const t = TEMPLATES[template];
  await transport.sendMail({
    from: FROM,
    to,
    replyTo: REPLY_TO,
    subject: fill(t.subject, vars, false),
    html: fill(t.html, vars, true),
    text: fill(t.text, vars, false),
    messageId: `<${crypto.randomUUID()}@${ID_DOMAIN}>`,
    headers: {
      "Auto-Submitted": "auto-generated",
      "X-Auto-Response-Suppress": "All",
    },
  });
}

const reply = (status: number, body: Json) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const fail = (status: number, message: string) => reply(status, { error: { http_code: status, message } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return fail(405, "Method not allowed");
  if (!HOOK_SECRET || !SMTP_PASSWORD) return fail(500, "The email hook isn't set up yet (missing secrets).");

  const payload = await req.text();
  let data: Json;
  try {
    data = new Webhook(HOOK_SECRET).verify(payload, Object.fromEntries(req.headers)) as Json;
  } catch {
    return fail(401, "Invalid hook signature");
  }

  const user = (data.user ?? {}) as Json;
  const e = (data.email_data ?? {}) as Json;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const action = ACTIONS[str(e.email_action_type)];
  if (!action) return fail(400, `Unknown email action: ${str(e.email_action_type)}`);

  const email = str(user.email);
  const newEmail = str(user.new_email);
  const redirectTo = str(e.redirect_to) || undefined;
  const base = { Email: email, NewEmail: newEmail, SiteURL: str(e.site_url), Token: str(e.token) };

  try {
    if (action.template === "email_change") {
      // Field names are swapped in Supabase's payload: token_hash_new goes to the current address,
      // token_hash to the new one. Without "secure email change" only the new address gets one.
      const jobs: Promise<void>[] = [];
      if (str(e.token_hash_new) && email) {
        jobs.push(send(email, "email_change", { ...base, Token: str(e.token), ConfirmationURL: verifyUrl(str(e.token_hash_new), action.type, redirectTo) }));
      }
      const hash = str(e.token_hash);
      if (hash && (newEmail || email)) {
        jobs.push(send(newEmail || email, "email_change", { ...base, Token: str(e.token_new) || str(e.token), ConfirmationURL: verifyUrl(hash, action.type, redirectTo) }));
      }
      await Promise.all(jobs);
    } else {
      if (!email) return fail(400, "No email address");
      await send(email, action.template, { ...base, ConfirmationURL: verifyUrl(str(e.token_hash), action.type, redirectTo) });
    }
  } catch (err) {
    console.error("litma-send-email", err instanceof Error ? err.message : String(err));
    return fail(500, "Couldn't send the email. Please try again in a minute.");
  }
  return reply(200, {});
});
