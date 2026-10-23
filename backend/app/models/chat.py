import base64
import binascii
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.config import get_settings

MAX_CONTEXT_IMAGES = 4


class Attachment(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=255)
    mime_type: Literal["image/png", "image/jpeg", "image/webp"]
    data_url: str = Field(min_length=32)

    @field_validator("data_url")
    @classmethod
    def validate_image_data(cls, value: str, info) -> str:
        mime_type = info.data.get("mime_type")
        prefix = f"data:{mime_type};base64,"
        if not mime_type or not value.startswith(prefix):
            raise ValueError("Image data does not match its declared type.")
        try:
            raw = base64.b64decode(value[len(prefix):], validate=True)
        except (ValueError, binascii.Error) as error:
            raise ValueError("Image data is invalid.") from error
        settings = get_settings()
        if not raw or len(raw) > settings.max_image_bytes:
            raise ValueError(f"Images must be no larger than {settings.max_image_bytes // (1024 * 1024)} MB.")
        signatures = {
            "image/png": raw.startswith(b"\x89PNG\r\n\x1a\n"),
            "image/jpeg": raw.startswith(b"\xff\xd8\xff"),
            "image/webp": len(raw) >= 12 and raw[:4] == b"RIFF" and raw[8:12] == b"WEBP",
        }
        if not signatures[mime_type]:
            raise ValueError("The image content does not match its file type.")
        return value

class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["user", "assistant"]
    content: str = Field(max_length=50000)
    attachments: list[Attachment] = Field(default_factory=list, max_length=4)

    @model_validator(mode="after")
    def require_message_content(self):
        if self.role == "user" and len(self.content) > 16000:
            raise ValueError("User messages must be no longer than 16,000 characters.")
        if not self.content.strip() and not self.attachments:
            raise ValueError("A message must contain text or an image.")
        if len(self.attachments) > get_settings().max_images_per_message:
            raise ValueError("Too many images in one message.")
        if self.role == "assistant" and self.attachments:
            raise ValueError("Assistant messages cannot include attachments.")
        return self


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    model: str = Field(min_length=1, max_length=160, pattern=r"^[A-Za-z0-9._/-]+$")
    messages: list[ChatMessage] = Field(min_length=1, max_length=40)
    system_prompt: str = Field(default="", max_length=4000)
    temperature: float = Field(default=0.7, ge=0, le=2)
    max_tokens: int = Field(default=2048, ge=1, le=8192)

    @model_validator(mode="after")
    def validate_history(self):
        if self.messages[-1].role != "user":
            raise ValueError("The last message must be from the user.")
        if sum(len(message.attachments) for message in self.messages) > MAX_CONTEXT_IMAGES:
            raise ValueError("Only the 4 most recent images can be included in the conversation context.")
        return self


class ConnectionTestRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    model: str = Field(min_length=1, max_length=160, pattern=r"^[A-Za-z0-9._/-]+$")


class ModelInfo(BaseModel):
    id: str
    name: str
    vision: bool
