import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";

const UPDATED = "13 November 2026";

const sections: LegalSection[] = [
  {
    id: "agree",
    title: "Using Litma",
    body: (
      <p>
        These terms apply to Litma&apos;s website at <a href="https://getlitma.in">getlitma.in</a>, its desktop app and its phone app. By creating an account or using Litma you agree to them and to our <Link href="/privacy/">Privacy Policy</Link>. If you
        don&apos;t agree, please don&apos;t use Litma.
      </p>
    ),
  },
  {
    id: "account",
    title: "Your account",
    body: (
      <ul>
        <li>You need to be 13 or older to use Litma. If you are under 18, use it with a parent&apos;s or guardian&apos;s permission.</li>
        <li>Give a real email address and keep your sign-in safe. You are responsible for what happens in your account.</li>
        <li>One person per account. Tell us at support@getlitma.in if you think someone else has used yours.</li>
      </ul>
    ),
  },
  {
    id: "writing",
    title: "Your writing",
    body: (
      <>
        <p>
          You keep all rights to everything you write in Litma. We claim no ownership of it. You give us only the permission we need to store it, sync it between your devices, show it to you, and show it to others when you share it by link or publish it.
          That permission ends when you delete the work or your account.
        </p>
        <p>Please keep your own copies of important work (Litma can export PDF and Word files). We take care of your writing, but no service can promise it will never lose data.</p>
      </>
    ),
  },
  {
    id: "rules",
    title: "Fair use",
    body: (
      <>
        <p>Please don&apos;t use Litma to:</p>
        <ul>
          <li>share or post writing that you have no right to share, or that breaks the law;</li>
          <li>share content that attacks or demeans people for their religion, caste, race, community, region, gender, age or ability, or that harasses or threatens anyone;</li>
          <li>try to reach other people&apos;s accounts or data, break Litma&apos;s security, or overload its servers;</li>
          <li>copy, resell or rebuild Litma&apos;s service, or scrape its dictionary in bulk.</li>
        </ul>
        <p>We may remove a shared link or a community post that breaks these rules, and block an account that keeps breaking them, for a time or for good. For serious or repeated abuse (spam, attacks on the service, illegal content) we may delete the account. Where we can, we will tell you first and explain why.</p>
      </>
    ),
  },
  {
    id: "community",
    title: "Community and other people's content",
    body: (
      <>
        <p>
          <Link href="/community/">Litma Community</Link> lets signed-in writers post conversations and replies that other writers can read. Before your first post you agree to the <Link href="/community/guidelines/">Community Guidelines</Link>, which are
          part of these terms.
        </p>
        <ul>
          <li>
            <strong>You are responsible for what you post, share or publish.</strong> Posts in the community, works you share by link or publish, and anything else a writer makes public through Litma are written by that writer, not by Litma. They
            show the writer&apos;s own views.
          </li>
          <li>
            Litma does not write, check or approve that content before it appears, and does not guarantee that it is true, accurate, original or lawful. As far as the law allows, Litma is not responsible or liable for content created by writers, or for
            any loss or harm that comes from it.
          </li>
          <li>
            Litma acts as an intermediary under India&apos;s Information Technology Act, 2000 and the rules made under it. When we learn of content that breaks the law or our guidelines, through a report, a complaint or a lawful order, we remove it or
            limit access to it as the law requires, and we may keep it for up to 180 days afterwards when the law asks us to.
          </li>
          <li>
            You agree to make good any claim, loss, cost or legal expense that Litma or the people who run it face because of content you posted, shared or published, or because you broke these terms or the guidelines.
          </li>
          <li>
            We may close or remove conversations, remove posts, and stop an account from posting, with or without notice, when content breaks these terms or the guidelines. Complaints and grievances go to{" "}
            <a href="mailto:support@getlitma.in?subject=Community%20grievance">support@getlitma.in</a> (see <Link href="/community/guidelines/#contact">Complaints and grievances</Link>).
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "ai",
    title: "AI companion and assistants",
    body: (
      <p>
        The AI companion works with your own key for Claude, ChatGPT or Gemini, or hands your request to your own AI app. Those requests go to the provider you choose, under that provider&apos;s terms, and any cost is between you and them. AI suggestions
        can be wrong. Suggestions from an AI assistant arrive in your inbox, and nothing changes in your writing until you accept it.
      </p>
    ),
  },
  {
    id: "dictionary",
    title: "Dictionary, spelling and fonts",
    body: (
      <p>
        Litma&apos;s dictionary, spelling check and fonts use open data and software, each under its own licence (listed in <Link href="/help/?a=credits">Credits and licences</Link>). Meanings and spelling suggestions are for guidance; check important ones yourself.
      </p>
    ),
  },
  {
    id: "service",
    title: "The service",
    body: (
      <>
        <p>
          Litma is free to use today. We keep improving it, so features may change. If we ever plan to charge for something, or to close Litma, we will tell you well in advance and give you time to export your writing.
        </p>
        <p>
          Litma is provided “as is”. As far as the law allows, we are not liable for indirect losses, for losses caused by things outside our control, such as a broken connection or a third-party service, or for content created by other writers (see
          Community and other people&apos;s content above). Nothing in these terms limits rights
          you have by law that cannot be limited.
        </p>
      </>
    ),
  },
  {
    id: "leaving",
    title: "Leaving Litma",
    body: (
      <p>
        You can stop using Litma at any time. To delete your account and all your writing, open Settings → Delete account in any Litma app, or email <a href="mailto:support@getlitma.in?subject=Delete%20my%20Litma%20account">support@getlitma.in</a> from your account&apos;s email address. Export anything you want
        to keep first.
      </p>
    ),
  },
  {
    id: "law",
    title: "Law and changes",
    body: (
      <>
        <p>These terms are governed by the laws of India, and the courts of Kerala have jurisdiction, unless the law of the place you live gives you the right to go to your own courts.</p>
        <p>If we change these terms, we will update the date above and tell you in the app or by email before a change that matters takes effect. Using Litma after that means you accept the new terms.</p>
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      updated={UPDATED}
      intro={<p>Thank you for writing with Litma. These terms are the agreement between you and Litma, in plain words. Please read them with our Privacy Policy.</p>}
      sections={sections}
      other={{ href: "/privacy/", label: "Privacy Policy" }}
    />
  );
}
