# Nexora AI

Nexora AI is a personal AI chat application with a React web interface and a FastAPI backend. Each person connects their own Groq API key; the project owner does not provide a shared key. The original command-line chatbot in `main.py` is preserved.

## Features

- Stream real responses from Groq using LangChain's `ChatGroq`.
- Supply and test your own Groq key in Settings; keys are held in application memory and sent only in an HTTPS request header when deployed.
- Choose from the models available to your Groq account. Image understanding is enabled only for models named in the backend's `VISION_MODELS` configuration.
- Attach PNG, JPEG, or WebP images by file picker, drag-and-drop, or clipboard paste. Images are validated and are not retained by the backend.
- Keep separate chats in browser-local storage, search them, rename/delete them, export as Markdown, retry answers, and edit/resend user messages.
- Use Markdown, tables, and syntax-highlighted code blocks; change between dark and light themes.
- Responsive desktop and mobile layouts, with a mobile navigation drawer.

## Technology

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Framer Motion, Lucide, React Markdown, and local shadcn-style UI primitives.
- **Backend:** Python 3.12, FastAPI, Pydantic, LangChain, and `langchain-groq`.
- **AI provider:** Groq's API, authenticated per request with the current user's key.
- **Deployment examples:** Vercel for the frontend; Render or Railway for the backend.

## Requirements

- Python 3.12 and pip.
- Node.js 18 or newer and npm.
- A Groq account and a Groq API key for live AI requests. The website itself can be opened without a key, but chat, connection tests, and personalized model discovery need one.

## Run locally (Windows PowerShell)

Open two PowerShell terminals from the project directory.

### 1. Configure and run the backend

```powershell
Copy-Item backend\.env.example backend\.env
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

If PowerShell prevents virtual-environment activation, either use `.\.venv\Scripts\python.exe -m pip install -r requirements.txt` and `.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000`, or adjust the execution policy for your current user. Do not put a personal Groq key in `.env`; users enter their own key in the app.

### 2. Configure and run the frontend

In another terminal, from the project directory:

```powershell
Copy-Item frontend\.env.example frontend\.env
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`). `VITE_API_BASE_URL` defaults to `http://127.0.0.1:8000`. The backend health check is at `http://127.0.0.1:8000/api/health`; interactive API docs are at `http://127.0.0.1:8000/docs` in development.

### macOS/Linux

The equivalent backend setup is `python3.12 -m venv .venv`, `source .venv/bin/activate`, `pip install -r requirements.txt`, then `uvicorn app.main:app --reload --port 8000`. Create the environment files with `cp backend/.env.example backend/.env` and `cp frontend/.env.example frontend/.env`. The npm commands are the same.

## Create and connect a Groq API key

1. Sign in at [Groq Console](https://console.groq.com/).
2. Create an API key at [console.groq.com/keys](https://console.groq.com/keys) and copy it somewhere private.
3. In Nexora, open **Settings & API key**, paste the key, choose a model available to your account, and select **Test connection** or **Connect**.
4. The key is kept in page memory only. Clearing it or closing the tab removes it from the application. The key is sent to the Nexora backend in the `X-Groq-API-Key` request header, then passed to a newly created Groq client for that request. It is not stored in local storage, server environment variables, or application logs.

Chat requests consume the connected user's Groq quota and are subject to Groq's model access, rate limits, and account terms. Do not use a key on a device or website you do not trust.

## Image analysis

Attach an image (up to 5 MB; PNG, JPEG, or WebP) and ask a question about it. Clipboard image paste and dropping images into the chat are supported. The backend checks the actual file signature and sends the image only as part of that request; it does not save uploads to disk.

Groq model availability and image support can change. Nexora does not infer vision support from a model name: configure the backend's comma-separated `VISION_MODELS` list only with model IDs currently documented as vision-capable and available to your users. Its example value is `meta-llama/llama-4-scout-17b-16e-instruct`; verify the current model catalog and availability in Groq before relying on it. Once connected, the model picker is populated from Groq's model-list endpoint for that user's key and marks only configured vision models as image-capable. A text-only model is not allowed to claim it analyzed an image.

## Test and build

Backend tests cover health, default model discovery, missing credentials, empty messages, and invalid model identifiers:

```powershell
cd backend
pip install -r requirements-dev.txt
python -m pytest
```

Build/type-check the frontend:

```powershell
cd frontend
npm install
npm run build
```

Tests that require an actual Groq key, image-capable account/model, or public deployment must be performed with those resources; the automated tests do not pretend to call a provider. The health endpoint can be used by deployment health checks.

## GitHub

Create a repository on GitHub, then from this project directory:

```powershell
git init
git add .
git status
git commit -m "Build Nexora AI chat application"
git branch -M main
git remote add origin https://github.com/YOUR-ACCOUNT/YOUR-REPOSITORY.git
git push -u origin main
```

Review `git status` before pushing. `.env` files, virtual environments, and frontend build output are ignored. Never commit a real Groq key.

## Deploy the frontend to Vercel

1. Import the GitHub repository into Vercel.
2. Set the project **Root Directory** to `frontend`.
3. Add the build-time environment variable `VITE_API_BASE_URL` with your deployed backend URL (for example `https://nexora-api.example-host.com`, without a trailing slash).
4. Deploy. `frontend/vercel.json` provides a history fallback for the single-page app.

The Vite variable is a public API address, not a secret. Do not add a Groq API key to Vercel's frontend environment.

## Deploy the backend to Render or Railway

### Render

The repository includes a root `render.yaml` blueprint. Create a Render Blueprint deployment, choose this repository, and set:

- `ENVIRONMENT=production`
- `CORS_ORIGINS=https://YOUR-VERCEL-DOMAIN.vercel.app` (add any custom domain as a comma-separated origin)
- `VISION_MODELS` to the verified Groq vision model IDs you intend to support

Render provides HTTPS and uses `/api/health` for health checks. Alternatively, create a Python web service with the backend directory as its root, `pip install -r requirements.txt` as the build command, and `uvicorn app.main:app --host 0.0.0.0 --port $PORT` as its start command.

### Railway

Create a Railway service from the repository and set its root directory to `backend`. The included `Procfile` starts Uvicorn; `railway.json` configures the `/api/health` check. Add the same `ENVIRONMENT`, `CORS_ORIGINS`, and `VISION_MODELS` variables in the Railway service settings.

Do not configure `GROQ_API_KEY` on either backend host. Each request carries its user's key; no personal or shared provider key is required by this deployment.

## Connect and share the public app

After both deployments are ready, set the frontend's `VITE_API_BASE_URL` to the backend HTTPS URL and redeploy the frontend. Set the backend's `CORS_ORIGINS` to the exact frontend origin(s), with no wildcard in production. Check `https://YOUR-BACKEND-DOMAIN/api/health`, open the frontend, enter your own key, and test a chat. Share the frontend URL; each friend enters their own Groq key in Settings.

## Privacy, security, and hosting limitations

- This initial version has no user accounts or cloud synchronization. Chat text is saved in the current browser's local storage and is not shared with other visitors. Image bytes are kept in page memory for the active session so image follow-ups can include them; image bytes are **not** stored in local browser history, so reloaded chats retain attachment names but not the image itself.
- API keys are not persisted by the application. While processing a request, the backend receives a key over the network, uses a request-specific Groq client, and does not intentionally log or retain it. Use HTTPS in production. Browser extensions, compromised devices, hosting infrastructure, and network termination points remain outside this application's control.
- The backend stores no uploaded image files or conversation database. Requests to Groq contain the conversation context needed for the response, subject to the configured 20-message / 60,000-character limits and a four-image context cap. Groq's own privacy, retention, and quota policies apply.
- Anonymous backend endpoints have a modest in-process per-IP rate limit. It is not a substitute for production abuse protection: free hosting may sleep, cold-start, restart, enforce request-duration/body limits, and use multiple instances where this process-local limit is not shared. Consider a managed rate limiter and monitoring before broad public exposure.
- The example vision model may be removed or unavailable for an account. Configure vision model IDs based on current Groq documentation; model discovery is account-specific, and a working API key does not guarantee access to every model.
- Conversation storage is local to the browser profile and can be cleared by the user or browser. Do not use this unauthenticated public app to store sensitive or regulated conversations.

## Troubleshooting

- **Cannot connect to backend:** confirm Uvicorn is running on port 8000, `VITE_API_BASE_URL` is correct, and restart Vite after changing `.env`.
- **CORS error after deployment:** make `CORS_ORIGINS` exactly match the browser's frontend origin, including `https://` and any custom domain; restart/redeploy the backend.
- **Invalid API key:** reconnect with a valid key from Groq Console. The key must be entered in the app, not a shared environment variable.
- **Model unavailable:** connect the key to refresh its model list and choose a listed model. Account access can differ; the default model is not guaranteed.
- **Image model error:** choose a currently available vision model that is also present in backend `VISION_MODELS`. Text models cannot analyze images.
- **Rate limit or quota:** wait, review the connected Groq account's quota, or select another model your account can use.
- **Images rejected:** use PNG, JPEG, or WebP files no larger than 5 MB each; the backend also verifies their file signatures.
- **Storage warning:** export chats you want to keep and remove older conversations, or clear site data only after saving important chats.
- **Deployment sleeps or times out:** free hosting can cold-start or stop idle services; check provider logs and consider an always-on paid plan for faster responses.
