const functions = require('firebase-functions');

// The Firebase Admin SDK to access the Firebase Realtime Database.
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

class Log {
  constructor(string, name) {
    this.string = string;
    if (name != null) {
      this.name = name;
    }
  }
  add(string) {
    this.string = this.string + string + ' , ';
  }
  log(string) {
    this.string = this.string + string + ' , ';
  }
  getLog() {
    return this.string;
  }
  /// Prints the log to the console
  toConsole() {
    console.log(this.string);
  }
}

/** Gets the pool data for the given poolID */
async function getPool(poolID) {

  let poolData = db.collection("pools").doc(poolID).get();

  poolData = (await poolData).data();

  if (poolData == null) {
    //console.log("Invalid pool returning");
    return "invalid";
  }
  //console.log("This pools raw data is: ", poolData);
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
      requiresPermission: (poolData.requiresPermission != null) ? poolData.requiresPermission : true,
      admins: poolData.admins ? poolData.admins : [],
      unsubscribed: poolData.unsubscribed ? poolData.unsubscribed : [],
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
      requiresPermission: (poolData.requiresPermission != null) ? poolData.requiresPermission : true,
      allowShares: poolData.allowShares ? poolData.allowShares : true,
      admins: poolData.admins ? poolData.admins : [],
      unsubscribed: poolData.unsubscribed ? poolData.unsubscribed : [],
      sentPoolClosingNotification: poolData.sentPoolClosingNotification ? poolData.sentPoolClosingNotification : false,
    };
  }
}

// Listen for changes in all documents in the 'pools' collection
exports.poolUpdate = functions.runWith({
  timeoutSeconds: 540,
  memory: '1GB'
}).firestore.document('pools/{poolID}')
  .onWrite(async (change, context) => { //On write to any pool.
    //// NOTE: we can get the poolsID with context.params.poolID
    const newData = change.after.data(); //Data after the write
    const previousData = change.before.data(); //Data before the write
    let functionLog = 'Pool ' + context.params.poolID + ' with state: ' + newData.state + ' has been updated! '; //This is a log so we can keep track of the pool and only consle. Log once for quota reasons
    console.log('started for pool ' + context.params.poolID);
    /** Async function to grade the pool
       function usage:
         *Input the ID of the pool and the type of message to send and this will grade the pool and all child pools
         *Valid message types are:
           "active"//This will let the users know that the pool is now active
           "score-update"//This notifies the pools users of there new score
           "closed"//This will let the users know that the pool is now closed
           "none"//This will not send a notification
     */
    async function gradePool(poolID, messageType) {

      // Keeps track of the log rather than having a bunch of little logs
      let poolLog = new Log('Grading pool: ' + poolID, 'gradePool:' + poolID);;

      try {


        // Reference to the pools document
        let poolRef = db.collection("pools").doc(poolID);
        let pool = getPool(poolID);

        // Get all user answer documents in this pool
        let userDocs = poolRef.collection("users").get();
        let gradedUsers = [];

        pool = await pool;

        let poolPromises = [];
        //If this pool has children then add them to the list of pools to grade
        if (pool.childPools != null) {
          pool.childPools.forEach(function (cpoolID) {
            poolPromises.push(gradePool(cpoolID, messageType).then(function (result) {
              //console.log("Successfully graded child pool ", result);
            }));
          });
        }

        userDocs = await userDocs;

        function gradeUser(user) {
          let score = 0; //This users total score
          let tieBreakerScores = [];
          let userDoc = userDocs.docs.find((a) => a.id == user.uid); //The users answer document

          if (userDoc != null && userDoc.get("answers") != null) { //If the user has answered any questions
            let answers = userDoc.get("answers");

            // 1. Grade the users answers to the questions
            for (let i = 0; i < pool.questions.length; i++) {
              // If the user answered this question correctly
              if (answers[pool.questions[i].id] != null &&
                answers[pool.questions[i].id] == pool.questions[i].correctAnswer) {
                score++;
              } else { }
            }

            // 2. Grade the users answers for the tieBreakers
            for (let i = 0; i < pool.tiebreakers.length; i++) {
              // Add the users score to the array 
              tieBreakerScores.push(Math.abs(answers[pool.tiebreakers[i].id] - pool.tiebreakers[i].answer));
            }

          } else {
            score = 0;
          }

          poolLog.log(user.uid + ':' + score + ',');
          return {
            uid: user.uid,
            score: score,
            tieBreakerScores: tieBreakerScores,
            isWinner: false,//may not need?
          };
        }

        let gradedUserPromises = [];
        if (pool.users != null) { //If there are any users in this pool
          poolLog.log('Grading users');
          //Grade each user in the pool
          for (let userIndex = 0; userIndex < pool.users.length; userIndex++) {
            const user = pool.users[userIndex];
            //Add the graded user to the array
            gradedUserPromises.push(gradeUser(user));
          }
          await Promise.all(gradedUserPromises).then((values) => {
            for (let i = 0; i < values.length; i++) {
              const user = values[i];
              gradedUsers.push(user);
            }
          });

          //Sort the graded users by score and tiebreaker scores
          gradedUsers.sort((a, b) => {
            // If the scores are not equal then we can sort by score 
            if (b.score != a.score) {
              return b.score - a.score;
            } // Else there is a tie so try to sort by tiebreakers
            else {
              poolLog.log('');
              for (let i = 0; i < pool.tiebreakers.length; i++) {
                let tieScore = a.tieBreakerScores[i] - b.tieBreakerScores[i];
                poolLog.log('resolving tie score is: ' + (tieScore));
                if (tieScore != 0)
                  return tieScore;
              }
            }
            return 0;
          });
          poolLog.log('Finished grading users');

          // If there are no unanswerd questions then determine the winner(s)
          if (pool.questions.every(a => a.correctAnswer != null) && pool.tiebreakers.every(e => e.answer != null)) {
            // Keep track of the place we are currently calculating eg(1st,2nd,3rd,etc.)
            let place = 0;
            // Determine each users place
            for (let i = 0; i < gradedUsers.length; i++) {
              const user = gradedUsers[i];
              const previousUser = gradedUsers[i - 1];
              // If there is a tie
              if ((previousUser != null) && previousUser.score == user.score) {
                for (let x = 0; x < pool.tiebreakers.length; x++) {
                  let tieScore = user.tieBreakerScores[x] - previousUser.tieBreakerScores[x];
                  poolLog.log('resolving tie for user placing score is: ' + (tieScore));
                  // If the tie score is not 0 then the tie is resolved
                  if (tieScore != 0) {
                    if (tieScore > 0) {
                      poolLog.log("this is probably going  to happen.")
                      // The previous user won
                      place = i + 1;
                      user.place = place;
                    } else {
                      poolLog.log("THIS is unlikely to happen. In fact it may be impossible")
                      // The current user won
                      user.place = place;
                      place = i + 1;
                      previousUser.place = place;
                    }
                    break;
                  }
                  if (x >= pool.tiebreakers.length - 1) {
                    // There has been a true tie
                    user.place = place;
                    // place++;
                  }
                }

              } else {
                place = i + 1;
                user.place = place;
              }
            }

            //TODO possibly combine with above
            for (var i = 0; i < gradedUsers.length; i++) {
              if (gradedUsers[i].place == 1) {
                gradedUsers[i].isWinner = true;
              }
            }

            poolLog.log('gradedUserArray:' + JSON.stringify(gradedUsers));
          }

          poolLog.log(' Final user array is: ' + JSON.stringify(gradedUsers));

          // Update the pools doc with the new user data
          await db.collection("pools").doc(poolID).update({
            users: gradedUsers,
          });

          //Notify each user in the pool
          poolLog.log("Sending notifications to users. Notification type: ", messageType);
          pool.users.forEach((user, i) => {
            //Check if the user is unsubbed from notifications 
            if (!pool.unsubscribed.includes(user.uid)) {
              //Decide which type of notification to send to the user
              switch (messageType) {
                case "active":
                  sendNotification(user.uid, {
                    id: poolID,
                    poolID: poolID,
                    link: "/pool/?id=" + poolID,
                    title: pool.name + " is now active",
                    text: pool.name + " is now active. Click here to view the pool! ",
                    type: "PU",
                  });
                  break;
                case "closed":
                  sendNotification(user.uid, {
                    id: poolID,
                    poolID: poolID,
                    link: "/pool/?id=" + poolID,
                    title: pool.name + " is now closed",
                    text: "The " + pool.name + " is closed. Your ranking is " + user.place + "/" + pool.users.length + ". Check here to see your results!",
                    type: "PU",
                  });
                  break;
                case "score-update":
                  sendNotification(user.uid, {
                    id: poolID,
                    poolID: poolID,
                    link: "/pool/?id=" + poolID,
                    title: "Your score has been updated",
                    text: "A question in " + pool.name + " has been updated—check here for your score!",
                    type: "PU",
                  });
                  break;
                default:
                  sendNotification(user.uid, {
                    id: poolID,
                    poolID: poolID,
                    link: "/pool/?id=" + poolID,
                    title: "Pool has been updated",
                    text: "" + pool.name + "has been updated!",
                    type: "PU",
                  });
              }
            }
          });
        } else {
          poolLog.log('Error no users');
        }

        // Wait for the child pools to be graded
        await Promise.all(poolPromises).then(function () {
          //console.log("All pools graded!");
        });

        return poolLog.getLog();
      } catch (error) {
        poolLog.log('ERROR');
        poolLog.toConsole();
        console.error(error);
      }
    }

    if ((previousData.state == null) || previousData.state != newData.state) { //state has changed
      switch (newData.state) {
        case "active":
          console.log("Pool " + context.params.poolID + " now active!");
          //Grade the pool and send the active notification
          let results = await gradePool(context.params.poolID, "active");
          console.log("Successfully graded pool:" + context.params.poolID + " log: " + results);
          return true;
          break;
        case "closed":
          //Grade the pool and send the closed notification
          let gradeResults = await gradePool(context.params.poolID, "closed");

          //Get the winner data and email it to the admins
          let winnersList = '';
          let poolData = await getPool(context.params.poolID);
          for (let i = 0; i < poolData.users.length; i++) {
            var user = poolData.users[i];
            // Skip loosers
            if (user.isWinner) {
              // Get winner's contact info and add it to the list
              await admin.auth().getUser(user.uid).then(async userRecord => {
                let userData = await getUser(user.uid);
                winnersList = winnersList + '<p style="font-size: large"></br>Name:' + userData.firstName + ' ' + userData.lastName + ' <br /> UID: ' + user.uid + '<br /> SCORE: ' + user.score + '/' + poolData.questions.length + '<br /> Email: <a href="mailto:"> ' + userRecord.email + ' </a></p>';
              }).catch(error => {
                console.error('Error fetching user data:', error)
                let foo = {
                  status: 'error',
                  code: 500,
                  error
                };
              });
            }
          };
          console.log("The winner list is: " + JSON.stringify(winnersList));

          // Email winner info to the admins
          await admin.firestore().collection('mail').add({
            to: ['tsmith@funsportspools.com', 'development@funsportspools.com',
              'admin@funsportspools.com', 'Haley.Sacotte@wyecomm.com'],//'tsmith@funsportspools.com', 'development@funsportspools.com', 'admin@funsportspools.com,mike@onairsportsmarketing.com,Haley.Sacotte@wyecomm.com'
            message: {
              subject: 'Winner info for ' + poolData.name,
              html: '<div style="margin: 32px auto; padding: 32px; max-width: 500px; background-color: #f0f0f0; border-radius: 8px">\
              <img src="https://admin.funpools.app/logo.png" style="width: 40%; max-width: 150px; display: block; margin: 0 auto;"/>\
            <p style="font-size: large"></br>Hi Admins,<br />' + poolData.name + ' has been closed and the winner info is: </br></p>' + winnersList + '</div>',
            }
          }).then(() => console.log('Queued email for delivery!'));

          console.log("Successfully graded pool:" + context.params.poolID + " log: " + gradeResults);
          break;
        case "open":
          // Reset the users scores
          let scoreResetUsers = [];
          newData.users.forEach((user, i) => {
            scoreResetUsers.push({
              uid: user.uid,
              score: 0,
              isWinner: false,
            });
          });
          await db.collection("pools").doc(context.params.poolID).update({
            users: scoreResetUsers,
          });
          if (previousData.state == null || previousData.state == 'draft') {
            console.log("Pool: " + newData + " has been opened! is dev: " + newData.tags.includes("dev"));
            await sendAnnouncementNotification(newData.name, 'The ' + newData.name + ' pool has been opened—tap to play now!', "/pool/?id=" + context.params.poolID, 'open-' + context.params.poolID, newData.tags.includes("dev"));
          }
          break;
        default:
      }
    } else { // The state is the same
      switch (newData.state) {
        case "active":
          console.log("Pool: " + context.params.poolID + " has stayed active!");
          if ((JSON.stringify(newData.questions) != JSON.stringify(previousData.questions)) || (JSON.stringify(newData.tiebreakers) != JSON.stringify(previousData.tiebreakers))) { //If the questions/tiebreakers have changed
            // Grade the pool and send users a score update
            let results = await gradePool(context.params.poolID, "score-update");
            console.log("Successfully graded pool:" + context.params.poolID + " log: " + results);
          }
          break;
      }
    }



    console.log("Finished execution of pool update for: " + context.params.poolID);

    return true;
  });

