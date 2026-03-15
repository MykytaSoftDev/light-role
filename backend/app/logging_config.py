import logging
import logging.handlers
from pathlib import Path


class JsonFormatter(logging.Formatter):
    """Simple JSON log formatter."""

    def format(self, record: logging.LogRecord) -> str:
        import json
        from datetime import datetime, timezone

        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)

        if hasattr(record, "extra"):
            log_entry.update(record.extra)

        return json.dumps(log_entry, ensure_ascii=False)


def setup_logging(log_dir: str = "logs", environment: str = "development") -> None:
    """
    Configure application logging:
    - Console handler: human-readable in development, JSON in production
    - File handler: JSON format, rotating daily, 30-day retention
    """
    log_path = Path(log_dir)
    log_path.mkdir(parents=True, exist_ok=True)

    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    # Remove existing handlers
    root_logger.handlers.clear()

    # --- Console handler ---
    console_handler = logging.StreamHandler()
    if environment == "development":
        console_handler.setFormatter(
            logging.Formatter(
                fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
                datefmt="%H:%M:%S",
            )
        )
    else:
        console_handler.setFormatter(JsonFormatter())
    console_handler.setLevel(logging.INFO)
    root_logger.addHandler(console_handler)

    # --- Rotating file handler (JSON, daily, 30 days) ---
    file_handler = logging.handlers.TimedRotatingFileHandler(
        filename=log_path / "app.log",
        when="midnight",
        interval=1,
        backupCount=30,
        encoding="utf-8",
    )
    file_handler.setFormatter(JsonFormatter())
    file_handler.setLevel(logging.INFO)
    root_logger.addHandler(file_handler)

    # Quieten noisy libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
