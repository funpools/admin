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
    async function gradePool(poolID, messageType) {
      /*
        function usage
        Input the ID of the pool and the type of message to send and this will grade this pool and all child pools
        Valid message types are:
          "active"//This will let the users know that the pool is now active
          "score-update"//This notifys the pools users of there new score
          "none"//This will not send a notification
      */


      let poolLog = "Graded pool: ";
      let highestScore = 0; //This is used to determin the winner(s)
      let winners = []; //Stores the winner(s). If there is a tie then their can be multiple winners in the array

      let poolRef = db.collection("pools").doc(poolID); //reference to the pools document
      let pool = getPool(poolID);

      let userDocs = poolRef.collection("users").get(); // All user documents in this pool
      let users = []; //The array of graded users

      pool = await pool;
      poolLog += ' ' + pool;

      //console.log('child pools', pool.childPools);
      let poolPromises = [];
      //If this pool has children then add them to the list of pools to grade
      if (pool.childPools != null) {
        pool.childPools.forEach(function(cpoolID) {
          poolPromises.push(gradePool(cpoolID, messageType).then(function(result) {
            console.log("Successfully graded child pool ", result);
          }));
        });
      }

      userDocs = await userDocs;

      let questions = pool.questions;

      if (pool.users != null) { //If there are any users in this pool
        poolLog += ' User scores:{'; //Logging

        //Grade each user in the pool
        pool.users.forEach((user, i) => {
          let score = 0; //This users total score
          let userDoc = userDocs.docs.find((a) => a.id == user.uid); //The users answers document
          poolLog += user.uid + ': { ';

          if (userDoc != null && userDoc.get("answers") != null) { //If the user has answered any questions
            let answers = userDoc.get("answers");
            //Go through each question and compare the correct answer with the users answer
            for (let i = 0; i < questions.length; i++) {
              if (answers[questions[i].id] != null && answers[questions[i].id] == questions[i].correctAnswer) { //If the user answerd this question correctly
                score++;
              } else {
                poolLog += ' incorrect: ' + questions[i].id;
              }
            }

            //Check to see if this user is the current winner
            if (score > highestScore) { // If this users score is higher then the previous highestScore they are the new winner
              highestScore = score;
              winners = [user.uid];
            } else if (score == highestScore) { // If the users score is equal to the highestScore then we are tied with the current winner
              winners.push(user.uid);
            }

            poolLog += ' Updated users score final score is: ' + score + '}, ';

          } else {
            score = null;
            poolLog += ' This user does not have any answers score is: ' + score;
          }
          //Add the graded user to the array
          users.push({
            uid: user.uid,
            score: score,
            isWinner: false,
          });

        });

        if (!pool.questions.some(a => a.correctAnswer == null)) { //If there are no unanswed questions
          //console.log("All questions are answered");
          //If there is a tie try and resolve it
          if (winners.length > 1) {
            poolLog += "More than one winner attempting tie resolution between: " + winners;
            let tieWinners = (await resolveTie(poolID, winners, pool.tiebreakers)); //Get the tie winners
            winners = tieWinners;
            console.log("winners are: ", winners);
          }

          if (winners.length <= 1 || !pool.tiebreakers.some(a => a.answer == null)) { //If there is only one winner or all the tiebreakers have been answered
            console.log("only one winner or true tie");
            //Set the pool winners
            for (var i = 0; i < users.length; i++) {
              if (winners.includes(users[i].uid)) {
                users[i].isWinner = true;
              }
            }
          }
        }

        //Notify each user in the pool
        console.log("Sending notifications to users. Notification type: ", messageType);
        pool.users.forEach((user, i) => {
          //Decide which type of notification to send to the user
          switch (messageType) {
            case "active":
              sendNotification(user.uid, {
                id: poolID,
                poolID: poolID,
                link: "/pool/?id=" + poolID,
                title: pool.name + " is now active",
                text: pool.name + " is now active. Click here to veiw the pool! ",
                type: "PU",
              });
              break;
            case "closed":
              sendNotification(user.uid, {
                id: poolID,
                poolID: poolID,
                link: "/pool/?id=" + poolID,
                title: pool.name + " is now closed",
                text: pool.name + " is now closed. Click here to veiw your results!",
                type: "PU",
              });
              break;
            case "score-update":
              sendNotification(user.uid, {
                id: poolID,
                poolID: poolID,
                link: "/pool/?id=" + poolID,
                title: "Your score has been updated",
                text: "A question in " + pool.name + " pool has been updated—check here for your score!",
                type: "PU",
              });
              break;
            default:
              sendNotification(user.uid, {
                id: poolID,
                poolID: poolID,
                link: "/pool/?id=" + poolID,
                title: "Pool has been updated",
                text: "Pool " + pool.name + "has been updated!",
                type: "PU",
              });
          }
        });

        //Sort the graded users by score and if they are a winner
        users.sort((a, b) => (a.winner) ? 1 : (a.score - b.score));
        console.log("Pools final user array is: ", users);

        //Wait for the pools doc to finish updating
        await db.collection("pools").doc(poolID).update({
          users: users,
        });
      } else {
        poolLog += "error no users."
      }

      //Wait for the child pool to be graded
      await Promise.all(poolPromises).then(function() {
        console.log("All pools graded!");
      });

      return poolLog;
    }

    //Async function to resolve ties
    async function resolveTie(poolID, winners, tieBreakerQuestions) {
      let winnersToResolve = winners.slice();
      let tieBreakerScore = null; //The lowest score of the tied users // NOTE:  Tiebreaker questions are graded by the distance to the correct answer terefor lower is better
      let tieWinners = winners.slice(); //The winners of this tie.

      console.log("Trying to resolve tie between users: ", winnersToResolve);
      //for each tieBreaker question
      for (let q = 0; q < tieBreakerQuestions.length; q++) {

        if (tieBreakerQuestions[q].answer != null) { //If question is valid grade the winners based of of it else move on to the next question
          //for each remaning winner
          for (let i = 0; i < winnersToResolve.length; i++) {
            let userDoc = await db.collection("pools").doc(poolID).collection("users").doc(winnersToResolve[i]).get(); // Get this users document
            let answers = userDoc.get("answers");
            let score;

            //If the user has answered this question grade them on it else they lose the tie breaker
            if (answers && answers[tieBreakerQuestions[q].id] != null) {
              score = Math.abs(answers[tieBreakerQuestions[q].id] - tieBreakerQuestions[q].answer); //score is the absolute distance between the correct answer and users answer // NOTE: therefore the lower the score the better the user did
            }

            console.log("graded user: ", winnersToResolve[i], " score is: ", score);
            //Check this users score against others in the tiebreaker
            if ((tieBreakerScore == null || score < tieBreakerScore) && (score != null)) { // If this users score is smaller then the previous best score they are the new winner
              tieBreakerScore = score;
              tieWinners = [userDoc.id];
              console.log(score, " new tie winner is: ", winnersToResolve[i]);
            } else if (score == tieBreakerScore && (score != null)) { // If the users score is equal to the best score then we are tied with the current winner
              tieWinners.push(userDoc.id);
              console.log(score, " another tie winner is: ", winnersToResolve[i]);
            }

          }

          //If the tie is resolved after grading break the loop else move on to next tiebreaker
          if (tieWinners.length <= 1) {
            break;
          } else {
            winnersToResolve = tieWinners.slice(); //set the winners to the tie winners this elemenates any users who lost the tie breaker
            tieBreakerScore = null; //reset the tie score
          }
        }
        console.log("tieBreaker winners are: ", winnersToResolve);
      }

      return tieWinners;
    }

    async function notifyPoolUsers(poolID, message) {
      let pool = await getPool(poolID);
      let noteOps = [];
      for (var i = 0; i < pool.users.length; i++) {
        noteOps.push(sendNotification(pool.users[i].uid, message));
      }

      await Promise.all(noteOps);
      return 1;
    }

    if (previousData.state != newData.state) { //state has changed
      switch (newData.state) {
        case "active":
          console.log("Pool now active!");
          //Notify the users of this pool that it is now active
          // notifyPoolUsers(context.params.poolID, { //todo send notificatoin to all child pools
          //   id: context.params.poolID,
          //   poolID: context.params.poolID,
          //   link: "/pool/?id=" + context.params.poolID,
          //   title: newData.name + " is now active",
          //   text: newData.name + " is now active. Click here to veiw the pool! ",
          //   type: "PU",
          // });
          //Grade the pool and notify the users that the pool is open
          return gradePool(context.params.poolID, "active");

          break;
        case "closed":
          //Grade the pool and notify the users that the pool is now closed
          return gradePool(context.params.poolID, "closed");
          break;
        default:

      }
    } else { //the state is the same
      switch (newData.state) {
        case "active":
          console.log("Pool has stayed active!");
          if ((JSON.stringify(newData.questions) != JSON.stringify(previousData.questions)) || (JSON.stringify(newData.tiebreakers) != JSON.stringify(previousData.tiebreakers))) { //If the questions/tiebreakers have changed
            //grade the pool and send notifications to users about their grade
            return gradePool(context.params.poolID, "score-update").then(function(result) {
              console.log("Successfully graded ", result);
            });
          }

          break;
        case "closed":

          break;
        default:

      }
    }
    /*
        if (newData.state === "active") { // TODO:If the pool has questions and is live

          if ((JSON.stringify(newData.questions) != JSON.stringify(previousData.questions)) || (JSON.stringify(newData.tiebreakers) != JSON.stringify(previousData.tiebreakers)) || (previousData.state != newData.state)) { //If the questions or tiebreakers have changed
            log = log + 'Questions were changed. New questions object: ' + JSON.stringify(newData.questions);

            let poolPromises = [];
            poolPromises.push(gradePool(context.params.poolID).then(function(result) {
              console.log("Successfully graded ", result);
            }));

            //If this pool has children then add them to the list of pools to grade
            if (newData.childPools) {
              newData.childPools.forEach(function(poolID) {
                poolPromises.push(gradePool(poolID).then(function(result) {
                  console.log("Successfully graded child pool ", result);
                }));
              });
            }

            return Promise.all(poolPromises, (previousData.state == newData.state)).then(function() {
              console.log("all Graded");
            });

          } else { //The state has not changed and the questions have not changed
            log = log + 'Questions were not changed and state has not changed!';
          }
        } else {
          log = log + " Pool is not active";
        }
    */

    console.log(log);

    return 0;
  });

