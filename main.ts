import { App, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
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
  public readonly cleanupOmittedFiles = async (): Promise<void> => {
  // TODO?: remove trailing '/' from folder paths
  }
*/

	public async onload() {
		console.log('Findex: loading plugin v' + this.manifest.version);

		await this.loadData();
		console.log('loaded Data: ', this.data)

		// Extract the index building functionality into a separate method
		const buildFolderIndex = async (dirPath: string) => {
			// do not index omittedFolders
			if(this.data.omittedFolders.map(item => { return path.basename(item); }).includes(path.basename(dirPath))) { 
				return; 
			}

			const getSortedFiles = async (dir) => {
				return fs.readdirSync(dir).filter(item => 
					fs.statSync(path.join(dir, item)).isFile() && 
					!item.startsWith('.') && 
					!item.startsWith('idx-') &&
					item.endsWith('.md')
				).sort((a, b) => 
					fs.statSync(path.join(dir, b)).mtime.getTime() - 
					fs.statSync(path.join(dir, a)).mtime.getTime()
				);
			};

			try {
				// Get sorted files first
				const files = await getSortedFiles(dirPath);
				
				// Define index file path
				const findexFile = path.join(dirPath, ('idx-' + path.basename(dirPath) + '.md').toLowerCase());
				let indexHeader = path.join(dirPath, '.indexHeading.md');
				
				console.log('the list of files: ', files);
				console.log('the index file: ', findexFile);

					// Create or update index file with header
				let headerContent = '';
				if (fs.existsSync(indexHeader)) {
					// Use custom header if it exists
					fs.copyFileSync(indexHeader, findexFile);
				} else {
					// Create default header
					headerContent = `# A list of files in ${path.basename(dirPath)}` + '\n\n';
				}
				// write header to index file (create it if it does not exist)
				fs.writeFileSync(findexFile, headerContent, 'utf8');
				
				// Add file entries to the index
				for (const i of Object.keys(files)) {
					fs.appendFileSync(findexFile, ` - [[${files[i]}]]  ` + '\n', 'utf-8');
				}
				new Notice(`Updated index for ${path.basename(dirPath)}`);
			} catch (error) {
				console.error("Error building index:", error);
				new Notice(`Error updating index for ${path.basename(dirPath)}`);
			}
		};

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('list-x', 'Folder Listing', (evt: MouseEvent) => {
			// called when the user clicks the icon.
			this.loadData();
			const activeFile = this.app.workspace.getActiveFile();
			if (!activeFile) {
				new Notice('No active file selected');
				return;
			}

			const dirPath = path.join(this.app.vault.adapter.basePath, activeFile.parent.path);
			buildFolderIndex(dirPath);
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new FindexSettingTab(this.app, this));

		// Register event for file modifications
		this.registerEvent(
			this.app.vault.on('modify', (file) => {
				if (!file || file.path.includes('idx-')) return; // Skip index files

				const activeFile = this.app.workspace.getActiveFile();
				if (!activeFile) return;

				const parentPath = activeFile.parent.path;
				const fileDirPath = file.parent?.path;

				if (fileDirPath === parentPath) {
					const dirPath = path.join(this.app.vault.adapter.basePath, parentPath);
					buildFolderIndex(dirPath);
				}
			})
		);

		// Register event for file creation
		this.registerEvent(
			this.app.vault.on('create', (file) => {
				if (!file || file.path.includes('idx-')) return; // Skip index files

				const activeFile = this.app.workspace.getActiveFile();
				if (!activeFile) return;

				const parentPath = activeFile.parent.path;
				const fileDirPath = file.parent?.path;

				if (fileDirPath === parentPath) {
					const dirPath = path.join(this.app.vault.adapter.basePath, parentPath);
					buildFolderIndex(dirPath);
				}
			})
		);

		// Register event for file deletion
		this.registerEvent(
			this.app.vault.on('delete', (file) => {
				if (!file || file.path.includes('idx-')) return; // Skip index files

				const activeFile = this.app.workspace.getActiveFile();
				if (!activeFile) return;

				const parentPath = activeFile.parent.path;
				const fileDirPath = file.parent?.path;

				if (fileDirPath === parentPath) {
					const dirPath = path.join(this.app.vault.adapter.basePath, parentPath);
					buildFolderIndex(dirPath);
				}
			})
		);

		// If the plugin hooks up any global DOM events (on parts of the app that do not belong to this plugin)
		// Using this function automatically removes the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function automatically clears the interval when the plugin is disabled.
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
	  			this.plugin.data.omittedFolders = patterns.split('\n').map((item) => { return item.endsWith('/') ? item.slice(0,-1) : item;});
//				console.log(' -- ',this.plugin.data.omittedFolders);
					this.plugin.saveData();
				};
			});
	}
}
