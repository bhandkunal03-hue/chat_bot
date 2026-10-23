import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowDownToLine, ChevronDown, Menu, Moon, PanelLeft, Plus, Settings2, Sparkles, Sun, Trash2,
} from "lucide-react";
import type { DragEvent } from "react";
import { Composer } from "./components/Composer";
import { MessageBubble } from "./components/MessageBubble";
import { SettingsDialog } from "./components/SettingsDialog";
import { Sidebar } from "./components/Sidebar";
import { Button } from "./components/ui/button";
import { ApiError, getModels, streamChat } from "./services/api";
import type { Attachment, Conversation, Message, ModelInfo, Theme } from "./types/chat";
import { loadConversations, loadTheme, saveConversations, saveTheme } from "./utils/storage";
import { readImageFiles } from "./utils/images";

const INITIAL_MODEL = "openai/gpt-oss-20b";
const INITIAL_MODELS: ModelInfo[] = [
  { id: INITIAL_MODEL, name: "GPT OSS 20B", vision: false },
  { id: "openai/gpt-oss-120b", name: "GPT OSS 120B", vision: false },
  { id: "meta-llama/llama-4-scout-17b-16e-instruct", name: "Llama 4 Scout", vision: true },
];
const SUGGESTIONS = [
  { title: "Explain a complex concept", prompt: "Explain a complex concept to me in a clear, intuitive way. Start with an analogy, then build up the details.", icon: "◈", tint: "violet" },
  { title: "Analyze an uploaded image", prompt: "What is in this image? Describe the important details and anything I should notice.", icon: "⌗", tint: "cyan" },
  { title: "Help me write code", prompt: "Help me write clean, reliable code. I'll describe what I need, and you can ask clarifying questions first.", icon: "</>", tint: "blue" },
  { title: "Brainstorm creative ideas", prompt: "Let's brainstorm some fresh, unexpected ideas. Give me a few distinct directions to explore.", icon: "✳", tint: "pink" },
];

function makeConversation(): Conversation {
  return { id: crypto.randomUUID(), title: "New conversation", messages: [], updatedAt: Date.now() };
}

function messageTitle(message: Message) {
  const title = message.content.trim().replace(/\s+/g, " ");
  return title.length > 42 ? `${title.slice(0, 42).trim()}…` : title || "Image conversation";
}

function loadInitialConversations() {
  try {
    const conversations = loadConversations();
    return { conversations, warning: "" };
  } catch {
    return { conversations: [] as Conversation[], warning: "Saved chats could not be read from this browser." };
  }
}

export default function App() {
  const [initialChats] = useState(loadInitialConversations);
  const [conversations, setConversations] = useState<Conversation[]>(initialChats.conversations);
  const [selectedId, setSelectedId] = useState<string | null>(initialChats.conversations[0]?.id ?? null);
  const initialConversationsRef = useRef(conversations);
  const [models, setModels] = useState<ModelInfo[]>(INITIAL_MODELS);
  const [selectedModel, setSelectedModel] = useState(INITIAL_MODEL);
  const [apiKey, setApiKey] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [storageWarning, setStorageWarning] = useState(initialChats.warning);
  const [dragging, setDragging] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const activeConversation = conversations.find((conversation) => conversation.id === selectedId) ?? null;
  const selectedModelInfo = models.find((model) => model.id === selectedModel) ?? null;
  const messages = activeConversation?.messages ?? [];

  useEffect(() => {
    if (conversations === initialConversationsRef.current) return;
    const timeout = window.setTimeout(() => {
      try {
        saveConversations(conversations);
        setStorageWarning((current) => current.startsWith("Browser storage is full") ? "" : current);
      } catch {
        setStorageWarning("Browser storage is full. Some recent chat history may not be saved.");
      }
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [conversations]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      saveTheme(theme);
    } catch {
      setStorageWarning("Your theme preference could not be saved in this browser.");
    }
  }, [theme]);

  useEffect(() => {
    void getModels().then((result) => {
      if (result.models.length) {
        setModels(result.models);
        const preferred = result.models.find((model) => model.id === result.default_model) ?? result.models[0];
        setSelectedModel(preferred.id);
      }
    }).catch(() => {
      // The app remains usable offline; model access is verified when a key is connected.
    });
  }, []); // Load the public model defaults once; an individual account is checked on connect.

  useEffect(() => {
    if (messages.length) messageEndRef.current?.scrollIntoView({ behavior: generating ? "auto" : "smooth", block: "end" });
  }, [messages, generating]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        createNewChat();
      }
      if ((event.ctrlKey || event.metaKey) && event.key === ",") {
        event.preventDefault();
        setSettingsOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  useEffect(() => () => abortRef.current?.abort(), []);

  const updateConversation = useCallback((id: string, updater: (conversation: Conversation) => Conversation) => {
    setConversations((previous) =>
      previous.map((conversation) => conversation.id === id ? updater(conversation) : conversation)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    );
  }, []);

  function createNewChat() {
    const conversation = makeConversation();
    setConversations((previous) => [conversation, ...previous]);
    setSelectedId(conversation.id);
    setDraft("");
    setAttachments([]);
    setError("");
    setMobileOpen(false);
  }

  function renameConversation(id: string) {
    const conversation = conversations.find((item) => item.id === id);
    if (!conversation) return;
    const title = window.prompt("Rename conversation", conversation.title);
    if (title?.trim()) updateConversation(id, (current) => ({ ...current, title: title.trim().slice(0, 80), updatedAt: Date.now() }));
  }

  function deleteConversation(id: string) {
    const conversation = conversations.find((item) => item.id === id);
    if (!conversation || !window.confirm(`Delete "${conversation.title}"? This cannot be undone.`)) return;
    const remaining = conversations.filter((item) => item.id !== id);
    setConversations(remaining);
    if (selectedId === id) {
      setSelectedId(remaining[0]?.id ?? null);
      setError("");
    }
  }

  async function generate(conversationId: string, history: Message[]) {
    if (!apiKey) {
      setSettingsOpen(true);
      setError("Connect your Groq API key in Settings to start a conversation.");
      return;
    }
    if (generating) return;
    const containsImage = history.some((message) => message.attachments?.some((attachment) => attachment.data_url));
    const hasUnavailableImage = history.some((message) =>
      message.attachments?.some((attachment) => !attachment.data_url),
    );
    const latestMessageHasImage = Boolean(history[history.length - 1]?.attachments?.some((attachment) => attachment.data_url));
    if (hasUnavailableImage && !latestMessageHasImage) {
      setError("Images are not saved with browser chat history. Re-attach the image to continue analyzing it.");
      return;
    }
    if (containsImage && !selectedModelInfo?.vision) {
      setError("This model can't analyze images. Choose a vision-capable model in the model menu or Settings.");
      return;
    }
    setError("");
    setGenerating(true);
    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      createdAt: Date.now(),
    };
    updateConversation(conversationId, (conversation) => ({
      ...conversation,
      messages: [...history, assistantMessage],
      updatedAt: Date.now(),
    }));
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await streamChat({
        apiKey,
        model: selectedModel,
        messages: history,
        signal: controller.signal,
        onText: (text) => updateConversation(conversationId, (conversation) => ({
          ...conversation,
          messages: conversation.messages.map((message) =>
            message.id === assistantMessage.id ? { ...message, content: message.content + text } : message,
          ),
          updatedAt: Date.now(),
        })),
      });
    } catch (chatError) {
      if (!controller.signal.aborted) {
        const safeMessage = chatError instanceof ApiError || chatError instanceof Error
          ? chatError.message
          : "The request failed. Please try again.";
        updateConversation(conversationId, (conversation) => ({
          ...conversation,
          messages: conversation.messages.map((message) =>
            message.id === assistantMessage.id ? { ...message, error: safeMessage } : message,
          ),
        }));
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setGenerating(false);
    }
  }

  function sendMessage(text = draft, currentAttachments = attachments) {
    if (generating) return;
    const content = text.trim();
    if (!content && !currentAttachments.length) {
      setError("Write a message or attach an image before sending.");
      return;
    }
    if (!apiKey) {
      setError("Connect your Groq API key in Settings to start a conversation.");
      setSettingsOpen(true);
      return;
    }
    let conversation = activeConversation;
    if (!conversation) {
      conversation = makeConversation();
      setConversations((previous) => [conversation!, ...previous]);
      setSelectedId(conversation.id);
    }
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      attachments: currentAttachments,
      createdAt: Date.now(),
    };
    const history = [...conversation.messages, userMessage];
    const title = conversation.messages.length ? conversation.title : messageTitle(userMessage);
    updateConversation(conversation.id, (current) => ({
      ...current,
      title,
      messages: history,
      updatedAt: Date.now(),
    }));
    setDraft("");
    setAttachments([]);
    void generate(conversation.id, history);
  }

  function editAndResend(index: number, content: string) {
    if (!activeConversation || generating) return;
    const original = activeConversation.messages[index];
    if (!original || original.role !== "user" || (!content.trim() && !original.attachments?.length)) return;
    const updated: Message = { ...original, content: content.trim(), createdAt: Date.now() };
    const history = [...activeConversation.messages.slice(0, index), updated];
    updateConversation(activeConversation.id, (conversation) => ({
      ...conversation,
      messages: history,
      updatedAt: Date.now(),
    }));
    void generate(activeConversation.id, history);
  }

  function retry(index: number) {
    if (!activeConversation || generating) return;
    const history = activeConversation.messages.slice(0, index);
    if (!history.length || history[history.length - 1].role !== "user") return;
    void generate(activeConversation.id, history);
  }

  function clearConversation() {
    if (!activeConversation || !activeConversation.messages.length) return;
    if (!window.confirm("Clear all messages in this conversation?")) return;
    abortRef.current?.abort();
    updateConversation(activeConversation.id, (conversation) => ({
      ...conversation,
      title: "New conversation",
      messages: [],
      updatedAt: Date.now(),
    }));
    setDraft("");
    setAttachments([]);
    setError("");
  }

  function exportConversation() {
    if (!activeConversation) return;
    const markdown = `# ${activeConversation.title}\n\n${activeConversation.messages.map((message) =>
      `## ${message.role === "user" ? "You" : "Nexora"}\n\n${message.content}${message.attachments?.length ? `\n\n_Attachments: ${message.attachments.map((item) => item.name).join(", ")}_` : ""}`,
    ).join("\n\n---\n\n")}`;
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${activeConversation.title.replace(/[<>:"/\\|?*]/g, "-").slice(0, 60) || "nexora-chat"}.md`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function handleDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    const result = await readImageFiles(Array.from(event.dataTransfer.files), attachments);
    setAttachments(result.attachments);
    setError(result.errors.join(" "));
  }

  function handleConnect(key: string, available: ModelInfo[]) {
    setApiKey(key);
    setModels(available);
    if (!available.some((model) => model.id === selectedModel)) {
      setSelectedModel(available[0]?.id ?? INITIAL_MODEL);
    }
    setError("");
  }

  function disconnectKey() {
    abortRef.current?.abort();
    setApiKey("");
    setError("Your Groq API key has been cleared from this session.");
  }

  const modelOptions = useMemo(() => models.length ? models : INITIAL_MODELS, [models]);
  const hasContent = messages.length > 0;

  return (
    <div className={`app-shell ${theme === "light" ? "light-theme" : ""}`} onDragEnter={(event) => {
      if (event.dataTransfer.types.includes("Files")) {
        event.preventDefault();
        setDragging(true);
      }
    }} onDragOver={(event) => { if (event.dataTransfer.types.includes("Files")) event.preventDefault(); }}
      onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
      onDrop={(event) => void handleDrop(event)}
    >
      <Sidebar
        conversations={conversations}
        selectedId={selectedId}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onNew={createNewChat}
        onSelect={(id) => { setSelectedId(id); setError(""); }}
        onRename={renameConversation}
        onDelete={deleteConversation}
        onSettings={() => setSettingsOpen(true)}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <main className="main-panel">
        <header className="topbar">
          <div className="flex min-w-0 items-center gap-3">
            <Button size="icon" className="mobile-menu-button" onClick={() => { setCollapsed(false); setMobileOpen(true); }} aria-label="Open sidebar"><Menu size={19} /></Button>
            <Button size="icon" className="desktop-sidebar-button" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title="Toggle sidebar"><PanelLeft size={17} /></Button>
            <div className="topbar-divider" />
            <div className="breadcrumb">
              <span>Workspace</span><span className="breadcrumb-slash">/</span><strong>{activeConversation?.title ?? "New conversation"}</strong>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {apiKey && <span className="connected-label"><span className="status-dot" /> Connected</span>}
            <label className="model-control" title="Choose an AI model">
              <span className={`model-indicator ${selectedModelInfo?.vision ? "vision" : ""}`} />
              <select aria-label="Choose a model" value={selectedModel} onChange={(event) => { setSelectedModel(event.target.value); setError(""); }}>
                {modelOptions.map((model) => <option key={model.id} value={model.id}>{model.name || model.id}{model.vision ? " · Vision" : ""}</option>)}
              </select>
              <ChevronDown size={14} />
            </label>
            {activeConversation && hasContent && (
              <Button size="icon" onClick={exportConversation} title="Export conversation" aria-label="Export conversation as Markdown"><ArrowDownToLine size={17} /></Button>
            )}
            {activeConversation && hasContent && (
              <Button size="icon" onClick={clearConversation} title="Clear conversation" aria-label="Clear conversation"><Trash2 size={16} /></Button>
            )}
            <Button size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </Button>
            <Button size="icon" onClick={() => setSettingsOpen(true)} title="Settings" aria-label="Settings"><Settings2 size={17} /></Button>
          </div>
        </header>

        <section className={`chat-stage ${hasContent ? "has-messages" : ""}`} aria-label="Chat">
          {hasContent ? (
            <div className="messages-scroll">
              <div className="messages-inner">
                {messages.map((message, index) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    index={index}
                    generating={generating}
                    onEdit={editAndResend}
                    onRetry={retry}
                  />
                ))}
                <div ref={messageEndRef} />
              </div>
            </div>
          ) : (
            <div className="welcome-content">
              <motion.div className="welcome-orb" initial={{ opacity: 0, scale: 0.86 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }}>
                <div className="orb-halo" /><div className="orb-core"><Sparkles size={25} /></div>
                <span className="orb-dot dot-a" /><span className="orb-dot dot-b" /><span className="orb-dot dot-c" />
              </motion.div>
              <motion.div className="welcome-copy" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }}>
                <div className="eyebrow welcome-eyebrow"><span className="status-dot" /> YOUR PERSONAL AI, IN FOCUS</div>
                <h1>Your ideas.<br /><span>Your intelligence.</span><br />Your AI.</h1>
                <p>Ask anything, explore ideas, analyze images, and turn your thoughts into something extraordinary.</p>
              </motion.div>
              <div className="suggestion-grid">
                {SUGGESTIONS.map((suggestion, index) => (
                  <motion.button
                    key={suggestion.title}
                    className={`suggestion-card ${suggestion.tint}`}
                    onClick={() => { setDraft(suggestion.prompt); setError(""); }}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.18 + index * 0.07, duration: 0.35 }}
                  >
                    <span className="suggestion-icon">{suggestion.icon}</span>
                    <span>{suggestion.title}</span>
                    <Plus size={15} className="suggestion-add" />
                  </motion.button>
                ))}
              </div>
            </div>
          )}
        </section>

        <footer className="composer-area">
          {error && <div className="inline-error" role="alert"><span className="status-dot error-dot" />{error}<button onClick={() => setError("")} aria-label="Dismiss error">×</button></div>}
          {storageWarning && <div className="inline-warning" role="status">{storageWarning}</div>}
          <Composer
            value={draft}
            attachments={attachments}
            generating={generating}
            onChange={setDraft}
            onAttachments={setAttachments}
            onSend={() => sendMessage()}
            onStop={() => abortRef.current?.abort()}
            onError={setError}
            onOpenSettings={() => setSettingsOpen(true)}
            connected={Boolean(apiKey)}
          />
        </footer>

        {dragging && (
          <div className="drop-overlay" onDragOver={(event) => event.preventDefault()}>
            <div className="drop-card"><div className="drop-icon"><ArrowDownToLine size={25} /></div><strong>Drop images to attach</strong><span>PNG, JPEG or WebP · up to 5 MB each</span></div>
          </div>
        )}
      </main>

      <SettingsDialog
        open={settingsOpen}
        apiKey={apiKey}
        model={selectedModel}
        models={modelOptions}
        onClose={() => setSettingsOpen(false)}
        onConnect={(key, available) => { handleConnect(key, available); }}
        onDisconnect={disconnectKey}
        onSelectModel={setSelectedModel}
      />
    </div>
  );
}
