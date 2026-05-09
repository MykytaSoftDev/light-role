import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class PaddleClient:
    def __init__(self) -> None:
        if settings.paddle_environment == "sandbox":
            self.base_url = "https://sandbox-api.paddle.com"
        else:
            self.base_url = "https://api.paddle.com"
        self.api_key = settings.paddle_api_key

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def get_subscription(self, subscription_id: str) -> dict:
        """GET /subscriptions/{id}?include=next_transaction,recurring_transaction_details"""
        url = f"{self.base_url}/subscriptions/{subscription_id}"
        params = {"include": "next_transaction,recurring_transaction_details"}
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=self._headers(), params=params)
            response.raise_for_status()
            return response.json()

    async def list_transactions(
        self,
        subscription_id: str,
        after: str | None = None,
        per_page: int = 10,
    ) -> dict:
        """GET /transactions?subscription_id={id}&order_by=created_at[DESC]"""
        url = f"{self.base_url}/transactions"
        params: dict = {
            "subscription_id": subscription_id,
            "order_by": "created_at[DESC]",
            "per_page": min(per_page, 20),
        }
        if after:
            params["after"] = after
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=self._headers(), params=params)
            response.raise_for_status()
            return response.json()

    async def cancel_subscription(self, subscription_id: str) -> dict:
        """PATCH /subscriptions/{id} — schedule cancellation at next billing period."""
        url = f"{self.base_url}/subscriptions/{subscription_id}"
        body = {
            "scheduled_change": {
                "action": "cancel",
                "effective_at": "next_billing_period",
            }
        }
        async with httpx.AsyncClient() as client:
            response = await client.patch(url, headers=self._headers(), json=body)
            response.raise_for_status()
            return response.json()

    async def update_subscription(self, subscription_id: str, new_price_id: str) -> dict:
        """PATCH /subscriptions/{id} — swap the subscription's price (plan change).

        Uses ``prorated_next_billing_period`` proration mode: the new price
        takes effect at the start of the next billing cycle and Paddle bills
        a prorated amount based on the time remaining in the current period.
        Paddle's valid proration values are ``prorated_immediately``,
        ``prorated_next_billing_period``, ``full_immediately``,
        ``full_next_billing_period``, ``do_not_bill`` — we deliberately pick
        the deferred/prorated variant so customers aren't charged immediately
        on plan change while still keeping accurate proration math.
        """
        url = f"{self.base_url}/subscriptions/{subscription_id}"
        body = {
            "items": [{"price_id": new_price_id, "quantity": 1}],
            "proration_billing_mode": "prorated_next_billing_period",
        }
        async with httpx.AsyncClient() as client:
            response = await client.patch(url, headers=self._headers(), json=body)
            response.raise_for_status()
            return response.json()

    async def create_portal_session(self, customer_id: str) -> dict:
        """POST /customers/{id}/portal-sessions"""
        url = f"{self.base_url}/customers/{customer_id}/portal-sessions"
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=self._headers(), json={})
            response.raise_for_status()
            return response.json()


paddle_client = PaddleClient()
