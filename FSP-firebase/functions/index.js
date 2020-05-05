const functions = require('firebase-functions');

// The Firebase Admin SDK to access the Firebase Realtime Database.
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();


// Listen for changes in all documents in the 'pools' collection
exports.poolUpdate = functions.firestore
  .document('pools/{poolID}')
  .onWrite((change, context) => { //On write to any pool // NOTE: The little arrow thing is shorthand for function(change,context)
    //// NOTE: we can get the poolsID with context.params.poolID
    const newData = change.after.data(); //Data after the write
    const previousData = change.before.data(); //Data before the write
    let log = 'Pool ' + context.params.poolID + ' with state: ' + newData.state + ' was changed! '; //This is a log so we can keep track of the pool and only consle. Log once for quota reasons

    //async function to grade the pool
    async function gradePool(poolID) {
      let poolLog = "Graded pool: " + poolID;
      let highestScore = 0; //This is used to determin the winner(s)
      let winners = []; //Stores the winner(s). If there is a tie then their can be multiple winners in the array
      let poolRef = db.collection("pools").doc(poolID); //reference to the pools document

      let pool = getPool(poolID);
      let users = [];

      // All user documents in this pool
      let userDocs = poolRef.collection("users").get();

      pool = await pool;
      console.log(pool);

      userDocs = await userDocs;

      let questions = pool.questions;

      //If this is a child pool then load the needed data from the parent pool
      if (pool.private) {
        poolLog += " This is a child pool!"; //Logging
      }

      poolLog += 'users scores:{'; //Logging
      //for each user in the pool grade their answers // TODO: Change this to user the pools user arrat
      userDocs.forEach(function(userDoc) {

        poolLog += userDoc.id + ': { ';

        let answers = userDoc.get("answers");
        let score = 0; //This is this users total score

        //If the user answered any questions grade them otherwise their score is 0
        if (answers != null) {
          //Go through each question and compare the correct answer with the users answer
          for (let i = 0; i < questions.length; i++) {
            if (answers[questions[i].id]) {
              if (answers[questions[i].id] == questions[i].correctAnswer) {
                score++;
              }
            } else {
              poolLog += ' User did not answer question: ' + questions[i].id;
            }
          }
        } else {
          poolLog += ' This user does not have any answers score is: ' + score;
        }

        //Notifiy the user that they have been graded
        sendNotification(userDoc.id, {
          id: poolID,
          link: "/pool/?id=" + poolID,
          title: "Your score has been updated",
          text: "Your score in " + pool.name + " has been updated!",
          type: "PU",
        });

        //
        users.push({
          uid: userDoc.id,
          score: score,
          isWinner: false,
        });

        poolLog += ' Updated users score final score is: ' + score + '}, ';

        //Check to see if this user is the winner
        if (score > highestScore) { // If this users score is higher then the previous highestScore they are the new winner
          highestScore = score;
          winners = [userDoc.id];
        } else if (score == highestScore) { // If the users score is equal to the highestScore then we are tied with the current winner
          winners.push(userDoc.id);
        }

      });

      users.sort(function(a, b) {
        return a.score - b.score;
      });

      //If there is a tie handle it else set the current winner of the pool
      if (winners.length > 1) {
        poolLog += "More than one winner attempting tie resolution between: " + winners;

        //Get the tie breaker questions
        let tieBreakerQuestions = pool.tiebreakers;

        let tieWinners = (await resolveTie(poolID, winners, tieBreakerQuestions));

        //Set the pool winners to the winners of the tie
        for (var i = 0; i < users.length; i++) {
          if (tieWinners.includes(users[i].uid)) {
            users[i].isWinner = true;
          }
        }

        //Update the users array
        await db.collection("pools").doc(poolID).update({
          users: users,
        });

        return poolLog;
      } else { //There was not a tie so set the winners to

        console.log("Setting winner to: ", winners[0]);
        //Set the pool winners
        for (var i = 0; i < users.length; i++) {
          if (winners.includes(users[i].uid)) {
            users[i].isWinner = true;
          }
        }
        console.log(users);
        await db.collection("pools").doc(poolID).update({
          users: users,
        });

        return poolLog;
      }
    }

    //Async function to resolve ties
    async function resolveTie(poolID, winners, tieBreakerQuestions) {
      let tieBreakerScore = null; //The lowest score of the tied users // NOTE:  Tiebreaker questions are graded by the distance to the correct answer terefor lower is better
      let tieWinners = winners.slice(); //The winners of this tie.

      //Try to resolve the tie with the tie breaker questions
      for (let q = 0; q < tieBreakerQuestions.length; q++) {
        //If question is valid grade the winners based of of it else move on to the next question
        if (!isNaN(tieBreakerQuestions[q].answer)) {
          //Grade each remaning winner based on this tiebreaker question
          for (let i = 0; i < winners.length; i++) {
            let userDoc = await db.collection("pools").doc(poolID).collection("users").doc(winners[i]).get(); // Get this users document
            let answers = userDoc.get("answers");
            let score;

            //If the user has answered this question grade them on it else they lose the tie breaker
            if (answers && answers[tieBreakerQuestions[q].id]) {
              score = Math.abs(answers[tieBreakerQuestions[q].id] - tieBreakerQuestions[q].answer); //score is the absolute distance between the correct answer and users answer // NOTE: therefore the lower the score the better the user did
            }

            //Check this users score against others in the tiebreaker
            if ((tieBreakerScore == null || score < tieBreakerScore) && (score != null)) { // If this users score is smaller then the previous best score they are the new winner
              tieBreakerScore = score;
              tieWinners = [userDoc.id];
            } else if (score == tieBreakerScore && (score != null)) { // If the users score is equal to the best score then we are tied with the current winner
              tieWinners.push(userDoc.id);
            }

          }

          //If the tie is resolved after grading break the loop else move on to next tiebreaker
          if (tieWinners.length <= 1) {
            break;
          } else {
            winners = tieWinners.slice(); //set the winners to the tie winners this elemenates any users who lost the tie breaker
            tieBreakerScore = null; //reset the tie score
          }
        }

      }

      return tieWinners;
    }

    if (newData.state === "active") { // TODO:If the pool has questions and is live

      //If the questions and the state have not changed dont grade the pool
      if ((JSON.stringify(newData.questions) === JSON.stringify(previousData.questions)) && (previousData.state === newData.state)) {
        log = log + 'Questions were not changed and state has not changed';
      } else {
        log = log + 'State or questions were changed. New questions object: ' + JSON.stringify(newData.questions);

        let poolPromises = [];
        poolPromises.push(gradePool(context.params.poolID).then(function(result) {
          console.log("Successfully graded ", result);
        }));

        //If this pool has children then add them to the grade list
        if (newData.childPools) {
          newData.childPools.forEach(function(poolID) {
            poolPromises.push(gradePool(poolID).then(function(result) {
              console.log("Successfully graded child pool ", result);
            }));
          });
        }

        return Promise.all(poolPromises).then(function() {
          console.log("all Graded");
        });

      }
    } else {
      log = log + " Pool is not active";
    }

    console.log(log);

    return 0;
  });

