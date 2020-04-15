var app = new Framework7({
  root: '#app',
  name: 'Fun Pools Admin',
  id: 'com.myapp.test',
  theme: 'aurora',
  routes: [{
      path: '/home/',
      url: 'index.html',
      options: {
        transition: 'f7-dive',
      },
      on: {
        pageBeforeIn: function() {
          app.preloader.hide();
        }
      }
    },
    {
      path: '/login/',
      url: 'pages/login.html',
      options: {
        transition: 'f7-dive',
      },
      on: {
        pageInit: function(e, page) {
          //When the pages is Initialized setup the signIn button
          $$('#log-in').click(function(event) {
            signIn($$('#uname').val(), $$('#pword').val());
          });
        },
      }
    },


  ],
});

var $$ = Dom7;

var mainView = app.views.create('.view-main');


///////********Page Setup Functions and dom stuff*********\\\\\\\\\\
function makeid(length) {
  var result = '';
  var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

// user search
$$('#user-search').on('keyup', function(event) {
  if (event.keyCode === 13) {
    $$('#user-search-button').click();
  }
});

// Setup for the new multiple choice question button
$$('#mc-question').on('click', function() {
  //store the question number for later use
  var questionNumb = makeid(10);
  //add the new question html to the page
  addQuestion(questionNumb, '');
});

// Setup for the new numeric question button
$$('#n-question').on('click', function() {

  //store the question number for later use
  var questionNumb = makeid(10);

  //add the new question html to the page
  addNumericQuestion(questionNumb, '');
});



// Save pool button on click
$$('.pool-save').on('click', function() {

  savePool();
});

// New pool button on click
function newPool() {
  //clear any existing values in the popup
  $$(".pool-popup").find('.pic-upload').css("background-image", "");
  $$(".pool-popup").find('.pic-icon').html("add_photo_alternate");
  document.getElementById("pool-name").value = "";
  document.getElementById("pool-name").dataset.id = "0";
  document.getElementById("pool-description").innerHTML = "";
  $$("#pool-tags").html("");
  $$("#pool-questions").html("");
  poolDateInput.setValue([new Date()]); //Set the value of the date to be nothing

  //open the popup
  app.popup.open(".pool-popup");

}

let questionAnswers = {};
var answerIDs = [];
//Adds an answer to the html // NOTE: this only adds the answer to the html not the data base
function addAnswer(questionID, answerID, answerText, correct) {
  // TODO: Check to see if this id is already in the database. If so dont add the answer
  answerIDs.push(answerID);
  $$('.mc-answer-' + questionID).prev().append('<li class="item-content item-input">\
  <div class="item-inner">\
    <div style="width: 100%">\
      <div class="item-title item-label">Answer</div>\
      <div class="item-input-wrap">\
        <input id="' + answerID + '" class="' + questionID + '-answer" type="text" placeholder="Your answer">\
      </div>\
    </div>\
    <div class="item-after">\
    <button id="' + answerID + '-deleteanswer" class="button" onclick="deleteAnswer(this)">Delete</button>\
      <button id="' + answerID + '-setanswer" class="button" >Correct</button>\
    </div>\
  </div>\
  </li>');

  $$('#' + answerID + "-setanswer").click(function() {
    setAnswer(questionID, answerID);
  });
  document.getElementById(answerID).value = answerText;
  if (correct) {
    setAnswer(questionID, answerID);
  }
}

var questionIDs = [];
// This is adds a multiple choice question to the html // NOTE: This only adds the question to the html not the database
function addQuestion(questionID, description, answers) {
  // TODO: Check to see if this questionId has been added already if so dont add the question
  questionIDs.push(questionID);

  // Add the question html to the pool questions element
  $$('#pool-questions').append('<div id=' + questionID + ' class="question mc-question list no-hairlines no-hairlines-between">\
  <ul>\
    <li class="item-content item-input">\
      <div class="item-inner">\
      <div style="width: 100%">\
        <div class="item-title item-label">Multiple Choice Question</div>\
        <div class="item-input-wrap">\
          <input id ="question-description-' + questionID + '" type="text" placeholder="Your question">\
        </div>\
        </div>\
        <div class="item-after">\
          <button class="button" onclick="deleteQuestion(this)">Delete</button>\
        </div>\
      </div>\
    </li>\
    <div class="seporator"></div>\
 </ul>\
  <button class = "button mc-answer-' + questionID + '" > Add Answer </button>\
   </div>');

  //Setup the add answer button
  $$('.mc-answer-' + questionID).on('click', function(event) {
    var answerID = makeid(10);
    addAnswer(questionID, answerID, '', false);
  });

  //Setup the question description
  document.getElementById("question-description-" + questionID).value = description;

  // If the answers array is valid
  if (answers != null && answers != []) {
    let i = 0;
    //Add each answer to the html
    answers.forEach(function(answer) {
      addAnswer(questionID, answer.id, answer.text, answer.correct);

      //If this is the first answer remove the delete button
      if (i < 1) {
        var deleteButton = document.getElementById(answer.id + "-deleteanswer");
        deleteButton.parentNode.removeChild(deleteButton);
      }
      i++;
    });

  } else {
    //Add a empty first answer to the html
    answerID = makeid(10);
    addAnswer(questionID, answerID, '', false);

    //Remove the Answers delete button
    var deleteButton = document.getElementById(answerID + "-deleteanswer");
    deleteButton.parentNode.removeChild(deleteButton);
  }

}

let tiebreakerIDs = [];
// This is adds a numeric question to the html // NOTE: This only adds the question to the html not the databasex
function addNumericQuestion(questionID, description, answer) {
  // TODO: Check to see if this questionId has been added already if so dont add the question
  tiebreakerIDs.push(questionID);

  // Add the question html to the pool questions element
  $$('#pool-questions').append('<div  id="' + questionID + '"  class="question n-question list no-hairlines no-hairlines-between">\
    <ul>\
      <li class="item-content item-input">\
      <div class="item-inner">\
      <div style="width: 100%">\
        <div class="item-title item-label">Numeric Question</div>\
        <div class="item-input-wrap">\
          <input id ="question-description-' + questionID + '" type="text" placeholder="Your question">\
        </div>\
        </div>\
        <div class="item-after">\
          <button class="button" onclick="deleteQuestion(this)">Delete</button>\
        </div>\
      </div>\
      </li>\
      <div class="seporator"></div>\
      <li class="item-content item-input">\
        <div class="item-inner"><div style="width: 100%">\
          <div class="item-title item-label">Answer</div>\
          <div class="item-input-wrap">\
            <input id="' + questionID + '-numeric-answer" class="" type="number">\
          </div>\
        </div></div>\
      </li>\
    </ul>\
  </div>');

  //Setup the question description
  document.getElementById("question-description-" + questionID).value = description;
  document.getElementById(questionID + "-numeric-answer").value = answer;


}

// TODO: Change these to use the questionIDs and answerIDs
//remove an answer from a multiple choice question
function deleteAnswer(el) {
  var answer = el.parentElement.parentElement.parentElement;
  answer.parentElement.removeChild(answer);
}

var correctAnswers = [];

function setAnswer(questionID, answerID) { //Set the selected answer as the correct answer for a multiple choice question with ID questionID

  let el = $$('#' + answerID + "-setanswer")[0]; //Get the element of the button(Correct/Undo)
  let answer = el.parentElement.parentElement.parentElement;

  //Set the previously selected answers state and color to the default
  $$('#' + correctAnswers[questionID] + "-setanswer").html("Correct");
  $$('#' + correctAnswers[questionID] + "-setanswer").parent().parent().parent().removeAttr("style");


  if (correctAnswers[questionID] == answerID) { //If this is already marked as the correct answer(eg. the admin has pressed undo in the panel) then remove it from the correct answers
    delete correctAnswers[questionID];
    console.log("Undo set answer as correct");
  } else { //Else add the answer to the list of correct answers and set its html to the correct color and state
    correctAnswers[questionID] = answerID;
    el.innerHTML = "Undo";
    answer.style.backgroundColor = "rgba(76, 175, 80, .2)";
  }
  console.log(correctAnswers);

}

function deleteQuestion(el) { //remove a question from the list
  deleteAnswer(el.parentElement.parentElement);
}

function setupMainPage() {
  db.collection("admins").doc(uid).get().catch(function(error) {
    console.log(error);
  }).then(function(userData) {
    //If the user exist then this user is an admin so load the main page
    if (userData.exists) {
      User = {
        uid: uid,
        username: userData.get("lastName"),
        firstName: userData.get("firstName"),
        lastName: userData.get("lastName"),
        fullName: function() {
          return "" + this.firstName + " " + this.lastName;
        },
        profilePic: null //profilePic,// TODO: Load that here
      };

      console.log(self.app.views.main.router.currentRoute.path);
      //direct user to main page if not already there
      if (self.app.views.main.router.currentRoute.path != '/' && self.app.views.main.router.currentRoute.path != '/fun-sports-pools-admin/') {
        self.app.views.main.router.navigate('/home/');
        console.log("navigated to main page");
      }
      loadPools();
      //editUser('Administrator', 'test', 'user', null, null);
      $$('#username').html('Hi, ' + User.firstName);
      console.log(User.username);
      var panel = app.panel.create({
        el: '.panel-left',
        resizable: true,
        visibleBreakpoint: 300,
      });

      //hide splash screen
      $$('#splash-screen').hide();
    } else {
      console.log("This user is not an admin! Signing out");
      signOut();
    }

    //load Feedback
    db.collection("feedback").get().then(function(snapshot) {

      $$('.skeleton-feedback').hide();
      var options = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      };
      let messageIndex = 0;
      snapshot.forEach(function(doc) {

        getUser(doc.get('sender'), function(user) {
          var message = {
            sender: user,
            email: doc.get("email"),
            subject: doc.get("subject"),
            message: doc.get("message"),
            date: doc.get("timestamp").toDate().toLocaleString('en-us', options),
            message: doc.get("message"),
            type: doc.get("type"),
          };

          //store feedback messages in an array to access later
          messages.push(message);

          //add feedback to page
          $$('#' + doc.get("type")).append('<li><a href="#" onclick="showFeedback(\'' + messageIndex + '\')" class="item-link item-content"><div class="item-inner"><div class="item-title-row">' +
            '<div class="item-title">' + user.username +
            '</div><div class="item-after">' + message.date + '</div></div>' +
            '<div class="item-text">' + message.subject + '</div></div></a></li><li>');
          messageIndex++;
        });
      });
    });

  });
}
//////*******feeback section********\\\\\\\

//array of feedback messages
var messages = [];

//show a popup of message when a feedback list item is clicked
function showFeedback(index) {
  var message = messages[index];
  switch (message.type) {
    case "delete-account":
      console.log('Delete account request');
      var popup = app.popup.create({
        content: '<div class="popup">' +
          '<div style="padding: 16px; padding-bottom: 0"><a href="#" class="link icon-only float-right popup-close" style="margin-left: 16px"><i class="material-icons" style="font-size:1.5rem">close</i></a>' +
          '<div class="row justify-content-space-between align-items-center">' +
          '<div><p class="no-margin"><strong>From: </strong>' + message.sender.username + '<br><strong>Subject: </strong>' + message.subject + '<br><strong>Reply-To: </strong><a href="mailto:' + message.email + '" class="link">' + message.email + '</a></p></div>' +
          '<div><p style="opacity: .5; margin: 0 0 4px 0">' + message.date + '</p><div class="display-flex justify-content-flex-end"><div class="picture" style="background-image: url(\'' + message.sender.picURL + '\')"></div></div></div>' +
          '</div><div class="hairline no-margin-bottom"></div></div>' +
          '<div style="padding: 16px; height: 100%; overflow-y: auto">' +
          '<a id="delete-account-button" href="#" class="button button-fill" >Delete Account</a>' +
          '</div>' +
          '</div>',
      });
      popup.open();

      $$('#delete-account-button').click(function() {
        deleteAccount(message.sender.uid)
      });

      break;
    default:
      var popup = app.popup.create({
        content: '<div class="popup">' +
          '<div style="padding: 16px; padding-bottom: 0"><a href="#" class="link icon-only float-right popup-close" style="margin-left: 16px"><i class="material-icons" style="font-size:1.5rem">close</i></a>' +
          '<div class="row justify-content-space-between align-items-center">' +
          '<div><p class="no-margin"><strong>From: </strong>' + message.sender.username + '<br><strong>Subject: </strong>' + message.subject + '<br><strong>Reply-To: </strong><a href="mailto:' + message.email + '" class="link">' + message.email + '</a></p></div>' +
          '<div><p style="opacity: .5; margin: 0 0 4px 0">' + message.date + '</p><div class="display-flex justify-content-flex-end"><div class="picture" style="background-image: url(\'' + message.sender.picURL + '\')"></div></div></div>' +
          '</div><div class="hairline no-margin-bottom"></div></div>' +
          '<div style="padding: 16px; height: 100%; overflow-y: auto">' +
          message.message +
          '</div>' +
          '</div>',
      });
      popup.open();
  }
}

