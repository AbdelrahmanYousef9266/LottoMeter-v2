"""
Launch feature flags for LottoMeter.
Change these values when each capability is ready to go live.
"""


class LaunchSettings:
    # ============================================
    # LAUNCH SETTINGS — change these when ready
    # ============================================

    # Set to True when Stripe is connected
    PAYMENTS_ENABLED = False

    # Set to True when email service is connected
    EMAIL_ENABLED = False

    # ============================================
    # STRIPE CONFIG — add when ready
    # ============================================
    STRIPE_SECRET_KEY = ''      # sk_live_xxx
    STRIPE_WEBHOOK_SECRET = ''  # whsec_xxx
    STRIPE_PRICE_ID = ''        # price_xxx

    # ============================================
    # EMAIL CONFIG — add when ready
    # ============================================
    EMAIL_PROVIDER = 'sendgrid'  # sendgrid or smtp
    SENDGRID_API_KEY = ''
    FROM_EMAIL = 'noreply@lottometer.com'
    FROM_NAME = 'LottoMeter'

    # ============================================
    # APP STORE LINKS — add when published
    # ============================================
    GOOGLE_PLAY_URL = ''
    APP_STORE_URL = ''

    # ============================================
    # PRICING
    # ============================================
    PLAN_NAME = 'Basic'
    PLAN_PRICE = 29
    PLAN_INTERVAL = 'month'
