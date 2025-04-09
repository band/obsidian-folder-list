import {
		App,
		Notice,
		Plugin,
		PluginSettingTab,
		Setting,
		TAbstractFile,
		TFile,
		TFolder,
} from 'obsidian';
import * as fs from 'fs';
import * as path from 'path';

interface FindexData {
		omittedFolders: string[];
		debug: boolean;
}

const DEFAULT_DATA: FindexData = {
		omittedFolders: [],
		debug: false,
};

export default class FindexPlugin extends Plugin {
		private updateDebounceTimers: Record<string, NodeJS.Timeout> = {};

		public data: FindexData;

		public async loadData(): Promise<void> {
				this.data = Object.assign(DEFAULT_DATA, await super.loadData());
		}

		public async saveData(): Promise<void> {
				await super.saveData(this.data);
		}

		private log(message: string, ...args: unknown[]): void {
				if (this.data.debug) {
						console.log(`[Findex] ${message}`, ...args);
				}
		}

		private async isFolderEmpty(dirPath: string): Promise<boolean> {
				this.log(`isFolderEmpty - ${dirPath}`);
				const folder = this.app.vault.getAbstractFileByPath(dirPath);
				if (!(folder instanceof TFolder)) {
						throw new Error(`${dirPath} is not a folder`);
				}

				const files = folder.children.filter(
						(item) => item instanceof TFile && !item.name.startsWith('idx-')
				);

				return files.length === 0;
		}

		private async writeFile(filePath: string, content: string): Promise<void> {
				const file = this.app.vault.getAbstractFileByPath(filePath);
				if (file instanceof TFile) {
						await this.app.vault.modify(file, content);
				} else {
						await this.app.vault.create(filePath, content);
				}
		}

		private async appendToFile(filePath: string, content: string): Promise<void> {
				const file = this.app.vault.getAbstractFileByPath(filePath);
				if (file instanceof TFile) {
						const existingContent = await this.app.vault.read(file);
						await this.app.vault.modify(file, existingContent + content);
				} else {
						await this.app.vault.create(filePath, content);
				}
		}

		private async deleteFile(filePath: string): Promise<void> {
				const file = this.app.vault.getAbstractFileByPath(filePath);
				if (file instanceof TFile) {
						await this.app.vault.delete(file);
				}
		}

