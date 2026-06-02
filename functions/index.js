const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { Resend } = require("resend");

if (!getApps().length) initializeApp();

const RESEND_KEY = defineSecret("RESEND_API_KEY");
const RECAPTCHA_SECRET = defineSecret("RECAPTCHA_SECRET_KEY");
const FROM = "judge.dog <noreply@judge.dog>";
const ADMIN_EMAIL = "hi@judge.dog";

// ── Booking email templates ───────────────────────────────────────────────────

function bookingToJudgeHtml({ judgeName, judgeSlug, organiserName, clubName, showName, date, location, country, breeds, entries, feeDiscussion, message, organiserId, claimed }) {
  const profileUrl = `https://judge.dog/judge/${judgeSlug}`;
  const safe = s => (s||"").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br>");
  const row = (label, value) => value ? `
    <tr><td style="padding:7px 12px;color:#9aa0a6;font-size:13px;white-space:nowrap;vertical-align:top">${label}</td>
    <td style="padding:7px 12px;color:#202124;font-size:13px;">${safe(value)}</td></tr>` : "";
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:'Segoe UI',system-ui,sans-serif;color:#202124;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(60,64,67,.15);">
    <div style="background:#1a73e8;padding:28px 32px;">
      <span style="font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px;">judge<span style="font-weight:400;">.dog</span></span>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 6px;font-size:22px;font-weight:400;color:#202124;">Booking inquiry received</p>
      <p style="margin:0 0 20px;font-size:14px;color:#5f6368;line-height:1.6;">
        Hi ${safe(judgeName)}, <strong>${safe(organiserName)}</strong>${clubName ? ` (${safe(clubName)})` : ""} has sent you a booking inquiry through judge.dog.
      </p>
      <table style="width:100%;border-collapse:collapse;background:#f8f9fa;border-radius:8px;margin-bottom:20px;">
        ${row("Show / Event", showName)}
        ${row("Date", date)}
        ${row("Location", location + (country ? ", " + country : ""))}
        ${row("Breeds / disciplines", breeds)}
        ${row("Expected entries", entries)}
        ${row("Fee & travel", feeDiscussion)}
      </table>
      ${message ? `<div style="background:#f0f4ff;border-left:3px solid #1a73e8;border-radius:4px;padding:14px 16px;margin-bottom:24px;font-size:14px;color:#202124;line-height:1.7;">${safe(message)}</div>` : ""}
      <a href="${profileUrl}" style="display:inline-block;padding:12px 24px;background:#1a73e8;color:#fff;text-decoration:none;border-radius:100px;font-size:14px;font-weight:500;">${claimed ? "View and respond on judge.dog →" : "Claim your profile to respond →"}</a>
    </div>
    <div style="padding:16px 32px 24px;border-top:1px solid #e8eaed;">
      <p style="margin:0;font-size:12px;color:#9aa0a6;line-height:1.6;">
        You received this because your judge profile is listed on judge.dog.
        To stop receiving these notifications, contact <a href="mailto:hi@judge.dog" style="color:#1a73e8;">hi@judge.dog</a>.
      </p>
    </div>
  </div>
</body></html>`;
}

function bookingConfirmationHtml({ organiserName, judgeName, judgeSlug, showName, date }) {
  const profileUrl = `https://judge.dog/judge/${judgeSlug}`;
  const safe = s => (s||"").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:'Segoe UI',system-ui,sans-serif;color:#202124;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(60,64,67,.15);">
    <div style="background:#1a73e8;padding:28px 32px;">
      <span style="font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px;">judge<span style="font-weight:400;">.dog</span></span>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 6px;font-size:22px;font-weight:400;color:#202124;">Inquiry sent</p>
      <p style="margin:0 0 20px;font-size:14px;color:#5f6368;line-height:1.6;">
        Hi ${safe(organiserName)}, your booking inquiry for <strong>${safe(showName)}</strong> on ${safe(date)} has been sent to <strong>${safe(judgeName)}</strong>.
      </p>
      <p style="margin:0 0 20px;font-size:13px;color:#5f6368;line-height:1.6;">
        The judge has been notified and can respond through their judge.dog profile. You'll hear back directly by email.
      </p>
      <a href="${profileUrl}" style="display:inline-block;padding:12px 24px;background:#f8f9fa;color:#202124;text-decoration:none;border-radius:100px;font-size:14px;font-weight:500;border:1px solid #e8eaed;">View judge profile</a>
    </div>
    <div style="padding:16px 32px 24px;border-top:1px solid #e8eaed;">
      <p style="margin:0;font-size:12px;color:#9aa0a6;">
        You're receiving this because you sent a booking inquiry on <a href="https://judge.dog" style="color:#1a73e8;">judge.dog</a>.
      </p>
    </div>
  </div>
</body></html>`;
}

// ── Email templates ────────────────────────────────────────────────────────────

function adminNewClaimHtml({ userName, userEmail, judgeName, judgeSlug }) {
  const profileUrl = `https://judge.dog/judge/${judgeSlug}`;
  const adminUrl = "https://judge.dog/admin";
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:'Segoe UI',system-ui,sans-serif;color:#202124;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(60,64,67,.15);">
    <div style="background:#1a73e8;padding:28px 32px;">
      <span style="font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px;">judge<span style="font-weight:400;">.dog</span></span>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 8px;font-size:22px;font-weight:400;color:#202124;">New profile claim</p>
      <p style="margin:0 0 20px;font-size:14px;color:#5f6368;line-height:1.6;">
        <strong>${userName}</strong> (${userEmail}) has submitted a claim for the profile of <strong>${judgeName}</strong>.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px;">
        <tr style="background:#f8f9fa;">
          <td style="padding:8px 12px;color:#9aa0a6;width:120px;">Claimant</td>
          <td style="padding:8px 12px;color:#202124;">${userName}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;color:#9aa0a6;">Email</td>
          <td style="padding:8px 12px;color:#202124;">${userEmail}</td>
        </tr>
        <tr style="background:#f8f9fa;">
          <td style="padding:8px 12px;color:#9aa0a6;">Judge</td>
          <td style="padding:8px 12px;color:#202124;">${judgeName}</td>
        </tr>
      </table>
      <div style="display:flex;gap:12px;">
        <a href="${adminUrl}" style="display:inline-block;padding:11px 22px;background:#1a73e8;color:#fff;text-decoration:none;border-radius:100px;font-size:14px;font-weight:500;margin-right:12px;">Review in admin</a>
        <a href="${profileUrl}" target="_blank" style="display:inline-block;padding:11px 22px;background:#f8f9fa;color:#202124;text-decoration:none;border-radius:100px;font-size:14px;font-weight:500;border:1px solid #e8eaed;">View profile</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function approvedHtml({ userName, judgeName, judgeSlug }) {
  const url = `https://judge.dog/judge/${judgeSlug}`;
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:'Segoe UI',system-ui,sans-serif;color:#202124;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(60,64,67,.15);">
    <div style="background:#1a73e8;padding:28px 32px;">
      <span style="font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px;">judge<span style="font-weight:400;">.dog</span></span>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 8px;font-size:22px;font-weight:400;color:#202124;">Claim approved</p>
      <p style="margin:0 0 24px;font-size:14px;color:#5f6368;line-height:1.6;">
        Hi ${userName}, your claim for <strong>${judgeName}</strong> has been approved.
        You now have full access to manage your profile, reply to reviews, and receive messages from exhibitors and show organisers.
      </p>
      <a href="${url}" style="display:inline-block;padding:12px 24px;background:#1a73e8;color:#fff;text-decoration:none;border-radius:100px;font-size:14px;font-weight:500;">View your profile</a>
    </div>
    <div style="padding:16px 32px 24px;border-top:1px solid #e8eaed;">
      <p style="margin:0;font-size:12px;color:#9aa0a6;">
        You're receiving this because you submitted a profile claim on judge.dog.<br>
        <a href="https://judge.dog" style="color:#1a73e8;text-decoration:none;">judge.dog</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

function rejectedHtml({ userName, judgeName }) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:'Segoe UI',system-ui,sans-serif;color:#202124;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(60,64,67,.15);">
    <div style="background:#1a73e8;padding:28px 32px;">
      <span style="font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px;">judge<span style="font-weight:400;">.dog</span></span>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 8px;font-size:22px;font-weight:400;color:#202124;">Claim not approved</p>
      <p style="margin:0 0 24px;font-size:14px;color:#5f6368;line-height:1.6;">
        Hi ${userName}, we were unable to verify your claim for <strong>${judgeName}</strong>
        at this time. If you believe this is an error, contact us at
        <a href="mailto:hi@judge.dog" style="color:#1a73e8;">hi@judge.dog</a>.
      </p>
      <a href="https://judge.dog" style="display:inline-block;padding:12px 24px;background:#1a73e8;color:#fff;text-decoration:none;border-radius:100px;font-size:14px;font-weight:500;">Go to judge.dog</a>
    </div>
    <div style="padding:16px 32px 24px;border-top:1px solid #e8eaed;">
      <p style="margin:0;font-size:12px;color:#9aa0a6;">
        You're receiving this because you submitted a profile claim on judge.dog.<br>
        <a href="https://judge.dog" style="color:#1a73e8;text-decoration:none;">judge.dog</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

function forwardMessageHtml({ judgeName, judgeSlug, fromName, messageText }) {
  const profileUrl = `https://judge.dog/judge/${judgeSlug}`;
  const safeMessage = messageText.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:'Segoe UI',system-ui,sans-serif;color:#202124;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(60,64,67,.15);">
    <div style="background:#1a73e8;padding:28px 32px;">
      <span style="font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px;">judge<span style="font-weight:400;">.dog</span></span>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 8px;font-size:22px;font-weight:400;color:#202124;">${fromName} sent you a message</p>
      <p style="margin:0 0 20px;font-size:14px;color:#5f6368;line-height:1.6;">
        Hi ${judgeName}, you received a message through your profile on
        <a href="https://judge.dog" style="color:#1a73e8;text-decoration:none;">judge.dog</a>
        — a platform where exhibitors find and review dog show judges worldwide.
      </p>
      <div style="background:#f8f9fa;border-left:3px solid #1a73e8;border-radius:4px;padding:16px 18px;margin-bottom:24px;font-size:14px;color:#202124;line-height:1.75;">
        ${safeMessage}
      </div>
      <p style="margin:0 0 20px;font-size:13px;color:#5f6368;line-height:1.6;">
        Sign in to judge.dog to reply. If you don't have an account yet, your profile is already there — it takes a minute to set up.
      </p>
      <a href="${profileUrl}" style="display:inline-block;padding:12px 24px;background:#1a73e8;color:#fff;text-decoration:none;border-radius:100px;font-size:14px;font-weight:500;">Sign in to reply →</a>
    </div>
    <div style="padding:16px 32px 24px;border-top:1px solid #e8eaed;">
      <p style="margin:0;font-size:12px;color:#9aa0a6;line-height:1.6;">
        Your email address was obtained from a publicly available judge registry. judge.dog is an independent platform not affiliated with any kennel club or cynological organisation.
        To stop receiving these notifications, contact <a href="mailto:hi@judge.dog" style="color:#1a73e8;text-decoration:none;">hi@judge.dog</a>.
      </p>
    </div>
  </div>
</body>
</html>`;
}

function contactNotifyHtml({ name, email, subject, message }) {
  const safe = s => s.replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br>");
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:'Segoe UI',system-ui,sans-serif;color:#202124;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(60,64,67,.15);">
    <div style="background:#1a73e8;padding:28px 32px;">
      <span style="font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px;">judge<span style="font-weight:400;">.dog</span></span>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 8px;font-size:22px;font-weight:400;color:#202124;">New contact message</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px;">
        <tr style="background:#f8f9fa;">
          <td style="padding:8px 12px;color:#9aa0a6;width:80px;">From</td>
          <td style="padding:8px 12px;color:#202124;">${safe(name)}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;color:#9aa0a6;">Email</td>
          <td style="padding:8px 12px;color:#202124;"><a href="mailto:${email}" style="color:#1a73e8;">${safe(email)}</a></td>
        </tr>
        <tr style="background:#f8f9fa;">
          <td style="padding:8px 12px;color:#9aa0a6;">Subject</td>
          <td style="padding:8px 12px;color:#202124;">${safe(subject)}</td>
        </tr>
      </table>
      <div style="background:#f8f9fa;border-left:3px solid #1a73e8;border-radius:4px;padding:16px 18px;font-size:14px;color:#202124;line-height:1.75;">
        ${safe(message)}
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ── Notify admin when a new claim is submitted ─────────────────────────────────
exports.onClaimCreated = onDocumentCreated(
  { document: "claims/{claimId}", secrets: [RESEND_KEY] },
  async (event) => {
    const claim = event.data.data();
    if (!claim) return;
    const resend = new Resend(RESEND_KEY.value());
    await resend.emails.send({
      from: FROM,
      to: ADMIN_EMAIL,
      subject: `New claim: ${claim.userName} → ${claim.judgeName}`,
      html: adminNewClaimHtml({
        userName: claim.userName,
        userEmail: claim.userEmail,
        judgeName: claim.judgeName,
        judgeSlug: claim.judgeSlug,
      }),
    });
  }
);

// ── Notify admin when a contact form is submitted ─────────────────────────────
exports.onContactCreated = onDocumentCreated(
  { document: "contact/{contactId}", secrets: [RESEND_KEY, RECAPTCHA_SECRET] },
  async (event) => {
    const c = event.data.data();
    if (!c) return;

    const secret = RECAPTCHA_SECRET.value();
    if (c.recaptchaToken && secret && secret !== "NOT_CONFIGURED") {
      const verify = await fetch(
        `https://www.google.com/recaptcha/api/siteverify?secret=${secret}&response=${c.recaptchaToken}`,
        { method: "POST" }
      );
      const result = await verify.json();
      if (!result.success || result.score < 0.5) return;
    }

    const resend = new Resend(RESEND_KEY.value());
    await resend.emails.send({
      from: FROM,
      to: ADMIN_EMAIL,
      replyTo: c.email,
      subject: `Contact: ${c.subject || "(no subject)"} — ${c.name}`,
      html: contactNotifyHtml({ name: c.name, email: c.email, subject: c.subject, message: c.message }),
    });
  }
);

// ── Forward message to unclaimed judge's scraped email ────────────────────────
exports.onMessageCreated = onDocumentCreated(
  { document: "messages/{messageId}", secrets: [RESEND_KEY] },
  async (event) => {
    const msg = event.data.data();
    if (!msg || msg.claimed) return; // claimed judges receive messages on-platform

    const db = getFirestore();
    const judgeSnap = await db.collection("judges").doc(msg.judgeId).get();
    if (!judgeSnap.exists) return;

    const judge = judgeSnap.data();
    if (!judge.email) return; // no scraped email on file

    const resend = new Resend(RESEND_KEY.value());
    await resend.emails.send({
      from: FROM,
      to: judge.email,
      subject: `${msg.fromName} sent you a message on judge.dog`,
      html: forwardMessageHtml({
        judgeName: judge.name,
        judgeSlug: msg.judgeSlug || msg.judgeId,
        fromName: msg.fromName,
        messageText: msg.message,
      }),
    });
  }
);

// ── Notify judge + confirm to organiser on new booking inquiry ────────────────
exports.onBookingInquiryCreated = onDocumentCreated(
  { document: "bookingInquiries/{inquiryId}", secrets: [RESEND_KEY] },
  async (event) => {
    const inq = event.data.data();
    if (!inq) return;

    const db = getFirestore();
    const resend = new Resend(RESEND_KEY.value());

    // ── Email to judge ──────────────────────────────────────────────────────
    // Claimed judge → email to their Google account email
    // Unclaimed judge → email to scraped contact email
    let judgeEmail = null;
    if (inq.judgeClaimed) {
      // Get judge's user account email
      const judgeDoc = await db.collection("judges").doc(inq.judgeId).get();
      if (judgeDoc.exists) {
        const j = judgeDoc.data();
        if (j.claimedBy) {
          // Find user by email (claimedBy is the email)
          judgeEmail = j.claimedBy;
        }
      }
    } else {
      judgeEmail = inq.judgeEmail;
    }

    if (judgeEmail) {
      await resend.emails.send({
        from: FROM,
        to: judgeEmail,
        subject: `Booking inquiry: ${inq.showName} — ${inq.organiserName}`,
        html: bookingToJudgeHtml({
          judgeName:    inq.judgeName,
          judgeSlug:    inq.judgeSlug,
          organiserName: inq.organiserName,
          clubName:     inq.organiserProfile?.clubName,
          showName:     inq.showName,
          date:         inq.date,
          location:     inq.location,
          country:      inq.country,
          breeds:       inq.breeds,
          entries:      inq.entries,
          feeDiscussion: inq.feeDiscussion,
          message:      inq.message,
          claimed:      inq.judgeClaimed,
        }),
      });
    }

    // ── Confirmation to organiser ───────────────────────────────────────────
    if (inq.organiserEmail) {
      await resend.emails.send({
        from: FROM,
        to: inq.organiserEmail,
        subject: `Booking inquiry sent to ${inq.judgeName}`,
        html: bookingConfirmationHtml({
          organiserName: inq.organiserName,
          judgeName:     inq.judgeName,
          judgeSlug:     inq.judgeSlug,
          showName:      inq.showName,
          date:          inq.date,
        }),
      });
    }
  }
);

