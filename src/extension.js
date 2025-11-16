import { relative, basename, join } from 'path';
import { readFileSync } from 'fs';
import { window, extensions, StatusBarAlignment, commands, env } from 'vscode';
import Handlebars from 'handlebars';


async function getTargetContextData() {
	const selection = window.activeTextEditor.selection;
	const selectedText = window.activeTextEditor.document.getText(selection);
	const editor = window.activeTextEditor;
	const uri = editor.document.uri;
	let data = {
		file: uri.fsPath,
		start: selection.start.line,
		end: selection.end.line,
		language: editor.document.languageId,
		code: selectedText
	};
	let containsGitData = false;
	try {
		const gitExtension = extensions.getExtension('vscode.git').exports;
		const api = gitExtension.getAPI(1);
		const repo = api.repositories.find(r => uri.fsPath.startsWith(r.rootUri.fsPath));
		const currentBranch = repo.state.HEAD.name
		const branchDetails = await repo.getBranch(currentBranch);
		const changes = repo.state.workingTreeChanges;
		const staged = repo.state.indexChanges;
		const merge = repo.state.mergeChanges;
		const untrackedCount = changes.filter(c => c.status === 7).length;

		const gitData = {
			file: relative(repo.rootUri.fsPath, uri.fsPath),
			repo: basename(repo.rootUri.fsPath),
			branch: repo.state.HEAD.name,
			commit: repo.state.HEAD.commit.slice(0, 7),
			status: `${branchDetails.ahead}, ${branchDetails.behind}`,
			stagedCount: staged.length,
			unstagedCount: changes.length,
			untrackedCount,
			mergeInProgress: merge.length > 0,
		}
		data = { ...data, ...gitData };
		containsGitData = true;
	} catch (err) {
		console.error(err);
	}

	return { data, useFallback: !containsGitData };
}

class Template {
	constructor(templatePath) {
		this.templatePath = templatePath;
		const templateSrc = readFileSync(templatePath, 'utf-8');
		this.template = Handlebars.compile(templateSrc, { noEscape: true });
	}
	generate(data) {
		return this.template(data);
	}
}


/**
 * @param {vscode.ExtensionContext} context
 */
export function activate(context) {
	const gitTemplate = new Template(context.asAbsolutePath(join('templates', 'defaults', 'gitEnabled.hbs')));
	const fallbackTemplate = new Template(context.asAbsolutePath(join('templates', 'defaults', 'fallback.hbs')))

	const myCommandId = 'starpost-copy-selection';

	let myStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 1000);
	myStatusBarItem.command = myCommandId;
	context.subscriptions.push(myStatusBarItem);
	context.subscriptions.push(window.onDidChangeActiveTextEditor(updateStatusBarItem));
	context.subscriptions.push(window.onDidChangeTextEditorSelection(updateStatusBarItem));

	function updateStatusBarItem() {
		const selection = window.activeTextEditor.selection;
		if (selection && !selection.isEmpty) {
			myStatusBarItem.text = `$(star-half) StarPost - Copy selection`;
			myStatusBarItem.show();
		} else {
			myStatusBarItem.hide();
		}
	}

	context.subscriptions.push(commands.registerCommand(myCommandId, async () => {
		const { data, useFallback } = await getTargetContextData();
		const template = useFallback ? fallbackTemplate : gitTemplate;
		const fancyStr = template.generate(data);
		await env.clipboard.writeText(fancyStr);
		myStatusBarItem.text = `$(star-half) StarPost - Copied $(check-all)`;
		setTimeout(() => myStatusBarItem.text = `$(star-half) StarPost - Copy selection`, 1500)
	}));

	updateStatusBarItem();
}


export function deactivate() { }