function deleteAccount(userID) {
  console.log("TODO Delete account here", userID);
}

//////*******Pools section********\\\\\\\

let loadedPools = [];
// An asyc method to get pool data
async function getPool(poolID, callback) {
  //If we have already loaded this users data then return it else load it from the database
  if (poolID in loadedPools) {
    console.log("found pool in array");
    //We call the callback and return it for backwards compatability
    (callback) ? callback(loadedPools[poolID]): null;
    return loadedPools[poolID];
  } else {
    // Create a reference to the file we want to download
    var poolPictureRef = storageRef.child('pool-pictures').child(poolID);
    // Get the download URL for the picture
    let poolPic = poolPictureRef.getDownloadURL().catch(function(error) {
      // TODO: add filler picture
      poolPic = "";
    });
    let poolData = db.collection("pools").doc(poolID).get();

    poolData = await poolData;
    poolPic = await poolPic;

    poolData = poolData.data();

    if (poolData == null) {
      console.log("Invalid pool returning");
      (callback) ? callback(invalidPool): null;
      return invalidPool;
    }

    //If the pool is a private/child pool get the needed data from the parentPool
    if (poolData.private) {
      getPool(poolData.parentPool, function(parentData) {
        loadedPools[poolID] = {
          poolID: poolID,
          tags: parentData.tags,
          name: poolData.name,
          description: poolData.description,
          state: parentData.state,
          date: parentData.state,
          pic: parentData.pic,
          questions: parentData.questions,
          tiebreakers: parentData.tiebreakers,
          winners: (poolData.winners) ? poolData.winners : [],
          id: poolID,
          private: true,
          bannedUsers: poolData.bannedUsers ? poolData.bannedUsers : [],
          pendingUsers: poolData.pendingUsers ? poolData.pendingUsers : [],
          allowShares: (poolData.allowShares != null) ? poolData.allowShares : true,
          admins: poolData.admins ? poolData.admins : [],
        };
        (callback) ? callback(loadedPools[poolID]): null;
        //console.log(loadedPools[poolID]);
        return loadedPools[poolID];
      });
    } else {
      loadedPools[poolID] = {
        poolID: poolID,
        tags: poolData.tags,
        name: poolData.name,
        description: poolData.description,
        state: poolData.state,
        date: ((poolData.date) ? poolData.date.toDate() : ''),
        pic: poolPic,
        questions: poolData.questions,
        tiebreakers: poolData.tiebreakers,
        winners: (poolData.winners) ? poolData.winners : [],
        id: poolID,
        private: false,
        pendingUsers: poolData.pendingUsers ? poolData.pendingUsers : [],
        bannedUsers: poolData.bannedUsers ? poolData.bannedUsers : [],
        allowShares: poolData.allowShares ? poolData.allowShares : true,
        admins: poolData.admins ? poolData.admins : [],
      };
      (callback) ? callback(loadedPools[poolID]): null;
      //console.log(loadedPools[poolID]);
      return loadedPools[poolID];

    }
  }
}

