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
      if (JSON.stringify(newData.questions) === JSON.stringify(previousData.questions)) { // Compare the old and new data and only grade the answers if the questions have changed
        log = log + 'Questions were not changed';
      } else {
        log = log + 'Questions were changed. New questions object: ' + JSON.stringify(newData.questions);

        change.after.ref.collection("users").get().then(function(userDocs) { // Get all users in this pool and grade their answers
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

            change.after.ref.collection("users").doc(userDoc.id).update({
              score: score,
            }).then(function() {
              userLog = userLog + ' Updated users score final score is: ' + score;
              console.log(userLog + '}');
            });

          })
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