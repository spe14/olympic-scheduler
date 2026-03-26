"use client";

import Modal from "@/components/modal";

export default function PrivacyPolicyModal({
  onClose,
}: {
  onClose: () => void;
}) {
  return (
    <Modal title="Privacy Policy" onClose={onClose} size="2xl">
      <p className="mb-6 text-xs text-slate-400">
        Last updated: March 26, 2026
      </p>

      <div className="space-y-6 text-sm leading-relaxed text-slate-600">
        <section>
          <h3 className="mb-2 text-sm font-semibold capitalize text-slate-900">
            Who we are
          </h3>
          <p>
            Collaboly is an independent, non-commercial tool for planning
            Olympic attendance. It is not affiliated with the LA 2028 organizing
            committee or the International Olympic Committee. For any
            privacy-related requests, contact us at{" "}
            <a
              href="mailto:collaboly@gmail.com"
              className="text-[#009de5] hover:underline"
            >
              collaboly@gmail.com
            </a>
            .
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold capitalize text-slate-900">
            What data we collect
          </h3>
          <p className="mb-2">
            When you create an account, we collect your first name, last name,
            username, email address, and avatar color preference.
          </p>
          <p>
            As you use the app, we store data you create: group memberships,
            sport preferences, session interest ratings, buddy constraints,
            schedule outputs, and purchase tracking information (including
            ticket prices and amounts paid). This data is linked to your
            account.
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold capitalize text-slate-900">
            Why we collect it
          </h3>
          <p>
            All data is collected solely to provide the scheduling and
            coordination service you signed up for. The legal basis for
            processing is performance of the contract between you and us — i.e.,
            to operate the service. We do not sell, share, or use your data for
            advertising or any purpose beyond operating the app.
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold capitalize text-slate-900">
            Error monitoring
          </h3>
          <p>
            We use{" "}
            <a
              href="https://sentry.io/privacy/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#009de5] hover:underline"
            >
              Sentry
            </a>{" "}
            to detect and diagnose application errors. When an error occurs,
            Sentry automatically collects technical context such as browser
            type, operating system, the URL where the error happened, and the
            error message. We do not send your name, email, or any other
            personally identifiable information to Sentry. IP addresses are
            discarded by Sentry before storage and are not retained.
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold capitalize text-slate-900">
            Data hosting
          </h3>
          <p>
            Your data is stored and processed by Supabase, our database and
            authentication provider. Error monitoring data is processed by
            Sentry. Both act as data processors on our behalf. See{" "}
            <a
              href="https://supabase.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#009de5] hover:underline"
            >
              Supabase&apos;s Privacy Policy
            </a>{" "}
            and{" "}
            <a
              href="https://sentry.io/privacy/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#009de5] hover:underline"
            >
              Sentry&apos;s Privacy Policy
            </a>{" "}
            for details on how they handle data. Your data may be transferred to
            and processed in the United States by our service providers, who
            operate under Standard Contractual Clauses approved by the European
            Commission.
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold capitalize text-slate-900">
            Cookies
          </h3>
          <p className="mb-2">
            This app uses strictly necessary cookies only — no tracking,
            analytics, or advertising cookies are used. The following cookies
            are set:
          </p>
          <ul className="space-y-2">
            <li className="flex gap-2">
              <span className="mt-0.5 shrink-0 text-slate-400">•</span>
              <span>
                <span className="font-medium text-slate-700">
                  Authentication token
                </span>{" "}
                — set by Supabase to keep you logged in across page loads.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 shrink-0 text-slate-400">•</span>
              <span>
                <span className="font-medium text-slate-700">
                  Session start
                </span>{" "}
                — records when your session began to enforce a 7-day maximum
                session length.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 shrink-0 text-slate-400">•</span>
              <span>
                <span className="font-medium text-slate-700">Last active</span>{" "}
                — updated on each request to detect inactivity and log you out
                after 60 minutes of idle time.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 shrink-0 text-slate-400">•</span>
              <span>
                <span className="font-medium text-slate-700">
                  Password reset
                </span>{" "}
                — a short-lived cookie set during the password reset flow,
                expires after 5 minutes.
              </span>
            </li>
          </ul>
          <p className="mt-2">
            All cookies are httpOnly and used solely for authentication and
            session security. Because these cookies are strictly necessary for
            the service to function, no cookie consent banner is shown.
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold capitalize text-slate-900">
            Password storage
          </h3>
          <p>
            Passwords are managed entirely by our authentication provider,
            Supabase. We never store, access, or log your password directly.
            Supabase hashes passwords using industry-standard algorithms before
            storage.
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold capitalize text-slate-900">
            Minimum age
          </h3>
          <p>
            This service is intended for users aged 13 and older. We do not
            knowingly collect personal data from children under 13. If you
            believe a child under 13 has created an account, please contact us
            at{" "}
            <a
              href="mailto:collaboly@gmail.com"
              className="text-[#009de5] hover:underline"
            >
              collaboly@gmail.com
            </a>{" "}
            so we can delete it.
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold capitalize text-slate-900">
            Data retention
          </h3>
          <p>
            Your data is retained for as long as your account exists. You can
            permanently delete your account and all associated data at any time
            from the Profile page.
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold capitalize text-slate-900">
            Data breach notification
          </h3>
          <p>
            In the event of a data breach affecting your personal data, we will
            notify you and the relevant supervisory authority as required by
            applicable law.
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold capitalize text-slate-900">
            Your rights
          </h3>
          <p className="mb-2">
            Depending on where you are located, you may have rights under
            applicable privacy laws (including GDPR for EU/UK residents) to:
          </p>
          <ul className="space-y-2">
            <li className="flex gap-2">
              <span className="mt-0.5 shrink-0 text-slate-400">•</span>
              <span>
                <span className="font-medium text-slate-700">
                  Delete your account
                </span>{" "}
                — available directly from the Profile page at any time.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 shrink-0 text-slate-400">•</span>
              Access a copy of the personal data we hold about you
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 shrink-0 text-slate-400">•</span>
              Request correction of inaccurate data
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 shrink-0 text-slate-400">•</span>
              Request a portable copy of your data
            </li>
          </ul>
          <p className="mt-2">
            For any other requests, contact us at{" "}
            <a
              href="mailto:collaboly@gmail.com"
              className="text-[#009de5] hover:underline"
            >
              collaboly@gmail.com
            </a>
            . You also have the right to lodge a complaint with your local data
            protection authority (for example, the ICO in the UK or your
            national supervisory authority in the EU).
          </p>
        </section>
      </div>
    </Modal>
  );
}
