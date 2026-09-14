import logging
import sys

LOG_FORMAT = "%(asctime)s %(levelname)-8s %(name)-28s %(message)s"
DATE_FORMAT = "%H:%M:%S"

_configured = False


def configure_logging(level: str = "INFO") -> None:
    global _configured
    if _configured:
        return

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(LOG_FORMAT, datefmt=DATE_FORMAT))

    root = logging.getLogger()
    root.setLevel(level.upper())
    root.addHandler(handler)

    _configured = True


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
