"""
Launch feature flags for LottoMeter.
Change these values when each capability is ready to go live.
"""

import os


class LaunchSettings:
    # ============================================
    # LAUNCH SETTINGS — change these when ready
    # ============================================

    # Set to True when Stripe is connected
    PAYMENTS_ENABLED = False

    # Set to True when email service is connected
    EMAIL_ENABLED = False

    # ============================================
    # STRIPE CONFIG — set via environment variables
    # ============================================
    STRIPE_SECRET_KEY = os.getenv('STRIPE_SECRET_KEY', '')
    STRIPE_WEBHOOK_SECRET = os.getenv('STRIPE_WEBHOOK_SECRET', '')
    STRIPE_PRICE_ID = os.getenv('STRIPE_PRICE_ID', '')

    # ============================================
    # EMAIL CONFIG — set via environment variables
    # ============================================
    EMAIL_PROVIDER = 'sendgrid'  # sendgrid or smtp
    SENDGRID_API_KEY = os.getenv('SENDGRID_API_KEY', '')
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
