import express from 'express';
import bcrypt from 'bcrypt';
import {body, sanitizeBody, validationResult} from 'express-validator';
import {authenticateUser, getUser} from '../services/filemaker';
import {AcceptLoginRequest, acceptLoginRequest, getLoginRequest, LoginRequest} from '../services/hydra';
import {cl} from '../utils';

const router = express.Router();

const defaultRememberTime = parseInt(process.env.LOGIN_DEFAULT_REMEMBER_TIME, 10);
const userRememberTime = parseInt(process.env.LOGIN_USER_REMEMBER_TIME, 10);

router.get('/', async (request, response, next) => {
    try {
        const challenge = request.query.login_challenge;
        const loginRequest = await getLoginRequest(challenge);

        if (loginRequest.skip) {
            const completedRequest = await acceptLoginRequest(challenge, {subject: loginRequest.subject});
            response.redirect(completedRequest.redirect_to);
            return;
        }

        renderForm(request, response, challenge, loginRequest);
    } catch (e) {
        next(e);
    }
});

const identifierValidation = process.env.AUTHENTICATION_METHOD !== 'basic-auth'
    ? body('emailAddress', cl('Valid email address required')).isEmail()
    : body('username', cl('Username required')).not().isEmpty();

router.post('/', ...[
    identifierValidation,
    body('password', cl('Password required')).not().isEmpty(),
    sanitizeBody('remember').toBoolean(),
], async (request, response, next) => {
    try {
        const challenge = request.body.challenge;
        const loginRequest = await getLoginRequest(challenge);
        const errors = validationResult(request);

        if (!errors.isEmpty()) {
            renderForm(
                request,
                response,
                challenge,
                loginRequest,
                errors.array({onlyFirstError: true}).map(error => error.msg)
            );
            return;
        }

        let user;

        if (process.env.AUTHENTICATION_METHOD !== 'basic-auth') {
            user = await getUser('emailAddress', request.body.emailAddress);

            if (!await bcrypt.compare(request.body.password, user.passwordHash)) {
                user = undefined;
            }
        } else {
            user = await authenticateUser(request.body.username, request.body.password);
        }

        if (!user) {
            renderForm(request, response, challenge, loginRequest, [cl('Invalid credentials')]);
            return;
        }

        const body : AcceptLoginRequest = {
            subject: user.id,
        };

        if (defaultRememberTime > 0 || (request.body.remember && userRememberTime > defaultRememberTime)) {
            body.remember = true;
            body.remember_for = request.body.remember && userRememberTime > defaultRememberTime
                ? userRememberTime
                : defaultRememberTime;
        }

        const completedRequest = await acceptLoginRequest(challenge, body);
        response.redirect(completedRequest.redirect_to);
    } catch (e) {
        next(e);
    }
});

const renderForm = (
    request : express.Request,
    response : express.Response,
    challenge : string,
    loginRequest : LoginRequest,
    errors : string[] = []
) => {
    if (errors.length > 0) {
        response.status(422);
    }

    response.render('login', {
        csrfToken: request.csrfToken(),
        challenge,
        showRememberChoice: userRememberTime > defaultRememberTime,
        client: loginRequest.client,
        errors,
    });
};

export default router;
