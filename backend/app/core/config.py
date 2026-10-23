from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Nexora AI"
    environment: str = "development"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    vision_models: str = "meta-llama/llama-4-scout-17b-16e-instruct"
    default_model: str = "openai/gpt-oss-20b"
    max_image_bytes: int = Field(default=5 * 1024 * 1024, gt=0, le=20 * 1024 * 1024)
    max_images_per_message: int = Field(default=4, ge=1, le=4)
    max_context_messages: int = Field(default=20, ge=1, le=40)
    max_context_characters: int = Field(default=60000, ge=1024, le=200000)
    request_timeout_seconds: float = Field(default=90.0, gt=0, le=600)
    rate_limit_requests: int = Field(default=30, ge=1, le=10000)
    rate_limit_window_seconds: int = Field(default=60, ge=1, le=3600)

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def allowed_origins(self) -> list[str]:
        origins = [origin.strip().rstrip("/") for origin in self.cors_origins.split(",") if origin.strip()]
        if self.environment.lower() == "production" and ("*" in origins or not origins):
            raise ValueError("Production CORS must list explicit frontend origins.")
        return origins

    @property
    def configured_vision_models(self) -> set[str]:
        return {model.strip() for model in self.vision_models.split(",") if model.strip()}


@lru_cache
def get_settings() -> Settings:
    return Settings()
