import httpx
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_groq import ChatGroq

from app.core.config import get_settings
from app.models.chat import ChatRequest

GROQ_MODELS_URL = "https://api.groq.com/openai/v1/models"
DEFAULT_MODELS = (
    ("openai/gpt-oss-20b", "GPT OSS 20B"),
    ("openai/gpt-oss-120b", "GPT OSS 120B"),
    ("meta-llama/llama-4-scout-17b-16e-instruct", "Llama 4 Scout"),
)


def _client(api_key: str, model: str, temperature: float, max_tokens: int) -> ChatGroq:
    settings = get_settings()
    return ChatGroq(
        model=model,
        api_key=api_key,
        temperature=temperature,
        max_tokens=max_tokens,
        timeout=settings.request_timeout_seconds,
        max_retries=1,
    )


def _trimmed_messages(request: ChatRequest):
    settings = get_settings()
    messages = request.messages[-settings.max_context_messages:]
    kept = []
    size = 0
    for message in reversed(messages):
        message_size = len(message.content) + 1024 * len(message.attachments)
        if kept and size + message_size > settings.max_context_characters:
            break
        kept.append(message)
        size += message_size
    return list(reversed(kept))


def _langchain_messages(request: ChatRequest):
    messages = []
    if request.system_prompt.strip():
        messages.append(SystemMessage(content=request.system_prompt.strip()))
    for message in _trimmed_messages(request):
        if message.role == "assistant":
            messages.append(AIMessage(content=message.content))
            continue
        content = []
        if message.content:
            content.append({"type": "text", "text": message.content})
        for image in message.attachments:
            if request.model not in get_settings().configured_vision_models:
                raise ValueError("This model does not support image input. Choose a configured vision model.")
            content.append({
                "type": "image_url",
                "image_url": {"url": image.data_url},
            })
        messages.append(HumanMessage(content=content))
    return messages


def _text_from_content(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            part.get("text", "")
            for part in content
            if isinstance(part, dict) and part.get("type") == "text"
        )
    return ""


async def generate_reply(api_key: str, request: ChatRequest) -> str:
    messages = _langchain_messages(request)
    result = await _client(api_key, request.model, request.temperature, request.max_tokens).ainvoke(messages)
    return _text_from_content(result.content)


async def stream_reply(api_key: str, request: ChatRequest):
    messages = _langchain_messages(request)
    client = _client(api_key, request.model, request.temperature, request.max_tokens)
    async for chunk in client.astream(messages):
        text = _text_from_content(chunk.content)
        if text:
            yield text


async def list_models(api_key: str) -> list[dict[str, str | bool]]:
    settings = get_settings()
    async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
        response = await client.get(GROQ_MODELS_URL, headers={"Authorization": f"Bearer {api_key}"})
    response.raise_for_status()
    data = response.json().get("data", [])
    available = {
        entry["id"]: entry
        for entry in data
        if isinstance(entry, dict) and isinstance(entry.get("id"), str) and entry.get("active", True)
    }
    return [
        {
            "id": model_id,
            "name": model_id,
            "vision": model_id in settings.configured_vision_models,
        }
        for model_id in sorted(available)
    ]


def default_models() -> list[dict[str, str | bool]]:
    settings = get_settings()
    return [
        {
            "id": model_id,
            "name": display_name,
            "vision": model_id in settings.configured_vision_models,
        }
        for model_id, display_name in DEFAULT_MODELS
    ]
