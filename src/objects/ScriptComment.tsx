import { SB3_WORKSPACE_X_SCALE, SB3_WORKSPACE_Y_SCALE } from '../data/SB3Data';
import { h } from '../xml';

export default class ScriptComment {
    x?: number;
    y?: number;
    text: string;
    width: number;
    collapsed: boolean;

    readSB2(jsonArr: any[]): ScriptComment {
        const blockID = jsonArr[5];
        if (blockID === -1) {
            this.x = jsonArr[0];
            this.y = jsonArr[1];
        }
        this.text = jsonArr[6];
        this.width = jsonArr[2];
        this.collapsed = !jsonArr[4];

        return this;
    }

    readSB3(jsonObj: any): ScriptComment {
        const blockID = jsonObj.blockId;
        if (blockID === null) {
            this.x = jsonObj.x / SB3_WORKSPACE_X_SCALE;
            this.y = jsonObj.y / SB3_WORKSPACE_Y_SCALE;
        }
        this.text = jsonObj.text;
        this.width = jsonObj.width / SB3_WORKSPACE_X_SCALE;
        this.collapsed = jsonObj.minimized;

        return this;
    }

    toXML(): Element {
        if (this.x != null && this.y != null) {
            return <comment x={this.x} y={this.y} w={this.width} collapsed={this.collapsed}>
                {this.text}
            </comment>;
        }
        return <comment w={this.width} collapsed={this.collapsed}>
            {this.text}
        </comment>;
    }
}