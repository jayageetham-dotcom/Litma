import React from "react";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";

export default function PrivacyPolicyPage() {
  return (
    <AuthShell quote={false}>
      <div className="space-y-6 text-left">
        <div>
          <Link href="/" className="text-sm font-medium text-indigo-600 hover:text-indigo-500 mb-2 inline-block">
            &larr; Back to Home
          </Link>
          <h1 className="text-2xl font-bold">Privacy Policy</h1>
          <p className="text-xs text-gray-500 mt-1">Last updated: November 7, 2026</p>
        </div>

        <div className="space-y-5 text-sm leading-relaxed text-gray-700">
          <section>
            <p>
              At <strong>GetLitma</strong>, accessible from <a href="https://getlitma.in" className="text-indigo-600 underline">https://getlitma.in</a>[cite: 1], one of our main priorities is the privacy of our visitors. This Privacy Policy document contains types of information that is collected and recorded by GetLitma and how we use it.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-1">1. Information We Collect</h2>
            <p>
              When you choose to sign in using your Google account, we request and collect the following limited scopes necessary to provide our application services:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Email Address:</strong> Your primary Google account email address to identify your user profile.</li>
              <li><strong>Profile Information:</strong> Basic profile details (such as your name and profile picture) to personalize your experience.</li>
              <li><strong>OpenID Data:</strong> Used strictly for secure authentication purposes via our backend provider (Supabase).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-1">2. How We Use Your Information</h2>
            <p>We use the information we collect in various ways, including to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Provide, operate, and maintain our application.</li>
              <li>Authenticate your identity and secure your account access.</li>
              <li>Manage user sessions and database records.</li>
              <li>Communicate with you for customer support, notices, or service updates.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-1">3. Data Security and Third-Party Sharing</h2>
            <p>
              We implement industry-standard security measures to protect your personal data. We do not sell, trade, or otherwise transfer your personally identifiable information to outside parties.
            </p>
            <p className="mt-2">
              We utilize trusted third-party service providers (such as <strong>Supabase</strong>[cite: 1] for database hosting and secure authentication) who assist us in operating our app, provided those parties agree to keep this information strictly confidential.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-1">4. Data Deletion and Your Rights</h2>
            <p>
              If you wish to delete your account, revoke access, or remove all associated personal data from our servers, you can contact us directly at <a href="mailto:support@getlitma.in" className="text-indigo-600 underline">support@getlitma.in</a>[cite: 1]. You can also manage or disconnect app access at any time via your <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">Google Account Security Settings</a>.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-1">5. Contact Us</h2>
            <p>
              If you have additional questions or require more information about our Privacy Policy, do not hesitate to contact us through email at <a href="mailto:support@getlitma.in" className="text-indigo-600 underline">support@getlitma.in</a>[cite: 1].
            </p>
          </section>
        </div>
      </div>
    </AuthShell>
  );
}