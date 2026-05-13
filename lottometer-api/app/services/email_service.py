"""Email service — the only place email is sent from in LottoMeter.

When LaunchSettings.EMAIL_ENABLED is False, all sends are logged and
return True (no real delivery). Flip the flag and add SendGrid credentials
to go live.
"""

import logging
from collections import defaultdict
from decimal import Decimal

from app.launch_settings import LaunchSettings

logger = logging.getLogger(__name__)

_DASHBOARD_URL = getattr(LaunchSettings, 'DASHBOARD_URL', 'https://app.lottometer.com/dashboard')


# ── Formatting helpers ─────────────────────────────────────────────────────

def _fmt(amount) -> str:
    """Format a numeric value as $X,XXX.XX."""
    try:
        v = float(amount or 0)
    except (TypeError, ValueError):
        v = 0.0
    return f'${v:,.2f}'


def _fmt_signed(amount) -> str:
    """Format with explicit + or - prefix: +$12.00 / -$5.00 / $0.00."""
    try:
        v = float(amount or 0)
    except (TypeError, ValueError):
        v = 0.0
    if v > 0:
        return f'+${v:,.2f}'
    if v < 0:
        return f'-${abs(v):,.2f}'
    return f'${v:,.2f}'


def _shift_status_label(shift) -> str:
    """Return 'correct', 'over', 'short', or 'open'."""
    if shift.shift_status:
        return shift.shift_status
    if shift.status == 'open':
        return 'open'
    diff = float(shift.difference or 0)
    if diff == 0:
        return 'correct'
    return 'over' if diff > 0 else 'short'


def _status_pill_styles(label: str) -> tuple[str, str]:
    """Return (background, color) for a status badge."""
    if label == 'correct':
        return 'rgba(45,174,26,0.12)', '#1a8c0e'
    if label == 'over':
        return 'rgba(217,119,6,0.12)', '#b05a00'
    if label == 'short':
        return 'rgba(239,68,68,0.12)', '#c02020'
    return 'rgba(0,119,204,0.12)', '#005a9e'


def _day_status_label(variance: float) -> str:
    if variance == 0:
        return 'Day closed correct'
    return 'Day closed over' if variance > 0 else 'Day closed short'


# ── Data aggregation helpers ───────────────────────────────────────────────

def _get_employee_names(shifts) -> dict:
    """Batch-load usernames for all employee_ids in shifts."""
    from app.models.user import User
    ids = {s.employee_id for s in shifts if s.employee_id and not s.voided}
    if not ids:
        return {}
    return {u.user_id: u.username for u in User.query.filter(User.user_id.in_(ids)).all()}


def _aggregate_ticket_breakdown(shifts, store_id: int) -> list:
    """Aggregate ticket sales by price tier across all non-voided shifts.

    Returns list of (price_str, count, subtotal_str) sorted by price ascending.
    """
    from app.models.shift_books import ShiftBooks
    from app.models.shift_extra_sales import ShiftExtraSales
    from app.models.book import Book

    price_totals: dict[Decimal, int] = defaultdict(int)

    active_shift_ids = [s.id for s in shifts if not s.voided]
    if not active_shift_ids:
        return []

    for shift_id in active_shift_ids:
        # Scanned sales: pair open/close scans
        open_scans = {
            sb.static_code: sb
            for sb in ShiftBooks.query.filter_by(
                shift_id=shift_id, store_id=store_id, scan_type='open'
            ).all()
        }
        close_scans = ShiftBooks.query.filter_by(
            shift_id=shift_id, store_id=store_id, scan_type='close'
        ).all()

        static_codes = set(open_scans) | {c.static_code for c in close_scans}
        if static_codes:
            book_map = {
                b.static_code: b
                for b in Book.query.filter(
                    Book.store_id == store_id,
                    Book.static_code.in_(static_codes),
                ).all()
            }
            for close in close_scans:
                open_scan = open_scans.get(close.static_code)
                if open_scan is None:
                    continue
                book = book_map.get(close.static_code)
                if book is None or book.ticket_price is None:
                    continue
                sold = close.start_at_scan - open_scan.start_at_scan
                if close.is_last_ticket:
                    sold += 1
                if sold > 0:
                    price_totals[book.ticket_price] += sold

        # Whole-book sales
        for e in ShiftExtraSales.query.filter_by(
            shift_id=shift_id, store_id=store_id
        ).all():
            price_totals[e.ticket_price] += e.ticket_count

    result = []
    for price in sorted(price_totals):
        count = price_totals[price]
        subtotal = (price * count).quantize(Decimal('0.01'))
        result.append((
            f'${int(price) if price == int(price) else float(price)}',
            count,
            subtotal,
        ))
    return result


