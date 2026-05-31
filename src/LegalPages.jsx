import { useNavigate } from "react-router-dom";

const T = {
  bg:"#ffffff", surface:"#f8f9fa", border:"#e8eaed",
  text:"#202124", textSub:"#5f6368", textHint:"#9aa0a6",
  accent:"#1a73e8", accentLight:"#e8f0fe",
  r:12, rsm:8, shadow:"0 1px 3px rgba(60,64,67,.15)",
};

function LegalLayout({ title, children }) {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight:"100vh", background:T.bg }}>
      <div style={{ background:T.bg, borderBottom:`1px solid ${T.border}`, padding:"10px 20px", display:"flex", alignItems:"center", gap:8, position:"sticky", top:0, zIndex:100 }}>
        <button onClick={()=>navigate(-1)}
          style={{ display:"flex", alignItems:"center", gap:6, background:"none", border:"none", cursor:"pointer", color:T.textSub, fontSize:14, fontWeight:500, padding:"7px 12px", borderRadius:100, fontFamily:"inherit" }}
          onMouseEnter={e=>e.currentTarget.style.background=T.surface}
          onMouseLeave={e=>e.currentTarget.style.background="none"}>
          ← Back
        </button>
        <span style={{ fontSize:13, color:T.textHint }}>{title}</span>
      </div>
      <div style={{ maxWidth:760, margin:"0 auto", padding:"40px 24px 80px" }}>
        <h1 style={{ margin:"0 0 6px", fontSize:28, fontWeight:400, color:T.text, letterSpacing:-0.5 }}>{title}</h1>
        <p style={{ margin:"0 0 40px", fontSize:13, color:T.textHint }}>Operated by Lenis res, MB · hi@judge.dog</p>
        {children}
      </div>
    </div>
  );
}

