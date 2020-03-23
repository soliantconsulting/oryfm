#!/bin/bash

usage()
{
    echo "usage: $0 setup|reset"
}

migrate_hydra()
{
    docker-compose run --rm hydra migrate sql --yes "postgres://dev:dev@postgres:5432/dev?sslmode=disable"
}

import_test_client()
{
    docker-compose exec hydra hydra clients import /opt/dev-client.json \
        --endpoint http://hydra:4445/
}

delete_test_client()
{
    docker-compose exec hydra hydra clients delete dev \
        --endpoint http://hydra:4445/
}

setup()
{
    touch .env
    migrate_hydra

    read -p "FileMaker URL: " fileMakerUrl
    read -p "FileMaker Database: " fileMakerDatabase
    read -p "FileMaker Username: " fileMakerUsername
    read -s -p "FileMaker Password: " fileMakerPassword
    read -s -p "FileMaker Layout: " fileMakerLayout

    echo "FILEMAKER_URL=$fileMakerUrl" > .env
    echo "FILEMAKER_DATABASE=$fileMakerDatabase" >> .env
    echo "FILEMAKER_USERNAME=$fileMakerUsername" >> .env
    echo "FILEMAKER_PASSWORD=$fileMakerPassword" >> .env
    echo "FILEMAKER_LAYOUT=$fileMakerLayout" >> .env

    echo "LOGIN_USER_REMEMBER_TIME=2592000" >> .env
    echo "CONSENT_USER_REMEMBER_TIME=2592000" >> .env

    echo "HYDRA_ADMIN_URL=http://localhost:4445" >> .env
    echo "AUTHENTICATION_METHOD=bcrypt" >> .env
    echo "MOCK_TLS_TERMINATION=" >> .env
    echo "TEST_MODE=true" >> .env

    docker-compose up -d
    import_test_client
    echo "Setup complete"
}

reset()
{
    docker-compose down
    migrate_hydra
    docker-compose up -d
    delete_test_client
    import_test_client
    npm install
}

case "$1" in
    setup)
        setup
        ;;
    reset)
        reset
        ;;
    *)
        usage
        ;;
esac
