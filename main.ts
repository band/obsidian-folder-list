import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

// Remember to rename these classes and interfaces!

interface FindexSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: FindexSettings = {
	mySetting: 'default'
}

interface FindexData {
	  omittedPaths: string[];
}

const DEFAULT_DATA: FindexData = {
      omittedPaths: [],
};

export default class Findex extends Plugin {
	settings: FindexSettings;

	async onload() {
	      console.log('Findex: loading plugin v' + this.manifest.version);
	      
	      await this.loadData();
//	      await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			function listFiles(directoryPath: string): Promise<string[]> {
			    return new Promise((resolve, reject) => {
			        fs.readdir(directoryPath, (err, files) => {
				    if (err) {
				        reject('Unable to scan directory: ' + err);
				    } else {
				      	// filter out dofiles and files that start with "idx-"
					let filteredFiles = files.filter(file => !file.startsWith('.') && !file.startsWith('idx-'));
					resolve(filteredFiles);
				    }
				});
			    });
			}

			const readdir = util.promisify(fs.readdir);
			const stat = util.promisify(fs.stat);

			async function getFiles(directoryPath: string): Promise<string[]> {
			    // Get the files in the directory
			    let files = await readdir(directoryPath);
			    // Filter out dotfiles and files that start with "idx-"
			    let filteredFiles = files.filter(file => !file.startsWith('.') && !file.startsWith('idx-'));
			    // Get the stats for each file
			    let stats = await Promise.all(filteredFiles.map(file => stat(path.join(directoryPath, file))));
			    // Pair each file with its stats
			    let fileStats = filteredFiles.map((file, index) => ({file, stats: stats[index]}));
			    // Sort the files by modification date, most recent first
			    fileStats.sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());
			    // Return the sorted list of file names
			    return fileStats.map(fileStat => fileStat.file);
			}

			const dirPath = path.join(this.app.vault.adapter.basePath, this.app.workspace.getActiveFile().parent.path);
//			const findexFile = path.join(this.app.vault.adapter.basePath, 'folder-index.md')
			const findexFile = path.join(this.app.vault.adapter.basePath, 'idx-' + path.basename(dirPath))			
			let indexHeader = path.join(dirPath, '.indexHeading.md');
			fs.copyFile(indexHeader, findexFile, () => {
			    console.log('Header file copy successful');
			});
			let fileList: string[];
			getFiles(dirPath)
			    .then(files => {
			        fileList = files;
				console.log(fileList);
				console.log('the index file: ', findexFile);
				fileList.forEach((file) => {
				    console.log('the file: ', file);
				    fs.appendFile(findexFile, ` - [[${file}]]  ` + '\n', (err) => {
				        if (err) {
					    console.error('Error writing file:', err);
					} else {
					    console.log('File name write successful');
					}
				    });
				});
			    })
			    .catch(error => console.error(error));

			new Notice(dirPath);
		});
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

		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: Findex;

	constructor(app: App, plugin: Findex) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();
		containerEl.createEl('h2', { text: 'Folder indexing' });

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
		      .setValue(this.plugin.data.omittedPaths.join('\n'));
		  textArea.inputEl.onblur = (e: FocusEvent) => {
		        const patterns = (e.target as HTMLInputElement).value;
			this.plugin.data.omittedPaths = patterns.split('\n');
			this.plugin.pruneOmittedFiles();
			this.plugin.view.redraw();
		  };
	        });
	}
}
