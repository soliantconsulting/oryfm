import csrf from 'csurf';
import express from 'express';
import url from 'url';
import {acceptLogoutRequest} from '../services/hydra';

const router = express.Router();
const csrfProtection = csrf({cookie: true});

router.get('/', csrfProtection, async (request, response, next) => {
    try {
        const query = url.parse(request.url, true).query;
        const challenge = query.logout_challenge as string;

        const completedRequest = await acceptLogoutRequest(challenge, {});
        response.redirect(completedRequest.redirect_to);
    } catch (e) {
        next(e);
    }
});

export default router;
