const path = require('path');
const fs = require('fs');
const vscode = require('vscode');
const Handlebars = require('handlebars');

async function getSelectionContextData() {

	const gitExtension = vscode.extensions.getExtension('vscode.git').exports;
	const api = gitExtension.getAPI(1);

	const selection = vscode.window.activeTextEditor.selection;
	const selectedText = vscode.window.activeTextEditor.document.getText(selection);

	const editor = vscode.window.activeTextEditor;
	if (!editor) return null;
	const uri = editor.document.uri;
	const repo = api.repositories.find(r => uri.fsPath.startsWith(r.rootUri.fsPath));

	const currentBranch = repo.state.HEAD.name
	const branchDetails = await repo.getBranch(currentBranch);

	const changes = repo.state.workingTreeChanges;
    const staged = repo.state.indexChanges;
    const merge = repo.state.mergeChanges;
    const untrackedCount = changes.filter(c => c.status === 7).length;

	return {
		repo: path.basename(repo.rootUri.fsPath),
		branch: repo.state.HEAD.name,
		commit: repo.state.HEAD.commit.slice(0, 7),
		status: `${branchDetails.ahead}, ${branchDetails.behind}`,
		stagedCount: staged.length,
        unstagedCount: changes.length,
		untrackedCount,
        mergeInProgress: merge.length > 0,
		file: path.relative(repo.rootUri.fsPath, uri.fsPath),
		start: selection.start.line,
		end: selection.end.line,
		language: editor.document.languageId,
		code: selectedText
	}
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	const templatePath = context.asAbsolutePath(path.join('templates', 'default.hbs'));
	const templateSrc = fs.readFileSync(templatePath, 'utf-8');
	const template = Handlebars.compile(templateSrc, { noEscape: true });

	const myCommandId = 'starpost-select';
	context.subscriptions.push(vscode.commands.registerCommand(myCommandId, async () => {
		const data = await getSelectionContextData();
		const fancyStr = template(data);
		await vscode.env.clipboard.writeText(fancyStr);
		vscode.window.showInformationMessage(`Copied selection!`);
	}));

	let myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1000);
	myStatusBarItem.command = myCommandId;
	context.subscriptions.push(myStatusBarItem);
	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(updateStatusBarItem));
	context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(updateStatusBarItem));

	function updateStatusBarItem() {
		const n = getNumberOfSelectedLines(vscode.window.activeTextEditor);
		if (n > 0) {
			myStatusBarItem.text = `$(star-half) StarPost - ${n} line(s) selected $(globe)`;
			myStatusBarItem.show();
		} else {
			myStatusBarItem.hide();
		}
	}

	function getNumberOfSelectedLines(editor) {
		let lines = 0;
		if (editor) {
			lines = editor.selections.reduce((prev, curr) => prev + (curr.end.line - curr.start.line), 0);
		}
		return lines;
	}

	updateStatusBarItem();

}


function deactivate() { }

module.exports = {
	activate,
	deactivate
}

