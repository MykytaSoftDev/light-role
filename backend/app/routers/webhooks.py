import hashlib
import hmac
import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.enums import SubscriptionStatus
from app.models.plan import Plan
from app.models.subscription import Subscription
from app.models.user import User
from app.redis import redis_get, redis_set
from app.services.usage_service import invalidate_usage_cache

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/webhooks", tags=["webhooks"])

# Map Paddle subscription statuses to our internal enum values
_PADDLE_STATUS_MAP: dict[str, SubscriptionStatus] = {
    "active": SubscriptionStatus.ACTIVE,
    "canceled": SubscriptionStatus.CANCELLED,
    "cancelled": SubscriptionStatus.CANCELLED,
    "past_due": SubscriptionStatus.PAST_DUE,
    "paused": SubscriptionStatus.PAUSED,
}


def _verify_paddle_signature(payload: bytes, signature_header: str, secret: str) -> bool:
    """Verify Paddle webhook signature using HMAC-SHA256.

    Paddle sends: Paddle-Signature: ts=TIMESTAMP;h1=SIGNATURE
    Signed payload format: "ts:raw_body"
    """
    try:
        parts = dict(p.split("=", 1) for p in signature_header.split(";"))
        ts = parts.get("ts", "")
        h1 = parts.get("h1", "")
        if not ts or not h1:
            return False
        signed_payload = f"{ts}:{payload.decode('utf-8')}"
        expected = hmac.new(
            secret.encode(), signed_payload.encode(), hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, h1)
    except Exception as exc:
        logger.warning(f"Paddle signature verification error: {exc}")
        return False


def _parse_paddle_datetime(value: str) -> datetime:
    """Parse Paddle ISO 8601 datetime string (handles Z suffix)."""
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _get_db_session() -> Session:
    """Create a one-shot DB session for use outside of request dependency injection."""
    gen = get_db()
    return next(gen)


async def _is_duplicate_event(event_id: str) -> bool:
    """Returns True if this event was already processed."""
    if not event_id:
        return False
    key = f"paddle_event:{event_id}"
    exists = await redis_get(key)
    return exists is not None


async def _mark_event_processed(event_id: str) -> None:
    """Mark an event as processed in Redis with a 72-hour TTL."""
    if not event_id:
        return
    key = f"paddle_event:{event_id}"
    await redis_set(key, "1", 259200)  # 72h TTL


def _lookup_plan_by_price_id(db: Session, price_id: str | None) -> Plan | None:
    """Find a plan by its Paddle price ID (monthly or annual). Returns None if not found."""
    if not price_id:
        return None
    return (
        db.query(Plan)
        .filter(
            (Plan.paddle_price_id_monthly == price_id)
            | (Plan.paddle_price_id_annual == price_id)
        )
        .first()
    )


async def _handle_subscription_created(data: dict) -> None:
    """Create or update a subscription record when Paddle fires subscription.created."""
    custom_data = data.get("custom_data") or {}
    user_id_raw = custom_data.get("user_id")
    paddle_sub_id = data.get("id")
    paddle_customer_id = data.get("customer_id")
    billing_period = data.get("current_billing_period") or {}

    logger.info(
        f"Handling subscription.created: paddle_sub_id={paddle_sub_id}, user_id={user_id_raw}"
    )

    if not user_id_raw:
        logger.error(
            f"subscription.created missing custom_data.user_id — paddle_sub_id={paddle_sub_id}"
        )
        return

    try:
        user_uuid = uuid.UUID(user_id_raw)
    except ValueError:
        logger.error(
            f"subscription.created has invalid user_id format: {user_id_raw!r}"
        )
        return

    db = _get_db_session()
    try:
        user: User | None = db.query(User).filter(User.id == user_uuid).first()
        if user is None:
            logger.error(
                f"subscription.created: user not found for user_id={user_id_raw}"
            )
            return

        subscription: Subscription | None = (
            db.query(Subscription).filter(Subscription.user_id == user_uuid).first()
        )

        period_start = _parse_paddle_datetime(billing_period["starts_at"])
        period_end = _parse_paddle_datetime(billing_period["ends_at"])

        # Try to resolve plan from the price_id on the first item
        price_id = (
            data.get("items", [{}])[0].get("price", {}).get("id")
            if data.get("items")
            else None
        )
        resolved_plan: Plan | None = _lookup_plan_by_price_id(db, price_id)

        if resolved_plan is None:
            # Fall back to pro plan when price_id doesn't match any known plan
            resolved_plan = db.query(Plan).filter(Plan.slug == "pro").first()

        if resolved_plan is None:
            logger.error("subscription.created: Pro plan not found in plans table")
            return

        if subscription is None:
            subscription = Subscription(user_id=user_uuid)
            db.add(subscription)

        subscription.plan_id = resolved_plan.id
        subscription.status = SubscriptionStatus.ACTIVE
        subscription.paddle_customer_id = paddle_customer_id
        subscription.paddle_subscription_id = paddle_sub_id
        subscription.current_period_start = period_start.replace(tzinfo=None)
        subscription.current_period_end = period_end.replace(tzinfo=None)

        db.commit()
        logger.info(
            f"Subscription created/upgraded for user_id={user_id_raw}, "
            f"paddle_sub_id={paddle_sub_id}, plan_slug={resolved_plan.slug}"
        )
        await invalidate_usage_cache(str(user_uuid))
    except Exception as exc:
        db.rollback()
        logger.error(
            f"subscription.created DB error for user_id={user_id_raw}: {exc}",
            exc_info=True,
        )
    finally:
        db.close()


