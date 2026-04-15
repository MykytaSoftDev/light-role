from __future__ import annotations

from app.schemas.analytics import FunnelStage, ResumeSparklinePoint

# Human-readable stage transition labels for funnel insight messages.
_STAGE_TRANSITION_LABELS: dict[str, str] = {
    "applied": "Saved → Applied",
    "screening": "Applied → Screening",
    "interview": "Screening → Interview",
    "offer": "Interview → Offer",
    "accepted": "Offer → Accepted",
}

_STAGE_IMPROVEMENT_TIPS: dict[str, str] = {
    "applied": "consider applying to more jobs",
    "screening": "review your resume for ATS keywords",
    "interview": "consider improving your resume tailoring",
    "offer": "practice your interview skills",
    "accepted": "work on your offer negotiation",
}


def get_funnel_insight(funnel_stages: list[FunnelStage]) -> str | None:
    """Return insight about the biggest drop-off stage.

    Returns None when total saved < 5 (insufficient data).
    """
    if not funnel_stages:
        return None

    saved_stage = next((s for s in funnel_stages if s.stage == "saved"), None)
    if saved_stage is None or saved_stage.count < 5:
        return None

    # Find the stage with the highest drop_off_pct (skip the first stage which has no drop_off).
    stages_with_drop = [s for s in funnel_stages if s.drop_off_pct is not None]
    if not stages_with_drop:
        return None

    worst = max(stages_with_drop, key=lambda s: s.drop_off_pct or 0.0)
    if worst.drop_off_pct is None or worst.drop_off_pct <= 0:
        return None

    transition = _STAGE_TRANSITION_LABELS.get(worst.stage, worst.stage)
    tip = _STAGE_IMPROVEMENT_TIPS.get(worst.stage, "review your job search strategy")

    return (
        f"Biggest drop: {transition} ({worst.drop_off_pct:.0f}%) "
        f"— {tip}"
    )


def get_resume_trend(sparkline: list[ResumeSparklinePoint]) -> str | None:
    """Return 'improving' | 'declining' | 'stable'.

    Returns None when fewer than 5 data points are available.
    Uses simple linear regression slope (index vs score).
    """
    if len(sparkline) < 5:
        return None

    scores = [point.score for point in sparkline]
    n = len(scores)
    xs = list(range(n))

    mean_x = sum(xs) / n
    mean_y = sum(scores) / n

    numerator = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, scores))
    denominator = sum((x - mean_x) ** 2 for x in xs)

    if denominator == 0:
        return "stable"

    slope = numerator / denominator

    if slope > 0.5:
        return "improving"
    if slope < -0.5:
        return "declining"
    return "stable"
