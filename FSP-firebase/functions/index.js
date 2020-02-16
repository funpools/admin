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


    if (newData.state === "active") { // TODO:If the pool has questions and is live

      //If the questions and the state have not changed dont grade the pool
      if ((JSON.stringify(newData.questions) === JSON.stringify(previousData.questions)) && (previousData.state === newData.state)) {
        log = log + 'Questions were not changed and state has not changed';
      } else {
        log = log + 'State or questions were changed. New questions object: ' + JSON.stringify(newData.questions);

        let highestScore = 0; //This is used to determin the winner(s)
        let winners = []; //Stores the winner(s). If there is a tie then their can be multiple winners in the array

        // Get all users in this pool then grade their answers
        change.after.ref.collection("users").get().then(function(userDocs) {

          userDocs.forEach(function(userDoc) {

            let userLog = 'Graded User ' + userDoc.id + ':{ ';
            let answers = userDoc.get("answers");
            let score = 0; //This is this users total score

            //If the user answered any questions grade them otherwise their score is 0
            if (answers) {
              //Go through each question and compare the correct answer with the users answer
              for (let i = 0; i < newData.questions.length; i++) {
                if (answers[newData.questions[i].id]) {
                  if (answers[newData.questions[i].id] == newData.questions[i].correctAnswer) {
                    score++;
                  }
                } else {
                  userLog = userLog + ' User did not answer question: ' + newData.questions[i].id;
                }
              }
            } else {
              userLog = userLog + ' This user does not have any answers score is: ' + score;
            }

            //Notifiy the user that they have been graded
            db.collection("users").doc(userDoc.id).collection('updates').add({
              title: 'Your score for the ' + newData.name + ' pool has been updated! ',
              body: 'You got ' + score + ' out of ' + newData.questions.length + ' correct',
              link: '/pool/?id=' + context.params.poolID,
            });

            //Update the users object to reflect their final score
            change.after.ref.collection("users").doc(userDoc.id).update({
              score: score,
            }).then(function() {
              userLog = userLog + ' Updated users score final score is: ' + score;
              console.log(userLog + '}');
            });

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
            console.log("More than one winner attempting tie resolution between: ", winners);

            //Make an async function to resolve the tie
            async function resolveTie() {
              let tieBreakerScore = null; //The lowest score of the tied users // NOTE:  Tiebreaker questions are graded by the distance to the correct answer terefor lower is better
              let tieWinners = winners.slice(); //The winners of this tie.
              let tieBreakerQuestions = [];
              //Get the tie breaker questions
              for (let i = 0; i < newData.questions.length; i++) {
                if (newData.questions[i].answer != null) { //This is a numeric/tiebreaker question so add it
                  tieBreakerQuestions.push(newData.questions[i]);
                }
              }

              //Try to resolve the tie with the first question if that fails go to the 2ND if that fails then go to the 3rd and so on if its a true tie then oh well
              for (let q = 0; q < tieBreakerQuestions.length; q++) {

                //If question is valid grade the winners based of of it else move on to the next question
                if (!isNaN(tieBreakerQuestions[q].answer)) {
                  //Grade each remaning winner based on this tiebreaker question
                  for (let i = 0; i < winners.length; i++) {
                    let userDoc = await change.after.ref.collection("users").doc(winners[i]).get(); // Get this users document
                    let answers = userDoc.get("answers");
                    let score;

                    //If the user has answered this question grade them on it else they immidiatly lose the tie breaker
                    if (answers && answers[tieBreakerQuestions[q].id]) {
                      score = Math.abs(answers[tieBreakerQuestions[q].id] - tieBreakerQuestions[q].answer); //score is the absolute distance between the correct answer and users answer // NOTE: therefore the lower the score the better the user did
                    } else {
                      //User didnt answer this question so make sure they dont win
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
                    console.log("Tie resolved");
                    break;
                  } else {
                    winners = tieWinners.slice(); //set the winners to the tie winners this elemenates any users who lost the tie breaker
                    tieBreakerScore = null; //reset the tie score
                  }

                  console.log("Attempted tie resolution with question: " + q);
                }

              }

              //Set the pool winners to the winners of the tie
              change.after.ref.update({
                winners: tieWinners,
              }).then(function() {
                console.log("Set winners to: ", tieWinners);
              });

            }
            //Call the function
            resolveTie();

          } else {

            console.log("Setting winner to: ", winners[0]);
            change.after.ref.update({
              winners: winners,
            }).then(function() {
              console.log("Set winner to: ", winners[0]);
            });

          }

        });
      }
    } else {
      log = log + " Pool is not active";
    }

    console.log(log);

    return 0;
  });


// Listen for changes in all documents in the 'pools' collection
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



// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });