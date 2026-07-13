let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  nodemailer = null;
}

function makeTransporter() {
  if (!nodemailer) return null;
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  const smtpUser = String(process.env.SMTP_USER || '').trim();
  const smtpPass = String(process.env.SMTP_PASS || '').replace(/\s+/g, '').trim();

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    requireTLS: true,
    auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
  });
}

async function sendResetEmail(email, token) {
  const transporter = makeTransporter();
  const resetUrl = `${process.env.APP_URL || 'http://localhost:5173'}/forgot-password?token=${encodeURIComponent(token)}`;

  const subject = 'Reset your Fast Forward India manager password';
  const text = `A password reset was requested for this account. Use the link below to reset your password:\n\nLink: ${resetUrl}\n\nIf you did not request this, ignore this message.`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
      <h2 style="margin:0 0 12px">Reset your Fast Forward India manager password</h2>
      <p>A password reset was requested for this account.</p>
      <p><a href="${resetUrl}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:700">Open reset link</a></p>
      <p>If you did not request this, you can ignore this email.</p>
    </div>
  `;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@fastforwardindia.org',
        to: email,
        subject,
        text,
        html,
        replyTo: process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@fastforwardindia.org',
      });
      return { sent: true };
    } catch (err) {
      console.warn('Failed to send reset email:', err && err.message);
    }
  }

  console.log('Password reset token for', email, token, 'reset link:', resetUrl);
  return { sent: false, token };
}

async function sendVolunteerResetEmail(email, token) {
  const transporter = makeTransporter();
  const resetUrl = `${process.env.APP_URL || 'http://localhost:5173'}/volunteer-forgot-password?token=${encodeURIComponent(token)}`;

  const subject = 'Reset your Fast Forward India volunteer password';
  const text = `A password reset was requested for this account. Use the link below to reset your password:\n\nLink: ${resetUrl}\n\nIf you did not request this, ignore this message.`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
      <h2 style="margin:0 0 12px">Reset your Fast Forward India volunteer password</h2>
      <p>A password reset was requested for this account.</p>
      <p><a href="${resetUrl}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:700">Open reset link</a></p>
      <p>If you did not request this, you can ignore this email.</p>
    </div>
  `;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@fastforwardindia.org',
        to: email,
        subject,
        text,
        html,
        replyTo: process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@fastforwardindia.org',
      });
      return { sent: true };
    } catch (err) {
      console.warn('Failed to send volunteer reset email:', err && err.message);
    }
  }

  console.log('Volunteer password reset token for', email, token, 'reset link:', resetUrl);
  return { sent: false, token };
}

async function sendVolunteerWelcomeEmail(email, name, token) {
  const transporter = makeTransporter();
  const activationUrl = `${process.env.APP_URL || 'http://localhost:5173'}/volunteer-forgot-password?token=${encodeURIComponent(token)}`;
  const subject = 'Activate your Fast Forward India volunteer account';
  const text = `Hello ${name},\n\nYour volunteer account has been created.\n\nTo set your password and activate your account, please use the link below (valid for 7 days):\n\nLink: ${activationUrl}\n\nUse your email address and the password you set to sign in.`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
      <h2 style="margin:0 0 12px">Activate your Fast Forward India volunteer account</h2>
      <p>Hello ${name},</p>
      <p>Your volunteer account has been created.</p>
      <p><a href="${activationUrl}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:700">Set Password & Activate</a></p>
      <p>Use your email address and the password you set to sign in.</p>
      <p style="color:#666;font-size:0.85em">This link is valid for 7 days.</p>
    </div>
  `;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@fastforwardindia.org',
        to: email,
        subject,
        text,
        html,
        replyTo: process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@fastforwardindia.org',
      });
      return { sent: true };
    } catch (error) {
      console.warn('Failed to send volunteer welcome email:', error && error.message);
    }
  }

  console.log('Volunteer welcome email fallback for', email, { activationUrl, token });
  return { sent: false, token };
}

async function sendVolunteerRemovalEmail(email, name) {
  const transporter = makeTransporter();
  const subject = 'Your Fast Forward India volunteer account has been removed';
  const text = `Hello ${name},\n\nWe would like to inform you that your volunteer account associated with this email has been removed by a manager.\n\nThank you for your service and support.\n\nBest regards,\nFast Forward India team`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
      <h2 style="margin:0 0 12px">Volunteer Account Removed</h2>
      <p>Hello ${name},</p>
      <p>We would like to inform you that your volunteer account associated with this email has been removed by a manager.</p>
      <p>Thank you for your service and support.</p>
      <hr style="border:none;border-top:1px solid #ddd;margin:20px 0" />
      <p style="color:#666;font-size:0.85em">Best regards,<br/>Fast Forward India team</p>
    </div>
  `;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@fastforwardindia.org',
        to: email,
        subject,
        text,
        html,
        replyTo: process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@fastforwardindia.org',
      });
      return { sent: true };
    } catch (error) {
      console.warn('Failed to send volunteer removal email:', error && error.message);
    }
  }

  console.log('Volunteer removal email fallback for', email);
  return { sent: false };
}

async function sendManagerPromotionEmail(email, name) {
  const transporter = makeTransporter();
  const loginUrl = `${process.env.APP_URL || 'http://localhost:5173'}/?view=manager`;
  const subject = 'You have been promoted to Manager - Fast Forward India';
  const text = `Hello ${name},\n\nYou have been promoted to a Manager account on the Fast Forward India Blood Donation portal.\n\nUse your existing volunteer credentials to log in to the Manager portal:\n${loginUrl}\n\nNo separate credentials are required.`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
      <h2 style="margin:0 0 12px">You have been promoted to Manager</h2>
      <p>Hello ${name},</p>
      <p>You have been promoted to a Manager account on the Fast Forward India Blood Donation portal.</p>
      <p><a href="${loginUrl}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:700">Open manager login</a></p>
      <p>Please use your existing volunteer email and password to sign in. No separate credentials are required.</p>
    </div>
  `;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@fastforwardindia.org',
        to: email,
        subject,
        text,
        html,
        replyTo: process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@fastforwardindia.org',
      });
      return { sent: true };
    } catch (error) {
      console.warn('Failed to send manager promotion email:', error && error.message);
    }
  }

  console.log('Manager promotion email fallback for', email, { loginUrl });
  return { sent: false };
}

module.exports = {
  sendResetEmail,
  sendVolunteerResetEmail,
  sendVolunteerWelcomeEmail,
  sendVolunteerRemovalEmail,
  sendManagerPromotionEmail,
};
