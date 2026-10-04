import LegalPage from '@/components/legal-page'
import { CONTACT_EMAIL, OPERATOR, PROCESSORS } from '@/lib/legal'

export const metadata = { title: 'Privacy Policy · Expense Tracker' }

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <section>
        <p>
          This explains what the Expense Tracker Telegram bot and this website (together, the &ldquo;service&rdquo;) collect,
          why, who else handles it, and how you can export or delete it. The service is run by {OPERATOR}. Questions: {CONTACT_EMAIL}.
        </p>
      </section>

      <section>
        <h2>What we collect</h2>
        <ul>
          <li><strong>From Telegram:</strong> your numeric Telegram ID, username, and first and last name.</li>
          <li><strong>For the dashboard:</strong> your email address and a password. The password is stored only as a hash by our login provider; we cannot see it.</li>
          <li><strong>What you record:</strong> entries (amount, date, description, category), accounts and balances, budgets, savings goals, debts (including the names and notes you type), recurring items, and your reminder time.</li>
          <li><strong>What you send the bot:</strong> commands and messages, and optionally receipt photos or voice notes, which are processed to create entries.</li>
          <li><strong>Technical data:</strong> standard server logs, and the sign-in cookie that keeps you logged in to the dashboard.</li>
        </ul>
        <p className="mt-2">We do not use advertising, analytics or tracking cookies, and we do not ask for bank logins or card numbers.</p>
      </section>

      <section>
        <h2>How we use it</h2>
        <p>
          To run the features you use: recording and showing your entries, budgets, goals and debts, sending the daily
          reminder if you turn it on, linking the bot to your dashboard, and keeping the service secure and free of abuse.
          We do not sell your data and we do not use it for advertising or profiling.
        </p>
      </section>

      <section>
        <h2>Who else handles your data</h2>
        <p>We use these providers to run the service. Each receives only what it needs for its job:</p>
        <ul className="mt-2">
          {PROCESSORS.map(p => (
            <li key={p.name}><strong>{p.name}</strong> ({p.role}): {p.receives}</li>
          ))}
        </ul>
        <p className="mt-2">Some of these providers are outside India, so your data may be processed in other countries.</p>
      </section>

      <section>
        <h2>How long we keep it</h2>
        <p>
          Until you delete it. Sending <code>/deletemydata</code> to the bot, or using &ldquo;Delete account&rdquo; in the dashboard
          Settings, permanently erases your entries, accounts, budgets, goals, debts, recurring items, reminders, your
          Telegram profile record and your dashboard login. Our providers may keep backup copies for a limited time after that,
          and server logs are kept only briefly.
        </p>
      </section>

      <section>
        <h2>Your choices</h2>
        <ul>
          <li><strong>See and export:</strong> everything you recorded is visible in the bot and dashboard, and <code>/export</code> gives you a CSV of your entries.</li>
          <li><strong>Correct:</strong> edit or delete entries with <code>/recent</code> and the Undo and Category buttons.</li>
          <li><strong>Disconnect the dashboard:</strong> send <code>/unlink</code>.</li>
          <li><strong>Delete everything:</strong> <code>/deletemydata</code> or dashboard Settings. This cannot be undone.</li>
          <li><strong>Anything else:</strong> write to {CONTACT_EMAIL}.</li>
        </ul>
      </section>

      <section>
        <h2>Security</h2>
        <p>
          Traffic is encrypted, each user&rsquo;s data is separated from every other user&rsquo;s, and sign-in codes are
          short-lived and single-use. No system is perfectly secure, so please use a strong, unique password and
          keep your Telegram account secure.
        </p>
      </section>

      <section>
        <h2>Children</h2>
        <p>The service is not meant for anyone under 18, and we do not knowingly collect data from children.</p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>If we change this policy in a way that matters, we will update the date above and, where we can, tell you in the bot.</p>
      </section>
    </LegalPage>
  )
}
