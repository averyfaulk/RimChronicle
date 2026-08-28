import React, { useState, useRef, useEffect } from "react";
import { aiFetch } from "../../lib/aiClient";
import {
  Sparkles,
  Send,
  Bot,
  User,
  BookOpen,
  Feather,
  Plus,
  RefreshCw,
  Copy,
  Check,
  MessageSquare
} from "lucide-react";
import { ThemeMode, StoryProject } from "../../types";
import { EntityLookup } from "../../lib/wikiParser";
import { MarkdownRenderer } from "../Wiki/MarkdownRenderer";
import { getTaxonomy, taxonomyLabel } from "../../lib/taxonomy";

interface ChroniclerBotProps {
  project: StoryProject;
  setProject: React.Dispatch<React.SetStateAction<StoryProject>>;
  theme: ThemeMode;
  lookup: EntityLookup;
  onNavigateToArticle: (title: string) => void;
}

interface ChatMessage {
  id: string;
  sender: "user" | "chronicler";
  text: string;
  timestamp: string;
}

export const ChroniclerBot: React.FC<ChroniclerBotProps> = ({
  project,
  setProject,
  theme,
  lookup,
  onNavigateToArticle,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg-0",
      sender: "chronicler",
      text: `Greetings, Overseer. I am your **Rim World Archivist & Narrative Chronicler**.\n\nI hold the memory of your colonists, their scars, heartbreaks, and epic sieges. Ask me to:\n- *Draft custom character dialogue or tense conversations*\n- *Suggest dramatic twists, betrayals, or heroic sacrifices for Act 2*\n- *Query canon timeline events or cross-reference character rivalries*\n- *Write flash fiction vignettes ready to add to your novel!*`,
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [inputQuery, setInputQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: "user",
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery("");
    setIsLoading(true);

    try {
      const res = await aiFetch("/api/ai/ask-chronicler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: userMsg.text,
          context: {
            title: project.title,
            characters: project.characters,
            factions: project.factions,
            timelineEvents: project.timelineEvents,
            relationships: project.relationships,
            recentArticles: project.wikiArticles.map((a) => ({
              title: a.title,
              category: taxonomyLabel(getTaxonomy(project).articleCategories, a.category),
              summary: a.markdownContent.slice(0, 150),
            })),
          },
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to consult the Chronicler");
      }

      const data = await res.json();
      const botMsg: ChatMessage = {
        id: `msg-bot-${Date.now()}`,
        sender: "chronicler",
        text: data.answer || "The chronicle records only silence on this matter.",
        timestamp: new Date().toLocaleTimeString(),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-err-${Date.now()}`,
          sender: "chronicler",
          text: `*A psychic storm disrupts the link:* ${err.message || "Failed to reach Chronicler core."}`,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAddAsWikiArticle = (text: string) => {
    const titleMatch = text.match(/#+\s+(.+)/);
    const title = titleMatch ? titleMatch[1].trim() : `Chronicler Lore: ${new Date().toLocaleDateString()}`;

    const newArticle = {
      id: `art-chronicler-${Date.now()}`,
      title,
      category: "Lore" as const,
      tags: ["archivist", "lore", "canon"],
      markdownContent: text,
      createdAt: new Date().toISOString().split("T")[0],
      lastModified: new Date().toISOString().split("T")[0],
      wordCount: text.split(/\s+/).length,
    };

    setProject({
      ...project,
      wikiArticles: [newArticle, ...project.wikiArticles],
      lastUpdated: new Date().toISOString(),
    });

    alert(`Saved "${title}" as a new Markdown Wiki article!`);
  };

  const quickPrompts = [
    "Draft a dramatic argument between Valerie Vance and Cole Briggs regarding cybernetic augmentation.",
    "Suggest 3 potential tragic twists for the upcoming winter raid.",
    "Write a short opening paragraph capturing the atmospheric chill of Mount Karas.",
    "Analyze the psychological impact of the 5502 Mortar Siege on the colony morale.",
  ];

  return (
    <div
      id="chronicler-chat-container"
      className={`rounded-2xl border p-6 shadow-sm space-y-4 max-w-4xl mx-auto flex flex-col h-[700px] ${
        theme === "dark"
          ? "bg-[#121215] border-[#222228]"
          : theme === "parchment"
          ? "bg-amber-100/70 border-amber-200"
          : "bg-slate-900/80 border-cyan-900"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-base sm:text-lg">Archivist Chronicler AI</h3>
            <p className="text-xs opacity-60">
              In-universe storyteller with full knowledge of your colony wiki, timeline, and relationships.
            </p>
          </div>
        </div>

        <button
          onClick={() =>
            setMessages([
              {
                id: "msg-0",
                sender: "chronicler",
                text: "Memory cleared. How may I assist your worldbuilding today?",
                timestamp: new Date().toLocaleTimeString(),
              },
            ])
          }
          className="p-1.5 rounded-lg border border-white/10 hover:bg-white/10 text-xs opacity-60 hover:opacity-100"
          title="Reset Conversation"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {messages.map((msg) => {
          const isBot = msg.sender === "chronicler";

          return (
            <div
              key={msg.id}
              className={`flex items-start space-x-3 ${isBot ? "" : "flex-row-reverse space-x-reverse"}`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                  isBot
                    ? "bg-purple-600 text-white"
                    : "bg-amber-500 text-slate-950 font-serif"
                }`}
              >
                {isBot ? <Sparkles className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>

              <div
                className={`max-w-[85%] p-4 rounded-2xl border text-xs sm:text-sm space-y-2 relative group ${
                  isBot
                    ? theme === "dark"
                      ? "bg-[#181820] border-[#252530] text-[#f1f5f9]"
                      : theme === "parchment"
                      ? "bg-amber-50 border-amber-300 text-stone-900"
                      : "bg-slate-950 border-cyan-900 text-cyan-50"
                    : theme === "dark"
                    ? "bg-amber-500/20 border-amber-500/40 text-amber-100"
                    : theme === "parchment"
                    ? "bg-amber-800/10 border-amber-800/30 text-stone-950"
                    : "bg-cyan-500/20 border-cyan-500/40 text-cyan-100"
                }`}
              >
                <div className="flex items-center justify-between opacity-50 text-[10px] font-mono pb-1 border-b border-white/5">
                  <span>{isBot ? "Storyteller Chronicler" : "Overseer"}</span>
                  <span>{msg.timestamp}</span>
                </div>

                <div className="leading-relaxed">
                  <MarkdownRenderer
                    content={msg.text}
                    lookup={lookup}
                    theme={theme}
                    taxonomy={getTaxonomy(project)}
                    onNavigateToArticle={onNavigateToArticle}
                  />
                </div>

                {isBot && msg.id !== "msg-0" && (
                  <div className="flex items-center space-x-2 pt-2 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleCopyText(msg.id, msg.text)}
                      className="flex items-center space-x-1 text-[11px] px-2 py-0.5 rounded border border-white/10 hover:bg-white/10 font-mono"
                    >
                      {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedId === msg.id ? "Copied" : "Copy"}</span>
                    </button>
                    <button
                      onClick={() => handleAddAsWikiArticle(msg.text)}
                      className="flex items-center space-x-1 text-[11px] px-2 py-0.5 rounded border border-white/10 hover:bg-white/10 font-mono text-amber-400"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Save as Wiki Article</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center">
              <Sparkles className="w-4 h-4 animate-spin" />
            </div>
            <div className="p-3 rounded-2xl border bg-black/20 text-xs font-mono opacity-70 flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
              <span>Consulting colony archives & synthesizing narrative...</span>
            </div>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Suggested Quick Prompts */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0 scrollbar-none">
        {quickPrompts.map((qp, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSend(qp)}
            className="text-[11px] px-2.5 py-1 rounded-lg border border-white/10 hover:bg-white/10 whitespace-nowrap opacity-80 hover:opacity-100 font-serif"
          >
            💡 {qp.slice(0, 45)}...
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex items-center gap-2 shrink-0 pt-2 border-t border-white/10"
      >
        <input
          type="text"
          id="chronicler-chat-input"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          placeholder="Ask the chronicler to write dialogue, analyze character trauma, or generate lore..."
          className={`flex-1 px-4 py-2.5 rounded-xl border text-xs sm:text-sm outline-none transition-colors ${
            theme === "dark"
              ? "bg-[#0c0c0e] border-[#222228] text-[#f1f5f9] focus:border-amber-500"
              : theme === "parchment"
              ? "bg-amber-50 border-amber-300 text-stone-900 focus:border-amber-700"
              : "bg-slate-900 border-cyan-900 text-cyan-50 focus:border-cyan-400"
          }`}
        />
        <button
          type="submit"
          id="btn-send-chronicler-query"
          disabled={!inputQuery.trim() || isLoading}
          className={`px-4 py-2.5 rounded-xl font-bold flex items-center justify-center transition-transform active:scale-95 disabled:opacity-30 ${
            theme === "dark"
              ? "bg-amber-500 hover:bg-amber-400 text-[#0c0c0e]"
              : theme === "parchment"
              ? "bg-amber-800 hover:bg-amber-700 text-amber-50"
              : "bg-cyan-500 hover:bg-cyan-400 text-slate-950"
          }`}
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
