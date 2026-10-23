import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.routes import router
from app.core.config import get_settings

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
settings = get_settings()
app = FastAPI(title=settings.app_name, version="1.0.0", docs_url=None if settings.environment == "production" else "/docs")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-Groq-API-Key"],
)


@app.middleware("http")
async def enforce_body_limit(request: Request, call_next):
    max_body_bytes = settings.max_image_bytes * settings.max_images_per_message * 2 + 256_000
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > max_body_bytes:
                return JSONResponse(status_code=413, content={"detail": {"code": "payload_too_large", "message": "Request exceeds the allowed size."}})
        except ValueError:
            return JSONResponse(status_code=400, content={"detail": {"code": "invalid_content_length", "message": "Invalid request size."}})
    return await call_next(request)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_request: Request, error: RequestValidationError):
    message = "Invalid request. Check your message, image type, and size."
    for item in error.errors():
        if item.get("type") == "value_error":
            message = str(item.get("ctx", {}).get("error", message))
            break
    return JSONResponse(status_code=422, content={"detail": {"code": "invalid_request", "message": message}})


@app.exception_handler(StarletteHTTPException)
async def http_error_handler(_request: Request, error: StarletteHTTPException):
    if isinstance(error.detail, dict):
        detail = error.detail
    else:
        detail = {"code": "http_error", "message": str(error.detail)}
    return JSONResponse(status_code=error.status_code, content={"detail": detail}, headers=error.headers)


app.include_router(router)
