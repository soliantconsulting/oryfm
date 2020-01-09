import express from 'express';

const router = express.Router();

router.get('/', async (request, response) => {
    response.render('hydra-error', {
        description: request.query.error_description as string,
        hint: request.query.error_hint as string,
    });
});

export default router;