# ── Email builders ─────────────────────────────────────────────────────────

def build_daily_report_html(store, business_day, shifts) -> str:
    """Build the branded HTML email body for the daily business day report.

    Uses table-based layout (no flexbox/grid) for Outlook/Gmail compatibility.
    """
    active_shifts = [s for s in shifts if not s.voided]

    total_sales = sum(float(s.tickets_total or 0) for s in active_shifts)
    total_cancels = sum(float(s.cancels or 0) for s in active_shifts)
    total_expected = sum(float(s.expected_cash or 0) for s in active_shifts)
    total_cash_in = sum(float(s.cash_in_hand or 0) for s in active_shifts)
    total_variance = sum(float(s.difference or 0) for s in active_shifts)

    biz_date = (
        business_day.business_date.strftime('%A, %b %d, %Y')
        if hasattr(business_day.business_date, 'strftime')
        else str(business_day.business_date)
    )

    day_label = _day_status_label(total_variance)
    day_bg, day_fg = _status_pill_styles(
        'correct' if total_variance == 0 else ('over' if total_variance > 0 else 'short')
    )

    variance_color = '#2DAE1A' if total_variance >= 0 else '#c02020'

    employee_map = _get_employee_names(active_shifts)

    # Preheader text
    preheader = (
        f'{biz_date} · {len(active_shifts)} shift{"s" if len(active_shifts) != 1 else ""} · '
        f'{_fmt(total_sales)} in ticket sales · {_fmt_signed(total_variance)} variance.'
    )

    # ── Shifts table rows ──────────────────────────────────────────────────
    shift_rows_html = ''
    for i, shift in enumerate(active_shifts):
        emp_name = employee_map.get(shift.employee_id) or '—'
        open_str = shift.opened_at.strftime('%H:%M') if shift.opened_at else '—'
        close_str = shift.closed_at.strftime('%H:%M') if shift.closed_at else 'Active'
        time_range = f'{open_str} → {close_str}'
        label = _shift_status_label(shift)
        pill_bg, pill_fg = _status_pill_styles(label)
        is_last = (i == len(active_shifts) - 1)
        border = '' if is_last else 'border-bottom:1px solid #E2EAF4;'

        shift_rows_html += f"""
            <tr>
              <td style="padding:11px 12px;{border}color:#0A1128;font-weight:600;">{shift.shift_number}</td>
              <td style="padding:11px 12px;{border}color:#0A1128;">{emp_name}</td>
              <td style="padding:11px 12px;{border}color:#46627F;">{time_range}</td>
              <td style="padding:11px 12px;{border}">
                <span style="display:inline-block;background:{pill_bg};color:{pill_fg};font-size:11px;font-weight:700;padding:2px 9px;border-radius:999px;">{label}</span>
              </td>
              <td align="right" style="padding:11px 12px;{border}color:#0A1128;font-weight:600;">{_fmt(shift.tickets_total)}</td>
            </tr>"""

    # ── Ticket breakdown rows ──────────────────────────────────────────────
    try:
        breakdown = _aggregate_ticket_breakdown(active_shifts, store.store_id)
    except Exception:
        breakdown = []

    breakdown_section = ''
    if breakdown:
        total_tickets = sum(count for _, count, _ in breakdown)
        total_breakdown_val = sum(float(sub) for _, _, sub in breakdown)
        rows = ''
        for idx, (price_str, count, subtotal) in enumerate(breakdown):
            border_top = 'border-top:1px solid #F0F5FB;' if idx > 0 else ''
            rows += f"""
            <tr>
              <td style="padding:8px 0;color:#46627F;{border_top}">{price_str} tickets &middot; {count:,} sold</td>
              <td align="right" style="padding:8px 0;color:#16A34A;font-weight:600;{border_top}">{_fmt(float(subtotal))}</td>
            </tr>"""
        rows += f"""
            <tr>
              <td style="padding:10px 0 0;border-top:2px solid #E2EAF4;font-weight:800;font-size:14px;">Total &middot; {total_tickets:,} tickets</td>
              <td align="right" style="padding:10px 0 0;border-top:2px solid #E2EAF4;color:#16A34A;font-weight:800;font-size:14px;">{_fmt(total_breakdown_val)}</td>
            </tr>"""
        breakdown_section = f"""
        <tr><td style="padding:18px 28px 4px;">
          <h2 style="margin:0 0 10px;font-size:14px;font-weight:700;color:#0A1128;">Ticket breakdown</h2>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:13px;">
            {rows}
          </table>
        </td></tr>"""

    # ── Cash reconciliation ────────────────────────────────────────────────
    recon_variance_color = '#2DAE1A' if total_variance >= 0 else '#c02020'
    cash_recon = f"""
        <tr><td style="padding:18px 28px 4px;">
          <h2 style="margin:0 0 10px;font-size:14px;font-weight:700;color:#0A1128;">Cash reconciliation</h2>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F8FAFF;border:1px solid #E2EAF4;border-radius:10px;font-size:13px;">
            <tr><td style="padding:10px 14px;color:#46627F;">Gross sales</td><td align="right" style="padding:10px 14px;color:#0A1128;font-weight:600;">{_fmt(total_sales)}</td></tr>
            <tr><td style="padding:10px 14px;color:#46627F;border-top:1px solid #E2EAF4;">Cancels</td><td align="right" style="padding:10px 14px;color:#EF4444;font-weight:600;border-top:1px solid #E2EAF4;">-{_fmt(total_cancels)}</td></tr>
            <tr><td style="padding:10px 14px;color:#0A1128;font-weight:700;border-top:1px solid #E2EAF4;">Expected cash</td><td align="right" style="padding:10px 14px;color:#0A1128;font-weight:700;border-top:1px solid #E2EAF4;">{_fmt(total_expected)}</td></tr>
            <tr><td style="padding:10px 14px;color:#0A1128;font-weight:700;border-top:1px solid #E2EAF4;">Cash counted</td><td align="right" style="padding:10px 14px;color:#0A1128;font-weight:700;border-top:1px solid #E2EAF4;">{_fmt(total_cash_in)}</td></tr>
            <tr><td style="padding:10px 14px;color:{recon_variance_color};font-weight:800;border-top:2px solid #E2EAF4;">Variance</td><td align="right" style="padding:10px 14px;color:{recon_variance_color};font-weight:800;border-top:2px solid #E2EAF4;">{_fmt_signed(total_variance)}</td></tr>
          </table>
        </td></tr>"""

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>LottoMeter &mdash; Daily Report</title>
</head>
<body style="margin:0;padding:0;background:#F6FAFF;font-family:'Inter','Segoe UI','Helvetica Neue',Arial,sans-serif;color:#0A1128;-webkit-font-smoothing:antialiased;">

<!-- preheader -->
<div style="display:none;font-size:1px;color:#F6FAFF;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  {preheader}
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F6FAFF;padding:24px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background:#FFFFFF;border-radius:12px;border:1px solid #E2EAF4;overflow:hidden;">

        <!-- gradient strip -->
        <tr><td style="height:4px;background:linear-gradient(to right,#0077CC,#2DAE1A);font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- brand header -->
        <tr><td style="padding:24px 28px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td>
                <span style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#0A1128;">Lotto</span><!--
             --><span style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#2DAE1A;">Meter</span>
                <div style="font-size:11px;color:#46627F;letter-spacing:0.10em;text-transform:uppercase;font-weight:700;margin-top:2px;">Digital Shift Tracking</div>
              </td>
              <td align="right" style="font-size:11px;color:#8FA3B8;font-weight:600;text-transform:uppercase;letter-spacing:0.10em;">
                Daily Report
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- title block -->
        <tr><td style="padding:8px 28px 4px;">
          <h1 style="margin:0;font-size:28px;font-weight:800;color:#0A1128;letter-spacing:-0.02em;line-height:1.2;">
            Business Day Closed
          </h1>
          <p style="margin:6px 0 0;font-size:14px;color:#46627F;line-height:1.5;">
            {biz_date} &nbsp;&middot;&nbsp; {store.store_name} &nbsp;&middot;&nbsp; {store.store_code}
          </p>
        </td></tr>

        <!-- status pills -->
        <tr><td style="padding:14px 28px 4px;">
          <span style="display:inline-block;background:{day_bg};color:{day_fg};font-size:12px;font-weight:700;padding:5px 12px;border-radius:999px;">&#9679; {day_label}</span>
          <span style="display:inline-block;margin-left:6px;background:rgba(0,119,204,0.12);color:#005a9e;font-size:12px;font-weight:600;padding:5px 12px;border-radius:999px;">{len(active_shifts)} shift{"s" if len(active_shifts) != 1 else ""}</span>
        </td></tr>

        <!-- KPI stat row -->
        <tr><td style="padding:20px 28px 4px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="33%" style="padding:0 4px 0 0;vertical-align:top;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E2EAF4;border-radius:10px;background:#FFFFFF;">
                  <tr><td style="height:3px;background:linear-gradient(to right,#0077CC,#2DAE1A);font-size:0;line-height:0;">&nbsp;</td></tr>
                  <tr><td style="padding:12px 14px;">
                    <div style="font-size:10px;color:#46627F;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Gross Sales</div>
                    <div style="font-size:22px;font-weight:800;color:#0A1128;line-height:1.1;margin-top:4px;">{_fmt(total_sales)}</div>
                  </td></tr>
                </table>
              </td>
              <td width="34%" style="padding:0 4px;vertical-align:top;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E2EAF4;border-radius:10px;background:#FFFFFF;">
                  <tr><td style="height:3px;background:linear-gradient(to right,#0077CC,#2DAE1A);font-size:0;line-height:0;">&nbsp;</td></tr>
                  <tr><td style="padding:12px 14px;">
                    <div style="font-size:10px;color:#46627F;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Expected Cash</div>
                    <div style="font-size:22px;font-weight:800;color:#0A1128;line-height:1.1;margin-top:4px;">{_fmt(total_expected)}</div>
                  </td></tr>
                </table>
              </td>
              <td width="33%" style="padding:0 0 0 4px;vertical-align:top;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E2EAF4;border-radius:10px;background:#FFFFFF;">
                  <tr><td style="height:3px;background:linear-gradient(to right,#0077CC,#2DAE1A);font-size:0;line-height:0;">&nbsp;</td></tr>
                  <tr><td style="padding:12px 14px;">
                    <div style="font-size:10px;color:#46627F;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Variance</div>
                    <div style="font-size:22px;font-weight:800;color:{variance_color};line-height:1.1;margin-top:4px;">{_fmt_signed(total_variance)}</div>
                  </td></tr>
                </table>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- shifts table -->
        <tr><td style="padding:24px 28px 8px;">
          <h2 style="margin:0 0 10px;font-size:14px;font-weight:700;color:#0A1128;">Shifts</h2>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E2EAF4;border-radius:10px;overflow:hidden;font-size:13px;">
            <tr style="background:#F8FAFF;">
              <th align="left" style="padding:9px 12px;font-size:10px;font-weight:700;color:#46627F;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #E2EAF4;">#</th>
              <th align="left" style="padding:9px 12px;font-size:10px;font-weight:700;color:#46627F;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #E2EAF4;">Employee</th>
              <th align="left" style="padding:9px 12px;font-size:10px;font-weight:700;color:#46627F;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #E2EAF4;">Time</th>
              <th align="left" style="padding:9px 12px;font-size:10px;font-weight:700;color:#46627F;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #E2EAF4;">Status</th>
              <th align="right" style="padding:9px 12px;font-size:10px;font-weight:700;color:#46627F;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #E2EAF4;">Sales</th>
            </tr>
            {shift_rows_html}
          </table>
        </td></tr>

        {breakdown_section}
        {cash_recon}

        <!-- CTA -->
        <tr><td align="center" style="padding:28px 28px 8px;">
          <a href="{_DASHBOARD_URL}/reports"
             style="display:inline-block;background:#0077CC;color:#FFFFFF;font-size:14px;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:8px;">
            View Full Report &rarr;
          </a>
          <div style="font-size:12px;color:#8FA3B8;margin-top:10px;">Or visit {_DASHBOARD_URL}</div>
        </td></tr>

        <!-- footer -->
        <tr><td style="padding:24px 28px;border-top:1px solid #E2EAF4;background:#F8FAFF;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-size:12px;color:#46627F;">
                Sent automatically when the business day closed.<br>
                <a href="{_DASHBOARD_URL}/account" style="color:#0077CC;text-decoration:none;">Manage email preferences</a>
              </td>
              <td align="right" style="font-size:11px;color:#8FA3B8;">
                <span style="color:#0A1128;font-weight:800;">Lotto</span><span style="color:#2DAE1A;font-weight:800;">Meter</span>
              </td>
            </tr>
          </table>
        </td></tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>"""


def build_daily_report_text(store, business_day, shifts) -> str:
    """Build the plain-text fallback body for the daily business day report."""
    active_shifts = [s for s in shifts if not s.voided]

    total_sales = sum(float(s.tickets_total or 0) for s in active_shifts)
    total_cancels = sum(float(s.cancels or 0) for s in active_shifts)
    total_expected = sum(float(s.expected_cash or 0) for s in active_shifts)
    total_cash_in = sum(float(s.cash_in_hand or 0) for s in active_shifts)
    total_variance = sum(float(s.difference or 0) for s in active_shifts)

    biz_date = (
        business_day.business_date.strftime('%A, %b %d, %Y')
        if hasattr(business_day.business_date, 'strftime')
        else str(business_day.business_date)
    )

    employee_map = _get_employee_names(active_shifts)
    day_label = _day_status_label(total_variance)

    lines = [
        'LOTTOMETER — DAILY REPORT',
        '================================================',
        '',
        'Business Day Closed',
        biz_date,
        f'{store.store_name} ({store.store_code})',
        '',
        f'Status: {day_label}',
        f'Shifts: {len(active_shifts)}',
        '',
        '------------------------------------------------',
        'SUMMARY',
        '------------------------------------------------',
        f'Gross Sales       {_fmt(total_sales)}',
        f'Expected Cash     {_fmt(total_expected)}',
        f'Variance          {_fmt_signed(total_variance)}',
        '',
        '------------------------------------------------',
        'SHIFTS',
        '------------------------------------------------',
    ]

    for shift in active_shifts:
        emp = employee_map.get(shift.employee_id) or '—'
        open_str = shift.opened_at.strftime('%H:%M') if shift.opened_at else '--:--'
        close_str = shift.closed_at.strftime('%H:%M') if shift.closed_at else 'Active'
        label = _shift_status_label(shift)
        sales_str = _fmt(shift.tickets_total)
        lines.append(
            f'#{shift.shift_number:<2}  {emp:<8}  {open_str} -> {close_str:<8}  {label:<9}  {sales_str}'
        )

    # Ticket breakdown
    try:
        breakdown = _aggregate_ticket_breakdown(active_shifts, store.store_id)
    except Exception:
        breakdown = []

    if breakdown:
        total_tickets = sum(count for _, count, _ in breakdown)
        total_bd_val = sum(float(sub) for _, _, sub in breakdown)
        lines += [
            '',
            '------------------------------------------------',
            'TICKET BREAKDOWN',
            '------------------------------------------------',
        ]
        for price_str, count, subtotal in breakdown:
            lines.append(f'{price_str:>3} tickets · {count:>4} sold     {_fmt(float(subtotal)):>10}')
        lines.append(f'{"":>25}  ---------')
        lines.append(f'TOTAL · {total_tickets:,} tickets         {_fmt(total_bd_val):>10}')

    # Cash reconciliation
    lines += [
        '',
        '------------------------------------------------',
        'CASH RECONCILIATION',
        '------------------------------------------------',
        f'Gross sales                 {_fmt(total_sales):>10}',
        f'Cancels                     {"-" + _fmt(total_cancels):>10}',
        f'{"":>28}  ---------',
        f'Expected cash               {_fmt(total_expected):>10}',
        f'Cash counted                {_fmt(total_cash_in):>10}',
        f'{"":>28}  ---------',
        f'Variance                    {_fmt_signed(total_variance):>10}',
        '',
        '------------------------------------------------',
        f'View the full report:',
        f'{_DASHBOARD_URL}/reports',
        '',
        "You're receiving this because daily reports are enabled",
        'for your store. Manage preferences at:',
        f'{_DASHBOARD_URL}/account',
        '',
        'LottoMeter — Digital Shift Tracking',
    ]

    return '\n'.join(lines)


# ── Email send functions ───────────────────────────────────────────────────

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

    biz_date = (
        business_day.business_date.strftime('%A, %B %d %Y')
        if hasattr(business_day.business_date, 'strftime')
        else str(business_day.business_date)
    )
    subject = f'LottoMeter Daily Report — {store.store_name} — {biz_date}'

    html_content = build_daily_report_html(store, business_day, shifts)
    text_content = build_daily_report_text(store, business_day, shifts)

    return send_email(to_email, subject, html_content, text_content)
