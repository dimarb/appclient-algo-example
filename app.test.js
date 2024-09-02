const request = require('supertest');
const { app, server } = require('./index'); // Importar la aplicación y el servidor
const { algorandFixture } = require('@algorandfoundation/algokit-utils/testing');
const algokit = require('@algorandfoundation/algokit-utils');   
const algosdk = require('algosdk');

afterAll(() => {
    server.close(); // Cerrar el servidor después de todas las pruebas
});

let assetId; 
let receiver;
let appId;// Guardará el ID del activo después de su creación

describe('Pruebas de API para rutas HTTP',  () => {
    let mnemonico ;
    beforeAll(async () => {
        const fixture = algorandFixture({
            algodConfig: {
              server: 'http://localhost',
              port: 4001,
              token: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
            },
            indexerConfig: {
              server: 'http://localhost',
              port: 8980,
              token: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
            },
            kmdConfig: {
              server: 'http://localhost',
              port: 4002,
              token: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
            }
          });
        await fixture.beforeEach();
        const { testAccount } = fixture.context;
        mnemonico = algosdk.secretKeyToMnemonic(testAccount.sk); 
        algokit.Config.configure({ populateAppCallResources: true });
    });

    

    test('POST /deploy-contract - debería desplegar el contrato', async () => {
        const response = await request(app)
            .post('/deploy-contract')
            .set('Authorization', mnemonico)
            .send();
        appId = response.body.appId;
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('appId');
    });

    test('POST /emit-shares - debería emitir acciones', async () => {
        const response = await request(app)
            .post('/emit-shares')
            .set('Authorization', mnemonico)
            .send({ name: 'TestToken', unitName: 'TTK', quantity: 1000, appId })
        
        assetId = response.body.assetId;
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('assetId');
    });

    test('POST /create-holder - debería crear un titular de acciones', async () => {
        const newAccount = algosdk.generateAccount();
        receiver = newAccount;
        const response = await request(app)
            .post('/create-holder')
            .set('Authorization', mnemonico)
            .send({ address: newAccount.addr, data: { firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '1234567890' }, appId });
        expect(response.status).toBe(200);
        expect(response.body.msj).toBe('Titular de acciones creado');
    });


    test('POST /fund - debería entregar fondos a la cuenta del comprador', async () => {
        
        const response = await request(app)
            .post('/fund')
            .set('Authorization', mnemonico)
            .send({ address : receiver.addr, amount: 212_000 });
        expect(response.status).toBe(200);
        
    });

    test('POST /optin-token - debería realizar opt-in a la cuenta del comprador', async () => {
        mnemonicoOptIn = algosdk.secretKeyToMnemonic(receiver.sk); 
        const response = await request(app)
            .post('/optin-token')
            .set('Authorization', mnemonicoOptIn)
            .send({  assetId });
        expect(response.status).toBe(200);
        
    });

    test('POST /transfer-tokens - debería  transferir tokens', async () => {
        const response = await request(app)
            .post('/transfer-tokens')
            .set('Authorization', mnemonico)
            .send({ receiver: receiver.addr, appId });
        expect(response.status).toBe(200);
        expect(response.body.msj).toBe('Titular de acciones creado');
    });
});