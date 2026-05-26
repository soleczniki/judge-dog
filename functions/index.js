const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { Resend } = require("resend");

initializeApp();

const RESEND_KEY = defineSecret("RESEND_API_KEY");

const FROM = "judge.dog <noreply@judge.dog>";

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
        at this time. If you believe this is an error, please reply to this email.
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

exports.onClaimStatusChange = onDocumentUpdated(
  { document: "claims/{claimId}", secrets: [RESEND_KEY] },
  async (event) => {
    const before = event.data.before.data();
    const after  = event.data.after.data();

    // Only fire when status actually changes to a terminal state
    if (before.status === after.status) return;
    if (after.status !== "approved" && after.status !== "rejected") return;

    const { userEmail, userName, judgeName, judgeSlug } = after;
    if (!userEmail) return;

    const resend = new Resend(RESEND_KEY.value());

    if (after.status === "approved") {
      await resend.emails.send({
        from: FROM,
        to:   userEmail,
        subject: `Your claim for ${judgeName} has been approved`,
        html:  approvedHtml({ userName, judgeName, judgeSlug }),
      });
    } else {
      await resend.emails.send({
        from: FROM,
        to:   userEmail,
        subject: `Update on your profile claim for ${judgeName}`,
        html:  rejectedHtml({ userName, judgeName }),
      });
    }
  }
);
