import type { ReactNode } from 'react';
import { Tooltip } from 'antd';

interface SearchFilterToggleProps {
  active: boolean;
  title: string;
  onClick: () => void;
  children: ReactNode;
}

function SearchFilterToggle({ active, title, onClick, children }: SearchFilterToggleProps) {
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

function MatchCaseIcon() {
  return <span className="search-filter-icon search-filter-icon--case">Aa</span>;
}

function MatchWholeWordIcon() {
  return (
    <span className="search-filter-icon search-filter-icon--whole">
      ab
      <span className="search-filter-icon-whole-bracket" aria-hidden />
    </span>
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
  return (
    <span className="search-filter-toggles">
      <SearchFilterToggle
        active={matchCase}
        title="Match case"
        onClick={() => onMatchCaseChange(!matchCase)}
      >
        <MatchCaseIcon />
      </SearchFilterToggle>
      <SearchFilterToggle
        active={matchWholeWord}
        title="Match whole word"
        onClick={() => onMatchWholeWordChange(!matchWholeWord)}
      >
        <MatchWholeWordIcon />
      </SearchFilterToggle>
    </span>
  );
}
