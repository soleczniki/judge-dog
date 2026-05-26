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
