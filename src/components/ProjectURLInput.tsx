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

import { h, Component } from 'preact';


export interface Props {
    onProjectID: (projectID: string) => void;
}

export interface State {
    projectID: string,
}

export default class ProjectURLInput extends Component<Props, State> {
    timeoutID: number;

    constructor(props) {
        super(props);
        this.state = {
            projectID: '',
        };
    }

    render() {
        return (
            <div>
             <input id='urlInput' class="url" value={this.state.projectID} onFocus={this.handleFocus.bind(this)} onInput={this.handleInput.bind(this)}/>
               <button id="urlInputButton" onClick={this.handleURLInputButtonClick.bind(this)}>enter</button>
            </div>
        );
    }

    componentWillUnmount() {
        if (this.timeoutID != null) {
            window.clearTimeout(this.timeoutID);
        }
    }

    handleFocus(e) {
        if (this.state.projectID !== '') {
            e.target.select();
        }
    }

    handleInput(e) {
        // const numbers = e.target.value.match(/\d+/g) || [''];
        // const id = numbers[0];
        let id = e.target.value;
        // id = "27-Flappy%20Parrot";
        this.setState({
            projectID: id,
        });
        // if (newProjectURL !== this.state.projectURL) {
        //     if (this.timeoutID != null) {
        //         window.clearTimeout(this.timeoutID);
        //     }
        //     if (id !== '' && this.props.onProjectID) {
        //         this.timeoutID = window.setTimeout(() => {
        //             this.props.onProjectID(id);
        //             this.timeoutID = null;
        //         }, 500);
        //     }
        // }
    }

    handleURLInputButtonClick (e) {
        this.props.onProjectID(this.state.projectID);
    }
}
