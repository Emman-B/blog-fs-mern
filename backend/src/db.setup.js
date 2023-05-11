/**
 * This is a source file for setting up the database. This is primarily meant
 * for testing, allowing for easy regeneration of dummy data as well as resetting the
 * entire database. Thus, this should not be used in any production environment.
 *
 * If no arguments are provided, the database will be set up (equivalent to:
 * "npm run dbsetup -- --setup").
 */

// setup the .env file
require('dotenv').config();
// mongodb module
const { MongoClient } = require('mongodb')
// filesystem module
const fs = require('fs');
// module for parsing arguments
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// == VARIABLES ==
const usageString = 'Usage: npm run dbsetup -- [-s|--setup] [-d|--dummy] [--dangerous=clear]';

// == yargs PARSING ==
const argv = yargs(hideBin(process.argv))
    .usage(usageString)
    .options({
      setup: {
        alias: 's',
        description: 'Sets up the tables in the database',
      },
      dummy: {
        alias: 'd',
        description: 'Inserts the dummy data',
      },
      "dangerous=clear": {
        description: 'Clears the database',
      },
    })
    .help()
    .argv;

// == CHECKS BEFORE DATABASE CONNECTION ==
// If the node environment is set to production, then exit the process while logging a message
if (process.env.NODE_ENV === 'production') {
  console.log('You appear to be in a production environment (NODE_ENV).' +
      ' Please change this in the ".env" file if you wish to use dbsetup.');
  process.exit();
}

// If no arguments were provided, set setup flag to true and continue
if (hideBin(process.argv).length === 0) {
  argv.setup = true;
}

// == DATABASE CONNECTION ==
// create a connection to the database
const client = new MongoClient(process.env.MONGODB_URL);
const databaseName = process.env.MONGODB_DATABASE;

// connect to the database
client.connect()
    .then(async (client) => {
      // Flag for clearing the entire database
      if (argv.dangerous === 'clear') {
        const db = client.db(databaseName);

        const collections = await db.listCollections().toArray();
        const users = db.collection('users');
        const blogposts = db.collection('blogposts');

        const promises = []

        collections.forEach((collection) => {
          switch (collection.name) {
            case 'users':
              promises.push(users.drop());
              break;
            case 'blogposts':
              promises.push(blogposts.drop());
              break;
            default:
          }
        });

        Promise.allSettled(promises).then(() => {
          console.log('Database has been cleared.');
          process.exit();
        })
      }

      // Flag for doing a simple setup
      if (argv.setup) {
        try {
          const db = client.db(databaseName);

          await db.collection('users').createIndex( { username: 1, email: 1 }, { unique: true } );
          await db.collection('blogposts').createIndex( { id: 1 }, { unique: true } );

          console.log('Database has been setup');
          process.exit();
        }
        catch (err) {
          console.error('[ERROR] Database was not setup.');
          console.error(err);
        }
      }

      // Flag for generating dummy data, which should only be called once and done after a setup
      if (argv.dummy) {
        try {
          const db = client.db(databaseName)

          const collectionsCount = (await db.listCollections().toArray()).length;

          if (collectionsCount < 2) {
            throw '[ERROR] Setup has not been run yet. Run: `npm run dbsetup -- --setup`.'
          }

          const dummyPosts = JSON.parse(fs.readFileSync('./src/dummy/posts.json', {encoding: 'utf-8'}));
          const blogposts = await db.collection('blogposts');
          const blospostsCount = await blogposts.countDocuments();
          if (blospostsCount > 0) throw '[ERROR] Existing blogposts detected.'
          const resultPosts = await blogposts.insertMany(dummyPosts)

          const dummyUsers = JSON.parse(fs.readFileSync('./src/dummy/users.json', {encoding: 'utf-8'}));
          const users = await db.collection('users');
          const usersCount = await users.countDocuments();
          if (usersCount > 0) throw '[ERROR] Existing users detected.'
          const resultUsers = await users.insertMany(dummyUsers)
          console.log(`Dummy data has been provided. ${resultPosts.insertedCount} posts and ${resultUsers.insertedCount} users added.`);
        }
        catch (err) {
          console.error('[ERROR] Dummy data was not provided. It may be due to running the --dummy command twice.');
          console.error(err);
        }
        finally {
          process.exit();
        }
      }
    })
    .catch((err) => {
      console.error(`[ERROR] Database connection failed: ${err}`);
      process.exit();
    });
