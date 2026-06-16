import type { ReactNode } from 'react';
import { Tooltip } from 'antd';

const SEARCH_FILTER_TOGGLES = [
  {
    key: 'case',
    title: 'Match case',
    icon: <span className="search-filter-icon search-filter-icon--case">Aa</span>,
  },
  {
    key: 'whole',
    title: 'Match whole word',
    icon: (
      <span className="search-filter-icon search-filter-icon--whole">
        ab
        <span className="search-filter-icon-whole-bracket" aria-hidden />
      </span>
    ),
  },
] as const;

function SearchFilterToggle({
  active,
  title,
  onClick,
  children,
}: {
  active: boolean;
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip title={title}>
      <button
        type="button"
        className={`search-filter-toggle${active ? ' search-filter-toggle--active' : ''}`}
        aria-label={title}
        aria-pressed={active}
        onClick={onClick}
      >
        {children}
      </button>
    </Tooltip>
  );
}

interface SearchFilterTogglesProps {
  matchCase: boolean;
  matchWholeWord: boolean;
  onMatchCaseChange: (on: boolean) => void;
  onMatchWholeWordChange: (on: boolean) => void;
}

export function SearchFilterToggles({
  matchCase,
  matchWholeWord,
  onMatchCaseChange,
  onMatchWholeWordChange,
}: SearchFilterTogglesProps) {
  const active = { case: matchCase, whole: matchWholeWord };
  const onToggle = { case: onMatchCaseChange, whole: onMatchWholeWordChange };

  return (
    <span className="search-filter-toggles">
      {SEARCH_FILTER_TOGGLES.map(({ key, title, icon }) => (
        <SearchFilterToggle
          key={key}
          active={active[key]}
          title={title}
          onClick={() => onToggle[key](!active[key])}
        >
          {icon}
        </SearchFilterToggle>
      ))}
    </span>
  );
}
