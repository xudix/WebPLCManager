//import SMB2 from '@marsaud/smb2';
import * as fsync from 'fs';
import * as fs from "fs/promises";
import { Readable } from 'stream';
import { finished } from 'stream/promises';
import * as path from "node:path";
import fetch from 'node-fetch';
import { RemoteLogger } from './RemoteLogger.js';
import EventEmitter from 'events';


/**
 * Gets files from PLC and local data files (.lp, Influx line protocol),
 * and write to influx data base.
 */
export class Pusher extends EventEmitter {

    /**
     * 
     * @param {*} conf 
     * @param {RemoteLogger} remoteLogger 
     */
    constructor(conf, remoteLogger) {
        super();
        this.remoteLogger = remoteLogger; // The only purpose to have this remoteLogger object is to call its switchFile() method
        this.conf = conf;
        /**
         * Max number of files processed every time
         * @type {number}
         */
        this.fileCount = 4;
        /**
         * Directory where data files are stored locally. 
         */
        this.dataDir = this.conf.loggingConfig.logPath;
        this.tempFile = path.join(this.dataDir, ".temp_");
        this.api = "/api/v2/write?precision=ms&bucket=";
        
        this.log = {
            info : (...args) => {
                let msg = "";
                args.forEach(arg => msg += this._msgToString(arg) + "\n");
                this.emit("log", "info", msg);
            },
            warn : (...args) => {
                let msg = "";
                args.forEach(arg => msg += this._msgToString(arg) + "\n");
                this.emit("log", "warn", msg);
            },
            error : (...args) => {
                let msg = "";
                args.forEach(arg => msg += this._msgToString(arg) + "\n");
                this.emit("log", "error", msg);
            }
        }
        
        //this.log = console;


        this.influxKeys = [];
        for (let key in this.conf.influx) {
            this.influxKeys.push(key);
            this.allInfluxKeys = this.allInfluxKeys + "." + key;
        }
        this.log.info("Pusher started.");

        setInterval(() => {
            this.run();
        }, this.conf.pushInterval);
    }

    async run() {
        this.processLocalFiles(this.fileCount);
        fetch(this.conf.PLCloggerURL+"/api/log-status").then(res => {
            res.json().then((result) => {
                this.log.info("PLC Logging status: ", JSON.stringify(result));
                this.loggingStatus = result;
            });
            this.processPLCFiles();
        }).catch(err => {
            //console.error(`Failed to connect to logger ${loggerURL}. `, err);
            this.loggingStatus = err;
            this.log.error(`Failed to connect to PLC logger ${this.conf.PLCloggerURL}. `)
        });
    }

    /**
     * Ask the PLC logger to stop the current file, then try to get all files from the PLC.
     */
    async processPLCFiles(){
        // Ask the PLC logger to stop the current file
        return fetch(this.conf.PLCloggerURL+"/api/log-files").then( res => {
            if(res.ok){
                res.json().then(async fileNames => {
                    for(let i = 0; i < Math.min(fileNames.length, this.fileCount); i++){
                        await this.fetchPLCFile(fileNames[i]).then(async () => {
                            await this.deletePLCFile(fileNames[i]);
                        }).catch(err => {
                            this.log.error(`Failed to get file ${fileNames[i]}`, err);
                        });
                    }
                })
            }
            else{
                this.log.error(`Failed to get log file info with HTTP Error Response: ${res.status} ${res.statusText}`);
            }
        })
        .catch(err => this.log.error(`Failed to get log file info.`, err));
    }


    async fetchPLCFile(fileName){
        return fetch(this.conf.PLCloggerURL+"/api/log-file/"+fileName).then(async res => {
            if (res.ok){
                if(!fsync.existsSync(this.dataDir)){
                    await fs.mkdir(this.dataDir);
                }
                const newName = path.join(this.dataDir, fileName.replace(/.lp$/, this.allInfluxKeys + ".lp"));
                const writeStream = fsync.createWriteStream(newName ,{flags: 'w', encoding:'binary'});
                await finished(res.body.pipe(writeStream));
            }
            else{
                throw new Error(`Failed to fetch file ${fileName} with HTTP Error Response: ${res.status} ${res.statusText}.`)
            }
        }).catch(err => {throw err;});
    }


    async deletePLCFile(fileName){
        return fetch(this.conf.PLCloggerURL + "/api/log-file/" + fileName, {
                    method: "DELETE"
                }).catch((err) => this.log.error(`Failed to delete ${fileName} from server.`, err));
    }

    // async listRemoteFiles(maxFiles) {
    //     return this.smbReaddirAsync(this.conf.smb2source.path)
    //         .then(files => {
    //             let found = [];
    //             for (let filename of files){
    //                 if(found.length >= maxFiles){break;}
    //                 if (filename.endsWith('.lp')){
    //                     found.push(filename);
    //                 }
    //             }
    //             return found;
    //         })
    //         .catch((err) => this.log.error(`Error reading PLC files.`, err))
    // }

