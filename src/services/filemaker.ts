import fetch from 'node-fetch';

const fileMakerUrl = process.env.FILEMAKER_URL;
const fileMakerUsername = process.env.FILEMAKER_USERNAME;
const fileMakerPassword = process.env.FILEMAKER_PASSWORD;
const fileMakerDatabase = process.env.FILEMAKER_DATABASE;
const fileMakerLayout = process.env.FILEMAKER_LAYOUT;

// Technically tokens are valid for 15 minutes after the last call, but we refresh every 14.
const tokenTimeout = 14 * 60 * 1000;

export class AuthenticationError extends Error
{
}

export type FileMakerUser = {
    id : string;
    displayName : string;
    emailAddress : string;
    passwordHash? : string;
};

class FileMaker
{
    private readonly url : string;
    private readonly username : string;
    private readonly password : string;
    private readonly database : string;
    private readonly layout : string;
    private token : string | null = null;
    private lastCall = 0;

    public constructor(url : string, username : string, password : string, database : string, layout : string)
    {
        this.url = url;
        this.username = username;
        this.password = password;
        this.database = database;
        this.layout = layout;
    }

    public withCredentials(username : string, password : string) : FileMaker
    {
        return new FileMaker(this.url, username, password, this.database, this.layout);
    }

    public async execute(script : string, params = {}) : Promise<any>
    {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await this.getToken()}`,
        };

        const response = await fetch(
            `${this.url}/fmi/data/v1/databases/${this.database}/layouts/${this.layout}/script/${script}?script.param=`
            + encodeURIComponent(JSON.stringify(params)),
            {headers}
        );

        if (!response.ok) {
            throw new Error('Error while calling script');
        }

        const body = await response.json();
        this.lastCall = Date.now();

        return JSON.parse(body.response.scriptResult);
    }

    public async clearSession() : Promise<void>
    {
        if (this.token === null) {
            return;
        }

        const headers = {
            'Content-Type': 'application/json',
        };

        const response = await fetch(
            `${this.url}/fmi/data/v1/databases/${this.database}/sessions/${this.token}`,
            {
                method: 'DELETE',
                headers,
            }
        );

        if (!response.ok) {
            throw new Error('Could not clear session');
        }

        this.token = null;
        this.lastCall = 0;
    }

    private async getToken() : Promise<string>
    {
        if (this.token !== null && Date.now() - this.lastCall < tokenTimeout) {
            return this.token;
        }

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + Buffer.from(`${this.username}:${this.password}`).toString('base64'),
        };

        const response = await fetch(`${this.url}/fmi/data/v1/databases/${this.database}/sessions`, {
            method: 'POST',
            body: '{}',
            headers,
        });

        if (!response.ok) {
            throw new AuthenticationError('Could not get token');
        }

        this.token = response.headers.get('X-FM-Data-Access-Token');
        this.lastCall = Date.now();

        return this.token;
    }
}

const fileMaker = new FileMaker(fileMakerUrl, fileMakerUsername, fileMakerPassword, fileMakerDatabase, fileMakerLayout);

export const authenticateUser = async (username : string, password : string) : Promise<FileMakerUser | null> => {
    const localFileMaker = fileMaker.withCredentials(username, password);
    let user;

    try {
        user = getUser('username', username);
    } catch (e) {
        if (e instanceof AuthenticationError) {
            return null;
        }

        throw e;
    }

    await localFileMaker.clearSession();
    return user;
};

export const getUser = async (
    field: 'id' | 'username' | 'emailAddress',
    value : string,
    localFileMaker? : FileMaker
) : Promise<FileMakerUser | null> => {
    const result = await (localFileMaker || fileMaker).execute('getUser', {field, value});

    if (!result.result) {
        return null;
    }

    return {
        id: result.user.id,
        displayName: result.user.displayName,
        emailAddress: result.user.emailAddress,
        passwordHash: result.user.passwordHash,
    };
};

export const requestPasswordResetLink = async (
    emailAddress : string,
    uriTemplate : string,
    returnResetLink = false
) : Promise<string | boolean> => {
    const result = await fileMaker.execute('requestPasswordResetLink', {
        emailAddress,
        uriTemplate,
        debug: returnResetLink,
    });

    if (!result.result) {
        return false;
    }

    if (returnResetLink) {
        return result.debug.resetLink;
    }

    return true;
};

export const validatePasswordResetToken = async (resetToken : string) : Promise<boolean> => {
    return (await fileMaker.execute('validatePasswordResetToken', {resetToken})).result;
};

export const resetPassword = async (resetToken : string, passwordHash : string) : Promise<boolean> => {
    return (await fileMaker.execute('resetPasswordHash', {resetToken, passwordHash})).result;
};

export const setPassword = async (userId : string, passwordHash : string) : Promise<boolean> => {
    return (await fileMaker.execute('setPasswordHash', {userId, passwordHash})).result;
};
