from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ParsedJobData:
    job_title: Optional[str] = None
    company: Optional[str] = None
    requirements: list[str] = field(default_factory=list)
    location: Optional[str] = None
    salary: Optional[str] = None


@dataclass
class AIUsageInfo:
    model: str
    tokens_input: int
    tokens_output: int
    response_time_ms: int


@dataclass
class ParseJobResult:
    data: ParsedJobData
    usage: Optional[AIUsageInfo]  # None if parsing failed gracefully
    success: bool


class AIServiceInterface(ABC):
    @abstractmethod
    async def parse_job_description(self, text: str) -> ParseJobResult:
        ...
