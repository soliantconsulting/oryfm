import createError from 'http-errors';
import express from 'express';
import path from 'path';
import logger from 'morgan';
import cookieParser from 'cookie-parser';
import csrf from 'csurf';
import {cl} from './utils';

import loginRouter from './routes/login';
import consentRouter from './routes/consent';
import logoutRouter from './routes/logout';
import errorRouter from './routes/error';
import passwordReset from './routes/password-reset';

const app = express();

if (process.env.THEME_CSS_URL) {
    app.locals.themeCssUrl = process.env.THEME_CSS_URL;
}

app.locals.cl = cl;
app.locals.authenticationMethod = process.env.AUTHENTICATION_METHOD;

app.set('views', path.join(process.cwd(), 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.urlencoded({extended: false}));
app.use(express.static(path.join(process.cwd(), 'public')));
app.use(cookieParser());
app.use(csrf({cookie: true}));

app.use('/login', loginRouter);
app.use('/consent', consentRouter);
app.use('/logout', logoutRouter);
app.use('/error', errorRouter);

if (process.env.AUTHENTICATION_METHOD !== 'basic-auth') {
    app.use('/password-reset', passwordReset);
}

app.use((request, response, next) => {
    next(createError(404));
});

app.use((error : any, request : express.Request, response : express.Response, next : express.NextFunction) => {
    response.status(error.status || 500);
    response.render('error', {
        message: error.message,
        error: request.app.get('env') === 'development' ? error : {},
    });
});

export default app;
