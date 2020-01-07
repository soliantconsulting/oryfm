# OryFM

OryFM is an OAuth2 identity provider for FileMaker and Ory Hydra.

## Development

To start developing OryFM, there's handy script assisting you:

```bash
dev.sh setup
```

When you messed up something in a database or need a refresh, there's a command to do a reset:

```bash
dev.sh reset
```

Next you'll want to run the application via npm:

```bash
npm run watch
```

Then you can test the implementation by calling for instance this URL:

```bash
http://localhost:4444/oauth2/auth?
client_id=dev
&redirect_uri=http://localhost:12345/login-callback
&scope=openid+email+profile
&response_type=token+id_token
&state=56d21661e36c85f28159969d038d2b5f6f3ddcc7
&nonce=56d21661e36c85f28159969d038d2b5f6f3ddcc7
```