//Check for any pools that are closing soon and notify the users in that pool
exports.poolClosing = functions.pubsub.schedule('every 2 minutes').onRun(async function (context) {

  //get any pools that close within "minutes" from now
  const minutes = 60;
  let startDate = new Date();
  let endDate = new Date(startDate.getTime() + (minutes * 60000));
  let querySnapshot = await db.collection('pools').orderBy('date').startAt(startDate).endAt(endDate).get();

  console.log(querySnapshot.size, " pools are closing soon! Start and end date:", startDate, endDate);

  async function sendClosingNotificatoin(poolID) { //Sends out a closing notification for the given pool and any child pools
    // TODO: Pehaps pass in the doc data to this function to save a read?
    let pool = await getPool(poolID);

    if (pool.state === "open") { //Only send closing notifications if the pool is open
      let poolPromises = [];
      //If this pool has children then add them to the list of pools to send closing notifications to
      if (pool.childPools != null) {
        pool.childPools.forEach(function (cpoolID) {
          poolPromises.push(sendClosingNotificatoin(cpoolID).then(function (result) {
            //console.log("Successfully sent closing notificatoins for child pool: ", cpoolID);
          }));
        });
      }

      let userPromises = [];
      //if we have not sent a closing notification for this pool send one to all users in this pool
      if (!pool.sentPoolClosingNotification) {
        pool.users.forEach((user, i) => {
          userPromises.push(sendNotification(user.uid, {
            id: poolID,
            poolID: poolID,
            link: "/pool/?id=" + poolID,
            title: "Pool closing soon",
            text: "Enter your answers now: " + pool.name + " is closing soon!",
            type: "PU",
          }).then(result => { }));
        });
        console.log("Sent closing notificatoin to " + pool.users.length + " users!");
      } else {
        console.log("Closing notification already sent for this pool.");
      }
      //wait for all operations to finish
      await Promise.all(userPromises);
      await Promise.all(poolPromises);
      await db.collection("pools").doc(poolID).update({
        sentPoolClosingNotification: true,
      });
    } else {
      //console.log("This pool is not open. Not sending closing notification");
    }

    return true;
  }

  //send a notificatoin for each of the found pools
  let notificationPromises = [];
  for (var i = 0; i < querySnapshot.docs.length; i++) {
    //console.log(querySnapshot.docs[i].id);
    //console.log("Pool ", querySnapshot.docs[i].id, " is closing soon pool data: ", querySnapshot.docs[i].data());
    notificationPromises.push(sendClosingNotificatoin(querySnapshot.docs[i].id));
  }
  await Promise.all(notificationPromises);

  return true;
});

