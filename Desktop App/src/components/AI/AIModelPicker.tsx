import React, { useEffect, useState, useCallback } from "react";
import { aiFetch } from "../../lib/aiClient";
import { Cpu, RefreshCw, Loader2 } from "lucide-react";
import { ThemeMode } from "../../types";

interface ProviderOption {
  id: string;
  label: string;
  description: string;
  defaultModel: string;
}

interface ModelEntry {
  id: string;
  ownedBy?: string;
}

interface AIConfigResponse {
  provider: string;
  model: string;
  providers: ProviderOption[];
}

const STORAGE_KEY = "rimchronicle_ai_config";

interface AIModelPickerProps {
  theme: ThemeMode;
}

export const AIModelPicker: React.FC<AIModelPickerProps> = ({ theme }) => {
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [provider, setProvider] = useState<string>("zen");
  const [model, setModel] = useState<string>("");
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [error, setError] = useState("");

  const loadModels = useCallback(async (providerId: string) => {
    setLoadingModels(true);
    setError("");
    try {
      const res = await aiFetch(`/api/ai/models?provider=${encodeURIComponent(providerId)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to load ${providerId} models`);
      }
      const data = await res.json();
      setModels(Array.isArray(data.models) ? data.models : []);
    } catch (err: any) {
      setModels([]);
      setError(err.message || "Failed to load model catalog");
    } finally {
      setLoadingModels(false);
    }
  }, []);

  // Load current server config on mount; re-apply persisted choice if it differs.
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const res = await aiFetch("/api/ai/config");
        if (!res.ok) throw new Error("Failed to load AI config");
        const config: AIConfigResponse = await res.json();
        if (cancelled) return;

        setProviders(config.providers || []);
        let activeProvider = config.provider;
        let activeModel = config.model;

        try {
          const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
          const storedProvider =
            stored && (stored.provider === "zen" || stored.provider === "go") ? stored.provider : null;
          const storedModel = stored && typeof stored.model === "string" ? stored.model : "";

          if (storedProvider && (storedProvider !== activeProvider || storedModel !== activeModel)) {
            const applied = await aiFetch("/api/ai/config", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ provider: storedProvider, model: storedModel }),
            });
            if (applied.ok) {
              const newState = await applied.json();
              activeProvider = newState.provider;
              activeModel = newState.model;
            }
          }
        } catch {
          /* No persisted preference — keep server defaults */
        }

        if (!cancelled) {
          setProvider(activeProvider);
          setModel(activeModel);
          loadModels(activeProvider);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Failed to load AI config");
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, [loadModels]);

  const persistAndApply = async (nextProvider: string, nextModel: string) => {
    try {
      const res = await aiFetch("/api/ai/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: nextProvider, model: nextModel }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to switch AI configuration");
      }
      const state = await res.json();
      setProvider(state.provider);
      setModel(state.model);
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ provider: state.provider, model: state.model })
      );
    } catch (err: any) {
      setError(err.message || "Failed to switch AI configuration");
    }
  };

  const handleProviderChange = async (nextProvider: string) => {
    setProvider(nextProvider);
    // Reset to the new provider's default model, then refresh its catalog
    const meta = providers.find((p) => p.id === nextProvider);
    const fallback = meta?.defaultModel || "";
    setModels([]);
    await persistAndApply(nextProvider, fallback);
    loadModels(nextProvider);
  };

  const handleModelChange = (nextModel: string) => {
    setModel(nextModel);
    persistAndApply(provider, nextModel);
  };

  // Ensure current model is selectable even if the catalog request failed
  const modelOptions =
    model && !models.some((m) => m.id === model) ? [{ id: model }, ...models] : models;

  return (
    <div className="flex items-center space-x-1.5">
      <div
        className={`flex items-center rounded-lg border pl-2 pr-1 py-1 gap-1.5 ${
          theme === "dark"
            ? "bg-[#121216] border-[#222228]"
            : theme === "parchment"
            ? "bg-amber-100 border-amber-300"
            : "bg-slate-900 border-cyan-900"
        }`}
        title={error ? `AI config error: ${error}` : "Switch OpenCode provider and model for all AI features"}
      >
        <Cpu
          className={`w-3.5 h-3.5 shrink-0 ${
            error ? "text-red-400 animate-pulse" : theme === "parchment" ? "text-amber-800" : "text-purple-400"
          }`}
        />

        <select
          id="select-ai-provider"
          value={provider}
          onChange={(e) => handleProviderChange(e.target.value)}
          className={`text-[11px] font-mono font-bold rounded outline-none cursor-pointer max-w-[92px] ${
            theme === "dark"
              ? "bg-[#121216] text-amber-400"
              : theme === "parchment"
              ? "bg-amber-100 text-amber-900"
              : "bg-slate-900 text-cyan-300"
          }`}
          title={providers.find((p) => p.id === provider)?.description || "OpenCode gateway"}
        >
          {(providers.length > 0 ? providers : [{ id: "zen", label: "OpenCode Zen" }, { id: "go", label: "OpenCode Go" }]).map(
            (p) => (
              <option key={p.id} value={p.id}>
                {p.label.replace("OpenCode ", "")}
              </option>
            )
          )}
        </select>

        <select
          id="select-ai-model"
          value={model}
          onChange={(e) => handleModelChange(e.target.value)}
          disabled={loadingModels}
          className={`text-[11px] font-mono rounded outline-none cursor-pointer max-w-[130px] sm:max-w-[180px] truncate ${
            theme === "dark"
              ? "bg-[#121216] text-zinc-300"
              : theme === "parchment"
              ? "bg-amber-100 text-stone-700"
              : "bg-slate-900 text-cyan-100"
          }`}
          title={model ? `Active model: ${model}` : "Active model"}
        >
          {modelOptions.map((m) => (
            <option key={m.id} value={m.id}>
              {m.id}
            </option>
          ))}
        </select>

        <button
          onClick={() => loadModels(provider)}
          className="p-1 rounded hover:bg-white/10 transition-colors shrink-0"
          title="Refresh model catalog"
        >
          {loadingModels ? (
            <Loader2 className="w-3 h-3 animate-spin opacity-70" />
          ) : (
            <RefreshCw className="w-3 h-3 opacity-60 hover:opacity-100" />
          )}
        </button>
      </div>
    </div>
  );
};