//Setup the date format for pools
let poolDateInput = app.calendar.create({
  inputEl: '#pool-date-input',
  timePicker: true,
  dateFormat: {
    weekday: 'long',
    month: 'long',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric'
  },
});

// This loads the pools. This can also be used to refresh the pools page
function loadPools() {

  //Close any open pool popup
  app.popup.close(".pool-popup");

  //Remove any old pool data from
  loadedPools = [];
  document.getElementById("pool-list").innerHTML = '';

  var pools = [];

  //Get all pools in the database and setup the cards. // TODO:only load the global pools and maybe the most popular custom pools
  db.collection("pools").get().then(function(poolsSnapshot) {
    poolsSnapshot.forEach(function(doc) {

      //Get the pool's Data
      getPool(doc.id, function(poolDAT) {

        //Add the pool data to an array for later use
        pools.push(poolDAT);
        //Once the array length is the same as the number of pools we need to load, sort the array then add all the pools to the html
        if (pools.length >= poolsSnapshot.size) {
          pools.sort((a, b) => (a.name > b.name) ? 1 : -1); //Sort the array

          console.log("Loaded and sorted all pool data");

          pools.forEach(function(pool) {
            if (pool.private) {
              console.log('private pool not displaying.');
            } else {
              var poolList = document.getElementById("pool-list");
              let date = (pool.date != '' && !isNaN(pool.date)) ? pool.date : "This pool does not have a date"; //Set the date if it is valid else set it to a string

              //Setup the pool card
              var a = document.createElement('div');
              a.classList.add("card");
              a.classList.add("pool-card");
              a.classList.add("col-30");

              //When the card is clicked fill the popup with data
              a.onclick = function() {
                console.log(pool);
                $$('.pool-popup').find('.pic-upload').css("background-image", ("url(" + pool.pic + ")"));
                document.getElementById("pool-name").value = pool.name;
                document.getElementById("pool-name").dataset.id = pool.poolID;
                document.getElementById("pool-description").innerHTML = pool.description;
                var poolVisibilityDiv = document.getElementById("pool-visibility");
                $$("#pool-visibility").val(pool.state).change();

                let date2 = (pool.date != '') ? pool.date : new Date();
                poolDateInput.setValue([date2])

                // document.getElementById("pool-date").value = "";
                // document.getElementById("pool-time").value = "";

                document.getElementById("pool-questions").innerHTML = ''; //Clear any leftover html data from old questions

                //Clear the question and answer IDs because we are loading a new page
                questionIDs = [];
                tiebreakerIDs = [];
                answerIDs = [];
                correctAnswers = [];

                //Check to see if this pool has any questions. If so then load them
                if (pool.questions != null) {
                  console.log(pool.questions);
                  for (let i = 0; i < pool.questions.length; i++) {
                    addQuestion(pool.questions[i].id, pool.questions[i].description, pool.questions[i].answers);
                  }
                } else { //There are no questions in this pool
                  // TODO: maybe add a question?
                }

                //Check to see if this pool has any tiebreakers. If so then load them
                if (pool.tiebreakers != null) {
                  console.log(pool.tiebreakers);
                  //For each tiebreaker in the pool.
                  for (let i = 0; i < pool.tiebreakers.length; i++) {
                    console.log("dsfkjhsgdfjkh");
                    addNumericQuestion(pool.tiebreakers[i].id, pool.tiebreakers[i].description, pool.tiebreakers[i].answer);
                  }
                }

                //Add in the tags
                var chipsDiv = document.getElementById("pool-tags");
                chipsDiv.innerHTML = "";
                for (var i = 0; i < pool.tags.length; i++) {
                  var chip = document.createElement("div");
                  chip.innerHTML = '<div class="chip" onclick="deleteTag(this)"><div class="chip-label">' + pool.tags[i] + '</div><a href="#" class="chip-delete"></a></div>';
                  chipsDiv.appendChild(chip.childNodes[0]);
                }

                app.popup.open(".pool-popup");
              };

              //Setup the card's inner html
              a.innerHTML = '<div style="background-image:url(' + pool.pic + ')" class="card-header align-items-flex-end">' + pool.name + '</div>' +
                '<div class="card-content card-content-padding">' +
                '  <p class="date">' + date.toLocaleString() + '</p>' +
                '  <p> ' + pool.description + '</p>' +
                '</div>';
              //Add the card to the pool list
              poolList.appendChild(a);
            }
          });

        }
      });

      ///

    });
  });

}

function savePool() {
  app.preloader.show();

  //Get all the needed values from the html
  let id = document.getElementById("pool-name").dataset.id;
  let name = document.getElementById("pool-name").value;
  let description = document.getElementById("pool-description").innerHTML;
  let pic = $$('.pool-popup').find('.pic-input')[0].files[0];
  let timestamp = poolDateInput.getValue()[0];
  let poolState = $$("#pool-visibility").val();
  let poolQuestions = document.getElementsByClassName("mc-question");
  let poolTieBreakers = document.getElementsByClassName("n-question");

  //Get tags from the chips
  let tags = [];
  let chips = document.getElementById("pool-tags").getElementsByClassName("chip-label");
  for (var i = 0; i < chips.length; i++) {
    tags.push(chips[i].innerHTML);
  }

  let questions = [];
  //For each question
  for (let i = 0; i < poolQuestions.length; i++) {

    let questionID = poolQuestions[i].id;
    let answerEL = document.getElementsByClassName(questionID + "-answer");
    let answers = [];

    //For each answer in this question
    for (let x = 0; x < answerEL.length; x++) {
      //ADD this answer to the question object
      answers.push({
        id: answerEL[x].id,
        correct: (correctAnswers[questionID] == answerEL[x].id), //Inline if statement to check if this answer id is the correct one
        text: answerEL[x].value,
      });
    }

    //Add this multiple choice question to the questions object
    questions.push({
      id: questionID,
      description: document.getElementById('question-description-' + questionID).value,
      answers: answers,
      correctAnswer: correctAnswers[questionID],
    });
  }
  console.log(questions);

  let tieBreakers = [];

  //For each tiebreaker
  for (let i = 0; i < poolTieBreakers.length; i++) {

    let questionID = poolTieBreakers[i].id;
    let numericAnswer = document.getElementById(questionID + "-numeric-answer");

    tieBreakers.push({
      id: questionID,
      description: document.getElementById('question-description-' + questionID).value,
      answer: (numericAnswer.value) ? numericAnswer.value : null,
    });

  }

  console.log(tieBreakers);

  //Save the pool to the database
  editPool({
    poolID: id,
    poolName: name,
    poolDescription: description,
    poolPicture: pic,
    poolStartDate: timestamp,
    tags: tags,
    questions: questions,
    state: poolState,
    tiebreakers: tieBreakers
  });
}
//If the pool exist then this edits its data if it doesnt exist eg poolID=0||null then it creates a new pool. tags should be an array, poolStartDate should be a Timestamp
function editPool(poolData) {

  console.log("editing pool: " + poolData.poolID + " with data: ", poolData);
  //If the poolID is not null and not 0 edit the data
  if (poolData.poolID != null && poolData.poolID != 0) {
    var poolRef = db.collection('pools').doc(poolData.poolID);


    poolRef.update({
      name: (poolData.poolName) ? poolData.poolName : "No name given",
      description: (poolData.poolDescription) ? poolData.poolDescription : "No Description",
      date: (poolData.poolStartDate) ? poolData.poolStartDate : new Date(),
      tags: (poolData.tags) ? poolData.tags : [],
      questions: poolData.questions,
      tiebreakers: poolData.tiebreakers,
      state: (poolData.state) ? poolData.state : "hidden",
    }).then(function() {
      // TODO: check if pool pic is valid if not set the default pic?
      if (poolData.poolPicture) {
        var poolPictureRef = storageRef.child('pool-pictures').child(poolID);
        poolPictureRef.put(poolData.poolPicture).then(function() {
          app.preloader.hide();
          app.toast.show({
            text: "Pool Saved",
            closeTimeout: 3000,
          });
          app.popup.close(".pool-popup");
          loadPools();
        }).catch(function(error) {
          app.preloader.hide();
          app.toast.show({
            text: error,
            closeTimeout: 10000,
            closeButton: true
          });
          app.popup.close(".pool-popup");
          loadPools();
        });
      } else {
        app.preloader.hide();
        app.toast.show({
          text: "Pool Saved",
          closeTimeout: 3000,
        });
        app.popup.close(".pool-popup");
        loadPools();
      }
    }).catch(function(error) {
      app.preloader.hide();
      app.popup.close(".pool-popup");
      app.toast.show({
        text: "error" + error,
        closeTimeout: 10000,
        closeButton: true
      });
      loadPools();
    });

  } else {
    //the pool does not exist so create a pool and set its information
    db.collection("pools").add({
      name: poolData.poolName,
      description: poolData.poolDescription,
      date: poolData.poolStartDate,
      tags: poolData.tags,
      questions: poolData.questions,
      tiebreakers: poolData.tiebreakers,
      state: (poolData.state) ? poolData.state : "hidden",
    }).then(function(doc) {
      console.log(doc.id);
      var profilePictureRef = storageRef.child('pool-pictures').child(doc.id);
      //If poolPicture is valid
      if (poolData.poolPicture) {
        profilePictureRef.put(poolData.poolPicture).then(function() {
          console.log("error with pic");

          app.preloader.hide();
          app.toast.show({
            text: "Pool Saved",
            closeTimeout: 3000,
          });
          app.popup.close(".pool-popup");
          loadPools();
        }).catch(function(error) {
          app.preloader.hide();
          app.toast.show({
            text: error,
            closeTimeout: 10000,
            closeButton: true
          });
        });
      } else {
        app.preloader.hide();
        app.toast.show({
          text: "Pool Saved Without a Picture",
          closeTimeout: 3000,
        });
        app.popup.close(".pool-popup");
        loadPools();
      }
    }).catch(function(error) {
      app.preloader.hide();
      app.toast.show({
        text: error.message,
        closeTimeout: 10000,
        closeButton: true
      });
    });

  }

}


//displays uploaded picture on screen
function previewPic(event, el) {
  $$(el).find('.pic-upload').css("background-image", ("url(" + URL.createObjectURL(event.target.files[0]) + ")"));
  $$(el).find('.pic-icon').html('edit');
}

//add a tag on edit pool page
function addTag(el) {
  chipsDiv = document.getElementById("pool-tags");
  if (el.value.includes(",")) {
    var tag = el.value.split(',')[0].toLowerCase();
    var chip = document.createElement("div");
    chip.innerHTML = '<div class="chip" onclick="$$(this).remove()"><div class="chip-label">' + tag + '</div><a href="#" class="chip-delete"></a></div>';
    chipsDiv.appendChild(chip.childNodes[0]);
    el.value = "";
    el.focus();
    el.select();

  }

}

//load tags
function loadTags() {
  $$('.tag').remove();
  app.preloader.show();
  db.collection("tags").get().then(function(tags) {
    tags.forEach(function(tag) {
      //add to page
      $$('#type-' + tag.get('type')).prepend('<div id="' + tag.id + '" class="tag"><label><div class="pic-upload no-margin">' +
        '<input class="pic-input" type="file" accept="image/jpeg, image/png" onchange="previewPic(event, \'#' + tag.id + '\')" disabled><i class="material-icons pic-icon" style="font-size: 30px; color: rgba(0,0,0,0)">edit</i></div>' +
        '</label><div class="list no-margin"><ul><li class="item-content item-input"><div class="item-inner"><div class="item-input-wrap text-align-center">' +
        '<input class="text-align-center tag-name" type="text" placeholder="Tag name" value="' + tag.get("name") + '" readonly></div></div></li></ul></div>' +
        '<p class="segmented no-margin"><button onclick="deleteTag(\'' + tag.id + '\')" class="button color-red">Delete</button><button class="button tag-edit" onclick=(editTag(\'' + tag.id + '\'))>Edit</button></p></div>');

      //get picture
      storageRef.child('tag-pictures').child(tag.id).getDownloadURL().then(function(url) {
        $$('#' + tag.id).find('.pic-upload').css("background-image", "url('" + url + "')");
      });
    });
    app.preloader.hide();
  }).catch(function(error) {
    console.error(error.message);
    app.preloader.hide();
  });

}

//open and clear popup
function newTag() {
  //clear dataset
  $$('.tag-popup').find('.pic-upload').css("background-image", "");
  $$('.tag-popup').find('.pic-icon').text("add_photo_alternate");
  $$('#tag-name').val("");
  $$('#tag-type').val("");
  //open popup
  app.popup.open(".tag-popup");
}

//actually save
$$(".tag-save").click(function() {
  app.preloader.show();
  //add tag to database
  db.collection("tags").add({
    name: $$('#tag-name').val(),
    type: $$('#tag-type').val()
  }).then(function(doc) {
    //then upload photo
    var profilePictureRef = storageRef.child('tag-pictures').child(doc.id);
    var pic = $$('.tag-popup').find('.pic-input').prop('files')[0];
    //If poolPicture is valid
    if (pic) {
      profilePictureRef.put(pic).then(function() {
        app.popup.close(".tag-popup");
        app.preloader.hide();
        loadTags();
      }).catch(function(error) {
        app.popup.close(".tag-popup");
        app.preloader.hide();
        app.toast.show({
          text: error.message,
          closeTimeout: 10000,
          closeButton: true
        });
        loadTags();

      });
    } else {
      app.popup.close(".tag-popup");
      app.preloader.hide();
      loadTags();

    }
  }).catch(function(error) {
    app.popup.close(".tag-popup");
    app.preloader.hide();
    app.toast.show({
      text: error.message,
      closeTimeout: 10000,
      closeButton: true
    });
    loadTags();

  });
});

