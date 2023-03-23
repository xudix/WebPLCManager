import SMB2 from '@marsaud/smb2';
import * as fsync from 'fs';
import * as fs from "fs/promises";
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
        this.conf.smb2source = {
            domain: 'WORKGROUP',
            path: '',
            autoCloseTimeout: 0,    //make this zero?!
            ...this.conf.smb2source
        }
        /**
         * SMB2 client is used to get files from the PLC
         */
        this.smbClient = new SMB2(this.conf.smb2source);
        this.log = {
            info : (...args) => {
                let msg = "";
                args.forEach(arg => msg += arg.toString() + "\n");
                this.emit("log", "info", msg);
            },
            warn : (...args) => {
                let msg = "";
                args.forEach(arg => msg += arg.toString() + "\n");
                this.emit("log", "warn", msg);
            },
            error : (...args) => {
                let msg = "";
                args.forEach(arg => msg += arg.toString() + "\n");
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
        // query the local data dir
        this.remoteLogger.switchFile()
            .then((fileName) => {
                if(fileName != "")
                    this.log.info(`Switched file. New file: ${fileName}`);
                this.processLocalFiles(this.fileCount);
            })
            .catch((err) => {
                this.log.error(`Failed to switch file.`, err);
            });
        // query the PLC
        fetch(this.conf.PLCloggerURL+"/api/log-status").then(res => {
            res.json().then((result) => {
                this.log.info("PLC Logging status: ", JSON.stringify(result));
                this.loggingStatus = result;
            });
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
        fetch(this.conf.PLCloggerURL+"/api/log-file").then( res => {
            
        })
        .catch(err => this.log.error(`Failed to get log file info.`, err))
        .finally(() => {
            this.listRemoteFiles(Infinity)
            .then(async (files) => {
                if (files.length > 0){
                    for (let filename of files){
                        await this.copyFileFromRemote(filename);
                    }
                    this.smbClient.disconnect();
                }
            }).catch(err => this.log.error(`Failed to get file from PLC.`, err));
        });
    }

    async listRemoteFiles(maxFiles) {
        return this.smbReaddirAsync(this.conf.smb2source.path)
            .then(files => {
                let found = [];
                for (let filename of files){
                    if(found.length >= maxFiles){break;}
                    if (filename.endsWith('.lp')){
                        found.push(filename);
                    }
                }
                return found;
            })
            .catch((err) => this.log.error(`Error reading PLC files.`, err))
    }

    //copies the file with filename from the remote to the local file system and inserts all the influx targets into the name
    async copyFileFromRemote(filename) {
        return new Promise(async (resolve, reject) => {
            let readStream = await this.smbClient.createReadStream(filename);
            let writeStream = fsync.createWriteStream(this.tempFile + filename);
            let done = false;
            // Listen for the 'end' event on the read stream to know when there is no more data to read
            readStream.on('end', () => {

                // Listen for the 'finish' event on the write stream to know when all data has been written
                writeStream.on('finish', () => {
                    done = true;
                    resolve(true);
                });
            });

            readStream.pipe(writeStream);

            // Handle errors
            readStream.on('error', (err) => {
                if (!done) {
                    this.log.error(`readStream error ${filename}`);
                    // console.log(`readStream error ${dirPath}`);
                    reject(err);
                }
            });
            writeStream.on('error', (err) => {
                if (!done) {
                    this.log.error(`writeSteam error ${filename}`);
                    // console.log(`writeSteam error ${dirPath}`);
                    reject(err);
                }
            });
        })
            .then((success) => {
                if (success) {
                    let proms = [];
                    fetch(this.conf.PLCloggerURL + "/api/log-file/" + filename, {
                        method: "DELETE"
                    }).catch((err) => this.log.error(`Failed to delete ${filename} from server.`, err));
                    const newName = path.join(this.dataDir, filename.replace(/.lp$/, this.allInfluxKeys + ".lp"));
                    proms.push(fs.rename(this.tempFile + filename, newName));
                    proms.push(new Promise(resolve => setTimeout(resolve, 2000)));  // add a delay. Otherwise smb won't copy multiple files.
                    return Promise.all(proms).then(() => {
                        return newName;
                    });
                }
                else {
                    this.log.error("smb transfer failed or incomplete")
                    //console.log("smb transfer failed or incomplete");
                    smbClient.disconnect();
                    return null;
                }
            })
            .catch((err) => {
                this.log.error(`error in smb2 ${filename}.`, err);
                this.smbClient.disconnect();
                // console.log(`error in smb2 ${dirPath}\n${err}`);
            });
    }

    //cound just be done with promisify?
    smbReaddirAsync(dirPath){
        //return new Promise(async (resolve, reject) => {   //why async?
        return new Promise((resolve, reject) => {
        try {
            //await fs.access(dirPath);
            this.smbClient.readdir(dirPath, (err, files) => {
            if (err) {
                reject(err);
            } else {
                resolve(files);
            }
            });
        } catch (err) {
            reject(err);
            this.smbClient.close();
        }
        });
    };

    /**
     * Scan through the dataDir, find files that ends with .new.lp and rename them into 
     * @param {number} maxFiles maximum number of files to process in each run
     */
    async processLocalFiles(maxFiles) {
        fs.readdir(this.dataDir).then(async (localFileNames) => {
            if (localFileNames.length > 0) {
                let processedFiles = 0;
                localFileNames.sort((a, b) => a > b ? -1 : (a < b ? 1 : 0)); // make sure we process new files first
                //console.log(`Found local files ${localFileNames.toString()}`);
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
                    } else if (!filename.endsWith(".lp")) {
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
        //console.log(`writing ${fileName} to ${influxID}`);
        const readable = fsync.createReadStream(fileName);
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
                //FIXME:  really the only reason not to remove my task is if the server didn't respond or got interrupted?
                let delFile = false;
                if (response.ok) {
                    this.log.info(`Uploaded ${fileName} to ${influxID} sucessfully!`)
                    delFile = true;
                }
                else {
                    let text = await response.text();
                    if (text.code === "invalid") {
                        this.log.warn("bad data in the file, marking it as complete anyway", text.message);
                        delFile = true;
                    }
                    else {
                        this.log.error("HTTP ERROR!", text)
                    }
                }
                if (delFile) {
                    return this.stripFromFileName(fileName, influxID).catch(err => this.log.error(`Failed to rename or delete file ${fileName}.`, err));
                }
                else {
                    return Promise.resolve(fileName);
                }
            })
            .catch((error) => {
                this.log.error(`Error uploading file: ${fileName} to ${influxID}.`, error);
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
                    // console.log(`done!  deleting ${path.basename(filename)}`);
                    return newName;
                });
        }
    }

    //private variables

    /**
     * a string with all influx keys, separated by dot. e.g. .local.cloud
     * This is added to every file name as a record of which Influx data base this file needs to go to.
     * @private
     * @type {string} 
     */
    allInfluxKeys = "";

}