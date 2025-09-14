const path = require('path');
const fs = require('fs');
const vscode = require('vscode');
const Handlebars = require('handlebars');

async function getTargetContextData() {
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

class Template {
	constructor(templatePath) {
		this.templatePath = templatePath;
		const templateSrc = fs.readFileSync(templatePath, 'utf-8');
		this.template = Handlebars.compile(templateSrc, { noEscape: true });
	}
	generate(data) {
		return this.template(data);
	}
}


/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	const gitTemplate = new Template(context.asAbsolutePath(path.join('templates', 'defaults', 'gitEnabled.hbs')));
	const fallbackTemplate = new Template(context.asAbsolutePath(path.join('templates', 'defaults', 'fallback.hbs')))

	const myCommandId = 'starpost-copy-selection';
	
	let myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1000);
	myStatusBarItem.command = myCommandId;
	context.subscriptions.push(myStatusBarItem);
	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(updateStatusBarItem));
	context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(updateStatusBarItem));
	
	function updateStatusBarItem() {
		if (vscode.window.activeTextEditor.selection) {
			myStatusBarItem.text = `$(star-half) StarPost - Copy selection`;
			myStatusBarItem.show();
		} else {
			myStatusBarItem.hide();
		}
	}
	
	context.subscriptions.push(vscode.commands.registerCommand(myCommandId, async () => {
		const data = await getTargetContextData();
		const fancyStr = gitTemplate.generate(data);
		await vscode.env.clipboard.writeText(fancyStr);
		myStatusBarItem.text = `$(star-half) StarPost - Copied $(check-all)`;
		setTimeout(() => myStatusBarItem.text = `$(star-half) StarPost - Copy selection`, 1500)
	}));

	updateStatusBarItem();
}


function deactivate() { }

module.exports = {
	activate,
	deactivate
}

