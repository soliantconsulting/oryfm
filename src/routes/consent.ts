import express from 'express';
import {sanitizeBody} from 'express-validator';
import {getUser} from '../services/filemaker';
import {
    AcceptConsentRequest,
    acceptConsentRequest,
    ConsentRequest,
    getConsentRequest,
    rejectConsentRequest
} from '../services/hydra';
import {cl} from '../utils';

const router = express.Router();

const defaultRememberTime = parseInt(process.env.CONSENT_DEFAULT_REMEMBER_TIME, 10);
const userRememberTime = parseInt(process.env.CONSENT_USER_REMEMBER_TIME, 10);

router.get('/', async (request, response, next) => {
    try {
        const challenge = request.query.consent_challenge as string;
        const consentRequest = await getConsentRequest(challenge);

        if (consentRequest.skip || consentRequest.client.metadata.first_party_client) {
            const completedRequest = await acceptConsentRequest(
                challenge,
                await createAcceptConsentRequest(consentRequest, false)
            );
            response.redirect(completedRequest.redirect_to);
            return;
        }

        renderForm(request, response, challenge, consentRequest);
    } catch (e) {
        next(e);
    }
});

router.post('/', ...[
    sanitizeBody('remember').toBoolean(),
    sanitizeBody('allow').toBoolean(),
], async (request, response, next) => {
    try {
        const challenge = request.body.challenge;
        const consentRequest = await getConsentRequest(challenge);

        if (!request.body.allow) {
            const completedRequest = await rejectConsentRequest(challenge, {
                error: 'access_denied',
                error_description: 'The resource owner denied the request',
            });
            response.redirect(completedRequest.redirect_to);
            return;
        }

        const completedRequest = await acceptConsentRequest(
            challenge,
            await createAcceptConsentRequest(consentRequest, request.body.remember)
        );
        response.redirect(completedRequest.redirect_to);
    } catch (e) {
        next(e);
    }
});

const renderForm = (
    request : express.Request,
    response : express.Response,
    challenge : string,
    consentRequest : ConsentRequest
) => {
    response.render('consent', {
        csrfToken: request.csrfToken(),
        challenge,
        client: consentRequest.client,
        scope: labelScope(consentRequest),
        showRememberChoice: userRememberTime > defaultRememberTime,
    });
};

const knownScope : Record<string, string> = {
    'email': cl('See your email address'),
    'profile': cl('See your name'),
};

const labelScope = (consentRequest : ConsentRequest) => consentRequest.requested_scope.filter(
    scope => scope in knownScope
).map(scope => knownScope[scope]);

const createAcceptConsentRequest = async (
    consentRequest : ConsentRequest,
    remember : boolean
) : Promise<AcceptConsentRequest> => {
    const user = await getUser('id', consentRequest.subject);
    const idToken : Record<string, any> = {};

    if (consentRequest.requested_scope.includes('profile')) {
        idToken.name = user.displayName;
    }

    if (consentRequest.requested_scope.includes('email')) {
        idToken.email = user.emailAddress;
    }

    const body : AcceptConsentRequest = {
        grant_scope: consentRequest.requested_scope,
        grant_access_token_audience: consentRequest.requested_access_token_audience,
    };

    if (defaultRememberTime > 0 || (remember && userRememberTime > defaultRememberTime)) {
        body.remember = true;
        body.remember_for = remember && userRememberTime > defaultRememberTime
            ? userRememberTime
            : defaultRememberTime;
    }

    if (Object.entries(idToken).length > 0) {
        body.session = {
            id_token: idToken,
        };
    }

    return body;
};

export default router;
