import { Button, Checkbox, Input, Space } from 'antd';
import { useMemo, useState } from 'react';
import { useConnectionStore } from '../../stores/connectionStore';
import {
  createPlaceholderVariable,
  useVariableStore,
} from '../../stores/variableStore';
import { isVariableDataType } from '../../api/types';

interface VariableControlViewProps {
  onSetValue: (name: string, value: string) => void;
  onRefresh: (name: string) => void;
}

function isNumericValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !Number.isNaN(Number(trimmed));
}

export function VariableControlView({ onSetValue, onRefresh }: VariableControlViewProps) {
  const { appMode } = useConnectionStore();
  const {
    variables,
    focusedVariable,
    selectedVariables,
    removeSelectedVariable,
    moveSelectedVariable,
    insertSelectedVariable,
    toggleSelectedVariable,
  } = useVariableStore();
  const [valueDraft, setValueDraft] = useState<{ name: string; value: string } | null>(null);
  const [showAlias, setShowAlias] = useState(false);

  const variableMap = useMemo(() => new Map(variables.map((v) => [v.name, v])), [variables]);

  const variable = useMemo(() => {
    if (!focusedVariable) return null;
    return variableMap.get(focusedVariable) ?? createPlaceholderVariable(focusedVariable);
  }, [focusedVariable, variableMap]);

  if (!focusedVariable || !variable) {
    return (
      <div className="control-empty">
        Select a parameter in the table or tree to view details.
      </div>
    );
  }

  const isPlaceholder = !variableMap.has(variable.name);
  const readOnly = appMode === 'replay' || isPlaceholder;
  const numeric = isVariableDataType(variable.dataType) && variable.dataType !== 'string';
  const displayLabel = showAlias && variable.alias ? variable.alias : variable.description;
  const inList = selectedVariables.includes(variable.name);
  const listIndex = selectedVariables.indexOf(variable.name);
  const draftValue =
    valueDraft?.name === variable.name ? valueDraft.value : variable.value;

  const setDraftValue = (value: string) => {
    setValueDraft({ name: variable.name, value });
  };

  const applyNumericDelta = (delta: number) => {
    if (!numeric || !isNumericValue(draftValue)) return;
    setDraftValue(String(Number(draftValue) + delta));
  };

  const invertValue = () => {
    if (!numeric || !isNumericValue(draftValue)) return;
    setDraftValue(String(-Number(draftValue)));
  };

  return (
    <div className="control-view">
      <fieldset className="control-fieldset control-fieldset--variable">
        <legend>Variable</legend>
        <label className="control-field-label control-field-label--readonly">Name</label>
        <Input
          size="small"
          value={variable.name}
          readOnly
          className="control-field control-field-readonly"
        />
        <label className="control-field-label control-field-label--readonly">Description</label>
        <Input
          size="small"
          value={displayLabel}
          readOnly
          placeholder="No description"
          className="control-field control-field-readonly"
        />
        <label
          className={
            readOnly
              ? 'control-field-label control-field-label--readonly'
              : 'control-field-label control-field-label--editable'
          }
        >
          Value
        </label>
        <div className={`control-editable-group${readOnly ? ' is-readonly' : ''}`}>
          <div className="control-value-row">
          <Input
            size="small"
            value={draftValue}
            readOnly={readOnly}
            onChange={(e) => setDraftValue(e.target.value)}
            className={`control-value-input ${
              readOnly ? 'control-field-readonly' : 'control-field-editable'
            }`}
          />
          <Space direction="vertical" size={2} className="control-value-actions">
            <Button
              size="small"
              disabled={readOnly || !numeric}
              onClick={() => applyNumericDelta(1)}
            >
              Plus 1
            </Button>
            <Button
              size="small"
              disabled={readOnly || !numeric}
              onClick={() => applyNumericDelta(-1)}
            >
              Min 1
            </Button>
            <Button size="small" disabled={readOnly || !numeric} onClick={invertValue}>
              Invert
            </Button>
          </Space>
          </div>
          <Space className="control-set-row">
          <Button
            size="small"
            disabled={readOnly}
            onClick={() => onSetValue(variable.name, draftValue)}
          >
            Set
          </Button>
          <Button size="small" disabled={readOnly} onClick={() => onRefresh(variable.name)}>
            Refresh
          </Button>
          </Space>
        </div>
      </fieldset>

      <div className="control-side-row">
        <fieldset className="control-fieldset control-fieldset--style">
          <legend>Style</legend>
          <label className="control-field-label control-field-label--readonly">Scale</label>
          <Input
            size="small"
            value={variable.scale || '-----'}
            readOnly
            className="control-field control-field-readonly"
          />
          <Checkbox checked={showAlias} onChange={(e) => setShowAlias(e.target.checked)}>
            Show Name/Alias
          </Checkbox>
        </fieldset>

        <fieldset className="control-fieldset control-fieldset--list">
          <legend>List</legend>
          <div className="control-list-grid">
            <Button
              size="small"
              disabled={!inList}
              onClick={() => removeSelectedVariable(variable.name)}
            >
              Remove
            </Button>
            <Button
              size="small"
              disabled={inList || selectedVariables.length >= 100}
              onClick={() => insertSelectedVariable(variable.name)}
            >
              Insert
            </Button>
            <Button
              size="small"
              disabled={!inList || listIndex <= 0}
              onClick={() => moveSelectedVariable(variable.name, 'up')}
            >
              Up
            </Button>
            <Button
              size="small"
              disabled={!inList || listIndex >= selectedVariables.length - 1}
              onClick={() => moveSelectedVariable(variable.name, 'down')}
            >
              Down
            </Button>
            <Button
              size="small"
              disabled={inList || selectedVariables.length >= 100}
              onClick={() => {
                if (!toggleSelectedVariable(variable.name)) return;
              }}
              className="control-list-add"
            >
              Add
            </Button>
          </div>
        </fieldset>
      </div>
    </div>
  );
}