function editTag(id) {
  tagEl = $$('#' + id);
  tagEl.find('.tag-name').removeAttr('readonly');
  tagEl.find('.pic-input').removeAttr('disabled');
  tagEl.find('.pic-icon').css("color", "white");
  tagEl.find('.tag-name').css("font-weight", 'normal');
  tagEl.find('.tag-edit').text('Save');
  tagEl.find('.tag-edit').click(function() {
    app.preloader.show();
    db.collection("tags").doc(id).update({
      name: tagEl.find('.tag-name').val(),
    }).then(function() {
      //then upload photo
      var profilePictureRef = storageRef.child('tag-pictures').child(id);
      var pic = tagEl.find('.pic-input').prop('files')[0];
      //If poolPicture is valid
      if (pic) {
        profilePictureRef.put(pic).then(function() {
          app.preloader.hide();
          loadTags();
        }).catch(function(error) {
          app.preloader.hide();
          app.toast.show({
            text: error.message,
            closeTimeout: 10000,
            closeButton: true
          });
          loadTags();

        });
      } else {
        app.preloader.hide();
        loadTags();
      }
    }).catch(function(error) {
      app.preloader.hide();
      app.toast.show({
        text: error.message,
        closeTimeout: 10000,
        closeButton: true
      });
      loadTags();
    });
  });
}

function deleteTag(id) {
  app.preloader.show();
  db.collection("tags").doc(id).delete().then(function() {
    storageRef.child('tag-pictures').child(id).delete().then(function() {
      app.preloader.hide();
      loadTags();
    }).catch(function(error) {
      app.preloader.hide();
      app.toast.show({
        text: error.message,
        closeTimeout: 10000,
        closeButton: true
      });
      loadTags();
    });
  }).catch(function(error) {
    app.preloader.hide();
    app.toast.show({
      text: error.message,
      closeTimeout: 10000,
      closeButton: true
    });
    loadTags();
  });
}

//getUser function taken from app
var loadedUsers = []; //
var callbacks = {}; // This stores the calbacks for users we are loading
function getUser(userID, callback) {
  //example usage
  //  getUser('MTyzi4gXVqfKIOoeihvdUuVAu3E2', function(user) {
  //  console.log(user);});

  if (userID && userID != '') { // If the userID is valid
    if (loadedUsers[userID]) { // If we have already loaded this users data then return it else load it from the database
      console.log("found user in array");
      callback(loadedUsers[userID]);
    } else {

      if (!callbacks[userID]) { // Check if we are already loading this user
        // We are not currently loading this user so make a callback array for the user and push the current callback to it
        callbacks[userID] = [];
        callbacks[userID].push(callback);

        var profilePic = "";
        var profilePictureRef = storageRef.child('profile-pictures').child(userID); // Create a reference to the file we want to download

        profilePictureRef.getDownloadURL().then(function(url) { // Get the download URL
          profilePic = url;
        }).catch(function(error) {
          profilePic = anonymousProfilePic;
        }).then(function() {
          db.collection("users").doc(userID).get().then(function(userData) {
            loadedUsers[userID] = {
              uid: userID,
              username: userData.get("username"),
              firstName: capFirstLetter(userData.get("firstName")),
              lastName: capFirstLetter(userData.get("lastName")),
              fullName: function() {
                return "" + this.firstName + " " + this.lastName;
              },
              profilePic: profilePic,
              bio: userData.get("bio"),
              favoriteSports: userData.get("favoriteSports"),
              favoriteTeams: userData.get("favoriteTeams"),
            };
            console.log("loaded user: " + userID);

            console.log(callbacks);
            for (let i = 0; i < callbacks[userID].length; i++) { // Iterate through the callbacks for this user
              callbacks[userID][i](loadedUsers[userID]);
            }
            delete callbacks[userID]; // Remove the calbacks for this user

          });
        });
      } else { // This user currently being loaded so add the callback to the array
        callbacks[userID].push(callback);
      }

    }
  } else {
    callback({}); //The id is invalid so return the invalid/anonomus user object
  }
}