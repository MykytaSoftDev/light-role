import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies.auth import get_verified_user
from app.dependencies.impersonation import block_during_impersonation
from app.models.plan import Plan
from app.models.subscription import Subscription
from app.models.user import User
from app.schemas.paddle import (
    CancelSubscriptionResponse,
    ChangePlanRequest,
    ChangePlanResponse,
    NextPaymentResponse,
    PaymentMethodResponse,
    PortalSessionResponse,
    SubscriptionCurrentResponse,
    TransactionItem,
    TransactionListResponse,
)
from app.schemas.subscription import PlanLimits, SaveCustomerIdRequest, SubscriptionDetailResponse
from app.services.paddle_client import paddle_client
from app.services.subscription_service import (
    get_effective_plan,
    get_plan_active_jobs_limit,
    get_plan_ai_limit,
)
from app.services.usage_service import get_usage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/subscriptions", tags=["subscriptions"])


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------


def _format_paddle_amount(amount: str | int | None, currency: str | None) -> str | None:
    """Format a Paddle amount (in minor units) as a display string."""
    if amount is None or currency is None:
        return None
    try:
        return f"{int(amount) / 100:.2f} {currency}"
    except (ValueError, TypeError):
        return str(amount)


def _detect_billing_cycle(subscription: Subscription, paddle_data: dict) -> str | None:
    """Try to detect monthly vs annual from Paddle price id in the subscription items."""
    items = paddle_data.get("items", [])
    if not items:
        return None
    price_id = (items[0].get("price") or {}).get("id", "")
    if price_id == settings.paddle_price_id_monthly:
        return "monthly"
    if price_id == settings.paddle_price_id_annual:
        return "annual"
    return None


# ---------------------------------------------------------------------------
# Existing endpoint — kept intact
# ---------------------------------------------------------------------------


