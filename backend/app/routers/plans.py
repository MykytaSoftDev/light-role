from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.plan import Plan
from app.schemas.plan import PlanListResponse, PlanResponse

router = APIRouter(prefix="/api/v1/plans", tags=["plans"])


@router.get("", response_model=PlanListResponse)
def list_plans(db: Session = Depends(get_db)) -> PlanListResponse:
    """Return all active subscription plans sorted by sort_order. Public endpoint."""
    plans = (
        db.query(Plan)
        .filter(Plan.is_active.is_(True))
        .order_by(Plan.sort_order)
        .all()
    )
    return PlanListResponse(data=[PlanResponse.model_validate(p) for p in plans])
