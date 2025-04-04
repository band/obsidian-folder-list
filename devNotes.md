# development notes

### 2024-04-14:
 - possible short names for this list of files in a folder: `flistof`,
   `findex`  

 - working on figuring out how this code works; using
   "recent-files-obsidian" plugin for guidance (but, be careful of
   GPL)  
   
 - TODAYS UPDATE: able to gather `omittedPaths` info from Settings
   tab; use `loadData()` and `saveData()` functions  
   - still not sure how to store the `omittedPaths` data for future
     use  

 - next steps (a.k.a. TODOs):
  - change 'Paths' to 'Folders'
  - figure out how to get list of folders to ignore  
  - clean up `main.ts` so that I, at least, can understand how the
    code works  
  - then figure out if all the Obsidian Plug-in steps are worth it  

### 2024-04-23:
 - removing `tsc -noEmit -skipLibCheck` from `build:` script allowed
   production of a draft release  
   (what a day of trial and error go rounds)  
   (learnings: (1) use of `tsc`; (2) still uncertain about the code
   quality)  
   
 - still do not understand how to go from Release "draft" to "publish"
   and still have all the assets needed (only the source code seems to
   be packaged with the release). I do not understand how all these
   parts are related to each other.  
   
   
 - TODOs:
   - test this draft release output  
   - perhaps ready to try and use BRAT?  
   
### 2025-04-04:
 - it has been a year since this work paused; now the TODO is to pick
   up where it was left; see what is new regarding Obsidian plugin
   development; and maybe get it to work the way I envision it to
   work.
   
 