@router.get("", response_model=SubscriptionDetailResponse)
async def get_subscription(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    subscription: Subscription | None = (
        db.query(Subscription).filter(Subscription.user_id == current_user.id).first()
    )
    if subscription is None:
        raise HTTPException(status_code=404, detail="Subscription not found")

    usage = await get_usage(current_user, db)
    effective_plan = get_effective_plan(subscription)

    # Build limits from the effective plan's values (plan relationship is joined)
    plan = subscription.plan
    ai_limit = get_plan_ai_limit(plan)
    jobs_limit = get_plan_active_jobs_limit(plan)  # -1 = unlimited

    # When the effective plan is downgraded to free (grace period expired)
    # we still use the subscription's stored plan limits for display — the
    # real enforcement is handled by usage_service.  For the subscription
    # detail we show limits based on what the user can actually use right now.
    if effective_plan != plan.code:
        # User's grace period has expired; show free-tier limits
        limits = PlanLimits(ai_operations=10, active_jobs=10)
    else:
        limits = PlanLimits(
            ai_operations=ai_limit,
            active_jobs=None if jobs_limit == -1 else jobs_limit,
        )

    return SubscriptionDetailResponse(
        id=subscription.id,
        plan=effective_plan,
        status=subscription.status,
        current_period_start=subscription.current_period_start,
        current_period_end=subscription.current_period_end,
        paddle_subscription_id=subscription.paddle_subscription_id,
        limits=limits,
        current_usage=usage.ai_operations_used,
        reset_date=usage.reset_date,
    )


@router.patch("/customer", status_code=204)
async def save_customer_id(
    body: SaveCustomerIdRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
    # SPEC §6.7: money-touching — blocked during impersonation.
    _: None = Depends(block_during_impersonation),
):
    """Save the Paddle customer ID on the user's subscription (called from inline checkout)."""
    subscription: Subscription | None = (
        db.query(Subscription).filter(Subscription.user_id == current_user.id).first()
    )
    if subscription is None:
        raise HTTPException(status_code=404, detail="Subscription not found")

    if not subscription.paddle_customer_id:
        subscription.paddle_customer_id = body.paddle_customer_id
        db.commit()


# ---------------------------------------------------------------------------
# New Paddle proxy endpoints
# ---------------------------------------------------------------------------


@router.get("/current", response_model=SubscriptionCurrentResponse)
async def get_current_subscription(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    """Detailed subscription info including live Paddle data for Pro users."""
    subscription: Subscription | None = (
        db.query(Subscription).filter(Subscription.user_id == current_user.id).first()
    )
    usage = await get_usage(current_user, db)

    if subscription is None or subscription.plan.code == "free":
        # Free users: return DB data only — no Paddle API call
        return SubscriptionCurrentResponse(
            subscription_id=subscription.paddle_subscription_id,
            plan_name="Free",
            plan_slug="free",
            status="active",
            ai_ops_used=usage.ai_operations_used,
            ai_ops_limit=usage.ai_operations_limit,
            active_jobs=usage.active_jobs_count,
        )

    # Pro users: fetch live data from Paddle API
    paddle_data: dict = {}
    if subscription.paddle_subscription_id:
        try:
            raw = await paddle_client.get_subscription(subscription.paddle_subscription_id)
            paddle_data = raw.get("data", {}) or {}
        except Exception as exc:
            logger.warning(
                f"Paddle API error for subscription {subscription.paddle_subscription_id}: {exc}"
            )

    billing_cycle: str | None = None
    next_payment: NextPaymentResponse | None = None
    payment_method: PaymentMethodResponse | None = None
    scheduled_change: dict | None = None

    if paddle_data:
        billing_cycle = _detect_billing_cycle(subscription, paddle_data)

        recurring = paddle_data.get("recurring_transaction_details") or {}

        # Next transaction details
        next_txn = paddle_data.get("next_transaction") or {}
        if next_txn:
            totals = (next_txn.get("details") or {}).get("totals") or {}
            next_payment = NextPaymentResponse(
                amount=_format_paddle_amount(
                    totals.get("grand_total"),
                    next_txn.get("currency_code"),
                ),
                currency=next_txn.get("currency_code"),
                date=(next_txn.get("billing_period") or {}).get("starts_at"),
            )

        # Payment method from recurring transaction details
        pm = (recurring.get("payment_method_details") or {})
        if pm:
            pm_type = pm.get("type", "")
            card = pm.get("card") or {}
            payment_method = PaymentMethodResponse(
                type=pm_type,
                last4=card.get("last4"),
                brand=card.get("brand"),
            )

        scheduled_change = paddle_data.get("scheduled_change")

    started_at: str | None = (
        subscription.created_at.isoformat()
        if hasattr(subscription, "created_at") and subscription.created_at
        else None
    )

    return SubscriptionCurrentResponse(
        subscription_id=subscription.paddle_subscription_id,
        customer_id=subscription.paddle_customer_id,
        plan_name=subscription.plan.name,
        plan_slug=subscription.plan.code,
        status=subscription.status.value,
        billing_cycle=billing_cycle,
        current_period_start=(
            subscription.current_period_start.isoformat()
            if subscription.current_period_start
            else None
        ),
        current_period_end=(
            subscription.current_period_end.isoformat()
            if subscription.current_period_end
            else None
        ),
        next_payment=next_payment,
        payment_method=payment_method,
        scheduled_change=scheduled_change,
        started_at=started_at,
        ai_ops_used=usage.ai_operations_used,
        ai_ops_limit=usage.ai_operations_limit,
        active_jobs=usage.active_jobs_count,
    )


@router.get("/transactions", response_model=TransactionListResponse)
async def get_transactions(
    after: str | None = None,
    per_page: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    """Paginated transaction history from Paddle."""
    subscription: Subscription | None = (
        db.query(Subscription).filter(Subscription.user_id == current_user.id).first()
    )

    if subscription is None or not subscription.paddle_subscription_id:
        return TransactionListResponse(items=[], has_more=False)

    try:
        result = await paddle_client.list_transactions(
            subscription.paddle_subscription_id,
            after=after,
            per_page=min(per_page, 20),
        )
    except Exception as exc:
        logger.error(f"Paddle transactions API error: {exc}")
        raise HTTPException(status_code=502, detail="Unable to fetch transaction history")

    items: list[TransactionItem] = []
    for txn in result.get("data", []):
        details = txn.get("details") or {}
        totals = details.get("totals") or {}
        items.append(
            TransactionItem(
                id=txn.get("id", ""),
                date=txn.get("created_at", ""),
                amount=_format_paddle_amount(
                    totals.get("grand_total"),
                    txn.get("currency_code"),
                ),
                currency=txn.get("currency_code", ""),
                status=txn.get("status", ""),
                description="Pro subscription",
            )
        )

    meta = result.get("meta") or {}
    pagination = meta.get("pagination") or {}

    return TransactionListResponse(
        items=items,
        has_more=pagination.get("has_more", False),
        next_cursor=pagination.get("next"),
    )


@router.post("/cancel", response_model=CancelSubscriptionResponse)
async def cancel_subscription(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
    # SPEC §6.7: money-touching — blocked during impersonation.
    _: None = Depends(block_during_impersonation),
):
    """Schedule subscription cancellation at the end of the current billing period."""
    subscription: Subscription | None = (
        db.query(Subscription).filter(Subscription.user_id == current_user.id).first()
    )

    if subscription is None or not subscription.paddle_subscription_id:
        raise HTTPException(status_code=400, detail="No active subscription to cancel")

    if subscription.status.value == "cancelled":
        raise HTTPException(status_code=400, detail="Subscription already cancelled")

    try:
        await paddle_client.cancel_subscription(subscription.paddle_subscription_id)
    except Exception as exc:
        logger.error(f"Paddle cancel API error: {exc}")
        raise HTTPException(status_code=502, detail="Unable to cancel subscription")

    return CancelSubscriptionResponse(
        success=True,
        message="Subscription will cancel at end of billing period",
    )


@router.post("/change-plan", response_model=ChangePlanResponse)
async def change_subscription_plan(
    body: ChangePlanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
    # SPEC §6.7: money-touching — blocked during impersonation.
    _: None = Depends(block_during_impersonation),
):
    """Change the subscription's plan/billing cycle at the next billing period.

    The local ``scheduled_change`` field is set optimistically so the UI can
    show a "Plan will change to X" banner before Paddle's webhook lands.
    Final reconciliation (plan_id swap from price_id) happens in
    ``_handle_subscription_updated`` when ``subscription.updated`` arrives.
    """
    subscription: Subscription | None = (
        db.query(Subscription).filter(Subscription.user_id == current_user.id).first()
    )

    if subscription is None or not subscription.paddle_subscription_id:
        raise HTTPException(status_code=400, detail="No active subscription")

    # Free is not a real Paddle subscription state — Paddle has no $0 paid
    # subscription. Switching to Free means cancelling the current sub.
    if body.plan_code == "free":
        raise HTTPException(
            status_code=400,
            detail="To switch to Free, cancel your subscription instead.",
        )

    target_plan: Plan | None = (
        db.query(Plan).filter(Plan.code == body.plan_code).first()
    )
    if target_plan is None:
        raise HTTPException(status_code=400, detail="Unknown plan code")

    # Same-plan no-op detection: we only block exact plan-id duplication and
    # skip the cycle check. Detecting current cycle reliably would require
    # either a live Paddle fetch or a period-length heuristic on stored
    # current_period_(start|end), neither of which is robust in edge cases
    # (manual cycle anchor edits, prorated periods, paused subs). The
    # cleaner guard happens upstream in the UI; if a user does send a
    # same-plan + same-cycle change Paddle will treat it as a price re-set.
    if subscription.plan_id == target_plan.id:
        raise HTTPException(status_code=400, detail="Already on this plan")

    if body.billing_cycle == "monthly":
        new_price_id = target_plan.paddle_price_id_monthly
    else:
        new_price_id = target_plan.paddle_price_id_annual
    if not new_price_id:
        raise HTTPException(
            status_code=400,
            detail="Plan does not have Paddle pricing for this cycle",
        )

    try:
        await paddle_client.update_subscription(
            subscription.paddle_subscription_id, new_price_id
        )
    except Exception as exc:
        logger.error(f"Paddle update subscription error: {exc}")
        raise HTTPException(status_code=502, detail="Unable to update subscription")

    subscription.scheduled_change = {
        "action": "change_plan",
        "new_plan_code": body.plan_code,
        "new_billing_cycle": body.billing_cycle,
        "effective_at": "next_billing_period",
    }
    db.commit()

    return ChangePlanResponse(
        success=True,
        message="Plan change scheduled for next billing period",
        new_plan_code=body.plan_code,
        effective_at="next_billing_period",
    )


@router.post("/portal-session", response_model=PortalSessionResponse)
async def create_portal_session(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
    # SPEC §6.7: money-touching — blocked during impersonation. The Paddle
    # customer portal would otherwise let the admin update payment methods
    # for the impersonated user.
    _: None = Depends(block_during_impersonation),
):
    """Generate a Paddle Customer Portal session URL."""
    subscription: Subscription | None = (
        db.query(Subscription).filter(Subscription.user_id == current_user.id).first()
    )

    if subscription is None or not subscription.paddle_customer_id:
        raise HTTPException(status_code=400, detail="No Paddle customer account found")

    try:
        result = await paddle_client.create_portal_session(subscription.paddle_customer_id)
        portal_url = (
            (result.get("data") or {})
            .get("urls", {})
            .get("general", {})
            .get("overview")
        )
        if not portal_url:
            raise ValueError("No portal URL in Paddle response")
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Paddle portal session error: {exc}")
        raise HTTPException(status_code=502, detail="Unable to create portal session")

    return PortalSessionResponse(url=portal_url)