async def _handle_subscription_updated(data: dict) -> None:
    """Update billing period, status, and plan when Paddle fires subscription.updated."""
    paddle_sub_id = data.get("id")
    paddle_status = data.get("status", "")
    billing_period = data.get("current_billing_period") or {}

    logger.info(
        f"Handling subscription.updated: paddle_sub_id={paddle_sub_id}, status={paddle_status}"
    )

    db = _get_db_session()
    try:
        subscription: Subscription | None = (
            db.query(Subscription)
            .filter(Subscription.paddle_subscription_id == paddle_sub_id)
            .first()
        )
        if subscription is None:
            logger.warning(
                f"subscription.updated: no subscription found for paddle_sub_id={paddle_sub_id}"
            )
            return

        new_status = _PADDLE_STATUS_MAP.get(paddle_status)
        if new_status is not None:
            subscription.status = new_status
        else:
            logger.warning(
                f"subscription.updated: unknown Paddle status {paddle_status!r} "
                f"for paddle_sub_id={paddle_sub_id}"
            )

        # Handle plan change (upgrade/downgrade) if items are present
        if data.get("items"):
            price_id = data["items"][0].get("price", {}).get("id")
            updated_plan = _lookup_plan_by_price_id(db, price_id)
            if updated_plan is not None:
                if subscription.plan_id != updated_plan.id:
                    logger.info(
                        f"subscription.updated: plan change detected for "
                        f"paddle_sub_id={paddle_sub_id}, new plan_slug={updated_plan.slug}"
                    )
                subscription.plan_id = updated_plan.id

        if billing_period.get("starts_at"):
            subscription.current_period_start = _parse_paddle_datetime(
                billing_period["starts_at"]
            ).replace(tzinfo=None)
        if billing_period.get("ends_at"):
            subscription.current_period_end = _parse_paddle_datetime(
                billing_period["ends_at"]
            ).replace(tzinfo=None)

        db.commit()
        logger.info(
            f"Subscription updated for paddle_sub_id={paddle_sub_id}, "
            f"new_status={new_status}"
        )
        await invalidate_usage_cache(str(subscription.user_id))
    except Exception as exc:
        db.rollback()
        logger.error(
            f"subscription.updated DB error for paddle_sub_id={paddle_sub_id}: {exc}",
            exc_info=True,
        )
    finally:
        db.close()


async def _handle_subscription_canceled(data: dict) -> None:
    """Set subscription status to cancelled (Pro access remains until period_end)."""
    paddle_sub_id = data.get("id")

    logger.info(f"Handling subscription.canceled: paddle_sub_id={paddle_sub_id}")

    db = _get_db_session()
    try:
        subscription: Subscription | None = (
            db.query(Subscription)
            .filter(Subscription.paddle_subscription_id == paddle_sub_id)
            .first()
        )
        if subscription is None:
            logger.warning(
                f"subscription.canceled: no subscription found for paddle_sub_id={paddle_sub_id}"
            )
            return

        subscription.status = SubscriptionStatus.CANCELLED
        db.commit()
        logger.info(f"Subscription cancelled for paddle_sub_id={paddle_sub_id}")
        await invalidate_usage_cache(str(subscription.user_id))
    except Exception as exc:
        db.rollback()
        logger.error(
            f"subscription.canceled DB error for paddle_sub_id={paddle_sub_id}: {exc}",
            exc_info=True,
        )
    finally:
        db.close()


async def _handle_subscription_past_due(data: dict) -> None:
    """Set subscription status to past_due."""
    paddle_sub_id = data.get("id")

    logger.info(f"Handling subscription.past_due: paddle_sub_id={paddle_sub_id}")

    db = _get_db_session()
    try:
        subscription: Subscription | None = (
            db.query(Subscription)
            .filter(Subscription.paddle_subscription_id == paddle_sub_id)
            .first()
        )
        if subscription is None:
            logger.warning(
                f"subscription.past_due: no subscription found for paddle_sub_id={paddle_sub_id}"
            )
            return

        subscription.status = SubscriptionStatus.PAST_DUE
        db.commit()
        logger.info(f"Subscription marked past_due for paddle_sub_id={paddle_sub_id}")
        await invalidate_usage_cache(str(subscription.user_id))
    except Exception as exc:
        db.rollback()
        logger.error(
            f"subscription.past_due DB error for paddle_sub_id={paddle_sub_id}: {exc}",
            exc_info=True,
        )
    finally:
        db.close()


async def _handle_subscription_paused(data: dict) -> None:
    """Set subscription status to paused."""
    paddle_sub_id = data.get("id")

    logger.info(f"Handling subscription.paused: paddle_sub_id={paddle_sub_id}")

    db = _get_db_session()
    try:
        subscription: Subscription | None = (
            db.query(Subscription)
            .filter(Subscription.paddle_subscription_id == paddle_sub_id)
            .first()
        )
        if subscription is None:
            logger.warning(
                f"subscription.paused: no subscription found for paddle_sub_id={paddle_sub_id}"
            )
            return

        subscription.status = SubscriptionStatus.PAUSED
        db.commit()
        logger.info(f"Subscription paused for paddle_sub_id={paddle_sub_id}")
        await invalidate_usage_cache(str(subscription.user_id))
    except Exception as exc:
        db.rollback()
        logger.error(
            f"subscription.paused DB error for paddle_sub_id={paddle_sub_id}: {exc}",
            exc_info=True,
        )
    finally:
        db.close()


async def _handle_subscription_resumed(data: dict) -> None:
    """Restore subscription to active when Paddle fires subscription.resumed."""
    paddle_sub_id = data.get("id")
    billing_period = data.get("current_billing_period") or {}

    logger.info(f"Handling subscription.resumed: paddle_sub_id={paddle_sub_id}")

    db = _get_db_session()
    try:
        subscription: Subscription | None = (
            db.query(Subscription)
            .filter(Subscription.paddle_subscription_id == paddle_sub_id)
            .first()
        )
        if subscription is None:
            logger.warning(
                f"subscription.resumed: no subscription found for paddle_sub_id={paddle_sub_id}"
            )
            return

        subscription.status = SubscriptionStatus.ACTIVE

        # Restore Pro plan if subscription has no plan or is on free
        if subscription.plan_id is None:
            pro_plan: Plan | None = db.query(Plan).filter(Plan.slug == "pro").first()
            if pro_plan is not None:
                subscription.plan_id = pro_plan.id

        if billing_period.get("starts_at"):
            subscription.current_period_start = _parse_paddle_datetime(
                billing_period["starts_at"]
            ).replace(tzinfo=None)
        if billing_period.get("ends_at"):
            subscription.current_period_end = _parse_paddle_datetime(
                billing_period["ends_at"]
            ).replace(tzinfo=None)

        db.commit()
        logger.info(f"Subscription resumed (set to active) for paddle_sub_id={paddle_sub_id}")
        await invalidate_usage_cache(str(subscription.user_id))
    except Exception as exc:
        db.rollback()
        logger.error(
            f"subscription.resumed DB error for paddle_sub_id={paddle_sub_id}: {exc}",
            exc_info=True,
        )
    finally:
        db.close()


async def _handle_transaction_completed(data: dict) -> None:
    """Update subscription billing period and clear PAST_DUE on successful payment."""
    transaction_id = data.get("id", "unknown")
    subscription_id = data.get("subscription_id")

    logger.info(
        f"Handling transaction.completed: transaction_id={transaction_id}, "
        f"subscription_id={subscription_id}"
    )

    if not subscription_id:
        logger.info(
            f"transaction.completed has no subscription_id (one-off charge?) — "
            f"transaction_id={transaction_id}"
        )
        return

    db = _get_db_session()
    try:
        subscription: Subscription | None = (
            db.query(Subscription)
            .filter(Subscription.paddle_subscription_id == subscription_id)
            .first()
        )
        if subscription is None:
            logger.warning(
                f"transaction.completed: no subscription found for "
                f"subscription_id={subscription_id}"
            )
            return

        # Clear PAST_DUE back to ACTIVE on successful payment
        if subscription.status == SubscriptionStatus.PAST_DUE:
            subscription.status = SubscriptionStatus.ACTIVE
            logger.info(
                f"transaction.completed: cleared PAST_DUE → ACTIVE for "
                f"subscription_id={subscription_id}"
            )

        # Update billing period if provided on the transaction
        billing_period = data.get("billing_period") or {}
        if billing_period.get("starts_at"):
            subscription.current_period_start = _parse_paddle_datetime(
                billing_period["starts_at"]
            ).replace(tzinfo=None)
        if billing_period.get("ends_at"):
            subscription.current_period_end = _parse_paddle_datetime(
                billing_period["ends_at"]
            ).replace(tzinfo=None)

        db.commit()
        logger.info(
            f"transaction.completed: subscription updated for "
            f"subscription_id={subscription_id}"
        )
        await invalidate_usage_cache(str(subscription.user_id))
    except Exception as exc:
        db.rollback()
        logger.error(
            f"transaction.completed DB error for subscription_id={subscription_id}: {exc}",
            exc_info=True,
        )
    finally:
        db.close()


