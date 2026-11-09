import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";

/** Keep in step with COMMUNITY_GUIDELINES_VERSION (lib/community.ts) when writers must agree again. */
const UPDATED = "9 November 2026";

const sections: LegalSection[] = [
  {
    id: "purpose",
    title: "What the community is for",
    body: (
      <>
        <p>
          Litma Community is a place for people who write in Malayalam to talk to each other: about the craft of writing, about words and language, about reading each other&apos;s work, and about Litma itself. It is open to every signed-in Litma writer,
          whoever they are and wherever they write from.
        </p>
        <p>Writers of every religion, community, region, gender, age and ability are equally welcome here, and so are their words, names, festivals and ways of speaking.</p>
      </>
    ),
  },
  {
    id: "kind",
    title: "Be kind and fair",
    body: (
      <ul>
        <li>Talk about the writing, not the person. Honest feedback is welcome; insults are not.</li>
        <li>Disagree politely. Give reasons, and accept that others may see it differently.</li>
        <li>Remember that many people here are sharing work for the first time. Encourage them.</li>
        <li>Write in Malayalam, Manglish or English, whichever is easiest for you. Nobody should be mocked for their dialect, spelling or language.</li>
        <li>Post in the right category, and search before you ask a question that may already have an answer.</li>
      </ul>
    ),
  },
  {
    id: "never",
    title: "What is never allowed",
    body: (
      <>
        <p>Do not post, link to or share anything that:</p>
        <ul>
          <li>attacks, mocks or demeans people for their religion, caste, community, race, region, language, gender, sexual orientation, age, disability or appearance, or that stirs up hatred or enmity between groups;</li>
          <li>harasses, bullies, intimidates or threatens anyone, or encourages violence, self-harm or any crime;</li>
          <li>is sexual, obscene or pornographic, or that harms or sexualises children in any way;</li>
          <li>reveals someone&apos;s private information (phone number, address, photos, documents, messages) without their consent, or invades their privacy;</li>
          <li>is defamatory: false statements that damage a real person&apos;s or organisation&apos;s reputation;</li>
          <li>copies someone else&apos;s writing, translation, artwork or other work without permission, or passes it off as your own;</li>
          <li>pretends to be another person, a Litma team member or an organisation;</li>
          <li>is knowingly false or misleading in a way that can cause harm, including false information about health, elections or public safety;</li>
          <li>advertises, spams, sells, asks for money, or promotes gambling, betting or schemes to make money;</li>
          <li>carries malware or tries to break Litma or reach other people&apos;s accounts;</li>
          <li>threatens the unity, integrity, defence, security or sovereignty of India, friendly relations with other countries or public order, or breaks any law in force in India or where you live.</li>
        </ul>
        <p>
          Fiction may explore difficult subjects. When you share a passage for feedback that deals with violence, abuse or other hard themes, say so at the top, keep it brief, and never use a story as a cover for content listed above.
        </p>
      </>
    ),
  },
  {
    id: "your-work",
    title: "Your writing and other people's",
    body: (
      <ul>
        <li>You keep the rights to what you post. By posting, you let Litma show it to the community for as long as it stays posted.</li>
        <li>Share only writing that is yours, or that you have the right to share. You may quote a few lines of someone else&apos;s work for discussion, with the writer&apos;s name.</li>
        <li>Anything you post can be read by every signed-in Litma writer. Don&apos;t post work you plan to send to a publisher or competition if they want unpublished work.</li>
        <li>If you used an AI assistant to write a large part of a post or passage, say so.</li>
        <li>If you believe a post copies your work, report it or write to us (see below) and we will act on it.</li>
      </ul>
    ),
  },
  {
    id: "safety",
    title: "Privacy and safety",
    body: (
      <ul>
        <li>Your posts show your pen name (or your profile name) and your avatar. Pick a pen name in your profile if you prefer not to show your real name.</li>
        <li>Never share your password, sign-in links, phone number or address in a post. Litma will never ask for them in the community.</li>
        <li>Be careful about meeting or paying anyone you know only from the community. Litma is not part of any deal between members.</li>
        <li>If you are under 18, use the community with a parent&apos;s or guardian&apos;s permission, and tell an adult you trust if anything here makes you uncomfortable.</li>
      </ul>
    ),
  },
  {
    id: "moderation",
    title: "Reports and moderation",
    body: (
      <>
        <ul>
          <li>Use Report on any post that breaks these guidelines. The writer does not see who reported it.</li>
          <li>Litma&apos;s moderators can close a conversation (no new replies), remove a conversation or a reply, pin a conversation, and stop a writer from posting for a time or for good. A closed or removed conversation shows the reason.</li>
          <li>We may act without a report, and we may remove anything that breaks the law or these guidelines without warning.</li>
          <li>Removed posts, and posts you delete, are hidden at once and kept for 180 days in case the law requires them (for example, an investigation), then deleted for good.</li>
          <li>If you think a decision was wrong, write to us and we will look at it again.</li>
          <li>Breaking these guidelines in the community can also lead to action on your Litma account under the <Link href="/terms/">Terms of Use</Link>.</li>
        </ul>
      </>
    ),
  },
  {
    id: "responsibility",
    title: "Who is responsible for posts",
    body: (
      <>
        <p>
          <strong>Every post is written by a member of the community, and the member who posts it is solely responsible for it.</strong> Posts show the views of the people who write them, not of Litma. Litma does not write, check, approve or edit posts
          before they appear, and does not guarantee that anything posted is true, accurate, original, lawful or safe to rely on.
        </p>
        <p>
          Litma provides the community as an intermediary, as that term is used in India&apos;s Information Technology Act, 2000. As far as the law allows, Litma and the people who run it are not responsible or liable for any post, for anything a member
          does because of a post, or for any loss or harm that comes from one. Once we know about a post that breaks the law or these guidelines, through a report, a complaint or a lawful order, we act on it as the law requires.
        </p>
        <p>
          By posting, you agree that you will be responsible for any claim, loss or cost that Litma faces because of what you posted or because you broke these guidelines, and that you will make good that loss. The same applies to works you share or publish
          from your desk. See the <Link href="/terms/#community">Terms of Use</Link>.
        </p>
      </>
    ),
  },
  {
    id: "contact",
    title: "Complaints and grievances",
    body: (
      <>
        <p>
          To report a post that breaks the law (for example, defamation, copying of your work, someone&apos;s private images, or threats), use Report on the post, or email <a href="mailto:support@getlitma.in?subject=Community%20grievance">support@getlitma.in</a>{" "}
          with the subject “Community grievance”, a link to the post and what is wrong. We acknowledge complaints within 24 hours and resolve them within 15 days. Complaints about private images or content that exposes someone are handled within 24
          hours.
        </p>
        <p>Law enforcement and government requests can be sent to the same address.</p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes",
    body: <p>We may update these guidelines as the community grows. When a change matters, we will update the date above and ask you to agree again before your next post.</p>,
  },
];

export default function CommunityGuidelinesPage() {
  return (
    <LegalPage
      title="Community Guidelines"
      updated={UPDATED}
      intro={
        <>
          <p className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            എഴുത്തിന്റെ കൂട്ടായ്മ: എല്ലാവർക്കും സ്വാഗതം, എല്ലാവരോടും ബഹുമാനം.
          </p>
          <p>
            These guidelines keep <Link href="/community/">Litma Community</Link> a safe, kind place to talk about writing. You agree to them, and to our <Link href="/terms/">Terms of Use</Link>, before your first post.
          </p>
        </>
      }
      sections={sections}
      other={{ href: "/terms/", label: "Terms of Use" }}
      back={{ href: "/community/", label: "Litma Community" }}
    />
  );
}
