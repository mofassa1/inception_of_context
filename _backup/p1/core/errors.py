from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from p1.core.logging import get_logger

logger = get_logger(__name__)


class ServiceError(Exception):
    """Base for every failure this service reports deliberately."""

    code = "INTERNAL_ERROR"
    status = 500

    def __init__(self, message: str, **context):
        super().__init__(message)
        self.message = message
        self.context = context


class ModelUnavailable(ServiceError):
    code = "MODEL_UNAVAILABLE"
    status = 503


class OllamaUnreachable(ServiceError):
    code = "OLLAMA_UNREACHABLE"
    status = 503


class PathNotFound(ServiceError):
    code = "PATH_NOT_FOUND"
    status = 404


class PathAlreadyExists(ServiceError):
    code = "PATH_ALREADY_EXISTS"
    status = 409


class InvalidPath(ServiceError):
    code = "INVALID_PATH"
    status = 400


class PathNotVisible(ServiceError):
    code = "PATH_NOT_VISIBLE"
    status = 404


class NotTextFile(ServiceError):
    code = "NOT_TEXT_FILE"
    status = 415


class InvalidPatch(ServiceError):
    code = "INVALID_PATCH"
    status = 422


class IndexingFailed(ServiceError):
    code = "INDEXING_FAILED"
    status = 500


class ValidationFailed(ServiceError):
    code = "VALIDATION_FAILED"
    status = 422


def missing_path(target, kind: str, visible_roots: list[str]) -> ServiceError:
    """Why a path cannot be used: absent, or outside what the container sees.

    In Docker the API only sees the host directories `make up` mounted. A
    folder elsewhere does exist on the host, so "not a directory" would be a lie.
    """
    location = str(target)
    inside_a_root = any(
        location == root or location.startswith(root.rstrip("/") + "/")
        for root in visible_roots
    )

    if visible_roots and not inside_a_root:
        return PathNotVisible(
            f"{location} is outside the folders the API container can see "
            f"({', '.join(visible_roots)}). Open a project under one of them, "
            "or run `make app` to use an API on the host.",
            path=location,
        )

    return PathNotFound(f"not a {kind}: {location}", path=location)


def error_body(message: str, code: str) -> dict:
    return {"detail": message, "code": code}


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ServiceError)
    async def handle_service_error(_: Request, error: ServiceError) -> JSONResponse:
        logger.warning(
            "%s: %s%s",
            error.code,
            error.message,
            f" {error.context}" if error.context else "",
        )
        return JSONResponse(
            status_code=error.status,
            content=error_body(error.message, error.code),
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation(_: Request, error: RequestValidationError) -> JSONResponse:
        problems = "; ".join(
            f"{'.'.join(str(part) for part in item['loc'][1:]) or 'body'}: {item['msg']}"
            for item in error.errors()
        )
        logger.warning("VALIDATION_ERROR: %s", problems)
        return JSONResponse(
            status_code=422,
            content=error_body(f"Invalid request — {problems}", "VALIDATION_ERROR"),
        )

    @app.exception_handler(Exception)
    async def handle_unexpected(request: Request, error: Exception) -> JSONResponse:
        logger.exception("unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content=error_body(
                "Internal server error. Check the agent logs for details.",
                "INTERNAL_ERROR",
            ),
        )
