import asyncio
import json
import logging
import time
from collections import defaultdict, deque
from typing import Annotated

import httpx
from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import StreamingResponse
from groq import APIConnectionError, APIStatusError, AuthenticationError, RateLimitError

from app.core.config import get_settings
from app.models.chat import ChatRequest, ConnectionTestRequest
from app.services.groq_service import (
    default_models,
    generate_reply,
    list_models,
    stream_reply,
)

logger = logging.getLogger("nexora")
router = APIRouter(prefix="/api")
_requests_by_ip: dict[str, deque[float]] = defaultdict(deque)
_rate_limit_lock = asyncio.Lock()


def _api_key(value: str | None) -> str:
    if not value or len(value) > 512 or not value.startswith("gsk_"):
        raise HTTPException(status_code=401, detail={"code": "missing_api_key", "message": "Enter a valid Groq API key in Settings."})
    return value


def _provider_error(error: Exception) -> HTTPException:
    if isinstance(error, AuthenticationError):
        return HTTPException(status_code=401, detail={"code": "invalid_api_key", "message": "Groq rejected this API key. Check it and try again."})
    if isinstance(error, RateLimitError):
        return HTTPException(status_code=429, detail={"code": "rate_limited", "message": "Groq rate limit reached. Wait a moment or check your account quota."})
    if isinstance(error, APIStatusError):
        status = error.status_code
        if status == 400:
            return HTTPException(status_code=400, detail={"code": "invalid_model_request", "message": "Groq rejected this model or request. Try another available model or remove the image."})
        if status == 404:
            return HTTPException(status_code=400, detail={"code": "model_unavailable", "message": "This model is unavailable to your Groq account. Choose another model."})
        if status == 413:
            return HTTPException(status_code=413, detail={"code": "payload_too_large", "message": "The request is too large. Remove an image or shorten the conversation."})
        return HTTPException(status_code=502, detail={"code": "provider_error", "message": "Groq could not complete the request. Check model availability and try again."})
    if isinstance(error, (APIConnectionError, httpx.TimeoutException, httpx.ConnectError)):
        return HTTPException(status_code=504, detail={"code": "provider_unavailable", "message": "Could not reach Groq. Check your connection and retry."})
    if isinstance(error, ValueError):
        return HTTPException(status_code=400, detail={"code": "invalid_request", "message": str(error)})
    logger.warning("Groq request failed (%s)", type(error).__name__)
    return HTTPException(status_code=502, detail={"code": "provider_error", "message": "The AI request failed. Please try again."})


async def _check_rate_limit(request: Request) -> None:
    settings = get_settings()
    client_ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    async with _rate_limit_lock:
        bucket = _requests_by_ip[client_ip]
        while bucket and now - bucket[0] > settings.rate_limit_window_seconds:
            bucket.popleft()
        if len(bucket) >= settings.rate_limit_requests:
            raise HTTPException(status_code=429, detail={"code": "request_rate_limited", "message": "Too many requests. Please wait before trying again."})
        bucket.append(now)
        if len(_requests_by_ip) > 10000:
            expired = [key for key, values in _requests_by_ip.items() if not values or now - values[-1] > settings.rate_limit_window_seconds]
            for key in expired:
                _requests_by_ip.pop(key, None)


async def _chat_key(request: Request, x_groq_api_key: Annotated[str | None, Header()] = None) -> str:
    await _check_rate_limit(request)
    return _api_key(x_groq_api_key)


@router.get("/health")
async def health():
    return {"status": "ok", "service": "nexora-api"}


@router.get("/models")
async def models(request: Request, x_groq_api_key: Annotated[str | None, Header()] = None):
    await _check_rate_limit(request)
    if not x_groq_api_key:
        return {"models": default_models(), "verified": False, "default_model": get_settings().default_model}
    key = _api_key(x_groq_api_key)
    try:
        return {"models": await list_models(key), "verified": True, "default_model": get_settings().default_model}
    except (httpx.HTTPStatusError, httpx.TimeoutException, httpx.ConnectError) as error:
        if isinstance(error, httpx.HTTPStatusError):
            if error.response.status_code in (401, 403):
                raise HTTPException(status_code=401, detail={"code": "invalid_api_key", "message": "Groq rejected this API key. Check it and try again."}) from error
            if error.response.status_code == 429:
                raise HTTPException(status_code=429, detail={"code": "rate_limited", "message": "Groq rate limit reached. Wait a moment or check your account quota."}) from error
        raise _provider_error(error) from error


@router.post("/chat")
async def chat(
    payload: ChatRequest,
    request: Request,
    x_groq_api_key: Annotated[str | None, Header()] = None,
):
    key = await _chat_key(request, x_groq_api_key)
    try:
        return {"content": await generate_reply(key, payload)}
    except Exception as error:
        raise _provider_error(error) from error


@router.post("/chat/stream")
async def chat_stream(
    payload: ChatRequest,
    request: Request,
    x_groq_api_key: Annotated[str | None, Header()] = None,
):
    key = await _chat_key(request, x_groq_api_key)

    async def events():
        try:
            async for text in stream_reply(key, payload):
                yield f"data: {json.dumps({'text': text}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        except asyncio.CancelledError:
            raise
        except Exception as error:
            safe_error = _provider_error(error)
            detail = safe_error.detail
            yield f"data: {json.dumps({'error': detail['message'], 'code': detail['code']})}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
    })


@router.post("/chat/test-connection")
async def test_connection(
    payload: ConnectionTestRequest,
    request: Request,
    x_groq_api_key: Annotated[str | None, Header()] = None,
):
    key = await _chat_key(request, x_groq_api_key)
    try:
        response = await generate_reply(
            key,
            ChatRequest(
                model=payload.model,
                messages=[{"role": "user", "content": "Reply with OK."}],
                max_tokens=16,
            ),
        )
        return {"connected": True, "model": payload.model, "response": response}
    except Exception as error:
        raise _provider_error(error) from error
