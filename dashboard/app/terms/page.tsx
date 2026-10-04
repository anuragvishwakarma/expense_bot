import LegalPage from '@/components/legal-page'
import { CONTACT_EMAIL, GOVERNING_LAW, OPERATOR } from '@/lib/legal'

export const metadata = { title: 'Terms of Service · Expense Tracker' }

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <section>
        <p>
          By using the Expense Tracker Telegram bot or this website (the &ldquo;service&rdquo;), run by {OPERATOR}, you agree to
          these terms and to the <a href="/privacy">Privacy Policy</a>. If you do not agree, please do not use the service.
        </p>
      </section>

      <section>
        <h2>What the service is</h2>
        <p>A personal tool for recording and reviewing your own spending, income, budgets, goals and debts through a Telegram bot and a web dashboard.</p>
      </section>

      <section>
        <h2>Your account</h2>
        <ul>
          <li>You must be at least 18 and give accurate information.</li>
          <li>You are responsible for your Telegram account, your dashboard password, and what happens with them. Tell us if you think someone else has access.</li>
          <li>One account is for one person. Do not share link codes.</li>
        </ul>
      </section>

      <section>
        <h2>Not financial advice, and check the numbers</h2>
        <p>
          The service shows what you record. It does not give financial, tax, legal or investment advice. Amounts, categories and
          dates can be wrong, especially when read by software from free text, photos or voice (an AI model may misread a
          message). Always review what is saved, and do not rely on the service as your only financial record.
        </p>
      </section>

      <section>
        <h2>Using it properly</h2>
        <p>Do not try to access anyone else&rsquo;s data, break or overload the service, send it unlawful content, or use automated tools to scrape or flood it. We may limit or suspend access that does.</p>
      </section>

      <section>
        <h2>Your data</h2>
        <p>
          Your data stays yours. You allow us to store and process it only to run the service for you, as described in the
          Privacy Policy. You can export or delete it at any time.
        </p>
      </section>

      <section>
        <h2>Availability and changes</h2>
        <p>
          We work to keep the service running but do not promise it will always be available, error-free or unchanged. We may
          change, pause or stop features. Please keep your own copy of anything important, for example with <code>/export</code>.
        </p>
      </section>

      <section>
        <h2>Ending your use</h2>
        <p>You can stop at any time and delete your data with <code>/deletemydata</code> or in dashboard Settings. We may suspend or end access for breaking these terms.</p>
      </section>

      <section>
        <h2>Limits on our responsibility</h2>
        <p>
          The service is provided &ldquo;as is&rdquo;. To the extent the law allows, we are not responsible for losses that result from
          errors in recorded data, interruptions, lost data, or your decisions based on what the service shows. Nothing here limits
          rights you have by law that cannot be limited.
        </p>
      </section>

      <section>
        <h2>Changes, law and contact</h2>
        <p>
          We may update these terms and will change the date above when we do; continuing to use the service means you accept the
          update. These terms are governed by the law of {GOVERNING_LAW}. Questions: {CONTACT_EMAIL}.
        </p>
      </section>
    </LegalPage>
  )
}
