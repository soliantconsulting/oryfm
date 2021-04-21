import argon2, {argon2id} from 'argon2';
import bcrypt from 'bcrypt';
import express from 'express';
import {body, validationResult} from 'express-validator';
import {authenticateUser, getUser, setPassword} from '../services/filemaker';
import {AcceptLoginRequest, acceptLoginRequest, getLoginRequest, LoginRequest} from '../services/hydra';
import {cl} from '../utils';

const router = express.Router();

const userRememberTime = parseInt(process.env.LOGIN_USER_REMEMBER_TIME, 10);
const defaultRememberTime = parseInt(process.env.LOGIN_DEFAULT_REMEMBER_TIME, 10);

router.get('/', async (request, response, next) => {
    try {
        const challenge = request.query.login_challenge as string;
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

const verifyPassword = async (password : string, passwordHash : string) => {
    if (passwordHash.startsWith('$2b$')) {
        // This is for legacy accounts only. The hash will be migrated to argon2 on success.
        return bcrypt.compare(password, passwordHash);
    }

    try {
        return await argon2.verify(passwordHash, password);
    } catch (e) {
        return false;
    }
};

const doesPasswordNeedRehash = (passwordHash : string) => {
    if (passwordHash.startsWith('$2b$')) {
        return true;
    }

    try {
        return argon2.needsRehash(passwordHash, {type: argon2id});
    } catch (e) {
        return true;
    }
};

export const generatePasswordHash = (password : string) => argon2.hash(password, {type: argon2id});

const identifierValidation = process.env.AUTHENTICATION_METHOD !== 'basic-auth'
    ? body('emailAddress', cl('Valid email address required')).isEmail()
    : body('username', cl('Username required')).not().isEmpty();

router.post('/', ...[
    identifierValidation,
    body('password', cl('Password required')).not().isEmpty(),
    body('remember').toBoolean(),
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

            if (!user || !await verifyPassword(request.body.password, user.passwordHash)) {
                user = undefined;
            }
        } else {
            user = await authenticateUser(request.body.username, request.body.password);
        }

        if (!user) {
            renderForm(request, response, challenge, loginRequest, [cl('Invalid credentials')]);
            return;
        }

        if (doesPasswordNeedRehash(user.passwordHash)) {
            await setPassword(user.id, await generatePasswordHash(request.body.password));
        }

        const body : AcceptLoginRequest = {
            subject: user.id,
        };

        body.remember = true;
        body.remember_for = request.body.remember ? userRememberTime : defaultRememberTime;

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
        showRememberChoice: userRememberTime > 0 && defaultRememberTime !== userRememberTime,
        client: loginRequest.client,
        errors,
    });
};

export default router;
