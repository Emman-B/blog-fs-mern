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
  /*
  // create the query for insertion, using the new blog post object
  const query = {
    text: `INSERT INTO blogposts (author, title, permissions, publishDate, updatedDate, content)` +
      ` VALUES ($1, $2, $3, $4, $5, $6)` +
      ` RETURNING *`, // return the new blog post that was just created
    values: [ author, title, permissions, publishDate, updatedDate, content ],
  };

  try {
    const {rows} = await pool.query(query);
    return rows[0];
  }
  catch (err) {
    // log the error
    console.error(err);
  }
  */
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
  /*
  // create the query that makes use of the existing blog post UUID
  const query = {
    text: `UPDATE blogposts SET title = $2, permissions = $3, updatedDate = $4, content = $5` +
      ` WHERE id = $1` +
      ` RETURNING *;`,
    values: [ id, title, permissions, updatedDate, content ],
  }

  try {
    const {rows} = await pool.query(query);
    // return the updated blogpost
    return rows[0];
  }
  catch (err) {
    console.error(err);
  }
  */

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
  /*
  // shared condition for selecting and deleting
  const condition = `WHERE id = $1 AND LOWER(author) = LOWER($2)`;
  // make the query to find the blog post before deletion
  const selectQuery = {
    text: `SELECT author FROM blogposts ` + condition,
    values: [ id, username ],
  };

  // make the query to delete the blog post
  const deleteQuery = {
    text: `DELETE FROM blogposts ` + condition,
    values: [ id, username ],
  };

  try {
    // verify that the provided username contains a blogpost with the specified id
    const {rows} = await pool.query(selectQuery);
    if (rows.length > 0) {
      // then, make the deletion
      await pool.query(deleteQuery);
      return true;
    }
    return false;
  }
  catch (err) {
    console.error(err);
    return undefined;
  }
  */

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
  /*
  // create the query which checks the email and username columns
  const query = {
    text: `SELECT * FROM users WHERE LOWER(email) LIKE LOWER($1) OR LOWER(username) LIKE LOWER($2)`,
    values: [ email, username ],
  };

  try {
    const {rows} = await pool.query(query);
    // if no results were found, then return an object indicating a unique email and username
    if (rows.length === 0) {
      return { unique: true };
    }
    // otherwise, check if either the email or username is not unique
    const result = {};
    for (const row of rows) {
      if (row.username.toLowerCase() === username.toLowerCase()) {
        result.username = true;
      }
      if (row.email.toLowerCase() === email.toLowerCase()) {
        result.email = true;
      }
    }
    return result;
  }
  catch (err) {
    console.error(err);
  }
  */
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
  /*
  // create the query to store a new user into the database
  const query = {
    text: `INSERT INTO users (email, username, password) VALUES ($1, $2, $3)` +
        ` RETURNING email, username;`,
    values: [ email, username, hashedSaltedPassword ],
  };

  try {
    const {rows} = await pool.query(query);
    // return the email and username of the newly created user
    return { email: rows[0].email, username: rows[0].username };
  }
  catch (err) {
    console.error(err);
  }*/

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
  /*
  // create the query to find the account with the corresponding email or username
  const query = {
    text: `SELECT * FROM users WHERE LOWER(username) = LOWER($1)` +
      ` OR LOWER(email) = LOWER($1);`,
    values: [ emailOrUsername ],
  };

  try {
    const {rows} = await pool.query(query);

    if (rows.length === 1) {
      return rows[0];
    }
  }
  catch (err) {
    console.error(err);
  }
  */
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
  /*
  const query = {
    text: `UPDATE ONLY users`
        + ` SET password = $1`
        + ` WHERE username = $2 AND email = $3`
        + ` RETURNING username, email`,
    values: [ newHashedSaltedPassword, currentUser.username, currentUser.email ],
  };

  try {
    const {rows} = await pool.query(query);

    if (rows.length !== 0) {
      const {username, email} = rows[0];
      return {username, email};
    }
  } catch (err) {
    console.error(error);
  }
  */

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
