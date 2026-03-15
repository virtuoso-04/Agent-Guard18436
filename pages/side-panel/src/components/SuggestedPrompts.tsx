import type React from 'react';
import { LuSparkles } from 'react-icons/lu';

interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void;
  isDarkMode?: boolean;
}

const SUGGESTIONS = [
  {
    title: 'Naukri Scout',
    description: 'Find top IT jobs in Bengaluru',
    prompt:
      'Go to Naukri.com and find the top 5 software engineering jobs in Bengaluru posted in the last 7 days. For each, extract the job title, company name, salary range, and required skills.',
    icon: '💼',
    color: 'from-blue-500 to-indigo-500',
  },
  {
    title: 'Flipkart Deal',
    description: 'Best earphones under ₹2000',
    prompt:
      'Go to Flipkart and find the best-rated wireless earphones under ₹2000 with at least 4-star reviews. List the top 3 with price, battery life, and key features.',
    icon: '🛒',
    color: 'from-orange-500 to-amber-500',
  },
  {
    title: 'UPSC Prep',
    description: 'Current affairs from The Hindu',
    prompt:
      "Go to The Hindu and extract today's top 5 news stories relevant to UPSC current affairs. Summarize each in 2–3 sentences with the key fact to remember.",
    icon: '📰',
    color: 'from-emerald-500 to-teal-500',
  },
  {
    title: 'Stock Watch',
    description: 'NSE/BSE movers today',
    prompt:
      'Go to Moneycontrol and find the top 5 gainers and top 5 losers on NSE today. List stock name, percentage change, and current price.',
    icon: '📈',
    color: 'from-violet-500 to-purple-500',
  },
  {
    title: 'Train Planner',
    description: 'Mumbai–Delhi trains this week',
    prompt:
      'Go to IRCTC or RailYatri and find all available trains from Mumbai to Delhi for this Saturday. List train name, departure time, arrival time, duration, and available classes.',
    icon: '🚆',
    color: 'from-sky-500 to-cyan-500',
  },
  {
    title: 'Ed-Tech Compare',
    description: 'Compare coding courses',
    prompt:
      'Compare the full-stack web development courses on Coursera, upGrad, and PW Skills. Create a table with price (INR), duration, certificate, and placement support.',
    icon: '🎓',
    color: 'from-pink-500 to-rose-500',
  },
  {
    title: 'Startup Intel',
    description: 'Indian startups funded this month',
    prompt:
      'Go to Inc42 or YourStory and find the top 5 Indian startups that received funding this month. For each, list the startup name, funding amount, investor, and sector.',
    icon: '🚀',
    color: 'from-fuchsia-500 to-violet-500',
  },
  {
    title: 'Cricket Update',
    description: 'Latest IPL/team India scores',
    prompt:
      'Go to Cricbuzz and get the latest cricket match results and upcoming fixtures for Team India and the current IPL season. Summarize scores and standings.',
    icon: '🏏',
    color: 'from-green-500 to-emerald-500',
  },
  {
    title: 'Property Hunt',
    description: '2BHK flats in Pune under 60L',
    prompt:
      'Go to 99acres or MagicBricks and find 2BHK flats for sale in Pune under ₹60 lakhs. List the top 5 with locality, area (sq ft), price, and builder name.',
    icon: '🏠',
    color: 'from-teal-500 to-cyan-500',
  },
  {
    title: 'Amazon.in Deal',
    description: 'Best smartphones under ₹15,000',
    prompt:
      'Go to Amazon.in and find the top 5 best-selling smartphones under ₹15,000 with at least 4-star ratings. For each, list the model name, price, key specs (RAM, storage, battery), and customer rating.',
    icon: '📱',
    color: 'from-yellow-500 to-orange-500',
  },
];

const SuggestedPrompts: React.FC<SuggestedPromptsProps> = ({ onSelect, isDarkMode = false }) => {
  return (
    <div className="py-2">
      <div className="mb-3 flex items-center gap-2 px-5">
        <LuSparkles className={isDarkMode ? 'text-indigo-400' : 'text-guard-primary'} size={13} />
        <h3
          className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          Try these
        </h3>
      </div>

      <div className="scrollbar-hide flex gap-2.5 overflow-x-auto px-5 pb-2">
        {SUGGESTIONS.map((s, i) => (
          <button
            key={i}
            onClick={() => onSelect(s.prompt)}
            type="button"
            className={`group flex shrink-0 w-[128px] flex-col gap-2 rounded-2xl p-3 text-left transition-all duration-200 hover:scale-[1.03] active:scale-95 ${
              isDarkMode
                ? 'bg-slate-800/70 border border-slate-700/50 hover:border-slate-600 hover:bg-slate-800'
                : 'bg-white border border-slate-200/80 hover:border-slate-300 shadow-sm hover:shadow-md'
            }`}>
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br ${s.color} shadow-sm`}>
              <span className="text-[15px] leading-none">{s.icon}</span>
            </div>
            <div className="min-w-0">
              <p
                className={`text-[12px] font-bold leading-tight truncate ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                {s.title}
              </p>
              <p
                className={`mt-0.5 text-[10px] leading-tight line-clamp-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                {s.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default SuggestedPrompts;
