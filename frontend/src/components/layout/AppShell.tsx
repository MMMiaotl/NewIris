import { Splitter } from 'antd';
import { ConnectionBar } from '../connection/ConnectionBar';
import { MenuBar } from '../toolbar/MenuBar';
import { VariableTree } from '../tree/VariableTree';
import { ParameterTable } from '../table/ParameterTable';
import { PlotPanel } from '../plot/PlotPanel';
import { PlotControlDrawer } from '../plot/PlotControlDrawer';
import { SettingsDrawer } from '../settings/SettingsDrawer';
import { ReplayControls } from '../replay/ReplayControls';
import { useConnectionStore } from '../../stores/connectionStore';
import { useWatchIo } from '../../hooks/useWatchIo';
import { useReplay } from '../../hooks/useReplay';

export function AppShell() {
  const { viewMode, appMode, config, status } = useConnectionStore();
  const { connect, disconnect, registerVariable, unregisterVariable, setVariableValue, client } =
    useWatchIo();
  useReplay();

  const showList = viewMode === 'splitter' || viewMode === 'list';
  const showPlot = viewMode === 'splitter' || viewMode === 'plot';

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-title">NewIris — WatchIO Monitor</div>
        <MenuBar onConnect={connect} onDisconnect={disconnect} />
        <ConnectionBar />
      </header>

      {appMode === 'replay' && <ReplayControls />}

      <main className="app-main">
        <Splitter className="main-splitter">
          <Splitter.Panel defaultSize="22%" min="15%" max="40%">
            <VariableTree
              onExpandBranch={(branch) => {
                if (!branch) client.current?.fetchVarTree();
                else client.current?.fetchVarTree(branch);
              }}
            />
          </Splitter.Panel>
          <Splitter.Panel>
            <Splitter orientation="vertical" className="right-splitter">
              {showList && (
                <Splitter.Panel defaultSize="45%" min="20%">
                  <ParameterTable
                    onRegister={registerVariable}
                    onUnregister={unregisterVariable}
                    onSetValue={setVariableValue}
                  />
                </Splitter.Panel>
              )}
              {showPlot && (
                <Splitter.Panel min="25%">
                  <PlotPanel />
                </Splitter.Panel>
              )}
            </Splitter>
          </Splitter.Panel>
        </Splitter>
      </main>

      <footer className="app-footer">
        <span>
          {config.transport}
          {' · '}
          {config.hostAddress}
          {config.serverPath}
          {' · '}
          {config.watchIoName}
          {' · '}
          {status}
        </span>
      </footer>

      <PlotControlDrawer />
      <SettingsDrawer />
    </div>
  );
}
