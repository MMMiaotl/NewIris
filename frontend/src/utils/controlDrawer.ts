import { useConnectionStore } from '../stores/connectionStore';
import { useVariableStore } from '../stores/variableStore';

/** Toggle the right-hand Control panel; focuses first selected variable when opening. */
export function toggleControlDrawer(): void {
  const { plotDrawerOpen, setPlotDrawerOpen } = useConnectionStore.getState();
  if (plotDrawerOpen) {
    setPlotDrawerOpen(false);
    return;
  }
  const { focusedVariable, selectedVariables, setFocusedVariable } = useVariableStore.getState();
  if (!focusedVariable && selectedVariables.length) {
    setFocusedVariable(selectedVariables[0]);
  }
  setPlotDrawerOpen(true);
}