    // //copies the file with filename from the remote to the local file system and inserts all the influx targets into the name
    // async copyFileFromRemote(filename) {
    //     return new Promise(async (resolve, reject) => {
    //         let readStream = await this.smbClient.createReadStream(filename);
    //         let writeStream = fsync.createWriteStream(this.tempFile + filename);
    //         let done = false;
    //         // Listen for the 'end' event on the read stream to know when there is no more data to read
    //         readStream.on('end', () => {

    //             // Listen for the 'finish' event on the write stream to know when all data has been written
    //             writeStream.on('finish', () => {
    //                 done = true;
    //                 resolve(true);
    //             });
    //         });

    //         readStream.pipe(writeStream);

    //         // Handle errors
    //         readStream.on('error', (err) => {
    //             if (!done) {
    //                 this.log.error(`readStream error ${filename}`);
    //                 // console.log(`readStream error ${dirPath}`);
    //                 reject(err);
    //             }
    //         });
    //         writeStream.on('error', (err) => {
    //             if (!done) {
    //                 this.log.error(`writeSteam error ${filename}`);
    //                 // console.log(`writeSteam error ${dirPath}`);
    //                 reject(err);
    //             }
    //         });
    //     })
    //         .then((success) => {
    //             if (success) {
    //                 let proms = [];
    //                 fetch(this.conf.PLCloggerURL + "/api/log-file/" + filename, {
    //                     method: "DELETE"
    //                 }).catch((err) => this.log.error(`Failed to delete ${filename} from server.`, err));
    //                 const newName = path.join(this.dataDir, filename.replace(/.lp$/, this.allInfluxKeys + ".lp"));
    //                 proms.push(fs.rename(this.tempFile + filename, newName));
    //                 proms.push(new Promise(resolve => setTimeout(resolve, 2000)));  // add a delay. Otherwise smb won't copy multiple files.
    //                 return Promise.all(proms).then(() => {
    //                     return newName;
    //                 });
    //             }
    //             else {
    //                 this.log.error("smb transfer failed or incomplete")
    //                 //console.log("smb transfer failed or incomplete");
    //                 smbClient.disconnect();
    //                 return null;
    //             }
    //         })
    //         .catch((err) => {
    //             this.log.error(`error in smb2 ${filename}.`, err);
    //             this.smbClient.disconnect();
    //             // console.log(`error in smb2 ${dirPath}\n${err}`);
    //         });
    // }

    // //cound just be done with promisify?
    // smbReaddirAsync(dirPath){
    //     //return new Promise(async (resolve, reject) => {   //why async?
    //     return new Promise((resolve, reject) => {
    //     try {
    //         //await fs.access(dirPath);
    //         this.smbClient.readdir(dirPath, (err, files) => {
    //         if (err) {
    //             reject(err);
    //         } else {
    //             resolve(files);
    //         }
    //         });
    //     } catch (err) {
    //         reject(err);
    //         this.smbClient.close();
    //     }
    //     });
    // };

    /**
     * Scan through the dataDir, find files that ends with .new.lp and rename them into 
     * @param {number} maxFiles maximum number of files to process in each run
     */
    async processLocalFiles(maxFiles) {
        fs.readdir(this.dataDir).then(async (localFileNames) => {
            //console.log(`Found local files ${localFileNames.toString()}`);
            if (localFileNames.length > 0) {
                let processedFiles = 0;
                localFileNames.sort((a, b) => a > b ? -1 : (a < b ? 1 : 0)); // make sure we process new files first
                for (let filename of localFileNames) {
                    let currentFile = path.join(this.dataDir, filename);
                    if (processedFiles >= maxFiles) {
                        break;
                    } else if (filename.endsWith(".new.lp")) {   // new file generated by the remote logger.
                        let oldName = currentFile;
                        let newName = oldName.replace(/.new.lp$/, this.allInfluxKeys + ".lp");
                        await fs.rename(oldName, newName)
                            .then(() => {
                                currentFile = newName;
                            })
                            .catch((err) => this.log.error(`Failed to rename ${oldName}.`, err));
                    } 
                    else if (filename.endsWith("invalid")){
                        this.handleInvalidFile(currentFile);
                        continue;
                    }
                    else if (!filename.endsWith(".lp")) {
                        // not a .lp file. do not write it to Influx
                        continue;
                    }
                    processedFiles++;
                    // Now send the file to Influx
                    for (let key in this.conf.influx) {
                        //console.log(conf.influx[key]);
                        if (currentFile.includes(key)) {
                            currentFile = await this.writeFileToInflux(currentFile, key);
                        }
                    }
                }
            }
        });
    }