//Check for any pools that are closing soon and notify the users in that pool
exports.poolClosing = functions.pubsub.schedule('every 2 minutes').onRun(async function(context) {
  console.log('Checking for any pools that are closing soon!');

  const minutes = 60;
  let startDate = new Date();
  let endDate = new Date(startDate.getTime() + (minutes * 60000));

  let querySnapshot = await db.collection('pools').orderBy('date')
    .startAt(startDate).endAt(endDate).get();

  console.log(querySnapshot.size, " pools are closing soon! Start and end date:", startDate, endDate);

  async function sendClosingNotificatoin(poolID) {

    let pool = await getPool(poolID);

    let poolPromises = [];
    //If this pool has children then add them to the list of pools to send closing notifications to
    if (pool.childPools != null) {
      pool.childPools.forEach(function(cpoolID) {
        poolPromises.push(sendClosingNotificatoin(cpoolID).then(function(result) {
          console.log("Successfully sent closing notificatoins for child pool: ", cpoolID);
        }));
      });
    }

    let userPromises = [];
    //if we have not sent a closing notification for this pool send one to all users in the pool
    if (!pool.sentPoolClosingNotification) {
      pool.users.forEach((user, i) => {
        userPromises.push(sendNotification(user.uid, {
          id: poolID,
          poolID: poolID,
          link: "/pool/?id=" + poolID,
          title: "Pool closing soon",
          text: "Enter your answers now: " + pool.name + " is closing soon!",
          type: "PU",
        }).then(result => {
          console.log("sent notificatoin to user", result);
        }));
      });
    } else {
      console.log("Closing notification already sent for this pool.");
    }

    await Promise.all(userPromises);
    await Promise.all(poolPromises);
    await db.collection("pools").doc(poolID).update({
      sentPoolClosingNotification: true,
    });
    return true;
  }

  //send a notificatoin for each of the found pools
  for (var i = 0; i < querySnapshot.docs.length; i++) {
    //console.log(querySnapshot.docs[i].id);
    console.log("Pool ", querySnapshot.docs[i].id, " is closing soon pool data: ", querySnapshot.docs[i].data());
    await sendClosingNotificatoin(querySnapshot.docs[i].id); // TODO: Change this to be more asychronus ie(Promise.all();)
  }

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

  const uid = context.auth.uid;
  console.log(data);

  let poolData = getPool(data.poolID);
  poolData = (await poolData);
  let admin = db.collection("admins").doc(uid).get();
  admin = await admin;
  //If the user requesting the delete operation is an admin of the pool or an FP admin allow to delete otherwise permission denied
  if (admin.exists || poolData.admins.includes(uid)) {
    let poolUsers = db.collection("pools").doc(data.poolID).collection('users').get();
    let poolMessages = db.collection("pools").doc(data.poolID).collection('messages').get();

    //Move the pool to the deleted collection
    await db.collection("deletedPools").doc(data.poolID).set(poolData);
    await db.collection("pools").doc(data.poolID).delete();

    poolUsers = await poolUsers;
    console.log(poolUsers);

    let operations = [];
    poolUsers.forEach((userDoc, i) => {
      operations.push(db.collection("pools").doc(data.poolID).collection('users').doc(userDoc.id).delete());
    });

    poolMessages = await poolMessages;
    poolMessages.forEach((messageDoc, i) => {
      operations.push(db.collection("pools").doc(data.poolID).collection('messages').doc(messageDoc.id).delete());
    });

    await Promise.all(operations);

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

exports.joinPool = functions.https.onCall(async function(data, context) { //Function for joining and leaving pools
  /**
   * This function must be called with the data param containing
   * {
   *    uid:""//The id of the user to join this pool
   *    poolID:""//The id of the pool that sould be joined
   *    join:true//True if the user should join the pool false if the user should leave the pool
   * }
   * it will return {
      result:joined,requested
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
    if (pool.state != "closed" && !(pool.state == "active" && join)) { //If the pool is not closed and (The the user is not trying to join an active pool)
      if (userID == targetUid) { //If the user is requesting this operation as themselves

        console.log("Loaded pool data: ", pool);

        if (join) { //If the user wants to join the pool

          if (!pool.private || pool.allowedUsers.includes(userID)) { //If the user is allowed to join this pool add them to it

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
              result: "joined",
              data: data,
            };

          } else { //This user is not allowed to join this pool so request permission from the pool admin/captian

            //Add this pool to the users pending pools
            await db.collection("users").doc(userID).update({
              pendingPools: admin.firestore.FieldValue.arrayUnion(poolID),
            });

            await db.collection("pools").doc(poolID).update({
              pendingUsers: admin.firestore.FieldValue.arrayUnion(userID),
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
              link: "/pool/?id=" + poolID,
              title: targetUser.firstName + ' ' + targetUser.lastName + " has requested to join your pool.",
              text: targetUser.firstName + ' ' + targetUser.lastName + " has requested to join " + pool.name + ". Click to accept or reject.",
              type: "pool-request",
            });

            return {
              uid: userID,
              result: "requested",
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
            pendingUsers: admin.firestore.FieldValue.arrayRemove(targetUid),
          });
          return {
            uid: userID,
            result: "left",
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
                pendingUsers: admin.firestore.FieldValue.arrayRemove(targetUid),
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
              ops.push(removeNotification(targetUid, "pool-request-" + poolID));

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
                result: "accepted",
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
                result: "invited",
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
                pendingUsers: admin.firestore.FieldValue.arrayRemove(targetUid),
                allowedUsers: admin.firestore.FieldValue.arrayRemove(targetUid),
                users: admin.firestore.FieldValue.arrayRemove(userToKick),
              }));

              //Remove the user from the pool//// QUESTION: should we do this as it does remove thier answers // NOTE: If we store users as an array in the pool doc we can delete them from the pool and keep the answers
              //await db.collection("pools").doc(poolID).collection("users").doc(userID).delete();
              //TODO:  Maybe add the user to the banned users list and perhaps send a notification

              return {
                uid: userID,
                operation: "success",
                result: "kicked",
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
                result: "reported",
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
      throw new functions.https.HttpsError('failed-precondition', 'Unable to join or invite to pool', data);
    }
  } else {
    throw new functions.https.HttpsError('failed-precondition', 'The function was called with invaid data ', data);
  }

});

async function getPool(poolID) {

  let poolData = db.collection("pools").doc(poolID).get();

  poolData = (await poolData).data();

  if (poolData == null) {
    console.log("Invalid pool returning");
    return "invalid";
  }
  console.log("This pools raw data is: ", poolData);
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
      childPools: null,
      bannedUsers: poolData.bannedUsers ? poolData.bannedUsers : [],
      pendingUsers: poolData.allowedUsers ? poolData.allowedUsers : [],
      allowedUsers: poolData.allowedUsers ? poolData.allowedUsers : [],
      allowShares: (poolData.allowShares != null) ? poolData.allowShares : true,
      admins: poolData.admins ? poolData.admins : [],
      sentPoolClosingNotification: poolData.sentPoolClosingNotification ? poolData.sentPoolClosingNotification : false,
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
      childPools: (poolData.childPools) ? poolData.childPools : null,
      private: false,
      pendingUsers: poolData.allowedUsers ? poolData.allowedUsers : [],
      allowedUsers: poolData.allowedUsers ? poolData.allowedUsers : [],
      bannedUsers: poolData.bannedUsers ? poolData.bannedUsers : [],
      allowShares: poolData.allowShares ? poolData.allowShares : true,
      admins: poolData.admins ? poolData.admins : [],
      sentPoolClosingNotification: poolData.sentPoolClosingNotification ? poolData.sentPoolClosingNotification : false,
    };
  }
}

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

    // TODO: Notifiy all pool users who want chat notifications exluding the user who sent this message
    let noteOps = [];
    for (var i = 0; i < pool.users.length; i++) {
      if (pool.users[i].uid != uid) {
        noteOps.push(sendNotification(pool.users[i].uid, {
          user: pool.users[i].uid,
          senderID: uid,
          poolID: poolID,
          id: poolID,
          link: "/chat/?id=" + poolID,
          title: "New chat Message",
          text: text,
          type: "CU",
        }));
      }
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
  //console.log("sending notification: ", message, " to user: ", user);
  if (user != null && user.exists && user.data() != null) {
    user = user.data();

    let exludedNotifications = (user.exludedNotifications) ? user.exludedNotifications : [];

    if (exludedNotifications.includes(message.type)) { //If the user has requested to not receve these types of notifications the dont send anything
      console.log("user: ", user, " has requested to not receve this");
      return "Failed to send the notification. The user has requested not to see these notifications";
    } else {
      message.user = uid;
      message.timestamp = admin.firestore.FieldValue.serverTimestamp();

      //console.log("uid: ", uid, " message: ", message);

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
          //notification_foreground: true,
          notification_id: message.type + '-' + message.id, //this is the id of the notificatoin as it is in the users updates collection
          //rawMessage:message,//This is the message object
        },
        android: {
          //collapse_key:"12345678910wasd",
          //collapseKey:"12345678910wasd",
          notification: {
            tag: message.type + '' + message.id,
            channel_id: channelID,
          },
        },
        topic: 'user-' + uid,
      };

      //If there is a image add it
      if (message.image) {
        notificationMessage.notification[image] = message.image;
      }

      //console.log(notificationMessage);

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

exports.banUser = functions.https.onCall(async function(data, context) {

  // Check that the user is authenticated.
  if (!context.auth) {
    // Throw an HttpsError so that the client gets the error details.
    throw new functions.https.HttpsError('failed-precondition', 'The function must be called ' +
      'while authenticated.');
  }

  const uid = context.auth.uid; //the uid of the user who the requested this operation
  const uidToBan = data.uidToBan;
  const liftBan = (data.liftBan) ? data.liftBan : false;
  let adminObject = await (db.collection("admins").doc(uid).get());


  if (adminObject.exists && uidToBan != null) {
    if (!liftBan) { //If we are not lifting the ban then ban the user

      //get the users data and move it into the bannedUser collection then delete the data in the normal user collection
      let bannedUserData = (await db.collection("users").doc(uidToBan).get()).data();
      let op1 = db.collection("bannedUsers").doc(uidToBan).set(bannedUserData);
      let op2 = db.collection("users").doc(uidToBan).delete();

      //Disable the users account
      let op3 = admin.auth().updateUser(uidToBan, {
        disabled: true,
      }).then(function(userRecord) {
        console.log('Successfully disabled user');
      }).catch(function(error) {
        console.log('Error disableing user: ', error);
      });
      //wait for the operations to finish
      await Promise.all([op1, op2, op3]).then(result => {
        console.log('Succesfully Banned User!');
        return {
          result: 'Successfully banned user!',
          data: {
            result: 'success'
          }
        };
      }).catch(error => {
        console.log(error);
        return 'Error banning user!';
      });
    } else {

      //get the users data and restore it to the users collection
      let bannedUserData = (await db.collection("bannedUsers").doc(uidToBan).get()).data();
      let op1 = db.collection("users").doc(uidToBan).set(bannedUserData);
      let op2 = db.collection("bannedUsers").doc(uidToBan).delete();

      //enable the users account
      let op3 = admin.auth().updateUser(uidToBan, {
        disabled: false,
      }).then(function(userRecord) {
        console.log('Successfully enabled user');
      }).catch(function(error) {
        console.log('Error enableing user: ', error);
      });
      //wait for the operations to finish
      await Promise.all([op1, op2, op3]).then(result => {
        console.log('Succesfully lifted ban on User!');
        return {
          result: 'Successfully lifted ban!',
          data: {
            result: 'success'
          }
        };
      }).catch(error => {
        console.log(error);
        return 'Error lifting ban on user!';
      });
    }
  } else {
    throw new functions.https.HttpsError('failed-precondition', 'The function must be called ' +
      'as an admin with valid data.');
  }

});

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });