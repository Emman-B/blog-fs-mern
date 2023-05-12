const { MongoClient } = require('mongodb');
const sanitize = require('mongo-sanitize');
const { v4: uuidv4 } = require('uuid');

const client = new MongoClient(process.env.MONGODB_URL);
const databaseName = process.env.MONGODB_DATABASE;
const db = client.db(databaseName);

/**
 * Retrieves a blogpost from the database using the UUID
 * @param {string} blogpostID UUID of the blogpost
 * @returns the blogpost queried from the database
 */
async function selectOneBlogPost(blogpostID) {
  // get blogpost by id from blogposts collection
  const blogposts = db.collection('blogposts');
  const result = await blogposts.findOne( { id: sanitize(blogpostID) } )

  return result;
}

/**
 * Retrieves the blog posts from the database
 * @param {object} currentUser the current user for filtering results from the database
 * @param {number} limit how many blogposts to retrieve (per page)
 * @param {page} page page offset for blogposts (page 1 = first page)
 * @param {string} specifiedAuthor author of blogposts to search for
 * @returns the blog posts from the database
 */
async function selectBlogPosts(currentUser, limit, page, specifiedAuthor) {
  // build query based on permissions
  const publicPosts = { permissions: 'public' }; // always included
  const usersPosts = currentUser?.username ? { permissions: 'users' } : null; // if not logged in, this is not included in query
  const authorPosts = specifiedAuthor ? { author: specifiedAuthor } : {}; // if author is specified, filter to only show author's posts
  const ownPosts = { $and: [ { author: currentUser?.username }, { permissions: { $in: ['drafts', 'unlisted', 'private'] } } ] };

  const orQuery = [ publicPosts, ownPosts ]
  if (usersPosts) orQuery.push(usersPosts);

  const query = {
    $and: [ authorPosts, {
      $or: orQuery
    }]
  };

  try {
    const blogposts = db.collection('blogposts');
    const cursor = blogposts.find(query).sort({ updatedDate: -1 });
    if (limit) {
      cursor.limit(limit);
    }

    return await cursor.toArray();
  } catch (err) {
    console.error(err);
    return [];
  }
}

/**
 * Inserts a new blog post
 * @param {object} newBlogPost New Blog Post to insert into the database
 * @return blog post that was inserted
 */
async function insertNewBlogPost({author, title, permissions, publishDate, updatedDate, content}) {
  try {
    const blogposts = db.collection('blogposts');
    const newPost = { id: uuidv4(), author, title, permissions, publishDate, updatedDate, content };

    const result = await blogposts.insertOne(newPost);
    console.log(`Inserted new blogpost with ID: ${newPost['id']}, _ID: ${result.insertedId}`);
    return newPost;
  } catch (err) {
    // log the error
    console.error(err)
  }
}

/**
 * Updates an existing blogpost. The updated blog post parameter needs the ID
 * @param {object} updatedBlogPost the blog post with the updated information
 * @return the blog post that was updated
 */
async function updateExistingBlogPost(updatedBlogPost) {
  const {id, title, permissions, updatedDate, content} = updatedBlogPost;

  try {
    const blogposts = db.collection('blogposts');
    const filter = { id };
    const updatedFields = { title, permissions, updatedDate, content };

    await blogposts.updateOne(filter, updatedFields);
    return updatedBlogPost;
  } catch (err) {
    console.error(err);
  }
}

/**
 * Deletes a blog post from the database.
 * @param {string} id UUID of the blog post to delete
 * @param {string} username username of the client trying to delete something
 * @returns true if deletion succeeded, false if deletion failed, undefined if an error occurred
 */
async function deleteBlogPost(id, username) {
  try {
    const blogposts = db.collection('blogposts');
    const query = { id, author: { $regex: new RegExp(username, 'i') } };

    const result = await blogposts.deleteOne(query);
    if (result.deletedCount > 0) {
      return true;
    } else {
      return false;
    }
  } catch (err) {
    console.error(err);
  }
}

/**
 * Verifies if the provided username and email is unique, checking
 * it against the database.
 * @param {string} email email to check
 * @param {string} username username to check
 * @return an object that verifies the uniqueness of the email or username, or
 * it indicates if either the email or username has been taken
 */
async function verifyEmailAndUsernameAreUnique(email, username) {
  try {
    const users = db.collection('users');
    const query = { $or: [ { email: { $regex: new RegExp(email, 'i') } }, { username: { $regex: new RegExp(username, 'i') } } ] };

    if (await users.countDocuments(query) === 0) {
      return { unique: true };
    }

    const cursor = users.find(query);

    const result = {};

    for await (const user of cursor) {
      if (user.email.toLocaleLowerCase() === email.toLocaleLowerCase()) {
        result.email = true;
      }
      if (user.username.toLocaleLowerCase() === username.toLocaleLowerCase()) {
        result.username = true;
      }
    }

    // use results to see if email if not unique, or username is not unique, or both
  } catch (err) {
    console.error(err);
  }
}

/**
 * Inserts a new user to the database
 * @param {string} email email of the new user
 * @param {string} username username of the new user
 * @param {string} hashedSaltedPassword password of the new user that has been hashed and salted
 * @returns the new user's email and username
 */
async function insertNewUser(email, username, hashedSaltedPassword) {
  try {
    const users = db.collection('users');
    const newUser = { email, username, password: hashedSaltedPassword };

    const result = await users.insertOne(newUser);
    console.log(`Inserted new user with _ID: ${result.insertedId}`);
    return newUser;
  } catch (err) {
    // log the error
    console.error(err)
  }
}

/**
 * retrieves the user's details
 * @param {string} emailOrUsername email or username of the user
 * @returns the user's details, including hashed and salted password
 */
async function selectUser(emailOrUsername) {
  try {
    const users = db.collection('users');
    const query = { email: { $regex: new RegExp(emailOrUsername, 'i') }, username: { $regex: new RegExp(emailOrUsername, 'i') } };

    const user = await users.findOne(query);
    return user;
  } catch (err) {
    // log the error
    console.error(err)
  }
}

/**
 * Updates the user's password
 * @param {object} currentUser the current logged-in user with the username and email properties
 * @param {string} newHashedSaltedPassword the hashed and salted password (DO NOT USE AN UNHASHED
 * UNSALTED PASSWORD FROM THE USER)
 * @return the username and email of the user's updated password
 */
async function updateUserPassword(currentUser, newHashedSaltedPassword) {
  try {
    const users = db.collection('users');
    const filter = { email: currentUser?.email, username: currentUser?.username };
    const updatedFields = { password: newHashedSaltedPassword };

    await users.updateOne(filter, updatedFields);
    return { email: currentUser?.email, username: currentUser?.username };
  } catch (err) {
    console.error(err);
  }
}

// Exports
module.exports = {
  // blogposts
  selectOneBlogPost,
  selectBlogPosts,
  insertNewBlogPost,
  updateExistingBlogPost,
  deleteBlogPost,

  // users
  verifyEmailAndUsernameAreUnique,
  insertNewUser,
  selectUser,
  // object for updating specific details
  updateUser: {
    password: updateUserPassword,
  },
};
