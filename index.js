/*
 * This is a demo script to show you how to connect successfully.
 * The code will be callback hell because it's easy and just to show you the basics.
 *
 * Make sure the account has access to Rocket League. (Family sharing untested)
 */

const RLAppId = 252950;
//const RLEndpoint = 'https://psyonix-rl.appspot.com/Services';
const RLEndpoint = 'https://api.rlpp.psynet.gg/Services';
const RLKey = 'c338bd36fb8c42b1a431d30add939fc7';

const RLUserAgent = 'RL Win/191113.75055.254903 gzip';
const RLLanguage = 'INT';
const RLFeatureSet = 'PrimeUpdate31';
const RLEnvironment = 'Prod';

const config = require('./demo_config');
const Utils = require('./lib/utils');
const SteamUser = require('steam-user');
const CryptoJS = require('crypto-js');
const WebSocket = require('ws');

// const username = config.username;
// const password = config.password;
// const displayName = config.steamname;
// const RLBuildId = config.BuildID; 
//This is used for the github version of the package (https://github.com/YEET78/rocketleague-api)

const username = "Your steam username";
const password = "Your steam password";
const displayName = "Your steam display name";
const RLBuildId = "Build ID"; //Build ID will change every game update


let request = require('request');
let clientSteam = new SteamUser();

// Step 0: Verify config.
//if (!Config.username) {
//    console.log('Field "username" is missing from the config.');
//    return;
//}

//if (!Config.password) {
//    console.log('Field "password" is missing from the config.');
//    return;
//}

//if (!Config.displayName) {
//    console.log('Field "displayName" is missing from the config.');
//    return;
//}

// Step 1: Sign into Steam.

clientSteam.logOn({
    'accountName': username,
    'password': password
});

clientSteam.on('loggedOn', details => {
    console.log('[Steam] Signed into Steam as ' + clientSteam.steamID + '.');

    // Step 2: Request an appticket (AuthTicket).
    clientSteam.getEncryptedAppTicket(RLAppId, null, (err, ticket) => {
        if (err) {
			console.log("[Steam] AppTicket error: " + err);
            return;
        }

        console.log('[Steam] Received an appticket.');

        // Step 3: Authenticate at RocketLeague.
        let authRequest = JSON.stringify([
            {
                Service: 'Auth/AuthPlayer',
                Version: 1,
                ID: 1,
                Params: {
                    Platform: 'Steam',
                    PlayerName: displayName,
                    PlayerID: clientSteam.steamID.getSteamID64(),
                    Language: RLLanguage,
                    AuthTicket: Utils.bufferToHex(ticket).toUpperCase(),
                    BuildRegion: '',
                    FeatureSet: RLFeatureSet,
                    bSkipAuth: false
                }
            }
        ]);

        let authSignature = CryptoJS.HmacSHA256('-' + authRequest, RLKey).toString();

        request.post({
            url: RLEndpoint,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': RLUserAgent,
                'Cache-Control': 'no-cache',
                'PsyBuildID': RLBuildId,
                'PsyEnvironment': RLEnvironment,
                'PsyRequestID': 'PsyNetMessage_X_0',
                'PsySig': Buffer.from(authSignature, 'hex').toString('base64')
            },
            body: authRequest
        }, (error, response, body) => {
            if (error) {
                return console.log('[RocketLeague] Auth failed: ' + error);
            }

            // Step 4: Consume tokens to send authenticated requests.
            let authResponse = JSON.parse(body).Responses[0].Result;
            if (authResponse === undefined) {
                return console.log('[RocketLeague] Auth failed: ' + body);
            }

            let authWebsocket = authResponse.PerConURL;
            let authPsyToken = authResponse.PsyToken;
            let authSessionId = authResponse.SessionID;

            console.log('[RocketLeague] Auth was successful.');
            console.log('[RocketLeague] Connecting to RocketLeague through WebSocket.');
	    //console.log(Utils.bufferToHex(ticket).toUpperCase());
	    console.log(clientSteam.steamID.getSteamID64());
            
            const client = new WebSocket(authWebsocket, {
                headers: {
                    'PsyToken': authPsyToken,
                    'PsySes	sionID': authSessionId,
                    'PsyBuildID': RLBuildId,
                    'PsyEnvironment': RLEnvironment,
                    'User-Agent': RLUserAgent
                }
            });

            client.on('open', function () {
                console.log('[RocketLeague] Connected to WebSocket.')

                client.on('message', function (data) {
                    // Parse message.
                    let start = data.indexOf('\r\n\r\n')
                    if (start !== -1) {
                        start += 4
                        let dataLen = data.length - start;
                        if (dataLen === 0) {
                            // No message data.
                            console.log('No data was found.');
                        } else {
                            // We got a message.
                            let jsonString = data.substring(start);
                            let jsonPretty = JSON.stringify(JSON.parse(jsonString), null, 2);

                            console.log(jsonPretty);
                        }
                    }
                });

                console.log('[RocketLeague] Requesting inventory of signed in player..');

                // Create message.
                let msgBody = JSON.stringify([
                    {
                        //Service: 'Products/GetPlayerProducts',
			            Service: 'Skills/GetPlayerSkill',
                        Version: 1,
                        ID: 3,
                        Params: {
                            //PlayerID: 'Steam|' + clientSteam.steamID.getSteamID64() + '|0',
			                PlayerID: 'Steam|76561197992682099|0',
			                bVerified: true
                        }
                    }
                ]);

                // Create signature for the message.
                let msgSignature = CryptoJS.HmacSHA256('-' + msgBody, RLKey).toString();
                let msgSignatureBase = Buffer.from(msgSignature, 'hex').toString('base64');

                // Setup headers.
                let msgHeaders = "PsySig: " + msgSignatureBase + "\r\n" +
                                 "PsyRequestID: PsyNetMessage_X_2\r\n" +
                                 "\r\n";

                // Create final message.
                let msgFinal = msgHeaders + msgBody;

                // Send message.
                client.send(msgFinal);
		
            })
        });
    });
});

clientSteam.on('error', function(e) {
    console.log(e);
});