exports.weeklyPool = functions.pubsub.schedule('every monday 00:00').onRun(async function (context) {
  //g2DfdYxi9z
  //every monday 00:00
  let startDate = new Date();
  let endDate = new Date(startDate.getTime() + 604800000);
  let querySnapshot = await db.collection('pools').orderBy('date').startAt(startDate).endAt(endDate).get();

  console.log(querySnapshot.size, " pools are closing this week. Start and end date:", startDate, endDate);


  // Set each pool to 'this week catagory'
  let notificationPromises = [];
  for (var i = 0; i < querySnapshot.docs.length; i++) {
    let doc = querySnapshot.docs[i];
    console.log('adding tag for pool ' + doc.id);


    // Update the pools doc with the new thing
    await db.collection("pools").doc(doc.id).update({
      tags: admin.firestore.FieldValue.arrayUnion('g2DfdYxi9z'),
    });
  }

  return true;
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
      requiresPermission:bool,// If the pool needs permission to join
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
  return db.collection("pools").doc(data.parentPool).get().then(function (doc) {

    console.log(doc.data());
    console.log('Parent pool state', doc.data.state);

    if (doc.exists && (doc.data()).state == 'open') {

      return db.collection("pools").add({
        name: data.name,
        description: data.description,
        parentPool: data.parentPool,
        admins: data.admins,
        allowShares: data.allowShares,
        requiresPermission: (data.requiresPermission != null) ? data.requiresPermission : true,
        private: true,
      }).then(function (doc) {

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

exports.deletePool = functions.https.onCall(async function (data, context) {
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

exports.joinPool = functions.https.onCall(async function (data, context) { //Function for joining and leaving pools
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

  console.log("Join pool function called with data: ", JSON.stringify(data));

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
  let targetUser = getUser(targetUid);
  let pool = getPool(poolID);
  let user = db.collection('users').doc(userID).get();

  targetUser = await targetUser;
  pool = await pool;

  let ops = []; //The operations stored as an array of promises

  //If the pool is valid
  if (pool != "invalid") {
    if (pool.state != "closed" && !(pool.state == "active" && join)) { //If the pool is not closed and (The the user is not trying to join an active pool)
      if (userID == targetUid) { //If the user is requesting this operation as themselves

        console.log("Loaded pool data: ", JSON.stringify(pool));

        if (join) { //If the user wants to join the pool

          if (!pool.private || pool.allowedUsers.includes(userID) || !pool.requiresPermission) { //If the user is allowed to join this pool add them to it

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
            console.log("admin is: ", JSON.stringify(adminT));
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

          let userToRemove = pool.users.find(function (e) {
            return e.uid === userID;
          });
          console.log(JSON.stringify(userToRemove));
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

        if (!pool.private || (pool.allowShares && user.pools.includes(poolID)) || pool.admins.includes(userID)) { //If this user is allowed to perform this operation // TODO: check if the user requesting this operation is part of this pool

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
              console.log("admin is: ", JSON.stringify(adminT));
              await sendNotification(adminT, {
                user: pool.admins[1],
                senderID: userID,
                poolID: poolID,
                id: targetUid + poolID,
                link: "/pool/?id=" + poolID, //", //"/pool/?id=" + poolID,
                title: user.firstName + ' ' + user.lastName + " has requested.",
                text: user.username + " has reported user: " + targetUser.username + " click to view.",
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

exports.setPoolNotificationPreference = functions.https.onCall(async function (data, context) {
  /*
  * This function must be called with the data param containing
   * {
   *    poolID:""//The id of the pool to unsubscribe the user from
   *    preference:""//True to recive notifications false to not 
   * }
  */
  // Checking that the user is authenticated.
  if (!context.auth) {
    // Throwing an HttpsError so that the client gets the error details.
    throw new functions.https.HttpsError('failed-precondition', 'The function must be called ' +
      'while authenticated.');
  }

  //TODO: check for valid data
  if (false) {
    throw new functions.https.HttpsError('failed-precondition', 'The function must be called ' +
      'with valid data.');
  }

  const userID = context.auth.uid; //The uid of the user who requested this operation
  const poolID = data.poolID; //the uid of the user whom the request is targeted
  let pool = await getPool(poolID);
  const preference = (pool.unsubscribed.includes(userID)); //the uid of the user whom the request is targeted

  if (preference) {
    await db.collection("pools").doc(poolID).update({
      unsubscribed: admin.firestore.FieldValue.arrayRemove(userID),
    });
    return "on";
  } else {
    await db.collection("pools").doc(poolID).update({
      unsubscribed: admin.firestore.FieldValue.arrayUnion(userID),
    });
    return "off";
  }
});

/** Adds a message to a chat
  This should be called with the data parameter containing
  {
      poolID:"",//The id of the pool you wish to add a message to
      text:"",//The messages text
  }
*/
exports.addMessage = functions.https.onCall(async function (data, context) {


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

  let pool = await getPool(poolID);
  let senderData = await getUser(uid);

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
          senderID: uid,
          poolID: poolID,
          id: poolID,
          link: "/chat/?id=" + poolID,
          title: pool.name + ": " + senderData.firstName + " " + senderData.lastName,
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

exports.sendAnnouncement = functions.https.onCall(async function (data, context) { //Sends an announcement to all users

  // Checking that the user is authenticated.
  if (!context.auth) {
    // Throwing an HttpsError so that the client gets the error details.
    throw new functions.https.HttpsError('failed-precondition', 'The function must be called ' +
      'while authenticated.');
  }
  if (data.title == null || data.description == null) {
    console.log("Function called with invalid data.");
    // Throwing an HttpsError so that the client gets the error details.
    throw new functions.https.HttpsError('failed-precondition', 'The function was called with invalid Data: ', data);
  }

  const uid = context.auth.uid;
  const title = data.title;
  const body = data.description;
  const link = (data.link) ? data.link : null;
  const test = (data.test) ? data.test : false;
  let announcementId = 'A-' + title + body;
  announcementId = announcementId.replace(/\s+/g, '-').toLowerCase();
  //const image = data.image;//Not needed at the moment

  //If the user is an admin allow the announcment
  let admin = await db.collection("admins").doc(uid).get();
  if (admin.exists && admin.data().adminPermissions.announcements) {

    if (test) {
      console.log("Sending a test announcment, title: " + title + ", body: " + body + ", link: " + link);
    } else {
      console.log("Sending announcment, title: " + title + ", body: " + body + ", link: " + link);
    }

    let querySnapshot = await db.collection("users").get();
    let userDocs = querySnapshot.docs;
    let promises = [];
    //console.log("Sending announcment to " + userDocs.length + " users");

    for (var i = 0; i < userDocs.length; i++) {
      if (!test || (userDocs[i].id == "9jFl5rEDLSWaEb50dZljVy1BVOr1" || userDocs[i].id == "hmv13BjWz6gMYJ06jYMoO6zKyYt2" || userDocs[i].id == "kvkL4oRtkDflKTeoOMJAkn2nRZe2")) {
        promises.push(db.collection("users").doc(userDocs[i].id).collection('updates').doc(announcementId).set({
          id: announcementId,
          title: title,
          text: body,
          type: 'A',
          link: link, //"/pool/?id=" + poolID,
        }));
      }
    }

    await sendAnnouncementNotification(title, body, link, announcementId, test);
    await Promise.all(promises);

    if (!test) {
      return "Succesfully sent announcement";
    } else {
      return "Succesfully sent test announcement";
    }
  } else {
    console.error("Announcement request from an unathorized source!");
    return "You are not authorized to send announcements. This incident will be reported!"
  }
});

/**
 * 
 * @param {string} title 
 * @param {string} body 
 * @param {string} link 
 * @param {string} announcementId 
 * @param {bool} test 
 */
async function sendAnnouncementNotification(title, body, link, announcementId, test) {
  // Define a condition which will send to devices which are subscribed
  let condition = "!('atopicthatexistssowecancheckifitdoesnt' in topics)";
  if (test != null && test) {
    console.log("Sending a test announcment notification.");
    condition = "('user-9jFl5rEDLSWaEb50dZljVy1BVOr1' in topics)||('user-hmv13BjWz6gMYJ06jYMoO6zKyYt2' in topics)||('user-kvkL4oRtkDflKTeoOMJAkn2nRZe2' in topics)";
  } else {
    console.log("Sending a real announcment notification.");

  }

  var message = {
    notification: {
      title: (title) ? title : 'No Title',
      body: (body) ? body : 'No Body',
    },
    data: {
      link: (link) ? link : '',
      //notification_foreground: true,
      notification_id: announcementId, //this is the id of the notificatoin as it is in the users updates collection
    },
    android: {
      notification: {
        //tag: 'A-' + message.id,
        channel_id: "default",
      },
    },
    // condition: condition,
    topic: 'all',
  };

  // Send a message to devices subscribed to the combination of topics specified by the provided condition.
  await admin.messaging().send(message).then((response) => {
    // Response is a message ID string.
    console.log('Successfully sent message:', response);
  }).catch((error) => {
    console.log('Error sending message:', error);
  });

  return 1;
}

/** Sends a notification to the specified user
`@param uid is the id of the targeted user

  @param message structure (* is optional):
  {
      id: "",
      title: "",
      text: "",
      type: "",
      *link: "",//"/pool/?id=" + poolID,
  }

//// NOTE: These types are not used notifications currently use old naming
  Notification types:
    A-(Announcement)
    PU-(Pool update)
    PI-(Pool invite)
    PA-(Pool accept)
    CU-(Chat update)
    UR-(User report)
    FR-(Freind request)
*/
async function sendNotification(uid, message) {


  let user = db.collection('users').doc(uid).get();
  user = (await user);
  //console.log("sending notification: ", message, " to user: ", user);
  if (user != null && user.exists && user.data() != null) {
    user = user.data();

    let exludedNotifications = (user.exludedNotifications) ? user.exludedNotifications : [];

    if (exludedNotifications.includes(message.type)) { //If the user has requested to not receve these types of notifications the dont send anything
      console.log("user: ", user, " has requested to not receve this");
      return "Failed to send the notification. The user has requested not to see these types notifications";
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

async function getUser(uidToGet) { //Gets a user and runs checks for errors and invalid pareameters
  let userData = (await db.collection('users').doc(uidToGet).get()).data();

  (userData.pendingPools) ? null : userData.pendingPools = [];

  return userData
}

//Requests to be freinds with the specified user
exports.freindRequest = functions.https.onCall(async function (data, context) {

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
      }).catch(function (error) {
        throw new functions.https.HttpsError('Error updating recevers docs', error);
      });

      //Update the other users freinds list
      let theirDoc = db.collection('users').doc(uid).update({
        friends: admin.firestore.FieldValue.arrayUnion(userID),
        pendingFriends: admin.firestore.FieldValue.arrayRemove(userID),
      }).catch(function (error) {
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
      }).catch(function (error) {
        throw new functions.https.HttpsError('Error updating recevers docs', error);
      });
      //Remove us from the other users freinds
      let theirDoc = db.collection('users').doc(uid).update({
        friends: admin.firestore.FieldValue.arrayRemove(userID),
        pendingFriends: admin.firestore.FieldValue.arrayRemove(userID),
      }).catch(function (error) {
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
      }).catch(function (error) {
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
      }).catch(function (error) {
        throw new functions.https.HttpsError('Error updating recevers docs', error);
      });
      //Remove us from the other users freinds
      let theirDoc = db.collection('users').doc(uid).update({
        friends: admin.firestore.FieldValue.arrayRemove(userID),
        pendingFriends: admin.firestore.FieldValue.arrayRemove(userID),
      }).catch(function (error) {
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

exports.banUser = functions.https.onCall(async function (data, context) {

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
      }).then(function (userRecord) {
        console.log('Successfully disabled user');
      }).catch(function (error) {
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
      }).then(function (userRecord) {
        console.log('Successfully enabled user');
      }).catch(function (error) {
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
//:)

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });