from flask import Blueprint, jsonify, request

stripe_bp = Blueprint("stripe", __name__)


@stripe_bp.post("/api/stripe/webhook")
def stripe_webhook():
    """
    Stripe webhook handler — ready to connect, add Stripe logic when keys are available.

    TODO when PAYMENTS_ENABLED:
      1. Verify webhook signature with stripe.Webhook.construct_event()
      2. Handle checkout.session.completed  → activate_subscription()
      3. Handle invoice.payment_failed      → expire_subscription()
      4. Handle customer.subscription.deleted → expire_subscription()
    """
    from app.launch_settings import LaunchSettings

    if not LaunchSettings.PAYMENTS_ENABLED:
        return jsonify({"message": "Payments not enabled"}), 200

    return jsonify({"message": "OK"}), 200
