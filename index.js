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

    if (true) { // TODO:If the pool has questions and is live
      if ((JSON.stringify(newData.questions) === JSON.stringify(previousData.questions)) && (previousData.state === newData.state)) { // Compare the old and new data and only grade the answers if the questions have changed or the pool has just be set to active
        log = log + 'Questions were not changed and state has not changed';
      } else {
        log = log + 'State or questions were changed. New questions object: ' + JSON.stringify(newData.questions);

        let highestScore = 0;
        let winners = [];
        // Get all users in this pool and grade their answers
        change.after.ref.collection("users").get().then(function(userDocs) {
          userDocs.forEach(function(userDoc) {
            let userLog = 'Graded User ' + userDoc.id + ':{ ';
            let answers = userDoc.get("answers");
            let score = 0;
            if (answers) {
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
            } else if (score == highestScore) { // If the users score is equal to the high score then we are tied with the current winner
              winners.push(userDoc.id);
            }

          });
          //If there is a tie handle it else set the current winner of the pool
          if (winners.length > 1) { // If there is more than one winner ther has been a tie of some sort
            console.log("More than one winner attempting tie resolution between: ", winners);
            //Make an async function to resolve the tie
            async function resolveTie() {
              let tieBreakerScore; //The lowest score of the tied users
              let tieWinners = winners; //The winners of this tie if more than one it is a true tie
              let tieBreakerQuestions = [];
              //Get the tie breaker questions
              for (let i = 0; i < newData.questions.length; i++) {
                if (newData.questions[i].answer != null) { //This is a numeric/tiebreaker question
                  tieBreakerQuestions.push(newData.questions[i]);
                }
              }
              //Try to resolve the tie with the first question if that fails go to the 2ND if that fails then go to the 3rd and so on if its a true tie then the oh well
              for (let q = 0; q < tieBreakerQuestions.length; i++) {
                //If question is valid grade the winners based of of it else move on to the next question
                if (!isNaN(tieBreakerQuestions[q].answer)) {
                  //Grade each winner
                  for (let i = 0; i < winners.length; i++) {
                    let userDoc = await change.after.ref.collection("users").doc(winners[i]).get(); // Get this users document
                    let answers = userDoc.get("answers");
                    let score;
                    //If the user has answered this question grade them on it else they immidiatly lose the tie breaker
                    if (answers[tieBreakerQuestions[q].id]) {
                      score = Math.abs(answers[tieBreakerQuestions[q].id] - tieBreakerQuestions[q].answer); //score is the absolute distance between the correct answer and users answer // NOTE: therefore the lower the score the better the user did
                    } else {
                      //user didnt answer this question so make sure they dont win
                    }

                    if ((tieBreakerScore == null || score < tieBreakerScore) && (score != null)) { // If this users score is smaller then the previous best score they are the new winner
                      tieBreakerScore = score;
                      tieWinners = [userDoc.id];
                    } else if (score == highestScore && (score != null)) { // If the users score is equal to the best score then we are tied with the current winner
                      tieWinners.push(userDoc.id);
                    }
                    console.log("Graded tie user", {
                      id: userDoc.id,
                      score: score,
                      tieWinners: tieWinners
                    });
                  }

                  //If the tie is resolved return else move to next tiebreaker
                  if (tieWinners.length <= 1) {
                    console.log("Tie resolved");
                    break;
                  } else {
                    winners = tieWinners; //set the winners to the tie winners this elemenates any users who lost the tie breaker
                    tieBreakerScore = null; //reset the tie score
                  }
                  console.log("endloop");
                }
              }
              //Set the pool winners to the winners of the tie
              console.log("Setting winners to: ", tieWinners);
              change.after.ref.update({
                winners: tieWinners,
              }).then(function() {
                console.log("Set winners to: ", tieWinners);
              });
            }
            //Call the function
            resolveTie();

          } else { // There is not a tie so set the winner
            console.log("Setting winner to: ", winners[0]);
            change.after.ref.update({
              winners: winners,
            }).then(function() {
              console.log("Set winner to: ", winners[0]);
            });
          }
        });
      }
    }
    console.log(log);

    return 0;
  });

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });