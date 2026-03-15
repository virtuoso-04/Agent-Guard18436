import type React from 'react';

interface TokenDisplayProps {
  tokenUsage: number;
  maxTokens: number;
  isDarkMode?: boolean;
}

/** Compact context-window usage bar shown in the side panel during agent execution. */
const TokenDisplay: React.FC<TokenDisplayProps> = ({ tokenUsage, maxTokens, isDarkMode = false }) => {
  const pct = maxTokens > 0 ? Math.min(100, Math.round((tokenUsage / maxTokens) * 100)) : 0;

  const barColor =
    pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : isDarkMode ? 'bg-indigo-400' : 'bg-guard-primary';

  const formatK = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest select-none ${
        isDarkMode ? 'bg-slate-800/50 text-slate-400' : 'bg-slate-100/80 text-slate-500'
      }`}
      title={`Context window: ${tokenUsage.toLocaleString()} / ${maxTokens.toLocaleString()} tokens (${pct}%)`}>
      <div className={`w-20 h-1.5 rounded-full overflow-hidden ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}>
        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={pct >= 90 ? 'text-red-500' : ''}>
        {formatK(tokenUsage)}&thinsp;/&thinsp;{formatK(maxTokens)} ctx
      </span>
    </div>
  );
};

export default TokenDisplay;
