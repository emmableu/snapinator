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
import globalConfig  from '../globalConfig.ignore';
import axios from 'axios';


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
                {/*<p>Or load a project from a file:</p>*/}
                {/*<input class="file" type="file" onInput={this.handleFile.bind(this)}/>*/}
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
        let res = {};
        const baseUrl = type === "csc110" ? globalConfig.csc110ServerURL : "https://assets.scratch.mit.edu/internalapi/asset/";

        if (type === "asset") {
            res['full'] = await this.getNonScripts(projectID, baseUrl);
            this.writeObj(projectID, res);
            return;
        }
        if (type === "csc110") {
            res = await this.jsonToFullScripts(projectID, projectJsonAggregate, baseUrl);
            this.writeObj(projectID, res);
            return;
        }
        projectJsonAggregate = JSON.parse(projectJsonAggregate);
        for (const [actorName, sliceMap] of Object.entries(projectJsonAggregate)) {
            if (actorName === "full" || actorName === "hidecode") {
                // if (type === "original") {
                //     res['full'] = await this.getFullScripts(projectID);
                // }
                // else {
                res[actorName] = await this.getScriptsOnly(projectID, sliceMap["all"], baseUrl);
                // }
            }
            else {
                res[actorName] = {};
                for (const [attributeName, programJson] of Object.entries(sliceMap) ) {
                    res[actorName][attributeName] = await this.getScriptsOnly(projectID, programJson, baseUrl);
                }
            }
        }

        this.writeObj(projectID, res);
    }



    async getFullScripts(projectID: string, baseUrl:string) {
        console.log("projectID: ", projectID);
        const response = await fetch(`${globalConfig.snapReplayURL}project/${projectID}/project.json`);
        if (!response.ok) {
            this.log(`Project "${projectID}" could not be retrieved`);
            return;
        }
        const file = await response.arrayBuffer();
        const project = await this.readProject(projectID, file, baseUrl, false, true);
        return this.toUrl(project)
    }

    async getNonScripts(projectID: string, baseUrl:string) {
        // projectID = "27-Flappy%20Parrot";
        console.log("projectID: ", projectID);
        const response = await fetch(`${globalConfig.snapReplayURL}project/${projectID}/project.json`);
        if (!response.ok) {
            this.log(`Project "${projectID}" could not be retrieved`);
            return;
        }
        const file = await response.arrayBuffer();
        console.log("getNonScripts: ", projectID);
        const project = await this.readProject(projectID, file, baseUrl,true, false);
        return this.toUrl(project);
    }

    async getScriptsOnly(projectID: string, projectScript: string, baseUrl: string) {
        const project = await this.readProject(projectID, projectScript, baseUrl, false, true);
        if (project) {
            return this.toUrl(project);
        }
    }

    async jsonToFullScripts(projectID: string, projectScript: string, baseUrl:string) {
        const forceReadObj = true;
        const project = await this.readProject(projectID, projectScript, baseUrl, true, true);
        // if (project) {
            return this.toUrl(project);
        // }
    }


    // handleFile(e) {
    //     const file = e.target.files[0];
    //     const projectName = file.name.replace(/\..*$/, '');
    //     const reader = new FileReader();
    //     reader.addEventListener('load', async () => {
    //         const project = await this.readProject(projectName, reader.result as ArrayBuffer, baseUrl, true, true);
    //         if (project) {
    //             this.writeProject(projectName, project);
    //         }
    //     });
    //     reader.readAsArrayBuffer(file);
    // }

    async readProject(projectName: string, file: any, baseUrl: string, hasNonScripts: boolean, hasScripts: boolean): Promise<Project | null> {
        let zip: Archive;
        let jsonObj;
        this.log(`Reading project "${projectName}"`);

        if (baseUrl !== "https://assets.scratch.mit.edu/internalapi/asset/") {
            jsonObj = JSON.parse(file);
            zip = new AssetServer();
        }

        else {
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
                        const jsonText = await zip.file('project.json').text(baseUrl);
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

        }

        const project = new Project();
        try {
            await project.readProject(projectName, jsonObj, zip, this.log.bind(this), baseUrl, hasNonScripts, hasScripts);
        } catch (err) {
            this.log(err);
            return null;
        }
        return project;
    }

    toUrl(project:Project) {
        console.log("project: ");
        console.log(project.toXML());
        return encodeURIComponent(serializeXML(project.toXML()))
        // @ts-ignore
        // return encodeURIComponent(`<project name="Untitled" app="iSnap 3.0, http://go.ncsu.edu/isnap" version="1" guid="305aa218-42d4-46fc-891b-6e39f0b9f570" assignment="none"><data>{}</data><notes></notes><thumbnail>data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAAB4CAYAAAB1ovlvAAAAAXNSR0IArs4c6QAADQNJREFUeF7tnHlUVdUex78MCVEgLg0HEkcEBRMHnEBJnwKJszhTIIkmFuAAIqiEyZM0ySQRUcABZbqaghOQT2VwKfYoAaHUShzDyhSSWXlrn5a8s+56L7xw79lc+J2/uAvY39/+fj937332Pvdq1NfX14MucoCTAxoEICfnSVZwgAAkELg6QABytZ/ECUBigKsDBCBX+0mcACQGuDpAAHK1n8QJQGKAqwMEIFf7SZwAJAa4OkAAcrWfxAlAYoCrAwQgV/tJnAAkBrg6QABytZ/ECUBigKsDBCBX+0mcACQGuDpAAHK1n8QJQGKAqwMEIFf7SZwAJAa4OkAAcrWfxAlAYoCrAwQgV/tJnAAkBrg6QABytZ/ECUBigKsDBCBX+0mcACQGuDpAAHK1n8QJQGKAqwMEIFf7SZwAJAa4OkAAcrWfxAlAYoCrAwQgV/tJnAAkBrg6QABytZ/ECUBigKsDBCBX+0mcACQGuDpAAHK1n8QJQGKAqwMEIFf7SZwAJAa4OkAAcrWfxAlAYoCrAwQgV/tJnAAkBrg6QABytZ/ECUBigKsDBCBX+0mcACQGuDpAAHK1n8QJQGKAqwMEIFf7SZwAJAa4OqA2ANbX1yMtLQ2Ojo5cDSNx5TqgNgDm5ORgov07+L64EE+fPoWxsTEMDAyU6wa1JrkDagNgdHQ0PgndhS8+W4/o2IPQ0dFFcmKc5IaRoHIdUBsAS0tLkZ+fj+fPnyM8NhsVfz7Gv06EK9cNak1yB9QCQAbf4CHDkJyUgIcPHyLqcC4elf6Iy5lJkhtGgsp1QC0ADAgIxP0KU1SVfo1Dcftx7NgxdOnSBTY2Nsp1g1qT3AG1AHDCJBfMWRYHWexqfBm6BP369ZPcKBJUjQNqAeDYiS5w8YrDycRN8F/+D4waNUo1blCrkjugFgAGB2/EhYtFMOrYDgf27UW7du0kN4oEVeOAWgComq5Tqy3BAQKwJaTQhmsgANtw+C2h6wRgS0ihDddAALbh8FtC1wnAlpBCG66BAGzD4beErhOALSGFNlwDAdiGw28JXScAW0IKbbgGArANh98Suk4AtoQU2nANBGAbDr8ldF0pALJPq126dAmGhoZYunQpdHV1Je9bcXExUlJSUF1djYULF6JPnz6S1CDWnTNnDjIyMvDo0SMMGzYMTk5OktRQW1uLyMjIBl1tbW0ueYg5sLOzEz7F2FgeTQIwNjYWV69cQYfOnfGKlhb63ivFFKvB+O5OCcrH2sDe3l7lxhcWFiJiRzh0dHUx0GoQfkrLgJ/deEH30JPfsWytv0pqEOtaDnoLn4WEYKxJT/Q16oyU/KvY854benTshNCMMwiWqeYjAww4f39/1FZUwszSAqnHU6D/x2OYd+mKS7d+goetnSR5iDmof/4cJ/YfwKi+ptDU0EC9lhY2TZ3RaB4KA1hXV4cAVzcEjx2PH355gK+LrmH5+AmCUHDqcbiEhsDS0lIl4Ysb3RgUBBe99uikr48vMtKwYORodDM0xNU7t5HV/jX4+vqqpAaxrr8sEQPf7A43mzFILyxAPQAHy4GoffYMy0+l4OCJVJXUwN4EWVu2Cbqn8q8i+UouYt/3kDQPeQ584uMQs8hD4TwUBvDzbdsgi9yNL11c8bSqCnuzLsB5qDXGmpnj4MVsnP/tIZLPnFaJ8S8aPX/+PHYHf4JBHTvhPRtbbD19Ega6r8LfaQrSCgsQf+UyNkTvgYWFhVLrEOvOHzEKa2QJeFpVjYRlHyI2OxPf3i5BoNNUPKmqhOxKLrpMGIePfHyUWkNVVRU8F7rg15s/CrrrjsqQ+/OPkuch5uD6Lw+QmHsZw3v1VjgPhQFcNm4CwuYtQFVtLVZf8MfuPY/xrrs2AgZvFKYhNgKVjR2t0ml4W2goPDsYCcGuSIrFhl3ZOJcFPEifL4zGbARSxTQs1nWP2SOMuhMGWCD9WgF+M9uO8XaAr2cfHFwYINSmimk4ODgYQx6VNeieKSjgkoeYg5GbPsZ3wSFNykNhABfZOyJi1hyUV1XhywfLsTEQWBeshRmvBSH9WiEqX9XFnDW+Kp2GP/9sG6Y900BXQ0N4Hw9DVOI1fJsPnNrmDCuTHpDlfYMFq1Zi4rSpSh19xLozdoZhupU1XG3GICrzLEYuPowhg4BF800QPiUAXocPou/QIQgK36HUGpKTk/F76qkG3cybBYhz95E8DzEHgzf7IGtFaJPyUBjA6L17cffEKfi9Mxlrjh5EWccs9K6cBl9HJxTcvYOzOtpYuy5QqabLN8bWQOF+/lhjNx7FD+4jojgMJppW8H3bRViDeBxNQuLXGUqvQaxb9OAeViQcwK5338fQHr3gkhiINzq0w9w+C/G2eX9sOXMSkwL8YW1trdQ62A3IR4vc4dzVWNAdvmk9XEbaSp6HmAPmw70/yvDFfBeF81AYQPa9LAHOcxE6faZgLJvuvrtdAutevYXXm69cwsa9UUo1/X81FuTlDVfjHsK7jl2Z17/H2H7mws/ROVlwWB8AU1NTpdch1pV9kyusPe0tBwo67KaMvWY1lVdVIkHjGby8vJReQ2J8PHQv5gq6FdXV2JhyDKGz50qahzwHISeOw93WTuE8mgTgEsd3sNfFTehwTFYmzleWo+ufFTDU1UX3yZPg4eGhdNPlG/R4zxVrLQYJHS66f08Av6OWFkz1Xkf+s1ockCWrpAaxbuS5s2ivpwd2Q8LeiAuidqH/cGvo/lKKn8vLsD5yF8zMzJRex+FDh1B19ryg+6SyAh8ciEX80uUNeWSUPYJJda1K82AAijmYv3snwuYubMhj0+UcGL3SrtE8FAaQ9TI9PR33877F05oaaBm9gZ49e0r+tWk3btxAmuwIeujr42ZtDXR0dODp6an0sOUbFOveqKnGxZwcLJ5gjx/KHuP7W7ewc+dOaGpqqrQOtgWyPSwMlvrtBd1vCgsxrv8AVNbVSZqHmINaA338fDUfE4YOVSiPJgEodre8vBzx8fFYsmSJSk1vrPGtW7eqbO/v77TFunv27IGDgwNMTEwaK1epvxfr8spDXvdl81AKgIGBgdixQ7l3e4om5OzsDJlMpui/Nfvvxbrh4eEwNzfHxIkTm92uIg2IdRkIPPKQ133ZPJoMIBt+2YmHvr4+AgICwEyQ+mLnsGVlZRgxYgRmzZqFI0eOSFKCvO7MmTOF82fmAVvzSXEUye6Gk5KSGnTZ+TNbe0udh5iDefPmYcOGDQrl0SQA2QGzxdvWKNWpwkGfLWCBrF27VpLwxSIfeXth57UT8LSYDG0NTWzfvl2SGsS6z2pqEZmXgiGGveE5xw3du3eXBMDs7GyMWTVX0F022xW+W4JQ1+01SfOQ52DFqpUo6QWF8mgSgCzl06dPY9IuH1gadMeHY2YLT8FIfVVWVqKv0wj8+qYWZtaYISEhQZIS5HVfNzRANP6NeZpvYdH0+ZIAyDq6+IMlDbpddTvg85snJc9DzIHH8Kn49NhehfJoMoDMALYr7xEbjBmdrcGejOBxFRUVwXW9F4qvFeFh3k3o6elJUoZY997lYvivC0Bk9hF8FRSJ6dOnS1IDm4a9Vvo06LLXPPIQc8AeAlEkj2YByFxm029mZibc3d2x0nc19n8Vj7KSh5IE8EKEGe/t7Y2IiAjhjbAuLASx2yJUPhLJ664KWYdP13wsfH3c4kBvWJsMkGRtzJ6DZM9gduvWDa5+yzGgowliYmIkzUPMgfdKH0Ql7Efdr382mkezAWQhrF69GrLrmbjvYAT/mtHY7BckKYBMjB3SXyopxBmj+zC+C9yNy5GkBrGuflEZHPT6Q1ZbAM1+nXDBaTNsbW1VXgf77uxP/rnpL13TTph9yxhZT36QNA95DrpEXYfVyGGN5tFsANntt4GJETDLHBblhji1db/k+2AsYXtHB2S8WoJXtLRx1C0UkydPVnnw8rqONb2ReicXsOoCtw6jERsWIUkN7O7bKyZE0J2vNwTxh+Mlz0OeA72SClzp+qTRPJQCINuGcHNzE7YEeF3Tpk3DjBkzhGmXTUVSXWJdtg10+/ZtsD0wtjUk1cUAfKE7YMAA8MiDASjWfdk8lAIgj41P+XBfduNT2VDQRvRfjkq+Ef0iSF5HP/IgbdmyBX5+fsrmq9H2xLp0FPffI9mXzaPZIyA7iWCfiJNi9//vaEhNTcWUKVMaBUbZfyDW3bdvn7AUkfoS6/LKQ173ZfNoNoBSHj/9v2DZKMzjOFBet6UsA6Q6DhTnIeZAkTyaDSDb/2nfvr2kC395ENkWQF5enqQLf1aDvO65c+cwbtw4qQdAiHV55SHWVSSPZgMoudsk2KocIABbVZzq1xkCUP0ya1UVE4CtKk716wwBqH6ZtaqKCcBWFaf6dYYAVL/MWlXFBGCrilP9OkMAql9mrapiArBVxal+nSEA1S+zVlUxAdiq4lS/zhCA6pdZq6qYAGxVcapfZ/4D35rkAiX1l38AAAAASUVORK5CYII=</thumbnail><stage name="Stage" width="480" height="360" costume="0" color="255,255,255,1" tempo="60" threadsafe="false" penlog="false" volume="100" pan="0" lines="round" ternary="true" hyperops="true" codify="false" inheritance="true" sublistIDs="false" scheduled="false" id="1"><pentrails>data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAeAAAAFoCAYAAACPNyggAAAAAXNSR0IArs4c6QAADoVJREFUeF7t1cEJAAAIxDDdf2m3sJ+4wEEQuuMIECBAgACBd4F9XzRIgAABAgQIjAB7AgIECBAgEAgIcIBukgABAgQICLAfIECAAAECgYAAB+gmCRAgQICAAPsBAgQIECAQCAhwgG6SAAECBAgIsB8gQIAAAQKBgAAH6CYJECBAgIAA+wECBAgQIBAICHCAbpIAAQIECAiwHyBAgAABAoGAAAfoJgkQIECAgAD7AQIECBAgEAgIcIBukgABAgQICLAfIECAAAECgYAAB+gmCRAgQICAAPsBAgQIECAQCAhwgG6SAAECBAgIsB8gQIAAAQKBgAAH6CYJECBAgIAA+wECBAgQIBAICHCAbpIAAQIECAiwHyBAgAABAoGAAAfoJgkQIECAgAD7AQIECBAgEAgIcIBukgABAgQICLAfIECAAAECgYAAB+gmCRAgQICAAPsBAgQIECAQCAhwgG6SAAECBAgIsB8gQIAAAQKBgAAH6CYJECBAgIAA+wECBAgQIBAICHCAbpIAAQIECAiwHyBAgAABAoGAAAfoJgkQIECAgAD7AQIECBAgEAgIcIBukgABAgQICLAfIECAAAECgYAAB+gmCRAgQICAAPsBAgQIECAQCAhwgG6SAAECBAgIsB8gQIAAAQKBgAAH6CYJECBAgIAA+wECBAgQIBAICHCAbpIAAQIECAiwHyBAgAABAoGAAAfoJgkQIECAgAD7AQIECBAgEAgIcIBukgABAgQICLAfIECAAAECgYAAB+gmCRAgQICAAPsBAgQIECAQCAhwgG6SAAECBAgIsB8gQIAAAQKBgAAH6CYJECBAgIAA+wECBAgQIBAICHCAbpIAAQIECAiwHyBAgAABAoGAAAfoJgkQIECAgAD7AQIECBAgEAgIcIBukgABAgQICLAfIECAAAECgYAAB+gmCRAgQICAAPsBAgQIECAQCAhwgG6SAAECBAgIsB8gQIAAAQKBgAAH6CYJECBAgIAA+wECBAgQIBAICHCAbpIAAQIECAiwHyBAgAABAoGAAAfoJgkQIECAgAD7AQIECBAgEAgIcIBukgABAgQICLAfIECAAAECgYAAB+gmCRAgQICAAPsBAgQIECAQCAhwgG6SAAECBAgIsB8gQIAAAQKBgAAH6CYJECBAgIAA+wECBAgQIBAICHCAbpIAAQIECAiwHyBAgAABAoGAAAfoJgkQIECAgAD7AQIECBAgEAgIcIBukgABAgQICLAfIECAAAECgYAAB+gmCRAgQICAAPsBAgQIECAQCAhwgG6SAAECBAgIsB8gQIAAAQKBgAAH6CYJECBAgIAA+wECBAgQIBAICHCAbpIAAQIECAiwHyBAgAABAoGAAAfoJgkQIECAgAD7AQIECBAgEAgIcIBukgABAgQICLAfIECAAAECgYAAB+gmCRAgQICAAPsBAgQIECAQCAhwgG6SAAECBAgIsB8gQIAAAQKBgAAH6CYJECBAgIAA+wECBAgQIBAICHCAbpIAAQIECAiwHyBAgAABAoGAAAfoJgkQIECAgAD7AQIECBAgEAgIcIBukgABAgQICLAfIECAAAECgYAAB+gmCRAgQICAAPsBAgQIECAQCAhwgG6SAAECBAgIsB8gQIAAAQKBgAAH6CYJECBAgIAA+wECBAgQIBAICHCAbpIAAQIECAiwHyBAgAABAoGAAAfoJgkQIECAgAD7AQIECBAgEAgIcIBukgABAgQICLAfIECAAAECgYAAB+gmCRAgQICAAPsBAgQIECAQCAhwgG6SAAECBAgIsB8gQIAAAQKBgAAH6CYJECBAgIAA+wECBAgQIBAICHCAbpIAAQIECAiwHyBAgAABAoGAAAfoJgkQIECAgAD7AQIECBAgEAgIcIBukgABAgQICLAfIECAAAECgYAAB+gmCRAgQICAAPsBAgQIECAQCAhwgG6SAAECBAgIsB8gQIAAAQKBgAAH6CYJECBAgIAA+wECBAgQIBAICHCAbpIAAQIECAiwHyBAgAABAoGAAAfoJgkQIECAgAD7AQIECBAgEAgIcIBukgABAgQICLAfIECAAAECgYAAB+gmCRAgQICAAPsBAgQIECAQCAhwgG6SAAECBAgIsB8gQIAAAQKBgAAH6CYJECBAgIAA+wECBAgQIBAICHCAbpIAAQIECAiwHyBAgAABAoGAAAfoJgkQIECAgAD7AQIECBAgEAgIcIBukgABAgQICLAfIECAAAECgYAAB+gmCRAgQICAAPsBAgQIECAQCAhwgG6SAAECBAgIsB8gQIAAAQKBgAAH6CYJECBAgIAA+wECBAgQIBAICHCAbpIAAQIECAiwHyBAgAABAoGAAAfoJgkQIECAgAD7AQIECBAgEAgIcIBukgABAgQICLAfIECAAAECgYAAB+gmCRAgQICAAPsBAgQIECAQCAhwgG6SAAECBAgIsB8gQIAAAQKBgAAH6CYJECBAgIAA+wECBAgQIBAICHCAbpIAAQIECAiwHyBAgAABAoGAAAfoJgkQIECAgAD7AQIECBAgEAgIcIBukgABAgQICLAfIECAAAECgYAAB+gmCRAgQICAAPsBAgQIECAQCAhwgG6SAAECBAgIsB8gQIAAAQKBgAAH6CYJECBAgIAA+wECBAgQIBAICHCAbpIAAQIECAiwHyBAgAABAoGAAAfoJgkQIECAgAD7AQIECBAgEAgIcIBukgABAgQICLAfIECAAAECgYAAB+gmCRAgQICAAPsBAgQIECAQCAhwgG6SAAECBAgIsB8gQIAAAQKBgAAH6CYJECBAgIAA+wECBAgQIBAICHCAbpIAAQIECAiwHyBAgAABAoGAAAfoJgkQIECAgAD7AQIECBAgEAgIcIBukgABAgQICLAfIECAAAECgYAAB+gmCRAgQICAAPsBAgQIECAQCAhwgG6SAAECBAgIsB8gQIAAAQKBgAAH6CYJECBAgIAA+wECBAgQIBAICHCAbpIAAQIECAiwHyBAgAABAoGAAAfoJgkQIECAgAD7AQIECBAgEAgIcIBukgABAgQICLAfIECAAAECgYAAB+gmCRAgQICAAPsBAgQIECAQCAhwgG6SAAECBAgIsB8gQIAAAQKBgAAH6CYJECBAgIAA+wECBAgQIBAICHCAbpIAAQIECAiwHyBAgAABAoGAAAfoJgkQIECAgAD7AQIECBAgEAgIcIBukgABAgQICLAfIECAAAECgYAAB+gmCRAgQICAAPsBAgQIECAQCAhwgG6SAAECBAgIsB8gQIAAAQKBgAAH6CYJECBAgIAA+wECBAgQIBAICHCAbpIAAQIECAiwHyBAgAABAoGAAAfoJgkQIECAgAD7AQIECBAgEAgIcIBukgABAgQICLAfIECAAAECgYAAB+gmCRAgQICAAPsBAgQIECAQCAhwgG6SAAECBAgIsB8gQIAAAQKBgAAH6CYJECBAgIAA+wECBAgQIBAICHCAbpIAAQIECAiwHyBAgAABAoGAAAfoJgkQIECAgAD7AQIECBAgEAgIcIBukgABAgQICLAfIECAAAECgYAAB+gmCRAgQICAAPsBAgQIECAQCAhwgG6SAAECBAgIsB8gQIAAAQKBgAAH6CYJECBAgIAA+wECBAgQIBAICHCAbpIAAQIECAiwHyBAgAABAoGAAAfoJgkQIECAgAD7AQIECBAgEAgIcIBukgABAgQICLAfIECAAAECgYAAB+gmCRAgQICAAPsBAgQIECAQCAhwgG6SAAECBAgIsB8gQIAAAQKBgAAH6CYJECBAgIAA+wECBAgQIBAICHCAbpIAAQIECAiwHyBAgAABAoGAAAfoJgkQIECAgAD7AQIECBAgEAgIcIBukgABAgQICLAfIECAAAECgYAAB+gmCRAgQICAAPsBAgQIECAQCAhwgG6SAAECBAgIsB8gQIAAAQKBgAAH6CYJECBAgIAA+wECBAgQIBAICHCAbpIAAQIECAiwHyBAgAABAoGAAAfoJgkQIECAgAD7AQIECBAgEAgIcIBukgABAgQICLAfIECAAAECgYAAB+gmCRAgQICAAPsBAgQIECAQCAhwgG6SAAECBAgIsB8gQIAAAQKBgAAH6CYJECBAgIAA+wECBAgQIBAICHCAbpIAAQIECAiwHyBAgAABAoGAAAfoJgkQIECAgAD7AQIECBAgEAgIcIBukgABAgQICLAfIECAAAECgYAAB+gmCRAgQICAAPsBAgQIECAQCAhwgG6SAAECBAgIsB8gQIAAAQKBgAAH6CYJECBAgIAA+wECBAgQIBAICHCAbpIAAQIECAiwHyBAgAABAoGAAAfoJgkQIECAgAD7AQIECBAgEAgIcIBukgABAgQICLAfIECAAAECgYAAB+gmCRAgQICAAPsBAgQIECAQCAhwgG6SAAECBAgIsB8gQIAAAQKBgAAH6CYJECBAgIAA+wECBAgQIBAICHCAbpIAAQIECAiwHyBAgAABAoGAAAfoJgkQIECAgAD7AQIECBAgEAgIcIBukgABAgQICLAfIECAAAECgYAAB+gmCRAgQICAAPsBAgQIECAQCAhwgG6SAAECBAgIsB8gQIAAAQKBgAAH6CYJECBAgIAA+wECBAgQIBAICHCAbpIAAQIECAiwHyBAgAABAoGAAAfoJgkQIECAgAD7AQIECBAgEAgIcIBukgABAgQICLAfIECAAAECgYAAB+gmCRAgQICAAPsBAgQIECAQCAhwgG6SAAECBAgIsB8gQIAAAQKBgAAH6CYJECBAgIAA+wECBAgQIBAICHCAbpIAAQIECAiwHyBAgAABAoGAAAfoJgkQIECAgAD7AQIECBAgEAgIcIBukgABAgQICLAfIECAAAECgYAAB+gmCRAgQICAAPsBAgQIECAQCAhwgG6SAAECBAgIsB8gQIAAAQKBgAAH6CYJECBAgIAA+wECBAgQIBAICHCAbpIAAQIECByxcQFpoRMBzwAAAABJRU5ErkJggg==</pentrails><costumes><list struct="atomic" id="2"></list></costumes><sounds><list struct="atomic" id="3"></list></sounds><variables></variables><blocks></blocks><scripts></scripts><sprites><sprite name="Sprite" idx="1" x="310" y="-100" heading="90" scale="0.2" volume="100" pan="0" rotation="1" draggable="true" costume="1" color="80,80,80,1" pen="tip" id="8"><costumes><list id="9"><item><costume name="flower" center-x="71" center-y="180" image="data:image/png;base64,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" id="10"/></item></list></costumes><sounds><list struct="atomic" id="11"></list></sounds><blocks></blocks><variables></variables><scripts><script x="76.81818181818181" y="48.45454545454543"><block blockID="114" s="receiveGo"></block><block blockID="199" s="gotoXY"><l>-190</l><l>-100</l></block><block blockID="154" s="setScale"><l>20</l></block><block blockID="196" s="doRepeat"><l>5</l><script><block blockID="197" s="createClone"><l><option>myself</option></l></block><block blockID="198" s="forward"><l>100</l></block></script></block></script></scripts></sprite><sprite name="Sprite(2)" idx="2" x="-108" y="-11" heading="90" scale="1" volume="100" pan="0" rotation="1" draggable="true" costume="1" color="3.2640000000000753,0,163.20000000000002,1" pen="tip" id="29"><costumes><list id="30"><item><costume name="water drop" center-x="9" center-y="12.5" image="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2ZXJzaW9uPSIxLjEiIHdpZHRoPSIxOC40MTE3ODg5NDA0Mjk2ODgiIGhlaWdodD0iMjUuNDAwMDIyNTA2NzEzODY3IiB2aWV3Qm94PSIwLjIxMjA4NzYzMTIyNTU4NTk0IDAuODUwMDAwMDIzODQxODU3OSAxOC40MTE3ODg5NDA0Mjk2ODggMjUuNDAwMDIyNTA2NzEzODY3Ij4KICA8IS0tIEV4cG9ydGVkIGJ5IFNjcmF0Y2ggLSBodHRwOi8vc2NyYXRjaC5taXQuZWR1LyAtLT4KICA8cGF0aCBpZD0iSUQwLjQwMzA5OTY1NDcwODA1NzY0IiBmaWxsPSIjOTlCMkZGIiBzdHJva2U9IiMwMDAwMDAiIHN0cm9rZS13aWR0aD0iMiIgZD0iTSA1LjA1IDExLjg1IEMgNS44NzMgMTEuOTIzIDYuMDIyIDEzLjk4NCA2LjYgMTUgQyA3LjIwNSAxNi4yMTcgOC4zMTUgMTcuMjI0IDguNiAxOC41NSBDIDguOTUzIDIwLjE5MiA5LjI2MiAyMi4wNyA4LjUgMjMuNSBDIDcuODg2IDI0LjY2OCA2LjMzNSAyNS4yNDYgNS4wNSAyNS4yNSBDIDMuODMxIDI1LjI1NCAyLjMwOCAyNC43MTEgMS43NSAyMy42NSBDIDAuOTM5IDIyLjEyOCAxLjIxIDIwLjE5IDEuNSAxOC41NSBDIDEuNzQ2IDE3LjE1NSAyLjY4OCAxNS45OCAzLjQgMTQuNzUgQyAzLjg3MiAxMy43NDYgNC4yNzcgMTEuNzgxIDUuMDUgMTEuODUgWiAiLz4KICA8cGF0aCBpZD0iSUQwLjU4ODYxNzY2MzM2NDg1NzQiIGZpbGw9IiM5OUIyRkYiIHN0cm9rZT0iIzAwMDAwMCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIGQ9Ik0gMTQuMzUgNS4yNSBDIDE1LjEwMSA1LjA5OSAxNi4xMDUgNi41ODkgMTYuNzUgNy41IEMgMTcuMjIxIDguMzM4IDE3LjU3NCA5LjM0MiAxNy42IDEwLjM1IEMgMTcuNjc0IDExLjUzOCAxNy42MTEgMTIuODgzIDE2LjkgMTMuODUgQyAxNi4zNjMgMTQuNTU4IDE1LjE4MiAxNC43NCAxNC4zNSAxNC42NSBDIDEzLjU2MyAxNC41NjYgMTIuNzY1IDEzLjk5MiAxMi40MDYgMTMuMjczIEMgMTEuOTQ3IDEyLjM1IDExLjk1OCAxMS4yNTkgMTIuMjUgMTAuMzUgQyAxMi40MzMgOS40NDYgMTMuMzkyIDguOTQgMTMuNzUgOC4xNSBDIDE0LjE1OSA3LjI1MiAxMy42NjYgNS4zODggMTQuMzUgNS4yNSBaICIvPgogIDxwYXRoIGlkPSJJRDAuNzQ3MjU4OTkyODY1NjgxNiIgZmlsbD0iIzk5QjJGRiIgc3Ryb2tlPSIjMDAwMDAwIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgZD0iTSA3LjYyNSAxLjg1IEMgOC4xMTIgMS44NTMgOC4xMDMgMy4zMDMgOC40IDQgQyA4LjY0MyA0LjUyNSA5LjA0IDUuMDI0IDkuMSA1LjY1IEMgOS4yMyA2LjI0MSA5LjI2OCA2LjkzNCA4Ljk1IDcuNTI2IEMgOC42ODUgOC4wMjEgOC4xNDIgOC41IDcuNjI1IDguNSBDIDcuMTA4IDguNSA2LjU3OCA4LjAxOSA2LjMgNy41MjYgQyA1Ljk1MyA2LjkxMiA1Ljg3OCA2LjE2NSA2IDUuNSBDIDYuMDM1IDQuODggNi40ODYgNC4zODYgNi43NSAzLjg1IEMgNy4wNjggMy4xOTggNy4xNTQgMS44NTQgNy42MjUgMS44NSBaICIvPgo8L3N2Zz4=" id="31"/></item></list></costumes><sounds><list struct="atomic" id="32"></list></sounds><blocks></blocks><variables></variables><scripts><script x="158.63636363636363" y="53.90909090909089"><block blockID="257" s="receiveGo"></block><block blockID="258" s="doRepeat"><l>10</l><script><block blockID="260" s="changeYPosition"><l>-10</l></block></script></block></script></scripts></sprite></sprites></stage><hidden></hidden><headers></headers><code></code><blocks></blocks><variables></variables><editing></editing></project>`)
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
