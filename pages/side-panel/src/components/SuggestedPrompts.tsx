import type React from 'react';
import { LuSparkles } from 'react-icons/lu';

interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void;
  isDarkMode?: boolean;
}

const SUGGESTIONS = [
  {
    title: 'News Summary',
    description: 'Top headlines from TechCrunch',
    prompt: 'Go to TechCrunch and extract top 10 headlines from the last 24 hours',
    icon: '📰',
  },
  {
    title: 'Shopping Hack',
    description: 'Find a speaker under $50',
    prompt:
      'Find a portable Bluetooth speaker on Amazon with a water-resistant design, under $50. It should have a minimum battery life of 10 hours',
    icon: '🛒',
  },
  {
    title: 'Code Research',
    description: 'Trending Python repos',
    prompt: 'Look for the trending Python repositories on GitHub with most stars',
    icon: '📂',
  },
  {
    title: 'Market Intel',
    description: 'AI news from Reuters',
    prompt: 'Navigate to Reuters and summarize the latest 5 articles related to artificial intelligence',
    icon: '📈',
  },
  {
    title: 'Price Compare',
    description: 'Compare prices across stores',
    prompt:
      'Search Amazon, Best Buy, and Walmart for the MacBook Air M3 and return a side-by-side price and availability comparison',
    icon: '💸',
  },
  {
    title: 'Job Scout',
    description: 'Find engineering roles this week',
    prompt:
      'Go to LinkedIn Jobs and find 5 software engineering positions in San Francisco posted in the last 7 days. For each, extract the job title, company name, and salary range if listed',
    icon: '💼',
  },
  {
    title: 'Competitor Intel',
    description: 'Compare SaaS pricing pages',
    prompt:
      'Visit the pricing pages of Notion, Coda, and Confluence and create a feature comparison table covering price tiers, storage limits, and collaboration features',
    icon: '🔍',
  },
  {
    title: 'Research Brief',
    description: 'Multi-source topic summary',
    prompt:
      'Search for the latest developments in large language model reasoning on Wikipedia, ArXiv, and a major tech news site. Write a concise 3-paragraph briefing with key findings',
    icon: '🧠',
  },
  {
    title: 'Travel Deals',
    description: 'Find cheap flights next month',
    prompt:
      'Go to Google Flights and find the 3 cheapest round-trip flights from New York JFK to London Heathrow for next month. List dates, airlines, and total price',
    icon: '✈️',
  },
];

const SuggestedPrompts: React.FC<SuggestedPromptsProps> = ({ onSelect, isDarkMode = false }) => {
  return (
    <div className="px-6 py-4">
      <div className="mb-4 flex items-center gap-2 px-1">
        <LuSparkles className={isDarkMode ? 'text-indigo-400' : 'text-guard-primary'} size={16} />
        <h3
          className={`text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          Suggested Tasks
        </h3>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SUGGESTIONS.map((s, i) => (
          <button
            key={i}
            onClick={() => onSelect(s.prompt)}
            className={`suggestion-card flex flex-col items-start gap-1 rounded-2xl p-4 text-left transition-all hover:scale-[1.02] active:scale-95 ${
              isDarkMode
                ? 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/60'
                : 'bg-white/40 border-slate-200/50 hover:bg-white/60'
            } border backdrop-blur-md shadow-sm`}
            type="button">
            <span className="mb-1 text-2xl">{s.icon}</span>
            <span className={`text-sm font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>{s.title}</span>
            <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} line-clamp-2`}>
              {s.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default SuggestedPrompts;
