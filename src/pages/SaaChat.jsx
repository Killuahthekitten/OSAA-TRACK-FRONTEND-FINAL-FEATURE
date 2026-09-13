import { useEffect, useRef, useState } from "react";
import { MessageCircle, Search, Plus, Paperclip, Send, ArrowLeft, Clock, File as FileIcon, Loader2, X } from "lucide-react";
import { api, ApiError, getToken } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import Tooltip from "../components/ui/Tooltip.jsx";
import { inputClass } from "../components/ui/formStyles.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
const MESSAGE_POLL_MS = 4000;
const LIST_POLL_MS = 15000;

function initials(name) {
  return (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function timeAgo(iso) {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Avatar({ name, isDemo }) {
  return (
    <div className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-status-indigo/10 text-sm font-semibold text-status-indigo">
      {initials(name)}
      {isDemo && <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-status-warning px-1 py-px text-[8px] font-bold text-white">DEMO</span>}
    </div>
  );
}

// ── Contact picker — search every directory user, pick one to open (or
// start) a conversation with ─────────────────────────────────────────
function ContactPicker({ onPick, onCancel }) {
  const { handleSessionInvalidated } = useAuth();
  const [search, setSearch] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      api
        .get(`/api/chat/contacts${search ? `?search=${encodeURIComponent(search)}` : ""}`)
        .then((data) => {
          if (!cancelled) setItems(data.items);
        })
        .catch((err) => {
          if (!handleSessionInvalidated(err) && !cancelled) setItems([]);
        })
        .finally(() => !cancelled && setLoading(false));
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-slate-100 p-3">
        <button onClick={onCancel} className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
          <ArrowLeft size={16} />
        </button>
        <div className="relative flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search students, alumni, staff, offices..."
            className={`${inputClass} h-9 pl-8 text-xs`}
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="p-4 text-center text-xs text-slate-400">Searching...</p>
        ) : items.length === 0 ? (
          <p className="p-4 text-center text-xs text-slate-400">No matching contacts.</p>
        ) : (
          items.map((u) => (
            <button key={u.id} onClick={() => onPick(u)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50">
              <Avatar name={u.name} isDemo={u.is_demo} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-700">{u.name}</p>
                <p className="truncate text-[11px] capitalize text-slate-400">{u.type}{u.email ? ` \u00b7 ${u.email}` : ""}</p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ── One message bubble — text and/or an attached file ────────────────
function MessageBubble({ message }) {
  const isAdmin = message.sender_type === "admin";
  const file = message.file;
  return (
    <div className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${isAdmin ? "bg-brand-blue text-white" : "bg-slate-100 text-slate-700"}`}>
        {message.body && <p className="whitespace-pre-wrap break-words">{message.body}</p>}
        {file && (
          <a
            href={`${API_BASE}/api/uploads/${file.id}/download`}
            onClick={(e) => {
              // authenticated download — same bearer-token pattern used
              // elsewhere for protected files
              e.preventDefault();
              fetch(`${API_BASE}/api/uploads/${file.id}/download`, { headers: { Authorization: `Bearer ${getToken()}` } })
                .then((r) => r.blob())
                .then((blob) => {
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = file.original_name;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(url);
                });
            }}
            className={`mt-1 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium underline-offset-2 hover:underline ${
              isAdmin ? "bg-white/15 text-white" : "bg-white text-brand-blue"
            }`}
          >
            <FileIcon size={13} /> {file.original_name}
          </a>
        )}
        <p className={`mt-1 text-right text-[10px] ${isAdmin ? "text-blue-100" : "text-slate-400"}`}>{timeAgo(message.created_at)}</p>
      </div>
    </div>
  );
}

export default function SaaChat() {
  const { handleSessionInvalidated } = useAuth();
  const { notify } = useToast();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [listLoaded, setListLoaded] = useState(false);
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);
  const lastMessageIdRef = useRef(0);

  async function loadConversations() {
    try {
      const data = await api.get("/api/chat/conversations");
      setConversations(data.items);
      setListLoaded(true);
    } catch (err) {
      handleSessionInvalidated(err);
    }
  }

  useEffect(() => {
    loadConversations();
    const t = setInterval(loadConversations, LIST_POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMessages(conversationId, { initial = false } = {}) {
    try {
      const data = await api.get(`/api/chat/conversations/${conversationId}/messages${initial ? "" : `?afterId=${lastMessageIdRef.current}`}`);
      setActiveConversation(data.conversation);
      if (initial) {
        setMessages(data.items);
      } else if (data.items.length) {
        setMessages((prev) => [...prev, ...data.items]);
      }
      if (data.items.length) lastMessageIdRef.current = data.items[data.items.length - 1].id;
    } catch (err) {
      handleSessionInvalidated(err);
    }
  }

  useEffect(() => {
    if (!activeId) return;
    lastMessageIdRef.current = 0;
    setMessages([]);
    loadMessages(activeId, { initial: true });
    const t = setInterval(() => loadMessages(activeId), MESSAGE_POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  async function openConversation(userId) {
    setPickerOpen(false);
    try {
      const data = await api.post("/api/chat/conversations", { userId });
      setActiveId(data.conversation.id);
      loadConversations();
    } catch (err) {
      if (!handleSessionInvalidated(err)) notify("Could not open that conversation.", "error");
    }
  }

  async function handleFilePick(file) {
    if (!file) return;
    setUploadingFile(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_BASE}/api/uploads`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Upload failed.");
      setPendingFile({ id: data.id, original_name: data.originalName });
    } catch (err) {
      notify(err.message || "Could not attach file.", "error");
    } finally {
      setUploadingFile(false);
    }
  }

  async function send() {
    if (!text.trim() && !pendingFile) return;
    setSending(true);
    try {
      const data = await api.post(`/api/chat/conversations/${activeId}/messages`, { body: text.trim() || null, fileId: pendingFile?.id || null });
      setMessages((prev) => [...prev, data.message]);
      lastMessageIdRef.current = data.message.id;
      setText("");
      setPendingFile(null);
      loadConversations();
    } catch (err) {
      if (!handleSessionInvalidated(err)) notify(err instanceof ApiError ? err.message : "Could not send message.", "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-status-indigo/10 text-status-indigo">
          <MessageCircle size={22} />
        </div>
        <div>
          <h1 className="font-heading text-xl font-bold text-slate-800 sm:text-2xl">SAA Chat</h1>
          <p className="text-sm text-slate-500">Message any student, alumni, staff, or office contact — text or a single file at a time</p>
        </div>
      </div>

      <div className="flex h-[calc(100vh-230px)] min-h-[420px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
        {/* ── left: conversation list / contact picker ─────────────── */}
        <div className={`${activeId ? "hidden sm:flex" : "flex"} w-full flex-col border-r border-slate-100 sm:w-80`}>
          {pickerOpen ? (
            <ContactPicker onPick={(u) => openConversation(u.id)} onCancel={() => setPickerOpen(false)} />
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-slate-100 p-3">
                <h2 className="px-1 text-sm font-semibold text-slate-700">Conversations</h2>
                <Tooltip text="Search contacts to start a new conversation." side="left">
                  <button onClick={() => setPickerOpen(true)} className="flex size-8 items-center justify-center rounded-lg text-brand-blue hover:bg-blue-50">
                    <Plus size={17} />
                  </button>
                </Tooltip>
              </div>
              <div className="flex-1 overflow-y-auto">
                {!listLoaded ? (
                  <p className="p-4 text-center text-xs text-slate-400">Loading...</p>
                ) : conversations.length === 0 ? (
                  <div className="p-5 text-center">
                    <p className="text-xs text-slate-400">No conversations yet.</p>
                    <button onClick={() => setPickerOpen(true)} className="mt-2 text-xs font-semibold text-brand-blue hover:underline">
                      Start one
                    </button>
                  </div>
                ) : (
                  conversations.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setActiveId(c.id)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                        activeId === c.id ? "bg-blue-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <Avatar name={c.user_name} isDemo={c.is_demo} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-sm font-medium text-slate-700">{c.user_name}</p>
                          <span className="shrink-0 text-[10px] text-slate-400">{timeAgo(c.last_message_at)}</span>
                        </div>
                        <p className="truncate text-[11px] text-slate-400">
                          {c.last_sender_type === "admin" && "You: "}
                          {c.last_body || (c.last_file_id ? "\ud83d\udcce Attachment" : "No messages yet")}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* ── right: message thread ─────────────────────────────────── */}
        <div className={`${activeId ? "flex" : "hidden sm:flex"} min-w-0 flex-1 flex-col`}>
          {!activeId ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
              <MessageCircle size={32} className="text-slate-200" />
              <p className="text-sm text-slate-400">Pick a conversation, or start a new one.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-slate-100 p-3">
                <button onClick={() => setActiveId(null)} className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 sm:hidden">
                  <ArrowLeft size={16} />
                </button>
                <Avatar name={activeConversation?.user_name} isDemo={activeConversation?.is_demo} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{activeConversation?.user_name}</p>
                  <p className="truncate text-[11px] capitalize text-slate-400">{activeConversation?.user_type}</p>
                </div>
                <Tooltip text="Messages in every SAA Chat conversation are automatically deleted 24 hours after they're sent." side="left">
                  <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-500">
                    <Clock size={11} /> 24h
                  </span>
                </Tooltip>
              </div>

              <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
                {messages.length === 0 ? (
                  <p className="pt-8 text-center text-xs text-slate-300">No messages yet — say hello.</p>
                ) : (
                  messages.map((m) => <MessageBubble key={m.id} message={m} />)
                )}
              </div>

              <div className="border-t border-slate-100 p-3">
                {pendingFile && (
                  <div className="mb-2 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
                    <FileIcon size={13} /> <span className="flex-1 truncate">{pendingFile.original_name}</span>
                    <button onClick={() => setPendingFile(null)} className="text-slate-400 hover:text-status-danger">
                      <X size={13} />
                    </button>
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <Tooltip text="Attach one file to send with your message.">
                    <button
                      type="button"
                      disabled={uploadingFile}
                      onClick={() => fileInputRef.current?.click()}
                      className="flex size-10 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
                    >
                      {uploadingFile ? <Loader2 size={17} className="animate-spin" /> : <Paperclip size={17} />}
                    </button>
                  </Tooltip>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      handleFilePick(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                  <textarea
                    rows={1}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    placeholder="Type a message..."
                    className="max-h-28 flex-1 resize-none rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-blue"
                  />
                  <Tooltip text="Send this message.">
                    <button
                      type="button"
                      onClick={send}
                      disabled={sending || (!text.trim() && !pendingFile)}
                      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-blue text-white transition hover:bg-blue-700 disabled:opacity-40"
                    >
                      <Send size={16} />
                    </button>
                  </Tooltip>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
