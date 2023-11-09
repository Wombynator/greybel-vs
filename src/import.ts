import vscode, {
  ExtensionContext,
  TextEditor,
  TextEditorEdit,
  Uri
} from 'vscode';

import { showCustomErrorMessage } from './helper/show-custom-error';
import { createImporter } from './build/importer';

const getFiles = async (uri: vscode.Uri): Promise<vscode.Uri[]> => {
  const stat = await vscode.workspace.fs.stat(uri);
  
  if (stat.type === vscode.FileType.Directory) {
    const target = vscode.workspace.asRelativePath(uri.fsPath);
    return await vscode.workspace.findFiles(`${target}/**/*`);
  } else if (stat.type === vscode.FileType.File) {
    return [
      uri
    ];
  }

  return [];
}

export function activate(context: ExtensionContext) {
  async function importIngame(
    editor: TextEditor,
    _edit: TextEditorEdit,
    eventUri: Uri
  ) {
    try {
      const files = await getFiles(eventUri);

      if (files.length === 0) {
        vscode.window.showInformationMessage('No files found!', {
          modal: false
        });
        return;
      }

      const target = eventUri.fsPath;
      const config = vscode.workspace.getConfiguration('greybel');
      const ingameDirectory = Uri.file(
        config.get<string>('transpiler.ingameDirectory')
      );
      const filesWithContent = await Promise.all(files.map(async (file) => {
        const buffer = await vscode.workspace.fs.readFile(file);
        const content = new TextDecoder().decode(buffer);

        return {
          path: file.fsPath,
          content
        };
      }));
      const results = await createImporter({
        target,
        ingameDirectory: ingameDirectory.path.replace(/\/$/i, ''),
        result: filesWithContent.reduce((result, item) => {
          result[item.path] = item.content;
          return result;
        }, {}),
        extensionContext: context
      });
      const successfulItems = results.filter((item) => item.success);
      const failedItems = results.filter((item) => !item.success);

      if (successfulItems.length === 0) {
        vscode.window.showInformationMessage(`No files could be imported! This might be due to a new Grey Hack version or other reasons.`, {
          modal: false
        });
      } else if (failedItems.length > 0) {
        vscode.window.showInformationMessage(`Import was only partially successful. Only ${successfulItems.length} files got imported to ${ingameDirectory.fsPath}!`, {
          modal: false
        });
      } else {
        vscode.window.showInformationMessage(`${successfulItems.length} files got imported to ${ingameDirectory.fsPath}!`, {
          modal: false
        });
      }
    } catch (err: any) {
      showCustomErrorMessage(err);
    }
  }

  context.subscriptions.push(
    vscode.commands.registerTextEditorCommand('greybel.import', importIngame)
  );
}
