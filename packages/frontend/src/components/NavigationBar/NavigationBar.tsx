import * as React from "react";
import {Alignment, Button, Classes, Navbar} from "@blueprintjs/core";
import {ISettings} from "../../types/settings";
import {DeepPartial} from "../../types/deeppartial";

import "./style.css";
import {connect} from "react-redux";
import {IState} from "../../store";
import {ApplySettings, OpenSettings} from "../../store/settings";
import {SetPermissionManagerState} from "../../store/permissions";
import {getMe} from "../../store/filters";
import {OpenTerminalManager} from "../../store/terminal";
import {OpenPortForwardingManager} from "../../store/portforwarding";

interface IStateProps {
  shouldDisplayPermissionManagerButton: boolean;
}

interface IDispatchProps {
  openSettings: () => void;
  openPermissionManager: () => void;
  openTerminalManager: () => void;
  openPortForwardingManager: () => void;
}

interface IOwnProps {}

const NavigationBarUI: React.FunctionComponent<IStateProps & IDispatchProps> = props => {

  return (
    <div>
      <Navbar>
        <Navbar.Group align={Alignment.LEFT}>
          <Navbar.Heading>CodeTogether</Navbar.Heading>
          <Navbar.Divider />
          <Button className="bp3-minimal" icon="home" text="Home" />
          <Button className="bp3-minimal" icon="console" text="Terminals" onClick={props.openTerminalManager} />
          <Button className="bp3-minimal" icon="globe-network" text="Port Forwarding" onClick={props.openPortForwardingManager} />
          <Button className="bp3-minimal" icon="settings" text="Settings" onClick={props.openSettings} />
          {
            props.shouldDisplayPermissionManagerButton &&
            <Button className="bp3-minimal" icon="helper-management" text="Permissions" onClick={props.openPermissionManager} />
          }
          <Button className="bp3-minimal" icon="help" text="Help" />
        </Navbar.Group>
      </Navbar>
      <Navbar className={['subnav', Classes.SMALL].join(' ')}>
        <Navbar.Group align={Alignment.LEFT}>
          <Button className="bp3-minimal" icon="home" text="Home" />
          <Button className="bp3-minimal" icon="document" text="Files" />
        </Navbar.Group>
        <Navbar.Group align={Alignment.RIGHT}>
          <Button className="bp3-minimal" icon="play" />
          <Button className="bp3-minimal" icon="stop" />
          <Button className="bp3-minimal" icon="lightbulb" />
        </Navbar.Group>
      </Navbar>
    </div>
  );
};

export const NavigationBar = connect<IStateProps, IDispatchProps, IOwnProps, IState>((state, ownProps) => ({
  shouldDisplayPermissionManagerButton: getMe(state).isAdmin
}), (dispatch, ownProps) => ({
  openSettings: () => dispatch(OpenSettings.create({})),
  openPermissionManager: () => dispatch(SetPermissionManagerState.create({ open: true, currentUser: undefined })),
  openTerminalManager: () => dispatch(OpenTerminalManager.create({})),
  openPortForwardingManager: () => dispatch(OpenPortForwardingManager.create({}))
}))(NavigationBarUI);
