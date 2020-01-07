import fetch from 'node-fetch';
import querystring from 'querystring';

const hydraUrl = process.env.HYDRA_ADMIN_URL;
const mockTlsTermination = process.env.MOCK_TLS_TERMINATION ? {'X-Forwarded-Proto': 'https'} : {};

type Flow = 'login' | 'consent' | 'logout';
type Action = 'accept' | 'reject';

const get = async (flow : Flow, challenge : string) : Promise<any> => {
    const url = new URL(`/oauth2/auth/requests/${flow}`, hydraUrl);
    url.search = querystring.stringify({[`${flow}_challenge`]: challenge});

    const response = await fetch(url.toString());

    if (response.status < 200 || response.status > 302) {
        const body = await response.json();

        console.error(`An error occurred while making an HTTP request: ${body}`);
        throw new Error(body.error.message);
    }

    return response.json();
};

const put = async (flow : Flow, action : Action, challenge : string, body : any) : Promise<any> => {
    const url = new URL(`/oauth2/auth/requests/${flow}/${action}`, hydraUrl);
    url.search = querystring.stringify({[`${flow}_challenge`]: challenge});

    const response = await fetch(
        url.toString(),
        {
            method: 'PUT',
            body: JSON.stringify(body),
            headers: {
                'Content-Type': 'application/json',
                ...mockTlsTermination
            },
        }
    );

    if (response.status < 200 || response.status > 302) {
        const body = await response.json();

        console.error(`An error occurred while making an HTTP request: ${body}`);
        throw new Error(body.error.message);
    }

    return response.json();
};

export type CompletedRequest = {
    redirect_to : string;
};

export type OAuth2Client = {
    client_id : string;
    client_name : string;
    metadata : Record<string, any>;
};

export type LoginRequest = {
    client : OAuth2Client;
    skip : boolean;
    subject : 'string';
};

export type AcceptLoginRequest = {
    subject : string;
    remember? : boolean;
    remember_for? : number;
};

export type ConsentRequest = {
    client : OAuth2Client;
    skip : boolean;
    subject : string;
    requested_scope : string[];
    requested_access_token_audience : string[];
};

export type AcceptConsentRequest = {
    grant_access_token_audience?: string[];
    grant_scope?: string[];
    remember? : boolean;
    remember_for? : number;
    session?: {
        access_token?: Record<string, object>;
        id_token?: Record<string, object>;
    };
};

export type RejectConsentRequest = {
    error? : string;
    error_description? : string;
};

export type AcceptLogoutRequest = {
    grant_access_token_audience?: string[];
    grant_scope?: [];
    remember? : boolean;
    remember_for? : number;
    session?: {
        access_token: Record<string, object>;
        id_token: Record<string, object>;
    };
};

export const getClient = async (id : string) : Promise<OAuth2Client> => {
    const url = new URL(`/clients/${id}`, hydraUrl);
    const response = await fetch(url.toString());

    if (response.status !== 200) {
        const body = await response.json();

        console.error(`An error occurred while making an HTTP request: ${body}`);
        throw new Error(body.error.message);
    }

    return response.json();
};
export const getLoginRequest = (challenge : string) : Promise<LoginRequest> => get('login', challenge);
export const acceptLoginRequest = (
    challenge : string,
    body : AcceptLoginRequest
) : Promise<CompletedRequest> => put('login', 'accept', challenge, body);
export const getConsentRequest = (challenge : string) : Promise<ConsentRequest> => get('consent', challenge);
export const acceptConsentRequest = (
    challenge : string,
    body : AcceptConsentRequest
) : Promise<CompletedRequest> => put('consent', 'accept', challenge, body);
export const rejectConsentRequest = (
    challenge : string,
    body : RejectConsentRequest
) : Promise<CompletedRequest> => put('consent', 'reject', challenge, body);
export const acceptLogoutRequest = (
    challenge : string,
    body : AcceptLogoutRequest
) : Promise<CompletedRequest> => put('logout', 'accept', challenge, body);