    /**
     * pushes a file to the specified influx
     * upon success it removes the influx id from the filename, and if there are no more 
     * influx tasks left the file is deleted
     * @param {*} fileName 
     * @param {*} influxID 
     * @returns 
     */
    async writeFileToInflux(fileName, influxID) {
        console.log(`writing ${fileName} to ${influxID}`);
        const fileHandle = await fs.open(fileName)
            .catch(error => {
                this.log.error(`Error opening ${fileName}: `, error);
                return null
            });
        if(fileHandle){
            const readable = fileHandle.createReadStream();
            const options = {
                method: 'POST',
                body: readable,
                headers: {
                    //'Content-Type': 'text/plain; charset=utf-8',
                    'Content-Type': 'application/octet-stream',
                    'Accept': 'application/json',
                    'Authorization': 'Token ' + this.conf.influx[influxID].token
                }
            }

            //console.log(`writing to ${this.conf.influx[influxID].URL}${this.api}${this.conf.influx[influxID].bucket}&org=${this.conf.influx[influxID].org}`);
            return fetch(`${this.conf.influx[influxID].URL}${this.api}${this.conf.influx[influxID].bucket}&org=${this.conf.influx[influxID].org}`, options)
                .then(async response => {
                    await fileHandle.close();
                    if (response.ok) {
                        this.log.info(`Uploaded ${fileName} to ${influxID} sucessfully!`)
                        return this.stripFromFileName(fileName, influxID).catch(err => this.log.error(`Failed to rename or delete file ${fileName}.`, err));
                    }
                    else {
                        let resJSON = await response.json();
                        if (resJSON.code == "invalid") {
                            //this.log.warn(`Invalid file: ${fileName} to ${influxID}.`, resJSON);
                            await fs.rename(fileName, fileName+"_invalid");
                            return Promise.resolve("");
                        }
                        else {
                            throw new Error("HTTP ERROR:\n"+this._msgToString(resJSON))
                        }
                    }
                })
                .catch((error) => {
                    this.log.error(`Error uploading file: ${fileName} to ${influxID}.`, error);
                    return fileName;
                });
        }
        else{
            return Promise.reject(`Failed to open ${fileName}.`);
        }
        
    }

    async handleInvalidFile(fileName){
        if(!this._busyHandlingInvalid){
            this._busyHandlingInvalid = true;
            for (let influxID in this.conf.influx) {
                //console.log(conf.influx[key]);
                if (fileName.includes(influxID)) {
                    fileName = await this.writeLinesToInflux(fileName, influxID);
                }
            }
            this._busyHandlingInvalid = false;
        }
    }

    

    async writeLinesToInflux(fileName, influxID){
        let badData = "";
        const options = {
            method: 'POST',
            body: null,
            headers: {
                //'Content-Type': 'text/plain; charset=utf-8',
                'Content-Type': 'application/octet-stream',
                'Accept': 'application/json',
                'Authorization': 'Token ' + this.conf.influx[influxID].token
            }
        }
        return fs.open(fileName).then(async (file) => {
            for await(const line of file.readLines()){
                options.body = line;
                //this.log.info(`Writing line to ${influxID}`, line)
                await fetch(`${this.conf.influx[influxID].URL}${this.api}${this.conf.influx[influxID].bucket}&org=${this.conf.influx[influxID].org}`, options)
                    .then(async (response) => {
                        if(!response.ok){
                            badData += line;
                            let text = await response.text();
                            this.log.error("HTTP ERROR!", text);
                        }
                    })
                    .catch(error => {
                        badData += line;
                        this.log.error(`Error uploading line to ${influxID}.`, error);
                    })
                await this._sleep(500);
            }
            await file.close();
            if(badData != ""){
                await fs.writeFile(fileName+".badData", badData, "binary")
                    .catch(error => {
                        this.log.error(`Error writing bad data file for ${fileName}.`, error);
                    });
            }
            return this.stripFromFileName(fileName, influxID).catch(err => this.log.error(`Failed to rename or delete file ${fileName}.`, err));

        })
        .catch((error) => {
            this.log.error(`Error opening file: ${fileName}.`, error);
            return fileName;
        });
    }

    //renames a file with a task removed from name
    async stripFromFileName(filename, toStrip) {
        const newName = filename.replace(`.${toStrip}.`, '.');
        //console.log(`${path.basename(filename)} --> ${path.basename(newName)}`);
        let test = newName.split('.');
        if (test.length == 2) {
            return fs.unlink(filename)
                .then((result) => {
                    return "";
                });
        }
        else {
            return fs.rename(filename, newName)
                .then((result) => {
                    return newName;
                });
        }
    }

    _msgToString(msg){
        switch(typeof(msg)){
            case 'object':
                // /**@type {string} */
                // let toStr = msg.toString();
                // return toStr.toLowerCase() == '[object object]'? JSON.stringify(msg) : toStr;
                let toStr = "";
                for(let property in msg){
                    toStr += property + ": "+msg[property] + "\n";
                }
                return toStr == ""? msg.toString():toStr;
            default:
                return msg;
        }
    }

    _sleep(ms) {
        return new Promise((resolve) => {
          setTimeout(resolve, ms);
        });
      }

    //private variables

    /**
     * a string with all influx keys, separated by dot. e.g. .local.cloud
     * This is added to every file name as a record of which Influx data base this file needs to go to.
     * @private
     * @type {string} 
     */
    allInfluxKeys = "";

    _busyHandlingInvalid = false;

}