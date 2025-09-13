const path = require('path');
const fs = require('fs');
const vscode = require('vscode');
const Handlebars = require('handlebars');

async function getCurrentEditorGitStatus() {

	const gitExtension = vscode.extensions.getExtension('vscode.git').exports;
	const api = gitExtension.getAPI(1);

	
	const editor = vscode.window.activeTextEditor;
	if (!editor) return null;
	const uri = editor.document.uri;
	const repo = api.repositories.find(r => uri.fsPath.startsWith(r.rootUri.fsPath));
	const head = repo.state.HEAD;

	// Get the branch and commit 
	const { commit, name: branch } = head;

	// Get head of any other branch
	const mainBranch = 'master'
	const branchDetails = await repo.getBranch(mainBranch);

	// Get last merge commit
	const lastMergeCommit = await repo.getMergeBase(branch, mainBranch);

	const status = await repo.status();

	console.log({ branch, status, branchDetails, commit, lastMergeCommit, needsSync: lastMergeCommit !== commit });

	return {
		file: uri,
		root: repo.rootUri.fsPath,
		repoName: path.basename(repo.rootUri.fsPath),
		HEAD: repo.state.HEAD ? repo.state.HEAD.name || repo.state.HEAD.commit : null,
		ahead: branchDetails.ahead,
		behind: branchDetails.behind
	};
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	const templatePath = context.asAbsolutePath(path.join('templates', 'default.hbs'));
	const templateSrc = fs.readFileSync(templatePath, 'utf-8');
	const template = Handlebars.compile(templateSrc, { noEscape: true });

	let myStatusBarItem;
	const myCommandId = 'starpost-select';
	context.subscriptions.push(vscode.commands.registerCommand(myCommandId, async () => {
		const selection = vscode.window.activeTextEditor.selection;
		const selectedText = vscode.window.activeTextEditor.document.getText(selection);

		const gitData = await getCurrentEditorGitStatus();
		const data = {
			repo: gitData.repoName,
			branch: gitData.HEAD,
			commit: gitData.HEAD,
			status: `${gitData.ahead}, ${gitData.behind}`,
			file: gitData.file,
			start: selection.start.line,
			end: selection.end.line,
			language: "js",
			code: selectedText
		}

		const fancyStr = template(data);

		await vscode.env.clipboard.writeText(fancyStr);
		vscode.window.showInformationMessage(`Copied selection!`);
	}));
	myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1000);
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

