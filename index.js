require('dotenv').config();
const express = require('express');
const algosdk = require('algosdk');
const algokit = require('@algorandfoundation/algokit-utils');
const fs = require('fs');
const path = require('path');

// Importar el archivo JSON
const investmentCallerPath = path.join(__dirname, 'InvestmentCaller.arc32.json');
const APP_SPEC = JSON.parse(fs.readFileSync(investmentCallerPath, 'utf8'));


const app = express();
app.use(express.json());

// Configuración de Algorand y Algokit
const algodToken = process.env.ALGOD_TOKEN;
const algodServer = process.env.ALGOD_SERVER;
const algodPort = process.env.ALGOD_PORT;

const algodClient = new algosdk.Algodv2(algodToken, algodServer, algodPort);


let assetId; // Guardará el ID del activo después de su creación

app.use((req, res, next) => {
    if(req.headers.authorization) {
        try{
            req.account = algosdk.mnemonicToSecretKey(req.headers.authorization);
        }catch(e){
            res.status(401).send('No autorizado');
        }
        next();
    }else{
        res.status(401).send('No autorizado');
    }
});

// Ruta para desplegar el contrato inteligente
app.post('/deploy-contract', async (req, res) => {
    try {
        const client = algokit.getAppClient({
            sender: req.account,
            resolveBy: 'id',
            id: 0,
            app: APP_SPEC
          }, algodClient);

        const app = await client.create({ method: 'createApplication()void', methodArgs: [] });
          //console.log(app);
        
        return res.json(app);
    } catch (error) {
        console.error(error);
        return res.status(500).send('Error desplegando contrato');
    }
});

// Ruta para emitir acciones
app.post('/emit-shares', async (req, res) => {
    const { name, unitName, quantity, appId } = req.body;
    const methodArgs = [name, unitName, quantity];
    try {
        const client = algokit.getAppClient({
            sender: req.account,
            resolveBy: 'id',
            id: appId,
            app: APP_SPEC
            }, algodClient);

        await client.fundAppAccount(algokit.microAlgos(550_000));
        const asset = await client.call({ method: 'emmitAndGetShares(string,string,uint64)uint64', methodArgs, sendParams: { fee: algokit.microAlgos(12_000) } });
        return res.json({assetId : Number(asset.return.returnValue) });
    } catch (error) {
        console.error(error);
        return res.status(500).send('Error desplegando contrato');
    }
});

// Ruta para crear un titular de acciones
app.post('/create-holder', async (req, res) => {
    
        const { address, data, appId } = req.body;
        const methodArgs = [ address, [data.firstName,data.lastName,data.email,data.phone] ];

        try {
            const client = algokit.getAppClient({
                sender: req.account,
                resolveBy: 'id',
                id: appId,
                app: APP_SPEC
                }, algodClient);
            
            const result = await client.call({ method: 'createHolder(address,(string,string,string,string))void', methodArgs, sendParams: { fee: algokit.microAlgos(12_000) } });
            
            return res.json({ msj : "Titular de acciones creado", txId :result.transactions[0].txId});
        } catch (error) {
            console.log("Error",error);
            return res.status(500).send('Error desplegando contrato');
        }
  
});

app.post('/optin-token', async (req, res) => {
    const assetId = req.body.assetId;

    try {
        await algokit.assetOptIn({ account : req.account, assetId: assetId }, algodClient);
        return res.json({ msj : "Opt-in realizado"});
    } catch (error) {
        console.log("Error",error);
        return res.status(500).send('Error al hacer el optin');
    }
});

app.post('/fund', async (req, res) => {
    const { address, amount } = req.body;
    console.log(address, amount);
    try {   
        const suggestedParams = await algodClient.getTransactionParams().do();
        const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
            from: req.account.addr,
            to: address,
            amount: amount, // Transferir 1 Algos
            suggestedParams
        });
        const signedTxn = txn.signTxn(req.account.sk);
        const { txId } = await algodClient.sendRawTransaction(signedTxn).do();
        await algosdk.waitForConfirmation(algodClient, txId, 4);
        return res.json({ msj : "Fondos transferidos", txId});
    } catch (error) {
        console.log("Error",error);
        return res.status(500).send('Error al hacer el optin');
    }
})

// Ruta para hacer opt-in y transferir tokens
app.post('/transfer-tokens', async (req, res) => {
        const { receiver, appId } = req.body;
        methodArgs = [receiver];
        try {
            const client = algokit.getAppClient({
                sender: req.account,
                resolveBy: 'id',
                id: appId,
                app: APP_SPEC
                }, algodClient);
            
            const result = await client.call({ method: 'transferToken(address)void', methodArgs, sendParams: { fee: algokit.microAlgos(12_000) } });
            
            return res.json({ msj : "Titular de acciones creado", txId :result.transactions[0].txId});
        } catch (error) {
            console.log("Error",error);
            return res.status(500).send('Error desplegando contrato');
        }
});

// Configurar servidor
const PORT = process.env.PORT || 3000;
server = app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en el puerto ${PORT}`);
});

module.exports = { app, server };