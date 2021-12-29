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

import { h } from '../xml';

export default class Primitive {
    value: any;
    isOption: boolean;

    constructor(value: any, isOption = false) {
        this.value = value;
        this.isOption = isOption;
    }

    toString(): string {
        return this.value.toString();
    }

    toXML(): HTMLElement {
        if (this.isOption) {
            // @ts-ignore
            return <l><option>{this.value}</option></l>;
        }
        if (typeof this.value === 'boolean') {
            if (this.value) {
                // @ts-ignore
                return <l><bool>true</bool></l>;
            }
            // @ts-ignore
            return <l/>;
        }
        if (this.value == null) {
            // @ts-ignore
            return <l/>;
        }
        // @ts-ignore
        return <l>{this.value}</l>;
    }
}