const H2 = ({children}) => (
  <h2 style={{ margin:"36px 0 10px", fontSize:17, fontWeight:500, color:T.text, letterSpacing:-0.2 }}>{children}</h2>
);
const H3 = ({children}) => (
  <h3 style={{ margin:"20px 0 6px", fontSize:14, fontWeight:600, color:T.textSub, textTransform:"uppercase", letterSpacing:0.4, fontSize:11 }}>{children}</h3>
);
const P = ({children, style:s}) => (
  <p style={{ margin:"0 0 14px", fontSize:14, color:T.textSub, lineHeight:1.75, ...s }}>{children}</p>
);
const Li = ({children}) => (
  <li style={{ fontSize:14, color:T.textSub, lineHeight:1.75, marginBottom:4 }}>{children}</li>
);
const Ul = ({children}) => (
  <ul style={{ margin:"0 0 14px", paddingLeft:22 }}>{children}</ul>
);
const Table = ({headers, rows}) => (
  <div style={{ overflowX:"auto", marginBottom:20 }}>
    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
      <thead>
        <tr style={{ background:T.surface }}>
          {headers.map(h=>(
            <th key={h} style={{ padding:"9px 14px", textAlign:"left", fontWeight:600, color:T.textSub, borderBottom:`2px solid ${T.border}`, whiteSpace:"nowrap" }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row,i)=>(
          <tr key={i} style={{ borderBottom:`1px solid ${T.border}`, background:i%2===0?T.bg:T.surface }}>
            {row.map((cell,j)=>(
              <td key={j} style={{ padding:"9px 14px", color:T.text, verticalAlign:"top" }}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const A = ({href, children}) => (
  <a href={href} target="_blank" rel="noreferrer" style={{ color:T.accent, textDecoration:"none" }}
    onMouseEnter={e=>e.currentTarget.style.textDecoration="underline"}
    onMouseLeave={e=>e.currentTarget.style.textDecoration="none"}>
    {children}
  </a>
);

const ContactBlock = () => (
  <div style={{ marginTop:40, padding:"18px 22px", background:T.surface, borderRadius:T.r, border:`1px solid ${T.border}` }}>
    <p style={{ margin:"0 0 4px", fontSize:13, fontWeight:600, color:T.text }}>Lenis res, MB</p>
    <p style={{ margin:0, fontSize:13, color:T.textSub, lineHeight:1.8 }}>
      Company code: 302896460 · VAT: LT100007253217<br/>
      Antakalnio g. 17, Vilnius, Lithuania<br/>
      <A href="mailto:hi@judge.dog">hi@judge.dog</A>
    </p>
  </div>
);

// ── Privacy Policy ─────────────────────────────────────────────────────────────
export function PrivacyPolicy() {
  return (
    <LegalLayout title="Privacy Policy">
      <P><em>Effective date: 1 June 2026</em></P>

      <H2>1. Who we are</H2>
      <P>
        judge.dog ("the Platform") is operated by <strong>Lenis res, MB</strong>, a company registered
        in the Republic of Lithuania (company code 302896460, VAT LT100007253217),
        Antakalnio g. 17, Vilnius. We act as the data controller for all personal data
        processed through the Platform. Contact us at <A href="mailto:hi@judge.dog">hi@judge.dog</A>.
      </P>

      <H2>2. Data we collect</H2>

      <H3>Account data</H3>
      <P>
        When you sign in with Google we receive your full name, email address, and profile
        photo URL from Google. We store this data in our database to operate your account.
      </P>

      <H3>Content you create</H3>
      <Ul>
        <Li><strong>Reviews:</strong> ratings, written review text, breed entered, show name, date submitted, and whether you would show under the judge again.</Li>
        <Li><strong>Messages:</strong> text of messages sent to judges or in response to contact requests.</Li>
        <Li><strong>Booking requests:</strong> show details, dates, and messages submitted to judges.</Li>
        <Li><strong>Profile content (verified judges only):</strong> bio, headline, career highlights, gallery photos, and social media links you choose to add.</Li>
      </Ul>

      <H3>Role and organiser profile data</H3>
      <P>
        When you create an account you select a role (Owner / Handler, Event Organiser, or both).
        We store your selected role and, if you activate the Event Organiser role, your organisation
        or club name, country, and city. This information is visible to judges when you send a
        booking inquiry and may appear on your public organiser profile in future.
      </P>

      <H3>Claim data</H3>
      <P>
        If you submit a judge profile claim, we store your name, email address, the identity
        of the judge claimed, submission date, claim status, and any internal administrative notes.
      </P>

      <H3>Analytics data (with consent only)</H3>
      <P>
        If you accept analytics cookies, Google Analytics 4 collects pages visited, time on
        page, navigation paths, device and browser type, and approximate geographic location
        (country/city level). No personally identifiable information is sent to Google Analytics.
      </P>

      <H3>Technical data</H3>
      <P>
        Firebase infrastructure (our hosting and database provider) may automatically log IP
        addresses and request metadata as part of normal server operations.
      </P>

      <H2>3. Legal basis for processing (GDPR)</H2>
      <Ul>
        <Li><strong>Performance of contract (Art. 6(1)(b)):</strong> processing your account data and user-generated content is necessary to provide the service you signed up for.</Li>
        <Li><strong>Legitimate interests (Art. 6(1)(f)):</strong> security, fraud prevention, claim verification, review moderation, and platform integrity.</Li>
        <Li><strong>Consent (Art. 6(1)(a)):</strong> analytics cookies. You may withdraw consent at any time via "Manage cookies" in the page footer.</Li>
      </Ul>

      <H2>4. Third-party processors</H2>
      <P>We use the following sub-processors, each bound by a data processing agreement:</P>
      <Table
        headers={["Service", "Provider", "Purpose"]}
        rows={[
          ["Firebase Authentication", "Google LLC", "User sign-in"],
          ["Cloud Firestore", "Google LLC", "Database storage"],
          ["Firebase Storage", "Google LLC", "Photo uploads"],
          ["Firebase Cloud Functions", "Google LLC", "Server-side email delivery"],
          ["Google Analytics 4", "Google LLC", "Usage analytics (consent-based)"],
          ["Resend", "Resend Inc.", "Transactional email delivery"],
          ["Sentry", "Functional Software, Inc.", "Error monitoring (anonymised crash reports)"],
          ["Microsoft Clarity", "Microsoft Corporation", "Session analytics (anonymised heatmaps)"],
        ]}
      />
      <P>
        Google LLC participates in the EU–US Data Privacy Framework and processes data
        subject to Standard Contractual Clauses. Resend processes data in accordance with GDPR.
      </P>

      <H2>5. Data retention</H2>
      <Table
        headers={["Data type", "Retention period"]}
        rows={[
          ["Account data", "Until you request deletion"],
          ["Reviews", "Indefinitely — they constitute the public record of the Platform"],
          ["Messages and booking requests", "Indefinitely"],
          ["Claim records", "Indefinitely, for audit and dispute purposes"],
          ["Google Analytics data", "14 months (GA4 default retention)"],
        ]}
      />

      <H2>6. Your rights under GDPR</H2>
      <P>You have the following rights regarding your personal data:</P>
      <Ul>
        <Li><strong>Access (Art. 15):</strong> request a copy of the data we hold about you.</Li>
        <Li><strong>Rectification (Art. 16):</strong> request correction of inaccurate data.</Li>
        <Li><strong>Erasure (Art. 17):</strong> request deletion of your personal data ("right to be forgotten").</Li>
        <Li><strong>Restriction (Art. 18):</strong> request that we limit how we use your data.</Li>
        <Li><strong>Portability (Art. 20):</strong> receive your data in a structured, machine-readable format.</Li>
        <Li><strong>Objection (Art. 21):</strong> object to processing based on legitimate interests.</Li>
        <Li><strong>Withdraw consent:</strong> for analytics cookies, at any time via the cookie banner.</Li>
      </Ul>
      <P>
        To exercise any right, email <A href="mailto:hi@judge.dog">hi@judge.dog</A>. We will respond
        within 30 days. You may also lodge a complaint with the{" "}
        <A href="https://vdai.lrv.lt">State Data Protection Inspectorate of Lithuania</A> or your
        local supervisory authority.
      </P>

      <H2>7. Cookies</H2>
      <P>See our <A href="/cookies">Cookie Policy</A> for full details on the cookies we use.</P>

      <H2>8. Children</H2>
      <P>
        judge.dog is not intended for persons under the age of 16. We do not knowingly collect
        personal data from children. If you believe a child has provided us with personal data,
        contact <A href="mailto:hi@judge.dog">hi@judge.dog</A> and we will delete it promptly.
      </P>

      <H2>9. International transfers</H2>
      <P>
        Some of our third-party processors (Google, Resend) are based in the United States.
        Any transfer of personal data to the US is carried out under Standard Contractual
        Clauses approved by the European Commission, providing an equivalent level of
        protection to that within the EU.
      </P>

      <H2>10. Changes to this policy</H2>
      <P>
        We may update this Privacy Policy from time to time. We will notify registered users
        of material changes by email at least 14 days before they take effect. The effective
        date at the top of this page reflects when the policy was last updated.
      </P>

      <ContactBlock/>
    </LegalLayout>
  );
}

// ── Terms of Service ───────────────────────────────────────────────────────────
export function TermsOfService() {
  return (
    <LegalLayout title="Terms of Service">
      <P><em>Effective date: 1 June 2026</em></P>
      <P>
        These Terms of Service ("Terms") govern your use of judge.dog ("the Platform"),
        operated by <strong>Lenis res, MB</strong> (company code 302896460, VAT LT100007253217,
        Antakalnio g. 17, Vilnius, Lithuania — "we", "us", "our").
      </P>

      <H2>1. Acceptance</H2>
      <P>
        By creating an account on judge.dog, you confirm that you have read, understood, and
        agree to be bound by these Terms and our{" "}
        <A href="/privacy">Privacy Policy</A>. If you do not agree, do not use the Platform.
      </P>

      <H2>2. The Platform</H2>
      <P>
        judge.dog is the professional network for dog judges. The Platform serves three types of users:
      </P>
      <Ul>
        <Li><strong>Owner / Handler:</strong> owners and handlers who enter dogs in shows, trials, or other competitive events. They may search judge profiles, read credentials, and submit reviews based on their first-hand experience competing under a judge.</Li>
        <Li><strong>Event Organiser:</strong> individuals or organisations that organise dog shows, trials, or other canine events. They may search for judges and send booking inquiries. Organisers may be unverified (identity not confirmed) or verified (identity confirmed via a third-party service). Judges can see an organiser's verification status.</Li>
        <Li><strong>Judge:</strong> licensed dog show or sport judges whose profiles are sourced from public FCI and national kennel club records. Judges may claim their profile, reply to reviews, and manage their public presence on the Platform.</Li>
      </Ul>
      <P>A single account may hold more than one of these roles simultaneously.</P>

      <H2>3. Eligibility</H2>
      <P>
        You must be at least 16 years old to register an account. By creating an account you
        confirm that you meet this requirement. Users under 16 are not permitted to use the Platform.
      </P>

      <H2>4. Your account</H2>
      <Ul>
        <Li>You sign in via Google. You are responsible for the security of your Google account and for all activity that occurs under your account.</Li>
        <Li>You must provide accurate and truthful information when using the Platform, including when selecting your role and providing organiser profile details.</Li>
        <Li>One account per person. Creating multiple accounts to circumvent moderation decisions is prohibited.</Li>
        <Li>You may not transfer your account to another person.</Li>
        <Li>We reserve the right to suspend or terminate accounts that violate these Terms.</Li>
      </Ul>

      <H2>5. Reviews and ratings</H2>
      <Ul>
        <Li>Reviews must be based on your <strong>genuine, first-hand experience competing or showing under the judge</strong> in question — in your capacity as an owner or handler, not as a show organiser who hired the judge.</Li>
        <Li>You must not submit reviews on behalf of third parties, incentivise others to submit reviews, or coordinate campaigns to artificially inflate or suppress a judge's rating.</Li>
        <Li>Reviews must not contain defamatory statements, false factual claims, personal attacks unrelated to the judging experience, discriminatory language, or any content that violates applicable law.</Li>
        <Li>By submitting a review, you grant Lenis res, MB a perpetual, worldwide, royalty-free, irrevocable licence to display it on the Platform and in related communications.</Li>
        <Li>We reserve the right to remove any review that violates these Terms without prior notice. Decisions on review removal are at our sole discretion.</Li>
      </Ul>

      <H2>6. Booking inquiries</H2>
      <Ul>
        <Li>Booking inquiries may be sent by users with the Event Organiser role (verified or unverified).</Li>
        <Li>You must only submit a booking inquiry if you are genuinely considering engaging the judge for a real event. Speculative, test, or harassing inquiries are prohibited.</Li>
        <Li>Judges are under no obligation to respond to or accept any inquiry.</Li>
        <Li>Unverified organisers are identified as such to judges. We recommend completing identity verification to improve response rates and build trust.</Li>
        <Li>The Platform facilitates communication between organisers and judges but is not a party to any contract or agreement that may result from a booking inquiry. Any fees, terms, or arrangements agreed between a judge and an organiser are solely between those parties.</Li>
      </Ul>

      <H2>7. Judge profiles</H2>
      <Ul>
        <Li>Profile data is sourced from publicly available FCI and national kennel club records. We make no warranty as to its completeness or accuracy.</Li>
        <Li>Judges may claim their profile by submitting a request through the Platform. Claims are reviewed and approved by our administrators. We reserve the right to approve or reject any claim at our sole discretion.</Li>
        <Li>Verified judges are solely responsible for the accuracy and appropriateness of all content they add to their claimed profile.</Li>
        <Li>We reserve the right to revoke verified status if a judge is found to have obtained it through misrepresentation or if they materially violate these Terms.</Li>
      </Ul>

      <H2>9. Prohibited conduct</H2>
      <P>You may not:</P>
      <Ul>
        <Li>Post false, misleading, or defamatory content about any judge or user.</Li>
        <Li>Submit a review in your capacity as a show organiser rather than as an owner or handler who competed under the judge.</Li>
        <Li>Harass, threaten, intimidate, or abuse any other user.</Li>
        <Li>Impersonate any person, judge, organisation, or official body.</Li>
        <Li>Use the Platform to send commercial advertising, spam, or unsolicited messages.</Li>
        <Li>Submit speculative, test, or bad-faith booking inquiries.</Li>
        <Li>Manipulate ratings through fake, coordinated, or incentivised reviews.</Li>
        <Li>Scrape, crawl, or systematically extract data from the Platform without our written permission.</Li>
        <Li>Attempt to access, reverse-engineer, or interfere with the technical operation of the Platform.</Li>
        <Li>Use the Platform in any way that violates applicable law, including EU consumer protection, data protection, or intellectual property law.</Li>
      </Ul>

      <H2>10. Intellectual property</H2>
      <P>
        The Platform, including its design, source code, and original content, is owned by
        Lenis res, MB and protected by applicable intellectual property law. You may not
        reproduce, modify, or commercially exploit any part of the Platform without our prior
        written consent. You retain ownership of the content you create; by posting it you
        grant us the licence described in section 5.
      </P>

      <H2>11. Disclaimers</H2>
      <P>
        The Platform is provided "as is" and "as available" without warranties of any kind,
        express or implied. We do not warrant that the Platform will be uninterrupted,
        error-free, or free of harmful components. Opinions expressed in reviews are those
        of individual users and do not represent the views of Lenis res, MB. Judge profile
        data sourced from third-party records is provided for informational purposes only.
        The Platform does not guarantee that booking inquiries will be accepted or that any
        engagement between organisers and judges will result in a contract.
      </P>

      <H2>12. Limitation of liability</H2>
      <P>
        To the fullest extent permitted by applicable law, Lenis res, MB and its personnel
        shall not be liable for any indirect, incidental, special, consequential, or punitive
        damages arising from your use of or inability to use the Platform, including but not
        limited to loss of data, loss of revenue, or reputational damage. Our total aggregate
        liability for any claim relating to the Platform shall not exceed EUR 100.
      </P>
      <P>
        Nothing in these Terms limits liability for death or personal injury caused by
        negligence, fraud, or any liability that cannot be excluded by law.
      </P>

      <H2>13. Governing law and jurisdiction</H2>
      <P>
        These Terms are governed by the laws of the Republic of Lithuania and applicable
        European Union law. Any disputes shall be subject to the exclusive jurisdiction of
        the courts of Vilnius, Lithuania, without prejudice to your rights as a consumer
        under mandatory EU consumer protection law.
      </P>

      <H2>14. Changes to these Terms</H2>
      <P>
        We may update these Terms at any time. We will notify registered users of material
        changes by email at least 14 days before they take effect. Continued use of the
        Platform after the effective date constitutes acceptance of the updated Terms.
      </P>

      <ContactBlock/>
    </LegalLayout>
  );
}

// ── Cookie Policy ──────────────────────────────────────────────────────────────
export function CookiePolicy() {
  return (
    <LegalLayout title="Cookie Policy">
      <P><em>Effective date: 1 June 2026</em></P>
      <P>
        This Cookie Policy explains what cookies and similar local storage technologies
        judge.dog uses, why we use them, and how you can manage your preferences.
      </P>

      <H2>1. What are cookies?</H2>
      <P>
        Cookies are small text files placed on your device by your browser when you visit a
        website. We also use <em>localStorage</em> — browser-side storage that persists
        beyond the browser session. Both serve similar purposes and are covered by this policy.
      </P>

      <H2>2. Essential storage (always active)</H2>
      <P>
        These are strictly necessary for the Platform to function. They cannot be disabled
        without breaking core functionality.
      </P>
      <Table
        headers={["Name / key", "Purpose", "Duration"]}
        rows={[
          ["Firebase Auth session", "Keeps you signed in to your judge.dog account", "Session / persistent"],
          ["jyj_v5_reviews (localStorage)", "Caches your local app state", "Persistent"],
          ["jyj_v5_bookings (localStorage)", "Caches your local app state", "Persistent"],
          ["jyj_cookie_consent (localStorage)", "Remembers your cookie preference so we don't ask again", "1 year"],
        ]}
      />

      <H2>3. Analytics cookies (optional — requires your consent)</H2>
      <P>
        We use <strong>Google Analytics 4</strong> to understand how visitors use judge.dog —
        which pages are popular, how people navigate, and where they drop off. This helps us
        improve the Platform. These cookies are only set after you click "Accept" on the
        cookie banner.
      </P>
      <Table
        headers={["Cookie", "Purpose", "Duration"]}
        rows={[
          ["_ga", "Distinguishes unique users", "2 years"],
          ["_ga_[ID]", "Persists session state", "2 years"],
        ]}
      />
      <P>
        Google Analytics data is anonymised and aggregated. No personally identifiable
        information is shared with Google through analytics. Google LLC processes this data
        under Standard Contractual Clauses.
      </P>

      <H2>4. No advertising cookies</H2>
      <P>
        We do not use advertising, retargeting, or third-party tracking cookies of any kind.
        We do not sell, rent, or share your browsing data with advertisers.
      </P>

      <H2>5. Managing your preferences</H2>
      <Ul>
        <Li>Click <strong>"Manage cookies"</strong> in the page footer at any time to review or change your analytics preference.</Li>
        <Li>You can opt out of Google Analytics across all websites using the <A href="https://tools.google.com/dlpage/gaoptout">Google Analytics Opt-out Browser Add-on</A>.</Li>
        <Li>You can clear cookies and localStorage via your browser settings — note that this will sign you out of judge.dog.</Li>
        <Li>Most modern browsers allow you to block cookies entirely. See your browser's help pages for instructions.</Li>
      </Ul>

      <H2>6. Changes</H2>
      <P>
        We may update this Cookie Policy to reflect changes in the technologies we use.
        The effective date at the top of this page will be updated accordingly.
      </P>

      <ContactBlock/>
    </LegalLayout>
  );
}

// ── Review Guidelines ──────────────────────────────────────────────────────────
export function ReviewGuidelines() {
  return (
    <LegalLayout title="Review Guidelines">
      <P><em>Effective date: 1 June 2026</em></P>
      <P>
        judge.dog is built on honest, first-hand reviews from people who have
        actually been judged. These guidelines exist to keep reviews useful,
        fair, and respectful — for judges, for readers, and for the community.
      </P>
      <P>
        By submitting a review you confirm that you have read and agree to
        these guidelines. We reserve the right to remove any review that
        violates them.
      </P>

      <H2>1. Write from your own experience as a competitor</H2>
      <P>
        Only review a judge you have personally competed or shown under — in your capacity
        as an owner or handler with a dog in the ring. Do not submit a review based on your
        experience as the show organiser who hired the judge. Do not relay stories you heard
        from others, repeat rumours, or review based on a judge's general reputation. If you
        were not in the ring yourself as a competitor, don't submit a review.
      </P>

      <H2>2. Be specific and factual</H2>
      <P>
        Describe what you actually observed — how the ring was run, what the
        judge prioritised, how they interacted with owners, handlers and dogs. Vague
        praise or vague criticism is not helpful to anyone. Concrete detail is.
      </P>

      <H2>3. Critique the judging, not the person</H2>
      <P>
        You may disagree with a judge's decisions. That is legitimate and
        welcome. What is not acceptable: personal attacks, comments about
        appearance, nationality, age, gender, or private life. Review the
        judging, not the human being.
      </P>

      <H2>4. No harassment or bullying</H2>
      <P>
        Reviews that are abusive, threatening, or intended to harm a judge's
        reputation rather than inform other owners and handlers will be removed
        immediately. Repeated violations may result in account suspension.
      </P>

      <H2>5. Declare conflicts of interest</H2>
      <P>
        Do not review a judge who is a close family member, your personal
        handler, a business partner, or anyone with whom you have a significant
        personal or financial relationship. Both positive and negative reviews
        with hidden conflicts of interest undermine the platform.
      </P>

      <H2>6. One honest review per event</H2>
      <P>
        Submit one review per judge per event. Duplicate reviews, coordinated
        review campaigns, and fake accounts are not permitted and will be
        removed.
      </P>

      <H2>7. No unverifiable claims</H2>
      <P>
        Do not make allegations — of misconduct, corruption, or wrongdoing —
        that you cannot substantiate. If you have a serious complaint about a
        judge, the correct route is through your national kennel club or
        the relevant governing body. judge.dog is not the place for unverified
        accusations.
      </P>

      <H2>Reporting a review</H2>
      <P>
        If you believe a review violates these guidelines, contact us at{" "}
        <A href="mailto:hi@judge.dog">hi@judge.dog</A> with the judge's name
        and a brief explanation. We review all reports and respond within 5
        business days.
      </P>

      <ContactBlock/>
    </LegalLayout>
  );
}