// ── Email organiser when judge accepts or declines their booking inquiry ────────
exports.onBookingStatusChange = onDocumentUpdated(
  { document: "bookingInquiries/{inquiryId}", secrets: [RESEND_KEY] },
  async (event) => {
    const before = event.data.before.data();
    const after  = event.data.after.data();
    if (before.status === after.status) return;
    if (after.status !== "accepted" && after.status !== "declined") return;
    if (!after.organiserEmail) return;

    const resend = new Resend(RESEND_KEY.value());
    const isAccepted = after.status === "accepted";
    const safe = s => (s||"").replace(/</g,"&lt;").replace(/>/g,"&gt;");

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:'Segoe UI',system-ui,sans-serif;color:#202124;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(60,64,67,.15);">
    <div style="background:${isAccepted?"#1e8e3e":"#d93025"};padding:28px 32px;">
      <span style="font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px;">judge<span style="font-weight:400;">.dog</span></span>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 8px;font-size:22px;font-weight:400;color:#202124;">
        ${isAccepted?"Booking inquiry accepted ✓":"Booking inquiry declined"}
      </p>
      <p style="margin:0 0 16px;font-size:14px;color:#5f6368;line-height:1.6;">
        <strong>${safe(after.judgeName)}</strong> has ${isAccepted?"accepted":"declined"} your booking inquiry for
        <strong>${safe(after.showName)}</strong> (${safe(after.dateFrom)}${after.dateTo!==after.dateFrom?" – "+safe(after.dateTo):""}).
      </p>
      ${after.judgeResponse?`<div style="background:#f8f9fa;border-left:3px solid ${isAccepted?"#1e8e3e":"#d93025"};border-radius:4px;padding:14px 16px;margin-bottom:20px;font-size:14px;color:#202124;line-height:1.7;">${safe(after.judgeResponse)}</div>`:""}
      <a href="https://judge.dog/my-bookings" style="display:inline-block;padding:12px 24px;background:${isAccepted?"#1e8e3e":"#1a73e8"};color:#fff;text-decoration:none;border-radius:100px;font-size:14px;font-weight:500;">
        View in My Bookings →
      </a>
    </div>
    <div style="padding:16px 32px 24px;border-top:1px solid #e8eaed;">
      <p style="margin:0;font-size:12px;color:#9aa0a6;">You're receiving this because you sent a booking inquiry on <a href="https://judge.dog" style="color:#1a73e8;">judge.dog</a>.</p>
    </div>
  </div>
</body></html>`;

    await resend.emails.send({
      from: FROM,
      to: after.organiserEmail,
      subject: `${after.judgeName} ${isAccepted?"accepted":"declined"} your booking inquiry — ${after.showName}`,
      html,
    });
  }
);

// ── Email claimant when status changes to approved or rejected ─────────────────
exports.onClaimStatusChange = onDocumentUpdated(
  { document: "claims/{claimId}", secrets: [RESEND_KEY] },
  async (event) => {
    const before = event.data.before.data();
    const after  = event.data.after.data();

    if (before.status === after.status) return;
    if (after.status !== "approved" && after.status !== "rejected") return;

    const { userEmail, userName, judgeName, judgeSlug } = after;
    if (!userEmail) return;

    const resend = new Resend(RESEND_KEY.value());

    if (after.status === "approved") {
      await resend.emails.send({
        from: FROM,
        to: userEmail,
        subject: `Your claim for ${judgeName} has been approved`,
        html: approvedHtml({ userName, judgeName, judgeSlug }),
      });
    } else {
      await resend.emails.send({
        from: FROM,
        to: userEmail,
        subject: `Update on your profile claim for ${judgeName}`,
        html: rejectedHtml({ userName, judgeName }),
      });
    }
  }
);
