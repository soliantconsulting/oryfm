import {Request} from 'express';
import fs from 'fs';
import url from 'url';

export const absoluteUrl = (request : Request, pathname : string) => url.format({
    protocol: request.protocol,
    host: request.get('host'),
    pathname,
});

let customLabels : Record<string, string> | null = null;

export const cl = (text : string, params : Record<string, Object> = {}) : string => {
    if (customLabels === null) {
        const filename = `${process.cwd()}/custom-labels.json`;

        if (!fs.existsSync(filename)) {
            customLabels = {};
            return text;
        }

        customLabels = JSON.parse(fs.readFileSync(filename).toString());
    }

    let label = customLabels[text] || text;

    Object.keys(params).map(key => {
        label = label.replace(new RegExp('\\{\\{' + key + '\\}\\}', 'g'), params[key].toString());
    });

    return label;
};
