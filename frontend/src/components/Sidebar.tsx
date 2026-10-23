import { useMemo, useState } from "react";
import { Bot, ChevronLeft, ChevronRight, Clock3, MessageSquare, MoreHorizontal, PanelLeftClose, Plus, Search, Settings2, Sparkles, Trash2 } from "lucide-react";
import type { Conversation } from "../types/chat";
import { Button } from "./ui/button";

interface SidebarProps {
  conversations: Conversation[];
  selectedId: string | null;
  collapsed: boolean;
  mobileOpen: boolean;
  onNew: () => void;
  onSelect: (id: string) => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
  onSettings: () => void;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
}

function groupLabel(timestamp: number) {
  const date = new Date(timestamp);
  const today = new Date();
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((day - target) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "Previous 7 days";
  if (days < 30) return "Previous 30 days";
  return "Earlier";
}

export function Sidebar({
  conversations, selectedId, collapsed, mobileOpen, onNew, onSelect, onRename, onDelete, onSettings, onToggleCollapse, onCloseMobile,
}: SidebarProps) {
  const [search, setSearch] = useState("");
  const groups = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matches = conversations.filter((chat) =>
      !query || chat.title.toLowerCase().includes(query) || chat.messages.some((message) => message.content.toLowerCase().includes(query)),
    );
    const result = new Map<string, Conversation[]>();
    for (const conversation of matches) {
      const label = groupLabel(conversation.updatedAt);
      result.set(label, [...(result.get(label) ?? []), conversation]);
    }
    return [...result.entries()];
  }, [conversations, search]);

  return (
    <>
      {mobileOpen && <button className="mobile-scrim" aria-label="Close menu" onClick={onCloseMobile} />}
      <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""} ${mobileOpen ? "sidebar-mobile-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-mark"><Sparkles size={18} strokeWidth={2.2} /></div>
          {!collapsed && <div className="min-w-0"><div className="brand-name">nexora<span>.</span></div><div className="brand-caption">PERSONAL INTELLIGENCE</div></div>}
          <Button size="icon" className="ml-auto sidebar-collapse" onClick={onToggleCollapse} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <ChevronRight size={17} /> : <PanelLeftClose size={17} />}
          </Button>
        </div>

        <div className="px-3 pt-5">
          <Button
            variant="secondary"
            className={`new-chat-button w-full justify-start ${collapsed ? "justify-center px-0" : ""}`}
            onClick={() => { onNew(); onCloseMobile(); }}
            title="New chat"
          >
            <Plus size={17} /> {!collapsed && <><span>New chat</span><span className="ml-auto shortcut">⌘ K</span></>}
          </Button>
        </div>

        {!collapsed && (
          <>
            <div className="history-heading">
              <span>YOUR CHATS</span>
              <Clock3 size={14} />
            </div>
            <label className="search-box mx-3">
              <Search size={15} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" aria-label="Search conversations" />
              {search && <button onClick={() => setSearch("")} aria-label="Clear search"><ChevronLeft size={13} /></button>}
            </label>
            <nav className="conversation-list" aria-label="Conversation history">
              {groups.length ? groups.map(([label, chats]) => (
                <section key={label} className="chat-group">
                  <div className="group-label">{label}</div>
                  {chats.map((chat) => (
                    <div key={chat.id} className={`chat-row ${chat.id === selectedId ? "selected" : ""}`}>
                      <button
                        className="chat-row-main"
                        onClick={() => { onSelect(chat.id); onCloseMobile(); }}
                        title={chat.title}
                      >
                        <MessageSquare size={15} />
                        <span>{chat.title || "New conversation"}</span>
                      </button>
                      <div className="chat-actions">
                        <button onClick={() => onRename(chat.id)} title="Rename conversation" aria-label={`Rename ${chat.title}`}><MoreHorizontal size={15} /></button>
                        <button onClick={() => onDelete(chat.id)} title="Delete conversation" aria-label={`Delete ${chat.title}`}><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </section>
              )) : (
                <div className="history-empty"><Bot size={19} /><span>{search ? "No matching chats" : "Your conversations will appear here"}</span></div>
              )}
            </nav>
          </>
        )}

        {collapsed && (
          <div className="collapsed-tools">
            <Button size="icon" onClick={onNew} title="New chat" aria-label="New chat"><Plus size={18} /></Button>
            <Button size="icon" onClick={onToggleCollapse} title="Conversation history" aria-label="Expand history"><MessageSquare size={17} /></Button>
          </div>
        )}

        <div className="sidebar-bottom">
          <div className="plan-card">
            <div className="plan-icon"><Sparkles size={15} /></div>
            {!collapsed && <div className="plan-copy"><strong>Your own AI</strong><span>Connected to your Groq account</span></div>}
            {!collapsed && <ChevronRight size={15} className="ml-auto text-slate-500" />}
          </div>
          <button className={`settings-link ${collapsed ? "justify-center" : ""}`} onClick={() => { onSettings(); onCloseMobile(); }}>
            <Settings2 size={17} /> {!collapsed && <><span>Settings & API key</span><span className="ml-auto settings-shortcut">⌘ ,</span></>}
          </button>
          {!collapsed && <div className="sidebar-footnote"><span className="privacy-led" /> Private by design · Your key stays yours</div>}
        </div>
      </aside>
    </>
  );
}
