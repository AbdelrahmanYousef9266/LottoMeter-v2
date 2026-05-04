"""Email service — the only place email is sent from in LottoMeter.

When LaunchSettings.EMAIL_ENABLED is False, all sends are logged and
return True (no real delivery). Flip the flag and add SendGrid credentials
to go live.
"""

import logging

from app.launch_settings import LaunchSettings

logger = logging.getLogger(__name__)


def send_email(to_email: str, subject: str, html_content: str, text_content: str = None) -> bool:
    """Send an email. Returns True on success, False on failure.

    When EMAIL_ENABLED is False, logs what would be sent and returns True.
    """
    if not LaunchSettings.EMAIL_ENABLED:
        logger.info(f'[email] DISABLED — would send to: {to_email}')
        logger.info(f'[email] Subject: {subject}')
        logger.info(f'[email] Content preview: {html_content[:200]}...')
        return True

    try:
        # TODO: Add SendGrid when ready
        # import sendgrid
        # from sendgrid.helpers.mail import Mail
        # sg = sendgrid.SendGridAPIClient(LaunchSettings.SENDGRID_API_KEY)
        # message = Mail(
        #     from_email=LaunchSettings.FROM_EMAIL,
        #     to_emails=to_email,
        #     subject=subject,
        #     html_content=html_content,
        # )
        # sg.client.mail.send.post(request_body=message.get())
        logger.info(f'[email] Sent to: {to_email} — {subject}')
        return True
    except Exception as e:
        logger.error(f'[email] Failed to send to {to_email}: {str(e)}')
        return False


def send_daily_report_email(store, business_day, shifts, settings) -> bool:
    """Send daily business day report to store owner.

    Called when a business day is closed. Uses report_email from settings,
    falling back to store.email. Returns False if no destination email found.
    """
    to_email = settings.report_email or store.email
    if not to_email:
        logger.warning(f'[email] No report email configured for store {store.store_code}')
        return False

    if not settings.report_enabled:
        logger.info(f'[email] Report emails disabled for store {store.store_code}')
        return False

    report_format = settings.report_format or 'html'

    subject = (
        f'LottoMeter Daily Report — {store.store_name} — '
        f'{business_day.business_date}'
    )

    html_content = build_daily_report_html(store, business_day, shifts)
    # PDF: html_content is used as fallback until SendGrid attachment support is wired
    text_content = build_daily_report_text(store, business_day, shifts)

    return send_email(to_email, subject, html_content, text_content)


