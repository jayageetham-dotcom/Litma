import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";

const UPDATED = "7 November 2026";

const sections: LegalSection[] = [
  {
    id: "who",
    title: "Who we are",
    body: (
      <>
        <p>
          Litma is a Malayalam writing app: the website at <a href="https://getlitma.in">getlitma.in</a>, the desktop app for macOS, Windows and Linux, and the phone app for iPhone and Android. This policy covers all of them. In this policy
          “Litma”, “we” and “us” mean the team that runs Litma, based in Kerala, India. You can reach us at <a href="mailto:support@getlitma.in">support@getlitma.in</a>.
        </p>
      </>
    ),
  },
  {
    id: "collect",
    title: "What we collect",
    body: (
      <>
        <p>We keep only what Litma needs to work:</p>
        <ul>
          <li>
            <strong>Your account:</strong> your email address and name. If you sign in with Google or Apple, we receive your email address, your name and a unique account id from them. We do not receive your password, contacts, files or anything else in your
            Google or Apple account.
          </li>
          <li>
            <strong>Your profile:</strong> what you choose to add, such as a pen name, username, bio, place, website, the avatar you pick and your daily writing goal.
          </li>
          <li>
            <strong>Your writing:</strong> your works, books and covers, Story World notes, saved versions, saved words and settings, so you can reach them on every device.
          </li>
          <li>
            <strong>Keys you add:</strong> if you add your own AI provider key, it is stored encrypted and is used only to send your own requests. If you connect an AI assistant to Litma, we keep only a fingerprint (hash) of its access token, never the token
            itself.
          </li>
          <li>
            <strong>Usage statistics:</strong> which pages and buttons are used, active time, app and version, device type, operating system, browser, app and device language, and country (from the network or your time zone). We never record your writing,
            titles, names, search words or IP address. You can switch this off in Settings, Usage statistics.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "google",
    title: "Signing in with Google",
    body: (
      <>
        <p>
          When you choose <strong>Continue with Google</strong>, Google asks you to share your basic profile (name), your email address and an OpenID sign-in id with Litma. We use them only to create your Litma account, sign you in, show your name in the
          app and send you emails about your account (for example a sign-in or password link). We do not ask for access to Gmail, Google Drive, Contacts, Calendar or any other Google service.
        </p>
        <p>
          Litma&apos;s use and transfer of information received from Google APIs adheres to the{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements. We do not sell Google user data, use it for advertising, or use it to train AI models, and no person at Litma reads it except to fix a problem you ask us about or where the law requires it.
        </p>
        <p>
          You can remove Litma&apos;s access at any time in your{" "}
          <a href="https://myaccount.google.com/connections" target="_blank" rel="noopener noreferrer">
            Google Account
          </a>
          . Your Litma account and writing stay until you ask us to delete them (see below).
        </p>
      </>
    ),
  },
  {
    id: "use",
    title: "How we use it",
    body: (
      <ul>
        <li>To run Litma: sign you in, save and sync your writing, and keep a copy on your device so you can write offline.</li>
        <li>To do what you ask: share a work by link, make PDFs and Word files, look up words, and send a passage to the AI provider you chose.</li>
        <li>To send emails about your account: sign-in links, password resets and email changes. We do not send marketing emails.</li>
        <li>To understand which parts of Litma are used, so we can improve them (usage statistics, if you leave them on).</li>
        <li>To keep Litma safe and fix problems.</li>
      </ul>
    ),
  },
  {
    id: "writing",
    title: "Your writing is yours",
    body: (
      <>
        <p>
          You own everything you write in Litma. Your works are private until you share them. A work you share by link can be read by anyone who has that link, until you turn sharing off. We do not read your writing, sell it, show ads or use it to train
          AI models.
        </p>
      </>
    ),
  },
  {
    id: "share",
    title: "Services we use",
    body: (
      <>
        <p>We do not sell or rent your information. A few services help run Litma and handle data only for that purpose:</p>
        <ul>
          <li>
            <strong>Supabase</strong> stores your account and writing and runs Litma&apos;s server functions.
          </li>
          <li>
            <strong>Our web host</strong> serves the website and the desktop app&apos;s update file. <strong>GitHub</strong> hosts the desktop app downloads.
          </li>
          <li>
            <strong>Google Input Tools</strong> receives the single Manglish word you are typing, without your name or account, to suggest Malayalam spellings. <strong>Google Fonts</strong> serves some fonts.
          </li>
          <li>
            <strong>Google and Apple</strong> handle sign-in when you choose them.
          </li>
          <li>
            <strong>Anthropic, OpenAI or Google Gemini</strong> receive the text you send to the AI companion, only when you ask it something and only with your own key. Their own privacy policies apply to that request.
          </li>
          <li>
            <strong>App Store and Google Play</strong> deliver the phone app.
          </li>
        </ul>
        <p>We may share information if the law requires it, and only as much as it requires.</p>
      </>
    ),
  },
  {
    id: "device",
    title: "On your device",
    body: (
      <p>
        Litma keeps a copy of your works and settings on your device (browser storage, or the app&apos;s own storage) so you can write without a connection, plus a few preferences such as theme and language. We use no advertising or tracking cookies. Signing
        out removes your account&apos;s remembered sign-in from that device.
      </p>
    ),
  },
  {
    id: "keep",
    title: "How long we keep it and deleting it",
    body: (
      <>
        <p>
          We keep your account and writing for as long as you have a Litma account. Works you move to Trash can be deleted for good from there. To delete your whole account and everything in it, email{" "}
          <a href="mailto:support@getlitma.in?subject=Delete%20my%20Litma%20account">support@getlitma.in</a> from the email address of your account. We delete it within 30 days and confirm by email. Backups that may still hold it are replaced within a further
          30 days. Usage statistics are kept for up to 13 months.
        </p>
      </>
    ),
  },
  {
    id: "rights",
    title: "Your choices and rights",
    body: (
      <ul>
        <li>See and change your profile in the app at any time, and export your works as PDF or Word.</li>
        <li>Switch usage statistics off in Settings.</li>
        <li>Ask us for a copy of your data, to correct it, or to delete it, by writing to support@getlitma.in.</li>
        <li>If you are in India, the EU, the UK or another place with data protection law, you have the rights that law gives you. If you are not happy with our answer, you can complain to your data protection authority.</li>
      </ul>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: (
      <p>
        Litma uses encrypted connections (HTTPS), each account can reach only its own data, AI keys are encrypted and assistant tokens are stored only as fingerprints. No service is perfectly secure, so please use a strong password and tell us at once if
        you notice anything wrong.
      </p>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: <p>Litma is for writers aged 13 and over. If you are under 18, please use Litma with a parent&apos;s or guardian&apos;s permission. If you believe a child under 13 has given us information, write to us and we will delete it.</p>,
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: <p>If we change this policy, we will update the date above, and tell you in the app or by email before a change that matters takes effect.</p>,
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated={UPDATED}
      intro={
        <p>
          Litma is a place to write. This policy explains, in plain words, what information Litma keeps, why, and the choices you have. In short: your writing is yours, we keep only what the app needs, and we never sell your information. By using Litma you
          also agree to our <Link href="/terms/">Terms of Use</Link>.
        </p>
      }
      sections={sections}
      other={{ href: "/terms/", label: "Terms of Use" }}
    />
  );
}
