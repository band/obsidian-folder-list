import { App, FileStat, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

interface FindexData {
	omittedFolders: string[];
}

const DEFAULT_DATA: FindexData = {
	omittedFolders: [],
};

export default class FindexPlugin extends Plugin {
	public data: FindexData;

  public async loadData(): Promise<void> {
    this.data = Object.assign(DEFAULT_DATA, await super.loadData());
  }

  public async saveData(): Promise<void> {
    await super.saveData(this.data);
  }

/*
  public readonly pruneOmittedFiles = async (): Promise<void> => {
  // TODO?: remove trailing '/' from folder paths
  }
*/
		
	public async onload() {
		console.log('Findex: loading plugin v' + this.manifest.version);

		await this.loadData();
//		console.log('loaded Data: ', this.data)

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
			// called when the user clicks the icon.
			const dirPath = path.join(this.app.vault.adapter.basePath, this.app.workspace.getActiveFile().parent.path);
			console.log(this.data.omittedFolders);
			console.log(path.parse(dirPath));
				// do not index omittedFolders
			if (this.data.omittedFolders.includes(path.parse(dirPath).name)) {
					return;
			}
			const getSortedFiles = async (dir) => {
					return fs.readdirSync(dir).filter(item => fs.statSync(path.join(dir, item)).isFile() && !item.startsWith('.') && !item.startsWith('idx-')).sort((a, b) => fs.statSync(path.join(dir, b)).mtime.getTime() - fs.statSync(path.join(dir, a)).mtime.getTime());
			};

			const findexFile = path.join(dirPath, ('idx-' + path.basename(dirPath) + '.md').toLowerCase());
			let indexHeader = path.join(dirPath, '.indexHeading.md');
			// create index header if needed
			if (fs.existsSync(indexHeader)) {
				fs.copyFileSync(indexHeader, findexFile);
			} else {
				fs.writeFileSync(findexFile, `# A list of files in ${path.basename(dirPath)}` + '\n\n', 'utf8');
			}

			getSortedFiles(dirPath)
				.then(files => {
					console.log('the list of files: ', files)
					console.log('the index file: ', findexFile);
					for (const i of Object.keys(files)) {
						//				    console.log('the file: ', files[i])
						fs.appendFileSync(findexFile, ` - [[${files[i]}]]  ` + '\n', (err) => {
							if (err) {
								console.error('Error writing file:', err);
							} else {
								console.log('File name write successful');
							}
						});
					}
				})
				.catch(error => console.error(error));

			new Notice(dirPath);
		});
		/*
				// Perform additional things with the ribbon
				ribbonIconEl.addClass('findex-ribbon-class');
		
				// This adds a simple command that can be triggered anywhere
				this.addCommand({
					id: 'open-sample-modal-simple',
					name: 'Open sample modal (simple)',
					callback: () => {
						new SampleModal(this.app).open();
					}
				});
		*/

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new FindexSettingTab(this.app, this));

		this.registerEvent(
			this.app.vault.on('modify', (file) => {
				console.log('regEvent file: ', file);
				//		    const dirPath = path.join(this.app.vault.adapter.basePath, this.app.workspace.getActiveFile().parent.path);
				const pPath = this.app.workspace.getActiveFile().parent.path;
				console.log('regEvent pPath: ', pPath);
				if (file.path.startsWith(pPath) || pPath === "/") {
					console.log(`File modified in ActiveFile directory: ${file.name}`);
				}
			})
		);

		// If the plugin hooks up any global DOM events (on parts of the app that do not belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {
	}
}

class FindexSettingTab extends PluginSettingTab {
private readonly plugin: FindexPlugin;

	constructor(app: App, plugin: FindexPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	public display(): void {
		const { containerEl } = this;

		console.log('this.plugin ', this.plugin);
		console.log('plugin.data.omittedFolders: ', this.plugin.data.omittedFolders)

		containerEl.empty();
		containerEl.createEl('h2', { text: 'Findex: folder indexing' });

		const fragment = document.createDocumentFragment();
		const link = document.createElement('a');
		link.href =
			'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#writing_a_regular_expression_pattern';
		link.text = 'MDN - Regular expressions';
		fragment.append('RegExp patterns to ignore. One pattern per line. See ');
		fragment.append(link);
		fragment.append(' for help.');

		new Setting(containerEl)
			.setName('Omitted folder pathname patterns')
			.setDesc(fragment)
			.addTextArea((textArea) => {
				textArea.inputEl.setAttr('rows', 6);
				textArea
					.setPlaceholder('^daily/\n\\.png$\nfoobar.*baz')
   				.setValue(this.plugin.data.omittedFolders.join('\n'));
				textArea.inputEl.onblur = (e: FocusEvent) => {
					const patterns = (e.target as HTMLInputElement).value;
						this.plugin.data.omittedFolders = patterns.replace(/\//g,'').split('\n');
//					console.log(' -- ',this.plugin.data.omittedFolders);
					this.plugin.saveData();
				};
			});
	}
}
