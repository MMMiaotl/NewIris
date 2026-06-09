import { memo } from 'react';
import type { TreeNodeKind } from '../../api/types';

interface VariableTreeNodeTitleProps {
  nodeKey: string;
  title: string;
  nodeKind?: TreeNodeKind;
  selected: boolean;
  onSelectVariable: (name: string) => void;
  onAddPlot: (name: string) => void;
}

export const VariableTreeNodeTitle = memo(function VariableTreeNodeTitle({
  nodeKey,
  title,
  nodeKind,
  selected,
  onSelectVariable,
  onAddPlot,
}: VariableTreeNodeTitleProps) {
  if (nodeKind !== 'variable') {
    return <span>{title}</span>;
  }

  return (
    <span
      className="tree-var-node"
      onDoubleClick={(e) => {
        e.stopPropagation();
        onAddPlot(nodeKey);
      }}
    >
      <button
        type="button"
        className={`tree-var-indicator${selected ? ' is-selected' : ''}`}
        aria-label={selected ? 'Selected parameter' : 'Select parameter'}
        aria-pressed={selected}
        onClick={(e) => {
          e.stopPropagation();
          onSelectVariable(nodeKey);
        }}
      />
      <span className="tree-var-label">{title}</span>
    </span>
  );
});
