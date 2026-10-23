import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import { ArrowUp, ImagePlus, Paperclip, Square, X } from "lucide-react";
import type { Attachment } from "../types/chat";
import { readImageFiles } from "../utils/images";
import { Button } from "./ui/button";

interface ComposerProps {
  value: string;
  attachments: Attachment[];
  generating: boolean;
  onChange: (value: string) => void;
  onAttachments: (attachments: Attachment[]) => void;
  onSend: () => void;
  onStop: () => void;
  onError: (message: string) => void;
  onOpenSettings: () => void;
  connected: boolean;
}

export function Composer({
  value, attachments, generating, onChange, onAttachments, onSend, onStop, onError, onOpenSettings, connected,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 180)}px`;
  }, [value]);

  function resize() {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 180)}px`;
  }

  async function addFiles(files: File[]) {
    const result = await readImageFiles(files, attachments);
    onAttachments(result.attachments);
    result.errors.forEach(onError);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (!generating) onSend();
    }
  }

  return (
    <div className="composer-wrap">
      {attachments.length > 0 && (
        <div className="composer-previews">
          {attachments.map((attachment, index) => (
            <div key={`${attachment.name}-${index}`} className="preview-tile">
              {attachment.data_url && <img src={attachment.data_url} alt={`Preview ${attachment.name}`} />}
              <button onClick={() => onAttachments(attachments.filter((_, i) => i !== index))} aria-label={`Remove ${attachment.name}`}><X size={13} /></button>
              <span>{attachment.name}</span>
            </div>
          ))}
        </div>
      )}
      <div className="composer-box">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => { onChange(event.target.value); resize(); }}
          onKeyDown={handleKeyDown}
          onPaste={(event) => {
            const files = Array.from(event.clipboardData.items)
              .filter((item) => item.type.startsWith("image/"))
              .map((item) => item.getAsFile())
              .filter((file): file is File => file !== null);
            if (files.length) {
              event.preventDefault();
              void addFiles(files);
            }
          }}
          placeholder="Message Nexora..."
          rows={1}
          aria-label="Message Nexora"
          maxLength={16000}
        />
        <div className="composer-tools">
          <div className="flex items-center gap-1">
            <input
              ref={fileRef}
              className="sr-only"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={(event) => { if (event.target.files) void addFiles(Array.from(event.target.files)); }}
              aria-label="Choose images"
            />
            <Button size="icon" onClick={() => fileRef.current?.click()} title="Attach an image" aria-label="Attach an image"><Paperclip size={17} /></Button>
            <span className="composer-hint"><ImagePlus size={13} /> Add an image</span>
          </div>
          {generating ? (
            <Button variant="secondary" size="icon" onClick={onStop} title="Stop generating" aria-label="Stop generating"><Square size={14} fill="currentColor" /></Button>
          ) : (
            <Button variant="primary" size="icon" className="send-button" onClick={onSend} disabled={!value.trim() && !attachments.length} title="Send message" aria-label="Send message"><ArrowUp size={19} /></Button>
          )}
        </div>
      </div>
      {!connected && <button className="connection-hint" onClick={onOpenSettings}><span className="status-dot error-dot" /> Add your Groq API key in Settings to start chatting <span>→</span></button>}
      <p className="composer-disclaimer">Nexora can make mistakes. Verify important information. Your requests use your Groq account.</p>
    </div>
  );
}
