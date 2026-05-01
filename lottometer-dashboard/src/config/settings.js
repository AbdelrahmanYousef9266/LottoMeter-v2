const settings = {
  // ============================================
  // LAUNCH SETTINGS — change these when ready
  // ============================================

  // Set to true when Stripe is connected and ready
  PAYMENTS_ENABLED: false,

  // Set to true when app is on Google Play / App Store
  APP_PUBLISHED: false,

  // Set to true when email service is connected
  EMAIL_ENABLED: false,

  // ============================================
  // STRIPE CONFIG — add keys when ready
  // ============================================
  STRIPE_PUBLISHABLE_KEY: '', // pk_live_xxx

  // ============================================
  // APP STORE LINKS — add when published
  // ============================================
  GOOGLE_PLAY_URL: '', // https://play.google.com/store/apps/details?id=xxx
  APP_STORE_URL: '',   // https://apps.apple.com/app/xxx

  // ============================================
  // PRICING — change anytime
  // ============================================
  PLAN_NAME: 'Basic',
  PLAN_PRICE: 29,
  PLAN_CURRENCY: '$',
  PLAN_INTERVAL: 'month',
  PLAN_FEATURES: [
    'Up to 500 lottery books',
    'Unlimited employees',
    'Daily shift reports',
    'Short/Over variance tracking',
    'PDF export',
    'Mobile app (iOS & Android)',
    'Email support',
  ],

  // ============================================
  // COMPANY INFO
  // ============================================
  COMPANY_NAME: 'LottoMeter',
  SUPPORT_EMAIL: 'support@lottometer.com',
  CONTACT_EMAIL: 'contact@lottometer.com',
}

export default settings
