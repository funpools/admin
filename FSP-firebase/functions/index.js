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

      let poolData = poolRef.get();
      // All user documents in this pool
      let userDocs = poolRef.collection("users").get();

      poolData = await poolData;
      userDocs = await userDocs;

      poolData = poolData.data();
      let questions = poolData.questions;

      //If this is a child pool then load the needed data from the parent pool
      if (poolData.parentPool) {
        poolLog += " This is a child pool!"
        let parentPoolData = db.collection("pools").doc(poolData.parentPool).get();
        parentPoolData = await parentPoolData;
        parentPoolData = parentPoolData.data();
        questions = parentPoolData.questions;
      }

      poolLog += 'users scores:{'
      //for each user in the pool grade their answers
      userDocs.forEach(function(userDoc) {

        poolLog += userDoc.id + ': { ';

        let answers = userDoc.get("answers");
        let score = 0; //This is this users total score

        //If the user answered any questions grade them otherwise their score is 0
        if (answers) {
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
        db.collection("users").doc(userDoc.id).collection('updates').add({
          title: 'Your score for the ' + poolData.name + ' pool has been updated! ',
          body: 'You got ' + score + ' out of ' + questions.length + ' correct',
          link: '/pool/?id=' + poolID,
        });

        //Update the users object to reflect their final score
        poolRef.collection("users").doc(userDoc.id).update({
          score: score,
        }).then(function() {});

        poolLog += ' Updated users score final score is: ' + score + '}, ';

        //Check to see if this user is the winner
        if (score > highestScore) { // If this users score is higher then the previous highestScore they are the new winner
          highestScore = score;
          winners = [userDoc.id];
        } else if (score == highestScore) { // If the users score is equal to thehighestScore then we are tied with the current winner
          winners.push(userDoc.id);
        }

      });

      //If there is a tie handle it else set the current winner of the pool
      if (winners.length > 1) {
        poolLog += "More than one winner attempting tie resolution between: " + winners;

        //Get the tie breaker questions
        let tieBreakerQuestions = [];
        for (let i = 0; i < questions.length; i++) {
          if (questions[i].answer != null) { //This is a numeric/tiebreaker question so add it
            tieBreakerQuestions.push(questions[i]);
          }
        }


        let tieWinners = resolveTie(poolID, winners, tieBreakerQuestions);
        tieWinners = await tieWinners;

        //Set the pool winners to the winners of the tie
        poolRef.update({
          winners: tieWinners,
        }).then(function() {
          poolLog += "Set winners to: " + tieWinners;
        });

        return poolLog;
        //Call the function

      } else {

        console.log("Setting winner to: ", winners[0]);
        db.collection("pools").doc(poolID).update({
          winners: winners,
        }).then(function() {
          console.log("Set winner to: ", winners[0]);
        });
        return poolLog;
      }


    }

    //async function to resolve ties
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


// Listen for changes in all documents in the user updates
exports.userNotification = functions.firestore
  .document('users/{userID}/updates/{updateID}')
  .onWrite((change, context) => { //On write to any pool // NOTE: The little arrow thing is shorthand for function(change,context)
    //// NOTE: we can get the ID with context.params.{updateID or userID}
    const newData = change.after.data(); //Data after the write
    const oldData = change.before.data(); //Data before the write

    /*Notification structure
        notification: {
            title: 'title',
            body: 'Basicaly a description',
            type: 'poolUpdate(new score, pool start etc),freindRequest,etc', //This is for allowing notifications to be muted and stuff
            image: '(URL) optional image',
            link: 'A link to go to when the notification is pressed'
          }
    */

    // TODO: check if the user wants to get this notification

    //Setup the notification message
    var message = {
      notification: {
        title: newData.title,
        body: newData.body,
      },
      data: {
        link: newData.link,
      },
      topic: 'user-' + context.params.userID,
    };

    //If there is a image add it
    if (newData.image) {
      message.notification[image] = newData.image;
    }

    console.log(message);
    // Send a message to devices subscribed to the provided topic.
    admin.messaging().send(message).then((response) => {
      // Response is a message ID string.
      console.log('Successfully sent message:', response);
    }).catch((error) => {
      console.log('Error sending message:', error);
    });


    return 0;
  });