		public async onload() {
				console.log(`Findex: loading plugin v${this.manifest.version}`);

				await this.loadData();
				this.log('loaded Data: ', this.data);

				// Extract the index building functionality into a separate method
				const buildFolderIndex = async (dirPath: string) => {
						const folder = this.app.vault.getAbstractFileByPath(dirPath)
						if (!(folder instanceof TFolder)) {
								new Notice(`${dirPath} is not a valid folder`)
								return
						}
								
								if (
										this.data.omittedFolders
												.map((item) => path.basename(item))
												.includes(path.basename(dirPath))
								) {
										return;
								}

								const getSortedFiles = async (dir: string): Promise<string[]> => {
										const folder = this.app.vault.getAbstractFileByPath(dir);
										if (!(folder instanceof TFolder)) {
												throw new Error(`${dir} is not a folder`);
										}

										const filesInDir = folder.children.filter(
												(item) => 
												item instanceof TFile && 
														item.extension === 'md' && 
														!item.name.startsWith('idx-') && 
														item.name !== '.indexHeading.md'
										) as TFile[];

										return filesInDir
												.map((file) => file.path)
												.sort(
														(a, b) =>
														(this.app.vault.getAbstractFileByPath(b) as TFile)?.stat.mtime -
														(this.app.vault.getAbstractFileByPath(a) as TFile)?.stat.mtime
												);
								};

								try {
										const files = await getSortedFiles(dirPath);

										const findexFile = path.join(
												dirPath,
												`idx-${path.basename(dirPath)}.md`.toLowerCase()
										);
										const indexHeader = path.join(dirPath, '.indexHeading.md');

										this.log('The list of files:', files);
										this.log('The index file:', findexFile);

										let headerContent = '';
										if (this.app.vault.getAbstractFileByPath(indexHeader)) {
												const headerFile = this.app.vault.getAbstractFileByPath(
														indexHeader
												) as TFile;
												headerContent = await this.app.vault.read(headerFile);
										} else {
												headerContent = `# A list of files in ${path.basename(dirPath)}\n\n`;
										}

										await this.writeFile(findexFile, headerContent);

										for (const file of files) {
												await this.appendToFile(findexFile, ` - [[${file}]]\n`);
										}

										new Notice(`Updated index for ${path.basename(dirPath)}`);
								} catch (error) {
										console.error('Error building index:', error);
										new Notice(`Error updating index for ${path.basename(dirPath)}`);
								}
							 };

						// This creates an icon in the left ribbon.
						const ribbonIconEl = this.addRibbonIcon(
								'list-x',
								'Folder Listing',
								(evt: MouseEvent) => {
										// called when the user clicks the icon.
										this.loadData();
										const activeFile = this.app.workspace.getActiveFile();
										if (!activeFile) {
												new Notice('No active file selected');
												return;
										}

										const dirPath = activeFile.parent?.path ?? '';
										if (!dirPath) {
												new Notice('Cannot determine parent folder')
												return
										}
										
										this.log('ribbonIconEL - dirPath ', dirPath);
										buildFolderIndex(dirPath);
								}
						);

						const handleFileEvent = async (file: TAbstractFile) => {
								this.log('handleFileEvent - file.path', file.path);

								if (
										!file ||
												file.path.includes('idx-') ||
												file.path.endsWith('.indexHeading.md')
								) {
										return;
								}

								const activeFile = this.app.workspace.getActiveFile();
								if (!activeFile) {
										return;
								}

								const parentPath = activeFile.parent?.path;
								if (!parentPath) {
										return;
								}

								if (file.parent?.path === parentPath) {
										const dirPath = parentPath;

										if (this.updateDebounceTimers[dirPath]) {
												clearTimeout(this.updateDebounceTimers[dirPath]);
										}

										this.updateDebounceTimers[dirPath] = setTimeout(async () => {
												if (await this.isFolderEmpty(dirPath)) {
														const findexFile = path.join(
																dirPath,
																`idx-${path.basename(dirPath)}.md`.toLowerCase()
														);

														if (this.app.vault.getAbstractFileByPath(findexFile)) {
																await this.deleteFile(findexFile);
																this.log('Deleted index file:', findexFile);
																new Notice(`Deleted index for ${path.basename(dirPath)}`);
														}
												} else {
														// Rebuild index if directory is not empty
														await buildFolderIndex(dirPath);
												}

												delete this.updateDebounceTimers[dirPath];
										}, 3000); // 3-second delay
								}
						};

						// Register event for file ops using common handler
						this.registerEvent(this.app.vault.on('modify', handleFileEvent));
						this.registerEvent(this.app.vault.on('create', handleFileEvent));
						this.registerEvent(this.app.vault.on('delete', handleFileEvent));
						this.registerEvent(this.app.vault.on('rename', handleFileEvent));

						// This adds a settings tab so the user can configure various aspects of the plugin
						this.addSettingTab(new FindexSettingTab(this.app, this));

						// If the plugin hooks up any global DOM events (on parts of the app that do not belong to this plugin)
						// Using this function automatically removes the event listener when this plugin is disabled.
						this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
								//			this.log('click', evt);
						});

						// When registering intervals, this function automatically clears the interval when the plugin is disabled.
						this.registerInterval(
								window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000)
						);
				}

				onunload() {}
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
						console.log(
								'plugin.data.omittedFolders: ',
								this.plugin.data.omittedFolders
						);

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

										textArea.inputEl.onblur = async (e: FocusEvent) => {
												const patterns = (e.target as HTMLInputElement).value;
												this.plugin.data.omittedFolders = patterns.split('\n').map((item) => {
														return item.endsWith('/') ? item.slice(0, -1) : item;
												});
												// console.log(' -- ',this.plugin.data.omittedFolders);
												await this.plugin.saveData();
										};
								});

						// Add debug toggle
						new Setting(containerEl)
								.setName('Enable debug mode')
								.setDesc(
										'When enabled, detailed logs will be printed to the developer console'
								)
								.addToggle((toggle) =>
										toggle.setValue(this.plugin.data.debug).onChange(async (value) => {
												this.plugin.data.debug = value;
												await this.plugin.saveData();
										})
								);
				}
		}
