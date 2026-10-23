import { useEffect, useState } from "react";
import { Check, ExternalLink, Eye, EyeOff, KeyRound, LoaderCircle, ShieldCheck, Trash2, X } from "lucide-react";
import type { ModelInfo } from "../types/chat";
import { getModels, testConnection } from "../services/api";
import { Button } from "./ui/button";

interface SettingsDialogProps {
  open: boolean;
  apiKey: string;
  model: string;
  models: ModelInfo[];
  onClose: () => void;
  onConnect: (key: string, models: ModelInfo[]) => void;
  onDisconnect: () => void;
  onSelectModel: (model: string) => void;
}

export function SettingsDialog({
  open, apiKey, model, models, onClose, onConnect, onDisconnect, onSelectModel,
}: SettingsDialogProps) {
  const [draftKey, setDraftKey] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [availableModels, setAvailableModels] = useState(models);

  useEffect(() => {
    if (open) {
      setDraftKey(apiKey);
      setAvailableModels(models);
      setStatus(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  async function connect() {
    const key = draftKey.trim();
    if (!key) {
      setStatus({ kind: "error", message: "Paste your Groq API key to continue." });
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      let nextModels = models;
      let modelListWarning = false;
      try {
        const result = await getModels(key);
        if (result.models.length) nextModels = result.models;
      } catch {
        modelListWarning = true;
      }
      const selectedModel = nextModels.some((item) => item.id === model) ? model : nextModels[0]?.id ?? model;
      onSelectModel(selectedModel);
      await testConnection(key, selectedModel);
      setAvailableModels(nextModels);
      onConnect(key, nextModels);
      setStatus({
        kind: "success",
        message: modelListWarning
          ? "Connected, but the model list could not be refreshed. The default models are shown."
          : "Connected. Your key is held in memory for this session only.",
      });
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "Could not connect to Groq." });
    } finally {
      setBusy(false);
    }
  }

  async function testOnly() {
    const key = draftKey.trim();
    if (!key) {
      setStatus({ kind: "error", message: "Enter a Groq API key before testing." });
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      await testConnection(key, model);
      setStatus({ kind: "success", message: "Connection test passed. Select Connect to use this key." });
      try {
        const result = await getModels(key);
        if (result.models.length) setAvailableModels(result.models);
      } catch {
        setStatus({ kind: "success", message: "Connection test passed, but the model list could not be refreshed." });
      }
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "Could not connect to Groq." });
    } finally {
      setBusy(false);
    }
  }

  function disconnect() {
    onDisconnect();
    setDraftKey("");
    setStatus({ kind: "success", message: "Disconnected. The key was cleared from application memory." });
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="flex items-start justify-between gap-4">
          <div>
            <div className="eyebrow mb-2"><span className="status-dot" /> PERSONAL CONNECTION</div>
            <h2 id="settings-title" className="font-display text-2xl font-bold">Your AI, your key.</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted">
              Connect your own Groq account. Usage is subject to your account's quota and billing.
            </p>
          </div>
          <Button size="icon" aria-label="Close settings" onClick={onClose}><X size={18} /></Button>
        </header>

        <div className="privacy-note mt-6">
          <ShieldCheck size={17} className="mt-0.5 shrink-0 text-cyan" />
          <p>Your key is sent only to this backend to make your request. It is not saved to the browser or server, and is cleared when you disconnect or close this tab.</p>
        </div>

        <label htmlFor="groq-key" className="field-label mt-6">GROQ API KEY</label>
        <div className="key-input-wrap mt-2">
          <KeyRound size={17} className="text-muted" />
          <input
            id="groq-key"
            value={draftKey}
            onChange={(event) => setDraftKey(event.target.value)}
            type={showKey ? "text" : "password"}
            placeholder="gsk_..."
            autoFocus
            autoComplete="off"
            spellCheck={false}
            aria-describedby="key-help"
          />
          <button className="icon-button" type="button" onClick={() => setShowKey(!showKey)} aria-label={showKey ? "Hide API key" : "Show API key"}>
            {showKey ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
        <p id="key-help" className="mt-2 text-xs leading-5 text-muted">
          Create a key in the <a className="inline-link" href="https://console.groq.com/keys" target="_blank" rel="noreferrer">Groq Console <ExternalLink size={11} /></a>. Never share it publicly.
        </p>

        <label htmlFor="model-select" className="field-label mt-6">MODEL</label>
        <select
          id="model-select"
          className="model-select mt-2"
          value={model}
          onChange={(event) => onSelectModel(event.target.value)}
        >
          {availableModels.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}{item.vision ? " · Vision" : ""}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs leading-5 text-muted">Models are loaded from Groq using your key when connected. Image understanding requires a configured vision model.</p>

        {status && (
          <div className={`status-message ${status.kind}`} role="status">
            {status.kind === "success" ? <Check size={16} /> : <span className="status-dot error-dot" />}
            <span>{status.message}</span>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={connect} disabled={busy || !draftKey.trim()}>
            {busy ? <LoaderCircle size={15} className="animate-spin" /> : <KeyRound size={15} />}
            Connect
          </Button>
          <Button variant="secondary" onClick={testOnly} disabled={busy || !draftKey.trim()}>
            Test connection
          </Button>
          {apiKey && (
            <Button variant="danger" onClick={disconnect} disabled={busy}>
              <Trash2 size={15} /> Clear key
            </Button>
          )}
        </div>
        <div className="mt-6 border-t border-white/[.08] pt-4 text-xs text-muted">
          Requests are sent over HTTPS when deployed. Your chat history stays in this browser; it is sent to Groq only when you chat.
        </div>
      </section>
    </div>
  );
}
