const http = require('http');

const data = JSON.stringify({
  name: "Tsuki",
  species: "dog",
  breedId: "Spitz",
  birthDate: "2024-03-14T15:50:55.323Z",
  isNeutered: false,
  sex: "male",
  weightKg: 10.0,
  category: "SMALL",
  coatType: "SHORT",
  groomingBehavior: "CALM",
  skinCondition: "HEALTHY"
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/pets',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    // Use the user's ID from the seed script to bypass complex token auth if possible,
    // or just let it hit the guard and log the error. We just need the 500 error, not a 401.
    'Authorization': 'Bearer test' 
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk}`);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