async def _handle_transaction_payment_failed(data: dict) -> None:
    """Set subscription to PAST_DUE when a payment fails."""
    transaction_id = data.get("id", "unknown")
    subscription_id = data.get("subscription_id")

    logger.info(
        f"Handling transaction.payment_failed: transaction_id={transaction_id}, "
        f"subscription_id={subscription_id}"
    )

    if not subscription_id:
        logger.info(
            f"transaction.payment_failed has no subscription_id — "
            f"transaction_id={transaction_id}"
        )
        return

    db = _get_db_session()
    try:
        subscription: Subscription | None = (
            db.query(Subscription)
            .filter(Subscription.paddle_subscription_id == subscription_id)
            .first()
        )
        if subscription is None:
            logger.warning(
                f"transaction.payment_failed: no subscription found for "
                f"subscription_id={subscription_id}"
            )
            return

        subscription.status = SubscriptionStatus.PAST_DUE
        db.commit()
        logger.info(
            f"transaction.payment_failed: subscription set to PAST_DUE for "
            f"subscription_id={subscription_id}"
        )
        await invalidate_usage_cache(str(subscription.user_id))
    except Exception as exc:
        db.rollback()
        logger.error(
            f"transaction.payment_failed DB error for subscription_id={subscription_id}: {exc}",
            exc_info=True,
        )
    finally:
        db.close()


@router.post("/paddle")
async def paddle_webhook(request: Request) -> JSONResponse:
    """Receive and process Paddle subscription lifecycle events.

    This endpoint is intentionally unauthenticated — Paddle calls it directly.
    Signature verification is used in place of standard auth.
    Always returns 200 for valid (or unknown) events; 401 only for bad signatures.
    """
    raw_body = await request.body()
    signature_header = request.headers.get("Paddle-Signature", "")

    # Signature verification — only hard failure we ever return non-200 for
    if settings.paddle_webhook_secret:
        if not signature_header:
            logger.warning("Paddle webhook received without Paddle-Signature header")
            return JSONResponse(status_code=401, content={"detail": "Missing signature"})
        if not _verify_paddle_signature(raw_body, signature_header, settings.paddle_webhook_secret):
            logger.warning("Paddle webhook signature verification failed")
            return JSONResponse(status_code=401, content={"detail": "Invalid signature"})
    else:
        logger.warning(
            "paddle_webhook_secret is not configured — skipping signature verification "
            "(development mode)"
        )

    try:
        payload: dict = await request.json()
    except Exception as exc:
        logger.error(f"Paddle webhook: failed to parse JSON body: {exc}")
        return JSONResponse(status_code=200, content={"detail": "Invalid JSON"})

    event_type: str = payload.get("event_type", "")
    event_id: str = payload.get("event_id", "")
    data: dict = payload.get("data") or {}
    data_id = data.get("id", "unknown")

    logger.info(
        f"Paddle webhook received: event_type={event_type}, "
        f"event_id={event_id}, data_id={data_id}"
    )

    # Idempotency check — skip already-processed events (after sig verification)
    if await _is_duplicate_event(event_id):
        logger.info(
            f"Paddle webhook: duplicate event_id={event_id!r} — skipping"
        )
        return JSONResponse(status_code=200, content={"detail": "Already processed"})

    if event_type == "subscription.created":
        await _handle_subscription_created(data)

    elif event_type == "subscription.updated":
        await _handle_subscription_updated(data)

    elif event_type == "subscription.canceled":
        await _handle_subscription_canceled(data)

    elif event_type == "subscription.past_due":
        await _handle_subscription_past_due(data)

    elif event_type == "subscription.paused":
        await _handle_subscription_paused(data)

    elif event_type == "subscription.resumed":
        await _handle_subscription_resumed(data)

    elif event_type == "transaction.completed":
        await _handle_transaction_completed(data)

    elif event_type == "transaction.payment_failed":
        await _handle_transaction_payment_failed(data)

    else:
        logger.info(f"Paddle webhook: unhandled event_type={event_type!r} — ignoring")

    # Mark as processed regardless of whether the handler found anything to do
    await _mark_event_processed(event_id)

    return JSONResponse(status_code=200, content={"detail": "OK"})
