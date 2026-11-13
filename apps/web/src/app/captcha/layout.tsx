import { pageMetadata } from "@/lib/seo";

// shown only inside the apps' sign-in check (an iframe on web and desktop, a web view on the phone)
export const metadata = pageMetadata({ title: "Security check", path: "/captcha/", noindex: true });

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
