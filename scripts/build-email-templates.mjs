// Builds Litma's auth emails (supabase/templates/*.html) from one layout.
//   node scripts/build-email-templates.mjs
// Then paste each file (and its subject from subjects.json) into
// Supabase → Authentication → Emails → Templates.
//
// Colours mirror src/styles/theme.css. Email clients ignore CSS variables, so they're repeated here.
import { mkdirSync, writeFileSync } from "node:fs";

const BRAND = {
  name: "Litma",
  wordmark: "ലിറ്റ്മ",
  site: "https://getlitma.in",
  support: "support@getlitma.in",
  ink: "#111113",
  muted: "#6b6b76",
  line: "#e2e2e6",
  canvas: "#f4f4f5",
  surface: "#ffffff",
  mark: "#4f46e5",
};

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function layout({ preheader, title, lead, button, url = "{{ .ConfirmationURL }}", code, after, ml }) {
  const b = BRAND;
  const font = "Inter,'Segoe UI',Roboto,Helvetica,Arial,'Noto Sans Malayalam',sans-serif";
  const mlFont = "'Anek Malayalam','Noto Sans Malayalam','Kartika',sans-serif";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:${b.canvas};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${b.canvas};">
<tr><td align="center" style="padding:40px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
    <tr><td style="padding:0 4px 20px;font-family:${mlFont};font-size:26px;font-weight:800;color:${b.ink};letter-spacing:-0.01em;">
      <a href="${b.site}" style="color:${b.ink};text-decoration:none;">${b.wordmark}<span style="color:${b.mark};">.</span></a>
      <span style="font-family:${font};font-size:12px;font-weight:600;color:${b.muted};letter-spacing:0.04em;">&nbsp;${b.name}</span>
    </td></tr>
    <tr><td style="background:${b.surface};border:1px solid ${b.line};border-radius:16px;padding:36px 32px;font-family:${font};color:${b.ink};">
      ${ml ? `<p style="margin:0 0 6px;font-family:${mlFont};font-size:15px;color:${b.muted};">${ml}</p>` : ""}
      <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;font-weight:700;color:${b.ink};">${title}</h1>
      <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:${b.muted};">${lead}</p>
      ${
        code
          ? `<p style="margin:0 0 28px;font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:0.3em;color:${b.ink};">${code}</p>`
          : `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-radius:10px;background:${b.ink};">
        <a href="${url}" style="display:inline-block;padding:13px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">${button}</a>
      </td></tr></table>
      <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:${b.muted};">Button not working? Paste this link into your browser:<br>
        <a href="${url}" style="color:${b.mark};word-break:break-all;">${url}</a></p>`
      }
      ${after ? `<p style="margin:24px 0 0;padding-top:20px;border-top:1px solid ${b.line};font-size:13px;line-height:1.6;color:${b.muted};">${after}</p>` : ""}
    </td></tr>
    <tr><td style="padding:20px 4px 0;font-family:${font};font-size:12px;line-height:1.6;color:${b.muted};">
      <span style="font-family:${mlFont};">${b.wordmark}</span> · the Malayalam writing desk · <a href="${b.site}" style="color:${b.muted};">${b.site.replace(/^https?:\/\//, "")}</a><br>
      You’re receiving this because someone used this address on ${b.name}. If that wasn’t you, you can ignore this email.<br>
      Questions? Write to <a href="mailto:${b.support}" style="color:${b.muted};">${b.support}</a>. Replies to this email aren’t read.
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>
`;
}

const TEMPLATES = {
  confirmation: {
    subject: "Confirm your email for Litma",
    html: layout({
      preheader: "One click and your desk is ready.",
      ml: "സ്വാഗതം!",
      title: "Confirm your email",
      lead: "Welcome to Litma. Confirm this address and your writing desk is ready for novels, poems, screenplays and more, in Manglish or Malayalam.",
      button: "Confirm email",
      after: "This link works once and expires in 1 hour. Didn’t sign up? Ignore this email.",
    }),
  },
  magic_link: {
    subject: "Your Litma sign-in link",
    html: layout({
      preheader: "Sign in to Litma with one click.",
      title: "Sign in to Litma",
      lead: "Use the button below to sign in on this device. No password needed.",
      button: "Sign in",
      after: "This link works once and expires in 1 hour. If you didn’t ask to sign in, ignore this email. Your account is safe.",
    }),
  },
  recovery: {
    subject: "Reset your Litma password",
    html: layout({
      preheader: "Choose a new password for Litma.",
      title: "Reset your password",
      lead: "Someone asked to reset the password for {{ .Email }}. If it was you, choose a new one below.",
      button: "Choose a new password",
      after: "This link expires in 1 hour. If you didn’t ask for this, ignore this email. Your password stays the same.",
    }),
  },
  email_change: {
    subject: "Confirm your new email for Litma",
    html: layout({
      preheader: "Confirm the change to your Litma email.",
      title: "Confirm your new email",
      lead: "You asked to change your Litma email from {{ .Email }} to {{ .NewEmail }}. Confirm to finish.",
      button: "Confirm new email",
      after: "If you didn’t ask for this change, ignore this email and your address stays the same.",
    }),
  },
  invite: {
    subject: "You’re invited to Litma",
    html: layout({
      preheader: "A Malayalam writing desk is waiting for you.",
      ml: "എഴുതൂ, മലയാളത്തിൽ.",
      title: "You’re invited to Litma",
      lead: "Litma is a writing desk for Malayalam literature. Accept the invitation to set up your account.",
      button: "Accept invitation",
    }),
  },
  reauthentication: {
    subject: "Your Litma verification code",
    html: layout({
      preheader: "Your Litma verification code.",
      title: "Confirm it’s you",
      lead: "Enter this code in Litma to continue:",
      code: "{{ .Token }}",
      after: "The code expires in a few minutes. If you didn’t ask for it, ignore this email.",
    }),
  },
};

mkdirSync("supabase/templates", { recursive: true });
for (const [name, t] of Object.entries(TEMPLATES)) writeFileSync(`supabase/templates/${name}.html`, t.html);
writeFileSync("supabase/templates/subjects.json", JSON.stringify(Object.fromEntries(Object.entries(TEMPLATES).map(([k, t]) => [k, t.subject])), null, 2) + "\n");
console.log(`Wrote ${Object.keys(TEMPLATES).length} templates to supabase/templates/`);
