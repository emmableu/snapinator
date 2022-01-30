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

import { h, Component, createRef } from 'preact';


export interface Props {
    onProjectID: (projectID: string, type: string, projectJson: any) => void;
}


export default class ProjectURLInput extends Component<Props> {
    timeoutID: number;
    urlInputRef: any;
    projectJsonInputRef: any;

    constructor(props) {
        super(props);
        this.urlInputRef = createRef();
        this.projectJsonInputRef = createRef();
    }


    render() {
        return (
            <div>
             <input ref={this.projectJsonInputRef} id="projectJsonInput" style={{visibility: "hidden"}}></input>
             <input id='urlInput' class="url" ref={this.urlInputRef}/>
               <button id="urlInputButton" onClick={this.handleURLInputButtonClick.bind(this)}>enter</button>
            </div>
        );
    }

    componentWillUnmount() {
        if (this.timeoutID != null) {
            window.clearTimeout(this.timeoutID);
        }
    }


    handleURLInputButtonClick (e) {
        // @ts-ignore
        let id = this.urlInputRef.current.value;
        // id = "asset[DELIM]27-Flappy%20Parrot";
        const words = id.split("[DELIM]");
        if (words.length == 2) {
            const type = id.split("[DELIM]")[0];
            const projectID = id.split("[DELIM]")[1];
            const projectJson = this.projectJsonInputRef.current.value;
            console.log('projectJson: ', projectJson);
            this.props.onProjectID(projectID, type, projectJson);

        }
    }
}