exports.poolClosing = functions.pubsub.schedule('every 10 minutes').onRun(async function(context) {
  console.log('Checking for any pools that are closing soon!');

  let querySnapshot = await db.collection('pools').where('private', '==', false).where('date', '>', db.timestamp.now()).get();

  async function closeWarning() {

  }

  querySnapshot.forEach(function(doc) {
    console.log(doc.id, ' => ', doc.data());
    console.log("timestamp", admin.Firestore.Timestamp.now());

  });

  return null;
});

//Creates a private pool with given data
exports.createPrivatePool = functions.https.onCall((data, context) => {
  /*
    data=
    {
      name: "",
      description: "",
      parentPool: "",
      admins: [],
      allowShares: bool,
    }
  */

  // Checking that the user is authenticated.
  if (!context.auth) {
    // Throwing an HttpsError so that the client gets the error details.
    throw new functions.https.HttpsError('failed-precondition', 'The function must be called ' +
      'while authenticated.');
  }
  // TODO: Check for valid data

  // Authentication / user information is automatically added to the request.
  const uid = context.auth.uid;
  // const name = context.auth.token.name || null;
  // const picture = context.auth.token.picture || null;
  // const email = context.auth.token.email || null;
  console.log(data);
  return db.collection("pools").doc(data.parentPool).get().then(function(doc) {

    console.log(doc.data());
    console.log('Parent pool state', doc.data.state);

    if (doc.exists && (doc.data()).state == 'open') {

      return db.collection("pools").add({
        name: data.name,
        description: data.description,
        parentPool: data.parentPool,
        admins: data.admins,
        allowShares: data.allowShares,
        private: true,
      }).then(function(doc) {

        //Add the pool to the parent pools children
        db.collection("pools").doc(data.parentPool).update({
          childPools: admin.firestore.FieldValue.arrayUnion(doc.id),
        });

        //Join the pool
        db.collection("users").doc(uid).update({
          pools: admin.firestore.FieldValue.arrayUnion(doc.id),
        });
        db.collection("pools").doc(doc.id).update({
          users: admin.firestore.FieldValue.arrayUnion({
            uid: uid,
            score: 0,
            isWinner: false,
          }),
        });

        return {
          data: data,
          result: 'success',
          message: 'made pool, id:' + doc.id,
          id: doc.id,
        };

      });
    } else {
      return {
        data: data,
        result: 'error',
        message: 'error',
        id: doc.id,
      };
    }

  });

  // let promise = new Promise(function(resolve, reject) {
  //   let dataR = {
  //     sentData: data,
  //     uid: uid,
  //     email: email,
  //   }
  //   setTimeout(() => resolve(dataR), 1000);
  //   console.log(dataR);
  // });

});

