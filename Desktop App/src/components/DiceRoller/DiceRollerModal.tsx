import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dices, Loader2, X } from "lucide-react";
import { ThemeMode } from "../../types";
import { DieFace } from "./DieFace";

interface DieOption {
  id: string;
  label: string;
  name: string;
  sides: number;
  min: number;
  color: string;
}

interface DiceRollRecord {
  label: string;
  value: number;
  at: number;
}

interface DiceRollerModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: ThemeMode;
}

const DICE_OPTIONS: DieOption[] = [
  { id: "d2", label: "D2", name: "Coin Flip", sides: 2, min: 1, color: "#f59e0b" },
  { id: "d3", label: "D3", name: "Three-Sider", sides: 3, min: 1, color: "#8b5cf6" },
  { id: "d4", label: "D4", name: "Four-Sider", sides: 4, min: 1, color: "#ef4444" },
  { id: "d6", label: "D6", name: "Six-Sider", sides: 6, min: 1, color: "#3b82f6" },
  { id: "d8", label: "D8", name: "Eight-Sider", sides: 8, min: 1, color: "#10b981" },
  { id: "d10", label: "D10", name: "Ten-Sider", sides: 10, min: 1, color: "#06b6d4" },
  { id: "d12", label: "D12", name: "Twelve-Sider", sides: 12, min: 1, color: "#ec4899" },
  { id: "d20", label: "D20", name: "Twenty-Sider", sides: 20, min: 1, color: "#a855f7" },
  { id: "d100", label: "D100", name: "Percentile", sides: 100, min: 1, color: "#f97316" },
];

/** Roll once within a die's range (D100 → 1–100). */
const rollDie = (opt: DieOption): number =>
  Math.floor(Math.random() * opt.sides) + opt.min;

export const DiceRollerModal: React.FC<DiceRollerModalProps> = ({
  isOpen,
  onClose,
  theme,
}) => {
  const [selectedId, setSelectedId] = useState<string>("d6");
  const [rolling, setRolling] = useState(false);
  const [displayNumber, setDisplayNumber] = useState<number | null>(null);
  const [result, setResult] = useState<DiceRollRecord | null>(null);
  const [history, setHistory] = useState<DiceRollRecord[]>([]);

  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const selected = useMemo(
    () => DICE_OPTIONS.find((o) => o.id === selectedId) || DICE_OPTIONS[3],
    [selectedId]
  );

  const clearTimers = () => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  useEffect(() => {
    if (!isOpen) {
      clearTimers();
      setRolling(false);
    }
    return clearTimers;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const selectDie = (id: string) => {
    if (rolling || id === selectedId) return;
    setSelectedId(id);
    setResult(null);
    setDisplayNumber(null);
  };

  const handleRoll = () => {
    if (rolling) return;
    clearTimers();
    setResult(null);
    setRolling(true);

    const target = rollDie(selected);
    let frames = 0;
    const totalFrames = 15;

    intervalRef.current = window.setInterval(() => {
      frames += 1;
      setDisplayNumber(rollDie(selected));
      if (frames >= totalFrames) {
        clearTimers();
        setDisplayNumber(target);
        setResult({ label: selected.label, value: target, at: Date.now() });
        setHistory((h) =>
          [{ label: selected.label, value: target, at: Date.now() }, ...h].slice(0, 8)
        );
        timeoutRef.current = window.setTimeout(() => setRolling(false), 450);
      }
    }, 55);
  };

  const showText = rolling ? displayNumber : result ? result.value : null;

  const panelBg =
    theme === "dark"
      ? "bg-[#17171d] border-[#26262f] text-[#e2e8f0]"
      : theme === "parchment"
      ? "bg-amber-50 border-amber-300 text-stone-900"
      : "bg-slate-900 border-cyan-800 text-cyan-50";

  const dieAnimClass = rolling
    ? "animate-dice-wiggle dice-glow"
    : result
    ? "animate-dice-settle"
    : "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-md rounded-2xl border shadow-2xl p-6 space-y-4 ${panelBg}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center pb-2 border-b border-white/10">
          <h3 className="font-serif font-bold text-base flex items-center space-x-2">
            <Dices className="w-4 h-4 text-amber-400" />
            <span>Dice Roller</span>
          </h3>
          <button onClick={onClose} className="text-xs opacity-60 hover:opacity-100" title="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Die graphic */}
        <div className="flex flex-col items-center space-y-3 py-2">
          <div
            className={`relative w-36 h-36 flex items-center justify-center ${dieAnimClass}`}
            style={
              rolling
                ? ({ "--dice-glow": `${selected.color}55` } as React.CSSProperties)
                : undefined
            }
          >
            <DieFace id={selected.id} value={showText} color={selected.color} />
          </div>

          <span className="text-[10px] font-mono uppercase tracking-wider opacity-60">
            {selected.name} · {selected.label}
          </span>

          {result ? (
            <div
              className="px-3 py-1.5 rounded-lg border font-mono font-bold text-sm"
              style={{ borderColor: `${selected.color}66`, color: selected.color }}
            >
              {result.label} → {result.value}
            </div>
          ) : (
            <div className="h-7 flex items-center text-[11px] opacity-40 italic">
              {rolling ? "tumbling..." : "Pick a die, then roll."}
            </div>
          )}
        </div>

        {/* Die options */}
        <div className="grid grid-cols-5 gap-1.5">
          {DICE_OPTIONS.map((opt) => {
            const isSelected = opt.id === selectedId;
            return (
              <button
                key={opt.id}
                onClick={() => selectDie(opt.id)}
                disabled={rolling}
                className={`px-1 py-2 rounded-lg text-xs font-bold border transition-all active:scale-95 disabled:opacity-40 cursor-pointer ${
                  theme === "dark"
                    ? "border-[#24242d] text-zinc-400 hover:bg-[#16161c] hover:text-zinc-100"
                    : theme === "parchment"
                    ? "border-amber-200 text-stone-500 hover:bg-amber-100"
                    : "border-cyan-900 text-cyan-500/60 hover:bg-slate-800"
                }`}
                style={
                  isSelected
                    ? {
                        borderColor: opt.color,
                        color: opt.color,
                        boxShadow: `0 0 0 1px ${opt.color}40, 0 0 12px ${opt.color}33`,
                      }
                    : undefined
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Session history */}
        {history.length > 0 && (
          <div>
            <span className="text-[10px] font-mono uppercase opacity-60 block mb-1">
              Recent Rolls (this session)
            </span>
            <div className="flex flex-wrap gap-1">
              {history.map((r, i) => (
                <span
                  key={`${r.at}-${i}`}
                  className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/10 border border-white/10"
                >
                  {r.label} ·<strong className="ml-0.5">{r.value}</strong>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end space-x-2 pt-1 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs border border-white/10 opacity-80 hover:opacity-100 cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={handleRoll}
            disabled={rolling}
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white transition-transform active:scale-95 disabled:opacity-40 cursor-pointer"
            style={{ backgroundColor: selected.color }}
            title={`Roll a ${selected.label} (1–${selected.sides})`}
          >
            {rolling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Dices className="w-3.5 h-3.5" />}
            <span>{rolling ? "Rolling..." : `Roll ${selected.label}`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};