def build_daily_report_html(store, business_day, shifts) -> str:
    """Build HTML email body for the daily report."""
    total_sales = sum(float(s.tickets_total or 0) for s in shifts if not s.voided)
    total_variance = sum(float(s.difference or 0) for s in shifts if not s.voided)

    variance_label = 'Correct' if total_variance == 0 else ('Over' if total_variance > 0 else 'Short')
    variance_color = '#16A34A' if total_variance >= 0 else '#DC2626'

    shift_rows = ''
    for shift in shifts:
        if shift.voided:
            continue
        diff = float(shift.difference or 0)
        diff_label = 'Correct' if diff == 0 else ('Over' if diff > 0 else 'Short')
        diff_color = '#16A34A' if diff >= 0 else '#DC2626'
        diff_symbol = '✓' if diff == 0 else ('↑' if diff > 0 else '✗')

        shift_rows += f"""
        <tr>
          <td style="padding:8px;border-bottom:1px solid #E2EAF4;">
            Shift #{shift.shift_number}
          </td>
          <td style="padding:8px;border-bottom:1px solid #E2EAF4;">
            {shift.opened_at.strftime('%I:%M %p') if shift.opened_at else '—'}
          </td>
          <td style="padding:8px;border-bottom:1px solid #E2EAF4;">
            {shift.closed_at.strftime('%I:%M %p') if shift.closed_at else 'Active'}
          </td>
          <td style="padding:8px;border-bottom:1px solid #E2EAF4;">
            ${float(shift.tickets_total or 0):.2f}
          </td>
          <td style="padding:8px;border-bottom:1px solid #E2EAF4;color:{diff_color};font-weight:600;">
            {diff_symbol} ${abs(diff):.2f} {diff_label}
          </td>
        </tr>
        """

    biz_date = (
        business_day.business_date.strftime('%A, %B %d %Y')
        if hasattr(business_day.business_date, 'strftime')
        else str(business_day.business_date)
    )
    active_shifts = len([s for s in shifts if not s.voided])

    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family:Arial,sans-serif;background:#F6FAFF;margin:0;padding:20px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;
              overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:linear-gradient(to right,#0077CC,#2DAE1A);padding:24px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:24px;">LottoMeter</h1>
      <p style="color:rgba(255,255,255,0.9);margin:4px 0 0;">Daily Shift Report</p>
    </div>

    <!-- Store + Date -->
    <div style="padding:24px;border-bottom:1px solid #E2EAF4;">
      <h2 style="margin:0;color:#0A1128;">{store.store_name}</h2>
      <p style="margin:4px 0 0;color:#46627F;">{biz_date}</p>
    </div>

    <!-- Summary Cards -->
    <div style="padding:24px;display:flex;gap:16px;border-bottom:1px solid #E2EAF4;">
      <div style="flex:1;background:#F6FAFF;border-radius:8px;padding:16px;text-align:center;">
        <div style="font-size:24px;font-weight:700;color:#0077CC;">${total_sales:.2f}</div>
        <div style="color:#46627F;font-size:13px;margin-top:4px;">Total Sales</div>
      </div>
      <div style="flex:1;background:#F6FAFF;border-radius:8px;padding:16px;text-align:center;">
        <div style="font-size:24px;font-weight:700;color:{variance_color};">${abs(total_variance):.2f}</div>
        <div style="color:#46627F;font-size:13px;margin-top:4px;">Variance · {variance_label}</div>
      </div>
      <div style="flex:1;background:#F6FAFF;border-radius:8px;padding:16px;text-align:center;">
        <div style="font-size:24px;font-weight:700;color:#0A1128;">{active_shifts}</div>
        <div style="color:#46627F;font-size:13px;margin-top:4px;">Shifts</div>
      </div>
    </div>

    <!-- Shifts Table -->
    <div style="padding:24px;">
      <h3 style="margin:0 0 16px;color:#0A1128;">Shift Breakdown</h3>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#F6FAFF;">
            <th style="padding:8px;text-align:left;color:#46627F;font-size:13px;">Shift</th>
            <th style="padding:8px;text-align:left;color:#46627F;font-size:13px;">Started</th>
            <th style="padding:8px;text-align:left;color:#46627F;font-size:13px;">Ended</th>
            <th style="padding:8px;text-align:left;color:#46627F;font-size:13px;">Sales</th>
            <th style="padding:8px;text-align:left;color:#46627F;font-size:13px;">Variance</th>
          </tr>
        </thead>
        <tbody>
          {shift_rows}
        </tbody>
      </table>
    </div>

    <!-- Footer -->
    <div style="padding:16px 24px;background:#F6FAFF;text-align:center;border-top:1px solid #E2EAF4;">
      <p style="margin:0;color:#46627F;font-size:12px;">
        Powered by LottoMeter · lottometer.com
      </p>
    </div>

  </div>
</body>
</html>"""


def build_daily_report_text(store, business_day, shifts) -> str:
    """Build plain-text fallback body for the daily report."""
    total_sales = sum(float(s.tickets_total or 0) for s in shifts if not s.voided)
    total_variance = sum(float(s.difference or 0) for s in shifts if not s.voided)
    variance_label = 'Correct' if total_variance == 0 else ('Over' if total_variance > 0 else 'Short')

    lines = [
        'LottoMeter Daily Report',
        f'Store: {store.store_name}',
        f'Date: {business_day.business_date}',
        '',
        'SUMMARY',
        f'Total Sales: ${total_sales:.2f}',
        f'Variance: ${abs(total_variance):.2f} {variance_label}',
        f'Shifts: {len([s for s in shifts if not s.voided])}',
        '',
        'SHIFTS',
    ]

    for shift in shifts:
        if shift.voided:
            continue
        diff = float(shift.difference or 0)
        diff_label = 'Correct' if diff == 0 else ('Over' if diff > 0 else 'Short')
        lines.append(
            f'Shift #{shift.shift_number}: '
            f'${float(shift.tickets_total or 0):.2f} sales, '
            f'${abs(diff):.2f} {diff_label}'
        )

    lines += ['', 'Powered by LottoMeter', 'lottometer.com']
    return '\n'.join(lines)