exports.deletePool = functions.https.onCall(async function(data, context) {
  // Checking that the user is authenticated.
  if (!context.auth) {
    // Throwing an HttpsError so that the client gets the error details.
    throw new functions.https.HttpsError('failed-precondition', 'The function must be called ' +
      'while authenticated.');
  }
  // Authentication / user information is automatically added to the request.
  // const name = context.auth.token.name || null;
  // const picture = context.auth.token.picture || null;
  // const email = context.auth.token.email || null;
  const uid = context.auth.uid;
  console.log(data);

  let poolData = db.collection("pools").doc(data.poolID).get();
  let poolUsers = db.collection("pools").doc(data.poolID).collection('users').get();

  poolData = (await poolData).data();

  //If the user requesting the delete operation is an admin of the pool allow the delete otherwise permission denied
  if (poolData.admins.includes(uid)) {

    console.log(await poolUsers);

    //Move the pool to the deleted collection
    await db.collection("deletedPools").doc(data.poolID).set(poolData);
    await db.collection("pools").doc(data.poolID).delete();

    return {
      data: data,
      message: "Successfully deleted private pool",
      uid: uid,
    };
  } else {
    return {
      data: data,
      message: "Failed to delete pool you are not an admin ",
      uid: uid,
    };
  }

});

exports.addMessage = functions.https.onCall(async function(data, context) {
  /*
  This should be called with the data pareameter containing
  {
      poolID:"",//The id of the pool you wish to add a message to
      text:"",//The messages text
  }
  */

  //console.log(data);

  // Checking that the user is authenticated.
  if (!context.auth) {
    // Throwing an HttpsError so that the client gets the error details.
    throw new functions.https.HttpsError('failed-precondition', 'The function must be called ' +
      'while authenticated.');
  }
  if (data.poolID == null || data.text == null) {
    // Throwing an HttpsError so that the client gets the error details.
    throw new functions.https.HttpsError('failed-precondition', 'The function was called with invalid Data: ', data);
  }

  const uid = context.auth.uid;
  const poolID = data.poolID;
  const text = data.text;

  let pool = getPool(poolID);
  pool = await pool;

  if (true) { //// TODO: check to see if the user is able to send this chat message eg they are a part of the pool

    await db.collection("pools").doc(poolID).collection("messages").add({ //Add message to the server.
      userID: uid,
      text: text,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    // TODO: Notifiy all pool users who want chat notifications
    let noteOps = [];
    for (var i = 0; i < pool.users.length; i++) {

      noteOps.push(sendNotification(pool.users[i].uid, {
        user: pool.users[i].uid,
        senderID: uid,
        poolID: poolID,
        id: poolID,
        link: "/chat/?id=" + poolID, //"/pool/?id=" + poolID,
        title: "New chat Message",
        text: text,
        type: "CU",
      }));
    }
    await Promise.all(noteOps);
    console.log("Sent notifications");
    return {
      uid: uid,
      operation: "success",
      result: "Succesfully added the message to the chat!",
      data: data,
    };
  } else { //The user does not have the permission to send theis message
    return {
      uid: userID,
      operation: "denied",
      result: "You do not have permission to send this message!",
      data: data,
    };
  }

});



async function sendNotification(uid, message) {
  //Usage
  /*
    uid is the id of the targeted user

    Message structure (* is optional):
    {
        id: "",
        title: "",
        text: "",
        type: "",
        *link: "",//"/pool/?id=" + poolID,
    }

//// NOTE: These types are not used notifications currently use old nameing
    Notification types:
      PU-(Pool update)
      PI-(Pool invite)
      PA-(Pool accept)
      CU-(Chat update)
      UR-(User report)
      FR-(Freind request)

  */

  let user = db.collection('users').doc(uid).get();
  user = (await user);
  console.log("sending notification to user: ", user);
  if (user != null && user.exists && user.data() != null) {
    user = user.data();

    let exludedNotifications = (user.exludedNotifications) ? user.exludedNotifications : [];

    if (exludedNotifications.includes(message.type)) { //If the user has requested to not receve these types of notifications the dont send anything
      console.log("THE BLASTED NOTIFICATION IS BANNED");
      return "Failed to send the notification. The user has requested to to see these notifications";
    } else {
      message.user = uid;
      console.log("uid: ", uid, " message: ", message);

      //Set the channel id
      let channelID = 'default';
      switch (message.type) {
        case 'CU':
          channelID = 'CU';
          break;
        case 'PU':
          channelID = 'PU';
          break;
        default:
          channelID = 'default';
      }

      //Setup the notification message
      let notificationMessage = {
        notification: {
          title: (message.title) ? message.title : 'No Title',
          body: (message.text) ? message.text : 'No Body',
        },
        data: {
          link: (message.link) ? message.link : '',
          notification_foreground: "true",
        },
        android: {
          notification: {
            channel_id: channelID,
          },
        },
        topic: 'user-' + uid,
      };

      //If there is a image add it
      if (message.image) {
        notificationMessage.notification[image] = message.image;
      }

      console.log(notificationMessage);

      //Add the message to the users updates
      db.collection("users").doc(uid).collection('updates').doc(message.type + '-' + message.id).set(message);
      //Send a message to devices subscribed to the users devices.
      admin.messaging().send(notificationMessage);
    }

    return "Successfully sent the notification!";
  } else {
    return "Failed to send the notification";
  }

}

async function removeNotification(uid, notificationID) {
  //Delete the notificatoin specified for the given uid
  await db.collection("users").doc(uid).collection('updates').doc(notificationID).delete();
  return "Succesfully removed notification";
}

//Requests to be freinds with the specified user
exports.freindRequest = functions.https.onCall(async function(data, context) {

  // Checking that the user is authenticated.
  if (!context.auth) {
    // Throwing an HttpsError so that the client gets the error details.
    throw new functions.https.HttpsError('failed-precondition', 'The function must be called ' +
      'while authenticated.');
  }

  const userID = context.auth.uid; //The uid of the user who requested this operation
  const uid = data.uid; //the uid of the user whom the requestt is targeted
  const accepted = data.accept; //If this user wishes to be freind with the requested user
  let userData = db.collection('users').doc(userID).get(); //The current user's data
  let doc = db.collection('users').doc(uid).get(); //The targeted user's data

  userData = (await userData).data();
  doc = await doc;

  var pendingFreinds = (doc.data().pendingFriends) ? doc.data().pendingFriends : [];


  if (pendingFreinds.includes(userID)) { //If the other user has requested to be freinds

    //Remove the frind request notification that was sent to this user
    removeNotification(userID, 'friend-request-' + uid);

    if (accepted) { //If both users have requested to be freinds set them as freinds in each of their docs. (Other user has sent a freind request and this user has rejected it)

      //Update this users freinds list
      let ourDoc = db.collection('users').doc(userID).update({
        friends: admin.firestore.FieldValue.arrayUnion(uid),
        pendingFriends: admin.firestore.FieldValue.arrayRemove(uid),
      }).catch(function(error) {
        throw new functions.https.HttpsError('Error updating recevers docs', error);
      });

      //Update the other users freinds list
      let theirDoc = db.collection('users').doc(uid).update({
        friends: admin.firestore.FieldValue.arrayUnion(userID),
        pendingFriends: admin.firestore.FieldValue.arrayRemove(userID),
      }).catch(function(error) {
        throw new functions.https.HttpsError('Error updating requester docs', error);
      });

      //wait for the operatins to complete
      await ourDoc;
      await theirDoc

      //Notify user that their friend request has been accepted
      await sendNotification(uid, {
        id: userID,
        title: userData.firstName + ' ' + userData.lastName + " Has accepted your friend request.",
        text: "Click here to view " + userData.firstName + "\'s profile.",
        link: "/user/?id=" + userID,
        type: "friend-accept",
        senderID: userID,
      });

      return {
        uid: userID,
        operation: "added",
        result: "Successfully accepted freind request",
        data: data,
      };

    } else { //Reject frind request (Other user has sent a request and this user has rejected it)

      //Remove the user from our freind list
      let ourDoc = db.collection('users').doc(userID).update({
        friends: admin.firestore.FieldValue.arrayRemove(uid),
        pendingFriends: admin.firestore.FieldValue.arrayRemove(uid),
      }).catch(function(error) {
        throw new functions.https.HttpsError('Error updating recevers docs', error);
      });
      //Remove us from the other users freinds
      let theirDoc = db.collection('users').doc(uid).update({
        friends: admin.firestore.FieldValue.arrayRemove(userID),
        pendingFriends: admin.firestore.FieldValue.arrayRemove(userID),
      }).catch(function(error) {
        throw new functions.https.HttpsError('Error updating requester docs', error);
      });
      //Wait for the operations to complete
      await ourDoc;
      await theirDoc;

      //Return the result // TODO: check to make sure the operatinos completed Successfully
      return {
        uid: userID,
        operation: "removed",
        result: "Successfully rejected freind request",
        data: data,
      };

    }

  } else { //The other user has not requested to be freinds
    removeNotification(userID, 'friend-accept-' + userID);

    if (accepted) { //User wishes to be freinds with uid so send freind request

      //Update our users pending freinds list
      await db.collection('users').doc(userID).update({
        pendingFriends: admin.firestore.FieldValue.arrayUnion(uid),
      }).catch(function(error) {
        throw new functions.https.HttpsError('Error updating recevers docs', error);
      });

      await sendNotification(uid, {
        id: userID,
        text: "Click here to accept or reject their request.",
        title: userData.firstName + ' ' + userData.lastName + " has requested to be your friend.",
        type: "friend-request",
        link: "/user/?id=" + userID,
        senderID: userID,
      });

      return {
        uid: userID,
        operation: "requested",
        result: "Successfully sent freind request",
        data: data,
      };

    } else { //User does not want to be freinds anymore (eg remove freind)

      //Remove the user from our freind list
      let ourDoc = db.collection('users').doc(userID).update({
        friends: admin.firestore.FieldValue.arrayRemove(uid),
        pendingFriends: admin.firestore.FieldValue.arrayRemove(uid),
      }).catch(function(error) {
        throw new functions.https.HttpsError('Error updating recevers docs', error);
      });
      //Remove us from the other users freinds
      let theirDoc = db.collection('users').doc(uid).update({
        friends: admin.firestore.FieldValue.arrayRemove(userID),
        pendingFriends: admin.firestore.FieldValue.arrayRemove(userID),
      }).catch(function(error) {
        throw new functions.https.HttpsError('Error updating requester docs', error);
      });
      //Wait for the operations to complete
      await ourDoc;
      await theirDoc;

      //Return the result // TODO: check to make sure the operatinos completed Successfully
      return {
        uid: userID,
        operation: "removed",
        result: "Successfully removed freind/freind request",
        data: data,
      };

    }

  }

});

async function getPool(poolID) {

  console.log("weeellll");
  let poolData = db.collection("pools").doc(poolID).get();

  poolData = (await poolData).data();

  if (poolData == null) {
    console.log("Invalid pool returning");
    return "invalid";
  }
  console.log("the pool raw data is", poolData);
  //If the pool is a private/child pool get the needed data from the parentPool
  if (poolData.parentPool != null) {

    let parentData = await getPool(poolData.parentPool);

    return {
      poolID: poolID,
      tags: parentData.tags,
      name: poolData.name,
      description: poolData.description,
      state: parentData.state,
      date: parentData.state,
      questions: parentData.questions,
      tiebreakers: parentData.tiebreakers,
      users: (poolData.users) ? poolData.users : [],
      winners: (poolData.winners) ? poolData.winners : [],
      id: poolID,
      private: true,
      bannedUsers: poolData.bannedUsers ? poolData.bannedUsers : [],
      pendingUsers: poolData.allowedUsers ? poolData.allowedUsers : [],
      allowedUsers: poolData.allowedUsers ? poolData.allowedUsers : [],
      allowShares: (poolData.allowShares != null) ? poolData.allowShares : true,
      admins: poolData.admins ? poolData.admins : [],
    };

  } else {
    return {
      poolID: poolID,
      tags: poolData.tags,
      name: poolData.name,
      description: poolData.description,
      state: poolData.state,
      date: ((poolData.date) ? poolData.date.toDate() : ''),
      questions: poolData.questions,
      tiebreakers: poolData.tiebreakers,
      users: (poolData.users) ? poolData.users : [],
      winners: (poolData.winners) ? poolData.winners : [],
      id: poolID,
      private: false,
      pendingUsers: poolData.allowedUsers ? poolData.allowedUsers : [],
      allowedUsers: poolData.allowedUsers ? poolData.allowedUsers : [],
      bannedUsers: poolData.bannedUsers ? poolData.bannedUsers : [],
      allowShares: poolData.allowShares ? poolData.allowShares : true,
      admins: poolData.admins ? poolData.admins : [],
    };
  }
}

exports.joinPool = functions.https.onCall(async function(data, context) {
  /*
  This function must be called with the data param containing
  {
    uid:""//The id of the user to join this pool,
    poolID:""//The id of the pool that sould be joined
    join:true//True if the user should join the pool false if the user should leave the pool
  }
  */
  console.log("Join pool function called with data: ", data);


  // Checking that the user is authenticated.
  if (!context.auth) {
    // Throwing an HttpsError so that the client gets the error details.
    throw new functions.https.HttpsError('failed-precondition', 'The function must be called ' +
      'while authenticated.');
  }

  if (data.uid == null || data.poolID == null || data.join == null) {
    // Throwing an HttpsError so that the client gets the error details.
    throw new functions.https.HttpsError('failed-precondition', 'The function was called with invaid data ', data);
  }


  const userID = context.auth.uid; //The uid of the user who requested this operation
  const targetUid = data.uid; //the uid of the user whom the request is targeted
  const poolID = data.poolID; //the uid of the user whom the request is targeted
  const join = data.join; //This is for telling weather the user wishes to join or not

  //Request the needed data
  let targetUser = db.collection("users").doc(targetUid).get();
  let pool = getPool(poolID);
  let user = db.collection('users').doc(userID).get();

  targetUser = (await targetUser).data();
  pool = await pool;

  let ops = []; //The operations stored as an array of promises

  //If the pool is valid
  if (pool != "invalid") {
    if (userID == targetUid) { //If the user is requesting this operation as themselves

      console.log("Loaded pool data: ", pool);

      if (join) { //If the user wants to join the pool

        //If the user is allowed to join this pool add them to it
        if (!pool.private || pool.allowedUsers.includes(userID)) {

          await db.collection("users").doc(userID).update({
            pools: admin.firestore.FieldValue.arrayUnion(poolID),
          });

          await db.collection("pools").doc(poolID).update({
            users: admin.firestore.FieldValue.arrayUnion({
              uid: userID,
              score: 0,
              isWinner: false,
            }),
          });

          return {
            uid: userID,
            result: "Successfully joined pool",
            data: data,
          };

        } else { //This user is not allowed to join this pool so request permission from the pool admin/captian

          //Add this pool to the users pending pools
          await db.collection("users").doc(userID).update({
            pendingPools: admin.firestore.FieldValue.arrayUnion(poolID),
          });

          //Send request to the pool admin/admins to join the pool
          //// TODO: Send request to other admins
          let adminT = pool.admins[0];
          console.log("admin is: ", adminT);
          await sendNotification(adminT, {
            user: pool.admins[1],
            senderID: userID,
            poolID: poolID,
            id: userID + poolID,
            link: "", //"/pool/?id=" + poolID,
            title: targetUser.firstName + ' ' + targetUser.lastName + " has requested.",
            text: targetUser.firstName + ' ' + targetUser.lastName + " has requested to join" + pool.name + " pool. Click accept or deny!",
            type: "pool-request",
          });

          return {
            uid: userID,
            result: "Succesfully sent join request",
            data: data,
          };
        }
      } else { //The user does not want to join/be part of the pool so remove them from it

        await db.collection("users").doc(userID).update({
          pools: admin.firestore.FieldValue.arrayRemove(poolID),
          pendingPools: admin.firestore.FieldValue.arrayRemove(poolID),
        });

        let userToRemove = pool.users.find(function(e) {
          return e.uid === userID;
        });
        console.log(userToRemove);
        //Remove the user from the pool//// QUESTION: Should we also delete thier answers?
        await db.collection("pools").doc(poolID).update({
          users: admin.firestore.FieldValue.arrayRemove(userToRemove),
        });

        return {
          uid: userID,
          result: "Successfully left the pool",
          data: data,
        };

      }

    } else { //The user is requesting the operation on another user

      user = (await user).data();

      if (!pool.private || (pool.allowShares) || pool.admins.includes(userID) || user.pools.includes(poolID)) { //If this user is allowed to perform this operation // TODO: check if the user requesting this operation is part of this pool

        if (join) { //If this user is allowing the specified user to join the pool

          if (targetUser.pendingPools.includes(poolID)) { //If the specified user has requested to join this pool

            //Add the user to the allowedUsers and to the users array
            ops.push(db.collection("pools").doc(poolID).update({
              allowedUsers: admin.firestore.FieldValue.arrayUnion(targetUid),
              users: admin.firestore.FieldValue.arrayUnion({
                uid: targetUid,
                score: 0,
                isWinner: false,
              }),
            }));

            //Add the pool to the users pool list
            ops.push(db.collection("users").doc(targetUid).update({
              pools: admin.firestore.FieldValue.arrayUnion(poolID),
            }));

            //Remove the notification from the user if any
            ops.push(removeNotification(targetUid, {
              type: "PR",
              id: poolID,
            }));

            ops.push(sendNotification(targetUid, {
              user: targetUid,
              id: poolID,
              link: "/pool/?id=" + poolID,
              title: user.firstName + ' ' + user.lastName + " has accepted your request.",
              text: user.firstName + ' ' + user.lastName + " has accepted your request to join" + pool.name + " pool. Click to play!",
              type: "PA",
            }));

            await Promise.all(ops);

            return {
              uid: userID,
              operation: "success",
              result: "Succesfully accepted the users join request",
              data: data,
            };

          } else { //The user has not requested to join this pool so send them an invite and allow them to join

            await db.collection("pools").doc(poolID).update({
              allowedUsers: admin.firestore.FieldValue.arrayUnion(targetUid),
            });

            await sendNotification(targetUid, {
              user: targetUid,
              id: poolID,
              link: "/pool/?id=" + poolID,
              title: user.firstName + ' ' + user.lastName + " invited you to a pool.",
              text: user.firstName + ' ' + user.lastName + " invited you to join the " + pool.name + " pool. Click to play!",
              type: "PI",
            });

            return {
              uid: userID,
              operation: "success",
              result: "Sent pool invite",
              data: data,
            };
          }

        } else { //The user is requesting that the specifid uid not be allowed in the pool

          if (pool.admins.includes(userID)) { //If the user is an admin kick the requested user from the pool

            await db.collection("users").doc(targetUid).update({
              pools: admin.firestore.FieldValue.arrayRemove(poolID),
              pendingPools: admin.firestore.FieldValue.arrayRemove(poolID),
            });

            //Find the object of the user to kick
            let userToKick = 0;
            for (var i = 0; i < pool.users.length; i++) {
              if (pool.users[i].uid == targetUid) {
                userToKick = pool.users[i];
                break;
              }
            }
            //Remove the user from the allowed users and pool users
            ops.push(db.collection("pools").doc(poolID).update({
              allowedUsers: admin.firestore.FieldValue.arrayRemove(targetUid),
              users: admin.firestore.FieldValue.arrayRemove(userToKick),
            }));

            //Remove the user from the pool//// QUESTION: should we do this as it does remove thier answers // NOTE: If we store users as an array in the pool doc we can delete them from the pool and keep the answers
            //await db.collection("pools").doc(poolID).collection("users").doc(userID).delete();
            //TODO:  Maybe add the user to the banned users list and perhaps send a notification

            return {
              uid: userID,
              operation: "success",
              result: "Succesfully kicked user: " + targetUid + " from pool",
              data: data,
            };
          } else { //The user is not an admin so send a request to the admin to kick the specified user


            //Send request to the pool admin/admins to kick the user
            //// TODO: Send request to other admins
            let adminT = pool.admins[0];
            console.log("admin is: ", adminT);
            await sendNotification(adminT, {
              user: pool.admins[1],
              senderID: userID,
              poolID: poolID,
              id: targetUid + poolID,
              link: "/pool/?id=" + poolID, //", //"/pool/?id=" + poolID,
              title: user.firstName + ' ' + user.lastName + " has requested.",
              text: user.username + " has reported user: " + targetUser.username + " click to veiw.",
              type: "UR",
            });

            return {
              uid: userID,
              operation: "success",
              result: "Reported user to pool captians",
              data: data,
            };
          }

        }


      } else { //The user does not have permission for this operation so deny their request
        return {
          result: "You do not have permission to do that!",
          operation: "denied",
          uid: userID,
          data: data,
        };
      }

    }
  } else {
    throw new functions.https.HttpsError('failed-precondition', 'The function was called with invaid data ', data);
  }

});



// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });