/*

    Snapinator
    Copyright (C) 2020  Deborah Servilla

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

*/

import Archive, { ZipArchive, SB1Archive, AssetServer } from './Archive';
import ProjectURLInput from './components/ProjectURLInput';
import Project from './Project';
import { serializeXML } from './xml';
import { h, Component, ComponentChild } from 'preact';
import { SB1File } from 'scratch-sb1-converter';
import axios from 'axios';
const BASE_URL = 'http://localhost:8082';


export interface State {
    logs: ComponentChild[];
}

export default class SnapinatorApp extends Component<any, State> {
    constructor() {
        super();
        this.state = {
            logs: [],
        };
    }

    componentDidMount() {
        this.log('Waiting for input...');
    }

    render() {
        return <div class="io">
            <div class="in box">
                <h1>Input</h1>
                <p>Paste a Scratch project URL or ID:</p>
                <ProjectURLInput onProjectID={this.postSnapXML.bind(this)}/>
                <p>Or load a project from a file:</p>
                <input class="file" type="file" onInput={this.handleFile.bind(this)}/>
            </div>
            <div class="out box">
                <h1>Output</h1>
                <button id="refreshOutputLog" onClick={this.refreshOutput.bind(this)}>refresh output</button>
                <ul id="outputLog" class="log">{this.state.logs}</ul>
            </div>
        </div>;
    }

    log(msg: ComponentChild | Error) {
        console.log(msg);
        if (msg instanceof Error) {
            msg = msg.toString();
        }
        this.setState(({ logs }) => ({ logs: [...logs, <li>{msg}</li>] }));
    }

    refreshOutput () {
        this.setState(({logs})=> ({logs: []}));
    }


    async postSnapXML(projectID, type, projectJsonAggregate) {
        projectJsonAggregate = JSON.parse(projectJsonAggregate);
        let res = {};

        for (const [actorName, sliceMap] of Object.entries(projectJsonAggregate)) {
            if (actorName === "full") {
                if (type === "original") {
                    res['full'] = await this.getFullScripts(projectID);
                }
                else if (type === "asset") {
                    res['full'] = await this.getNonScripts(projectID);
                    return;
                }
                else {
                    res['full'] = await this.getScriptsOnly(projectID, sliceMap["all"]);
                }
            }
            else {
                res[actorName] = {};
                for (const [attributeName, programJson] of Object.entries(sliceMap) ) {
                    res[actorName][attributeName] = await this.getScriptsOnly(projectID, programJson);
                }
            }
        }

        this.writeObj(projectID, res);
    }


    async getFullScripts(projectID: string) {
        console.log("projectID: ", projectID);
        const response = await fetch(`http://localhost:8082/project/${projectID}/project.json`);
        if (!response.ok) {
            this.log(`Project "${projectID}" could not be retrieved`);
            return;
        }
        const file = await response.arrayBuffer();
        const project = await this.readProject(projectID, file, true, true);
        return this.toUrl(project)
    }

    async getNonScripts(projectID: string) {
        // projectID = "27-Flappy%20Parrot";
        console.log("projectID: ", projectID);
        const response = await fetch(`http://localhost:8082/project/${projectID}/project.json`);
        if (!response.ok) {
            this.log(`Project "${projectID}" could not be retrieved`);
            return;
        }
        const file = await response.arrayBuffer();
        const project = await this.readProject(projectID, file, true, false);
        return this.toUrl(project);
    }

    async getScriptsOnly(projectID: string, projectScript: string) {
        const project = await this.readProject(projectID, projectScript, false, true);
        if (project) {
            return this.toUrl(project);
        }
    }


    handleFile(e) {
        const file = e.target.files[0];
        const projectName = file.name.replace(/\..*$/, '');
        const reader = new FileReader();
        reader.addEventListener('load', async () => {
            const project = await this.readProject(projectName, reader.result as ArrayBuffer, true, true);
            if (project) {
                this.writeProject(projectName, project);
            }
        });
        reader.readAsArrayBuffer(file);
    }

    async readProject(projectName: string, file: any, hasNonScripts: boolean, hasScripts: boolean): Promise<Project | null> {
        let zip: Archive;
        let jsonObj;
        this.log(`Reading project "${projectName}"`);

        if (hasNonScripts) {
            // console.log("file: ", file);
            try {
                jsonObj = JSON.parse(
                    new TextDecoder().decode(
                        new Uint8Array(file)
                    )
                );
                zip = new AssetServer();
            } catch (err) {
                try {
                    zip = await new ZipArchive().load(file);
                    const jsonText = await zip.file('project.json').text();
                    jsonObj = JSON.parse(jsonText);
                } catch (err) {
                    try {
                        const sb1 = new SB1File(file);
                        jsonObj = sb1.json;
                        zip = new SB1Archive(sb1.zip);
                    } catch (err) {
                        this.log('Invalid project');
                        return null;
                    }
                }
            }
        }
        else {
            jsonObj = file;
        }

        const project = new Project();
        try {
            await project.readProject(projectName, jsonObj, zip, this.log.bind(this), hasNonScripts, hasScripts);
        } catch (err) {
            this.log(err);
            return null;
        }
        return project;
    }

    toUrl(project:Project) {
        return encodeURIComponent(serializeXML(project.toXML()))
    }

    writeObj(projectName: string, obj: any) {
        try {
            // @ts-ignore
            this.log(
                <div>
                    <div style={{visibility: "hidden"}}>
                        <p id="downloadXML" style={{visibility: "hidden"}}>{JSON.stringify(obj)}</p>
                    </div>
                </div>
            );
        } catch (err) {
            this.log(err.toString());
        }
    }

    writeProject(projectName: string, project: Project) {
        this.log(<span>Writing Snap<i>!</i> XML</span>);
        try {
            // @ts-ignore
            const projectXML = serializeXML(project.toXML());
            // const projectURL = URL.createObjectURL(new Blob([projectXML], {type: 'text/xml'}));
            const openInSnap = () => {
                window.open('https://snap.berkeley.edu/snap/snap.html#open:' + encodeURIComponent(projectXML), '_blank');
            };
            this.log(
                <div>
                {/*<span>*/}
                {/*    Success! <a href="#" onClick={openInSnap}>Click here to open your project in Snap<i>!</i></a> (your browser may block this link),*/}
                {/*    or <a href={projectURL} download={projectName + '.xml'}>click here to download your project.</a>*/}
                {/*</span>*/}
                <div style={{visibility: "hidden"}}>
                    <p id="downloadXML" style={{visibility: "hidden"}}>{encodeURIComponent(projectXML)}</p>
                </div>
                </div>
            );
        } catch (err) {
            this.log(err.toString());
        }
    }
}
