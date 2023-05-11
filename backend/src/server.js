// express app
const app = require('./app');

// port to listen on
const PORT = parseInt(process.env.SERVER_PORT);

// database connection test
const { MongoClient } = require('mongodb')
const client = new MongoClient(process.env.MONGODB_URL)

// listen on the specified port
app.listen(PORT, () => {
  console.log(`Backend is listening on port ${PORT}.`);

  // test the database
  let connectionTestString = 'Database connection test ';
  client.connect()
    .then(() => {
      console.log(connectionTestString + 'succeeded.');
      client.close();
    })
    .catch(() => {
      console.error(connectionTestString + 'failed.');
    });
});
