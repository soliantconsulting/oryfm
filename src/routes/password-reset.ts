import express from 'express';
import bcrypt from 'bcrypt';
import {body, validationResult} from 'express-validator';
import {requestPasswordResetLink, resetPassword, validatePasswordResetToken} from '../services/filemaker';
import {getClient, OAuth2Client} from '../services/hydra';
import {absoluteUrl, cl} from '../utils';

const testMode = Boolean(process.env.TEST_MODE);

const router = express.Router();

router.get('/request/:clientId', async (request, response) => {
    renderRequestForm(request, response);
});

router.post('/request/:clientId', ...[
    body('emailAddress').isEmail(),
], async (request, response, next) => {
    try {
        const errors = validationResult(request);

        if (!errors.isEmpty()) {
            renderRequestForm(request, response, errors.array({onlyFirstError: true}).map(error => error.msg));
            return;
        }

        const uriTemplate = absoluteUrl(request, `/password-reset/set/${request.params.clientId}/{resetToken}`);
        const result = await requestPasswordResetLink(request.body.emailAddress, uriTemplate, testMode);

        if (!result) {
            renderRequestForm(request, response, ['Unknown email address provided']);
            return;
        }

        let redirectUrl = `/password-reset/request-success/${request.params.clientId}`;

        if (testMode) {
            redirectUrl += '?resetLink=' + encodeURIComponent(result);
        }

        response.redirect(redirectUrl);
    } catch (e) {
        next(e);
    }
});

router.get('/request-success/:clientId', async (request, response, next) => {
    try {
        const client = await getClient(request.params.clientId);
        const params : Record<string, any> = {client};

        if (testMode && request.query.resetLink) {
            params.resetLink = request.query.resetLink;
        }

        response.render('password-reset/request-success', params);
    } catch (e) {
        next(e);
    }
});

router.get('/set/:clientId/:token', async (request, response, next) => {
    try {
        const [client, isValidToken] = await Promise.all([
            getClient(request.params.clientId),
            validatePasswordResetToken(request.params.token),
        ]);

        if (!isValidToken) {
            response.render('password-reset/invalid-token', {client});
            return;
        }

        renderSetForm(request, response, client);
    } catch (e) {
        next(e);
    }
});

router.post('/set/:clientId/:token', ...[
    body('password')
        .isLength({min: 8})
        .custom((value, {req}) => {
            if (value !== req.body.confirmPassword) {
                throw new Error(cl('Passwords do not match'));
            }

            return value;
        }),
], async (request, response, next) => {
    try {
        const client = await getClient(request.params.clientId);
        const errors = validationResult(request);

        if (!errors.isEmpty()) {
            renderSetForm(request, response, client, errors.array({onlyFirstError: true}).map(error => error.msg));
            return;
        }

        const passwordHash = await bcrypt.hash(request.body.password, 10);
        const result = resetPassword(request.params.token, passwordHash);

        if (!result) {
            response.render('password-reset/invalid-token', {client});
            return;
        }

        response.redirect(`/password-reset/set-success/${request.params.clientId}`);
    } catch (e) {
        next(e);
    }
});

router.get('/set-success/:clientId', async (request, response, next) => {
    try {
        const client = await getClient(request.params.clientId);
        response.render('password-reset/set-success', {client});
    } catch (e) {
        next(e);
    }
});

const renderRequestForm = (
    request : express.Request,
    response : express.Response,
    errors : string[] = []
) => {
    if (errors.length > 0) {
        response.status(422);
    }

    response.render('password-reset/request', {
        csrfToken: request.csrfToken(),
        clientId: request.params.clientId,
        errors,
    });
};

const renderSetForm = (
    request : express.Request,
    response : express.Response,
    client : OAuth2Client,
    errors : string[] = []
) => {
    if (errors.length > 0) {
        response.status(422);
    }

    response.render('password-reset/set', {
        csrfToken: request.csrfToken(),
        client,
        token: request.params.token,
        errors,
    });
};

export default router;
