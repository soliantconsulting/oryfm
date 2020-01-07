#!/usr/bin/env node

import debug from 'debug';
import http from 'http';
import dotenv from 'dotenv';

dotenv.config();
const log = debug('oryfm:server');

const normalizePort = (value : string) => {
    const port = parseInt(value, 10);

    if (isNaN(port)) {
        return value;
    }

    if (port >= 0) {
        return port;
    }

    return false;
};

import('./app').then(app => {
    const port = normalizePort(process.env.PORT || '3000');
    app.default.set('port', port);

    const server = http.createServer(app.default);
    server.listen(port);

    server.on('error', (error : any) => {
        if (error.syscall !== 'listen') {
            throw error;
        }

        const bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

        switch (error.code) {
            case 'EACCES':
                console.error(bind + ' requires elevated privileges');
                process.exit(1);
                break;

            case 'EADDRINUSE':
                console.error(bind + ' is already in use');
                process.exit(1);
                break;

            default:
                throw error;
        }
    });

    server.on('listening', () => {
        const address = server.address();
        const bind = typeof address === 'string' ? 'pipe ' + address : 'port ' + address.port;

        log('Listening on ' + bind);
    });
});
