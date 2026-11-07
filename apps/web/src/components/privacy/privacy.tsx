import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy - GetLitma',
  description: 'Privacy Policy for GetLitma outlining how we collect, use, and protect your data.',
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <div className="mb-8">
          <Link 
            href="/" 
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500 mb-4 inline-block"
          >
            &larr; Back to Home
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">Privacy Policy</h1>
          <p className="text-sm text-gray-500 mt-2">Last updated: November 7, 2026</p>
        </div>

        <div className="space-y-6 text-base leading-relaxed">
          <section>
            <p>
              At <strong>GetLitma</strong>, accessible from <a href="https://getlitma.in" className="text-indigo-600 underline">https://getlitma.in</a>, one of our main priorities is the privacy of our visitors. This Privacy Policy document contains types of information that is collected and recorded by GetLitma and how we use it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mt-6 mb-3">1. Information We Collect</h2>
            <p>
              When you choose to sign in using your Google account, we request and collect the following limited scopes necessary to provide our application services:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Email Address:</strong> Your primary Google account email address to identify your user profile.</li>
              <li><strong>Profile Information:</strong> Basic profile details (such as your name and profile picture) to personalize your experience within the app.</li>
              <li><strong>OpenID Data:</strong> Used strictly for secure authentication purposes via our backend provider (Supabase).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mt-6 mb-3">2. How We Use Your Information</h2>
            <p>We use the information we collect in various ways, including to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Provide, operate, and maintain our application.</li>
              <li>Authenticate your identity and secure your account access.</li>
              <li>Manage user sessions and database records.</li>
              <li>Communicate with you for customer support, notices, or service updates.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mt-6 mb-3">3. Data Security and Third-Party Sharing</h2>
            <p>
              We implement industry-standard security measures to protect your personal data. We do not sell, trade, or otherwise transfer your personally identifiable information to outside parties. 
            </p>
            <p className="mt-2">
              We utilize trusted third-party service providers (such as <strong>Supabase</strong>[cite: 1] for database hosting and secure authentication) who assist us in operating our app, provided those parties agree to keep this information strictly confidential.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mt-6 mb-3">4. Data Deletion and Your Rights</h2>
            <p>
              If you wish to delete your account, revoke access, or remove all associated personal data from our servers, you can contact us directly at <a href="mailto:support@getlitma.in" className="text-indigo-600 underline">support@getlitma.in</a>[cite: 1]. You can also manage or disconnect app access at any time via your <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">Google Account Security Settings</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mt-6 mb-3">5. Contact Us</h2>
            <p>
              If you have additional questions or require more information about our Privacy Policy, do not hesitate to contact us through email at <a href="mailto:support@getlitma.in" className="text-indigo-600 underline">support@getlitma.in</a>[cite: 1].
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}