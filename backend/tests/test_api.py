from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_models_without_key_are_unverified_defaults():
    response = client.get("/api/models")

    assert response.status_code == 200
    body = response.json()
    assert body["verified"] is False
    assert any(model["id"] == "openai/gpt-oss-20b" for model in body["models"])


def test_chat_requires_a_user_supplied_key():
    response = client.post("/api/chat", json={
        "model": "openai/gpt-oss-20b",
        "messages": [{"role": "user", "content": "Hello"}],
    })

    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "missing_api_key"


def test_empty_message_is_rejected_before_provider_call():
    response = client.post("/api/chat", json={
        "model": "openai/gpt-oss-20b",
        "messages": [{"role": "user", "content": "  "}],
    }, headers={"X-Groq-API-Key": "gsk_example"})

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "invalid_request"


def test_invalid_model_identifier_is_rejected():
    response = client.post("/api/chat", json={
        "model": "model name with spaces",
        "messages": [{"role": "user", "content": "Hello"}],
    }, headers={"X-Groq-API-Key": "gsk_example"})

    assert response.status_code == 422
