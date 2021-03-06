import {SocketMessages} from "@devsession/common";
import {getActualPathFromNormalizedPath, normalizeProjectPath} from "@devsession/common";
import * as fs from "fs";
import {editor} from "monaco-editor";
import * as path from "path";
import {Socket} from "socket.io";
import {AbstractRouter} from "./AbstractRouter";
import PermissionRouter from "./PermissionRouter";

export default class EditorRouter extends AbstractRouter {
  public readonly routerPrefix = "editor";

  private files: {
    [path: string]: { contents: string, openedByUsers: string[] }
  } = {};

  public onNewSocket(socket: Socket): void {
    this.onSocketMessage<SocketMessages.Editor.OpenedFile>(socket, "@@EDITOR/OPEN_FILE", true, (payload, auth) => {
      payload.path = normalizeProjectPath(payload.path);
      const actualPath = path.join(this.serverSettings.projectPath, getActualPathFromNormalizedPath(payload.path));

      if (!this.permissionService.getPathPermissionsOfUser(payload.path, auth.userId).mayRead) {
        this.respondUserError(socket, "No sufficient read permissions for the requested action.");
        return;
      }

      if (this.isOpened(payload.path)) {
        this.files[payload.path].openedByUsers.push(auth.userId);
      } else {
        fs.readFile(actualPath, (err, data) => {
          if (err) {
            this.createServerError("Error during editor file opening", [`File ${getActualPathFromNormalizedPath(payload.path)} could not be opened.`]);
          } else {
            this.files[payload.path] = {
              contents: data.toString("utf8"),
              openedByUsers: [auth.userId]
            };
          }
        });
      }
    });

    this.onSocketMessage<SocketMessages.Editor.ClosedFile>(socket, "@@EDITOR/CLOSE_FILE", true, (payload, auth) => {
      payload.path = normalizeProjectPath(payload.path);
      const actualPath = path.join(this.serverSettings.projectPath, getActualPathFromNormalizedPath(payload.path));

      if (this.isOpened(payload.path)) {
        this.files[payload.path].openedByUsers = this.files[payload.path].openedByUsers.filter((user) => user !== auth.userId);
        if (this.files[payload.path].openedByUsers.length === 0) {
          this.saveFile(payload.path);
          this.files[payload.path] = undefined;
        }
      }
    });

    this.onSocketMessage<SocketMessages.Editor.ChangedText>(socket, "@@EDITOR/CHANGED_TEXT", true, (payload, auth) => {
      payload.path = normalizeProjectPath(payload.path);

      if (!this.permissionService.getPathPermissionsOfUser(payload.path, auth.userId).mayWrite) {
        this.respondUserError(socket, "No sufficient write permissions for the requested action.");
        return;
      }

      if (!this.isOpened(payload.path)) {
        this.createServerError("Operating an action on a file which is not opened.",
          [`File ${getActualPathFromNormalizedPath(payload.path)} should be changed, but it was closed..`]);
        return;
      }

      payload.changes.forEach((change) => this.applyChange(payload.path, change));

      this.forward<SocketMessages.Editor.NotifyChangedText>(socket, "@@EDITOR/NOTIFY_CHANGED_TEXT", {
        user: auth.userId,
        changes: payload.changes,
        path: payload.path
      });
    });

    this.onSocketMessage<SocketMessages.Editor.ForceSave>(socket, "@@EDITOR/FORCE_SAVE", true, (payload, auth) => {
      payload.path = normalizeProjectPath(payload.path);

      if (!this.permissionService.getPathPermissionsOfUser(payload.path, auth.userId).mayWrite) {
        this.respondUserError(socket, "No sufficient write permissions for the requested action.");
        return;
      }

      this.saveFile(payload.path);
    });
  }

  public defineRoutes(): void {
    this.router.get("/dir", ((req, res) => {
      const requestedPath = normalizeProjectPath(req.query.path);
      const actualPath = path.join(this.serverSettings.projectPath, getActualPathFromNormalizedPath(requestedPath));

      // TODO AUTH

      fs.readdir(actualPath, (err, files) => {
        if (err) {
          this.createServerError("Error while loading dir contents", [`Directory ${actualPath}.`]);
        } else {
          res.send({
            files: files.map((f) => ({ path: path.join(requestedPath, f), filename: f, isDir: !f.includes(".") }))
          });
        }
      });
    }));

    this.router.get("/contents", ((req, res) => {
      const requestedPath = normalizeProjectPath(req.query.path);
      const actualPath = path.join(this.serverSettings.projectPath, getActualPathFromNormalizedPath(requestedPath));

      // TODO auth

      if (this.isOpened(requestedPath)) {
        res.send({
          path: requestedPath,
          fileName: path.basename(requestedPath),
          contents: this.files[requestedPath].contents
        });
      } else {
        fs.readFile(actualPath, { encoding: "utf8" }, (err, file) => {
          if (err) {
            this.createServerError("Error while loading file contents", [`File ${actualPath}.`]);
          } else {
            res.send({
              path: requestedPath,
              fileName: path.basename(requestedPath),
              contents: file
            });
          }
        });
      }
    }));
  }

  public saveAllFiles() {
    for (const file of Object.keys(this.files)) {
      this.saveFile(file);
    }
  }

  private isOpened(filePath: string) {
    return Object.keys(this.files).includes(filePath) && !!this.files[filePath];
  }

  private applyChange(filePath: string, change: editor.IModelContentChange) {
    try {
      let lines = this.files[filePath].contents.split("\n");

      const before = lines[change.range.startLineNumber - 1].substr(0, change.range.startColumn - 1);
      const after = lines[change.range.endLineNumber - 1].substr(change.range.endColumn - 1);

      lines = [
        ...lines.filter((l, i) => i < change.range.startLineNumber - 1),
        before + change.text + after,
        ...lines.filter((l, i) => i > change.range.endLineNumber - 1)
      ];

      this.files[filePath].contents = lines.join("\n");
    } catch (e) {
      this.createServerError("Error while applying edit changes in the backend.",
        [
          `Affected file was ${filePath}`,
          `Change was ${change.text} ${change.range.startLineNumber}:${change.range.startColumn}-${change.range.endLineNumber}:${change.range.endColumn}`,
          `Change length: ${change.rangeLength}, Change offset: ${change.rangeOffset}`
        ], { filePath, change });
    }
  }

  private saveFile(filePath: string) {
    console.log(filePath, this.files);
    const actualPath = path.join(this.serverSettings.projectPath, getActualPathFromNormalizedPath(filePath));
    fs.writeFile(actualPath, this.files[filePath].contents, (err) => {
      if (err) {
        this.createServerError("Error during editor file saving", [`File ${getActualPathFromNormalizedPath(filePath)} could not be saved.`]);
      }
    });
  }
}