//Creates a private pool with given data
exports.createPrivatePool = functions.https.onCall((data, context) => {
  // Checking that the user is authenticated.
  if (!context.auth) {
    // Throwing an HttpsError so that the client gets the error details.
    throw new functions.https.HttpsError('failed-precondition', 'The function must be called ' +
      'while authenticated.');
  }
  // Authentication / user information is automatically added to the request.
  // const uid = context.auth.uid;
  // const name = context.auth.token.name || null;
  // const picture = context.auth.token.picture || null;
  // const email = context.auth.token.email || null;
  console.log(data);
  return db.collection("pools").add({
    name: data.name,
    description: data.description,
    parentPool: data.parentPool,
    admins: data.admins,
    allowShares: data.allowShares,
    private: true,
  }).then(function(doc) {
    db.collection("pools").doc(data.parentPool).update({
      childPools: admin.firestore.FieldValue.arrayUnion(doc.id),
    })
    return {
      data: data,
      message: 'made pool, id:' + doc.id,
      id: doc.id,
    };

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

async function sendNotification(uid, message) {

  await db.collection("users").doc(uid).collection('updates').doc(message.type + '-' + message.id).set(message);

  return "Successfully sent the notification!";
}

//Requests to be freinds with the specified user
exports.freindRequest = functions.https.onCall((data, context) => {
  // Checking that the user is authenticated.
  if (!context.auth) {
    // Throwing an HttpsError so that the client gets the error details.
    throw new functions.https.HttpsError('failed-precondition', 'The function must be called ' +
      'while authenticated.');
  }

  // Authentication / user information is automatically added to the request.
  const UserID = context.auth.uid;
  // const name = context.auth.token.name || null;
  // const picture = context.auth.token.picture || null;
  // const email = context.auth.token.email || null;


  console.log(data);
  return sendNotification(data.uid, {
    id: UserID,
    text: "Click here to accept or reject their request.",
    title: data.firstName + ' ' + data.lastName + " has requested to be your friend.",
    type: "friend-request",
    senderID: UserID,
  }).then(function(result) {
    console.log(result);
    return {
      result: result,
      uid: UserID
    };
  });
});


//Resolves pending freind requests by accepting or rejecting them
exports.resolveFreindRequest = functions.https.onCall(async function(data, context) {

  /*
  Data{
    accept:true/false,
    uid://the uid of the person whose frend request we want to accept
  }
  */

  // Checking that the user is authenticated.
  if (!context.auth) {
    // Throwing an HttpsError so that the client gets the error details.
    throw new functions.https.HttpsError('failed-precondition', 'The function must be called ' +
      'while authenticated.');
  }

  // Authentication user information is automatically added to the request.
  const userID = context.auth.uid;
  const uid = data.uid; //The uid whose freind request we are accepting
  //TODO: if the user really requested this

  let operations = []; //Array of promises for the operations we are currently running

  console.log(userID, uid);
  //Update this users freinds list
  operations.push(db.collection('users').doc(userID).update({
    friends: admin.firestore.FieldValue.arrayUnion(uid),
    pendingFriends: admin.firestore.FieldValue.arrayRemove(uid),
  }).catch(function(error) {
    throw new functions.https.HttpsError('Error updating recevers docs', error);
  }));

  //Update the person who sent the freind request
  operations.push(db.collection('users').doc(uid).update({
    friends: admin.firestore.FieldValue.arrayUnion(userID),
    pendingFriends: admin.firestore.FieldValue.arrayRemove(userID),
  }).catch(function(error) {
    throw new functions.https.HttpsError('Error updating requester docs', error);
  }));

  return Promise.all(operations).then(function(results) {
    //notify user that their friend request has been accepted
    return sendNotification(uid, {
      id: userID,
      title: data.firstName + ' ' + data.lastName + " Has accepted your friend request.",
      text: "Click here to view " + data.firstName + "\'s profile.",
      link: "/user/?id=" + userID,
      type: "friend-accept",
      senderID: userID,
    }).then(function(result) {
      console.log(result);
      return {
        uid: userID,
        notificationResult: result,
        data: data,
      };
    });

  });

});

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });