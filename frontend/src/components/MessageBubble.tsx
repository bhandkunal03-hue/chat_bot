import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { Check, Copy, Pencil, RefreshCw, UserRound } from "lucide-react";
import type { Message } from "../types/chat";
import { Button } from "./ui/button";

interface MessageBubbleProps {
  message: Message;
  index: number;
  onEdit: (index: number, content: string) => void;
  onRetry: (index: number) => void;
  generating: boolean;
}

function CodeBlock({ children }: { children: ReactNode }) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(preRef.current?.innerText ?? "");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }
  return (
    <div className="code-block">
      <div className="code-toolbar"><span>CODE</span><button onClick={copy} aria-label="Copy code">{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? "Copied" : "Copy"}</button></div>
      <pre ref={preRef}>{children}</pre>
    </div>
  );
}

export function MessageBubble({ message, index, onEdit, onRetry, generating }: MessageBubbleProps) {
  const user = message.role === "user";
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const [copied, setCopied] = useState(false);

  async function copyMessage() {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24 }}
      className={`message-row ${user ? "message-user" : "message-assistant"}`}
      aria-label={`${user ? "You" : "Nexora"} message`}
    >
      <div className="message-avatar">{user ? <UserRound size={16} /> : <span className="assistant-glyph">✦</span>}</div>
      <div className="message-body">
        <div className="message-meta"><strong>{user ? "You" : "Nexora"}</strong><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time></div>
        {message.attachments?.length ? (
          <div className="message-attachments">
            {message.attachments.map((attachment, i) => (
              attachment.data_url
                ? <a key={`${attachment.name}-${i}`} href={attachment.data_url} target="_blank" rel="noreferrer" aria-label={`Open image ${attachment.name}`}><img src={attachment.data_url} alt={attachment.name} /></a>
                : <div key={`${attachment.name}-${i}`} className="attachment-unavailable">{attachment.name} · image isn't stored in chat history</div>
            ))}
          </div>
        ) : null}
        {editing ? (
          <div className="edit-message">
            <textarea value={editText} onChange={(event) => setEditText(event.target.value)} aria-label="Edit your message" />
            <div className="flex justify-end gap-2"><Button size="sm" onClick={() => setEditing(false)}>Cancel</Button><Button size="sm" variant="primary" onClick={() => { onEdit(index, editText); setEditing(false); }}>Save & resend</Button></div>
          </div>
        ) : user ? (
          <div className="user-message-text">{message.content}</div>
        ) : message.error && !message.content ? (
          <div className="message-error" role="alert">{message.error}</div>
        ) : (
          <div className="markdown-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={{
              pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
              a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer">{children}</a>,
            }}>{message.content}</ReactMarkdown>
            {!message.content && generating && <span className="thinking-indicator"><span className="thinking-dots"><i /><i /><i /></span>Thinking</span>}
            {Boolean(message.content) && generating && <span className="stream-caret" />}
            {message.error && <div className="message-error" role="alert">{message.error}</div>}
          </div>
        )}
        {!editing && (
          <div className="message-actions">
            {!user && message.content && <button onClick={copyMessage} aria-label="Copy message" title="Copy message">{copied ? <Check size={14} /> : <Copy size={14} />}</button>}
            {user && !generating && <button onClick={() => { setEditText(message.content); setEditing(true); }} aria-label="Edit message" title="Edit & resend"><Pencil size={14} /></button>}
            {!user && !generating && <button onClick={() => onRetry(index)} aria-label="Regenerate response" title="Regenerate response"><RefreshCw size={14} /></button>}
          </div>
        )}
      </div>
    </motion.article>
  );
}
