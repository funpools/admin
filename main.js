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

//user search
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


// Delete pool button on click
$$('.pool-delete').on('click', function() {
  let idToDelete = document.getElementById("pool-name").dataset.id;

  app.dialog.create({
    text: 'Are you sure you want to delete this pool? This action can not be undone.',
    buttons: [{
        text: 'Cancel',
      },
      {
        text: 'Delete',
        color: 'red',
        onClick: function() {
          console.log("Deleting pool: ", idToDelete);
          app.preloader.show();
          deletePool({
            poolID: idToDelete,
          }).then(function() {
            app.toast.show({
              text: "Succesfully deleted pool.",
              closeTimeout: 5000,
            });
          }).catch(function(error) {
            app.toast.show({
              text: "There was an error deleting your pool. Please try again later.",
              closeTimeout: 5000,
              closeButton: true
            });
          }).finally(function(result) {
            //Close the uneeded UI
            loadPools(function() {
              app.preloader.hide();
              app.popup.close(".pool-popup");
            });

          });
        }
      },
    ],
  }).open();

});

// Save pool button on click
$$('.pool-save').on('click', function() {
  savePool();
});

//Duplicate pool button
$$('.pool-duplicate').click(function() {
  duplicatePool();
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
      loadTags();
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
            id: doc.id,
            sender: user,
            email: doc.get("email") ? doc.get("email") : 'No email provided',
            subject: doc.get("subject") ? doc.get("subject") : 'No subject',
            message: doc.get("message") ? doc.get("message") : 'No message',
            date: doc.get("timestamp") ? doc.get("timestamp").toDate().toLocaleString('en-us', options) : '',
            type: doc.get("type") ? doc.get("type") : 'feedback',
          };

          //store feedback messages in an array to access later
          messages.push(message);

          //add feedback to page
          $$('#' + doc.get("type")).append('<li class="fb-' + message.id + '"><a href="#" onclick="showFeedback(\'' + messageIndex + '\')" class="item-link item-content"><div class="item-inner"><div class="item-title-row">' +
            '<div class="item-title">' + user.username +
            '</div><div class="item-after">' + message.date + '</div></div>' +
            '<div class="item-text">' + message.subject + '</div></div></a></li><li>');
          messageIndex++;
        });
      });
    });

  });
}

//////*******feedback section********\\\\\\\

//array of feedback messages
var messages = [];

//show a popup of message when a feedback list item is clicked
function showFeedback(index) {
  var message = messages[index];
  switch (message.type) {
    case "delete-account":
      app.dialog.create({
        text: 'Are you sure you want to delete this account?',
        buttons: [{
            text: 'Cancel',
          },
          {
            text: 'Delete',
            color: 'red',
            onClick: function() {
              deleteAccount(message.sender.uid)

            },
          },
        ],
        verticalButtons: false,
      }).open();
      break;
    default:
      let mailto = message.email == "No email provided" ? 'No email provided' : '<a href="mailto:' + message.email + '" class="link external">' + message.email + '</a>';
      var popup = app.popup.create({
        content: '<div class="popup">' +
          '<div style="padding: 16px; padding-bottom: 0"><div class="float-right" style="margin-left: 16px"><a href="#" class="button button-outline popup-close">Close</a><a href="#" class="button button-fill resolve-' + message.id + '" style="margin-top: 8px">Resolve</a></div>' +
          '<div class="row justify-content-space-between align-items-center">' +
          '<div><p class="no-margin"><strong>From: </strong>' + message.sender.username + '<br><strong>Subject: </strong>' + message.subject + '<br><strong>Reply-To: </strong>' + mailto + '</p></div>' +
          '<div><p style="opacity: .5; margin: 0 0 4px 0">' + message.date + '</p><div class="display-flex justify-content-flex-end"><div class="picture" style="background-image: url(\'' + message.sender.picURL + '\')"></div></div></div>' +
          '</div><div class="hairline no-margin-bottom"></div></div>' +
          '<div class="body">' +
          message.message +
          '</div>' +
          '</div>',
      });
      popup.open();

      //update feedback type in database
      $$('.resolve-' + message.id).click(function() {

        app.preloader.show();

        db.collection("feedback").doc(message.id).update({
          type: 'resolved'
        }).catch(function(error) {

          console.log(error.message);
          app.preloader.hide();
          app.toast.show({
            text: "There was an error resolving feedback. please try agian later."
          });

        }).then(function() {

          app.preloader.hide();
          popup.close();

          //move to other card
          $$('.fb-' + message.id).appendTo('#resolved');

          //update local copy
          messages[index].type = "resolved";

        });

      });
  }

  //hide resolve button if already resolved
  if (message.type == "resolved") $$('.resolve-' + message.id).hide();
}

function deleteAccount(userID) {
  console.log("TODO Delete account here", userID);
}

///////****Question and answer section****\\\\\\\\\
let questionAnswers = {};
var answerIDs = [];

function addAnswer(questionID, answerID, answerText, correct) { //Adds an answer to the html // NOTE: this only adds the answer to the html not the data base
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
    <button id="' + answerID + '-deleteanswer" class="button delete-button" onclick="deleteAnswer(this)">Delete</button>\
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

function addQuestion(questionID, description, answers) { //Adds a multiple choice question to the html // NOTE: This only adds the question to the html not the database
  // TODO: Check to see if this questionId has been added already if so dont add the question
  questionIDs.push(questionID);

  // Add the question html to the pool questions element
  $$('#pool-questions').append('<div id=' + questionID + ' class="question mc-question list no-hairlines no-hairlines-between">\
  <ul>\
    <li class="item-content item-input">\
      <div class="item-inner">\
      <div style="width: 100%">\
        <div class="item-title item-label question-title">Multiple Choice Question</div>\
        <div class="item-input-wrap">\
          <input id ="question-description-' + questionID + '" type="text" placeholder="Your question">\
        </div>\
        </div>\
        <div class="item-after">\
          <button class="button delete-button" onclick="deleteQuestion(this)">Delete</button>\
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
  if (answers != null && answers.length > 0) {
    let i = 0;
    //Add each answer to the html
    answers.forEach(function(answer) {
      addAnswer(questionID, answer.id, answer.text, answer.correct);

      if (i < 1) { //If this is the first answer remove the delete button
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
  updateQuestionNumbers();
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
        <div class="item-title item-label question-title">Numeric Question</div>\
        <div class="item-input-wrap">\
          <input id ="question-description-' + questionID + '" type="text" placeholder="Your question">\
        </div>\
        </div>\
        <div class="item-after">\
          <button class="button delete-button" onclick="deleteQuestion(this)">Delete</button>\
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

  updateQuestionNumbers();
}

function updateQuestionNumbers() {
  $$('.question-title').forEach(function(question, i) {
    $$(question).text('Question ' + (i + 1));
  });
}

// TODO: Change these to use the questionIDs and answerIDs
//remove an answer from a multiple choice question
function deleteAnswer(el) {
  var answer = el.parentElement.parentElement.parentElement;
  answer.parentElement.removeChild(answer);
  updateQuestionNumbers();
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

//////*******Pools section********\\\\\\\
const invalidPool = {
  poolID: "invalid",
  tags: [],
  name: "invalid",
  description: "invalid",
  state: "invalid",
  date: "invalid",
  pic: "invalid picURL", // TODO: add a image here
  users: [],
  questions: [],
  winners: [],
  id: "invalid",
  private: false,
  pendingUsers: [],
  bannedUsers: [],
  allowShares: false,
  admins: [],
}

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
function loadPools(callback) {

  //Close any open pool popup
  app.popup.close(".pool-popup");

  //Remove any old pool data from
  loadedPools = [];

  //Clear any old pool cards
  $$("#active-pools").html("");
  $$("#open-pools").html("");
  $$("#draft-pools").html("");
  $$("#closed-pools").html("");

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
              let a = document.createElement('div');
              a.id = "poolcard-" + pool.id;
              a.classList.add("card");
              a.classList.add("pool-card");
              a.classList.add("col-30");

              //When the card is clicked fill the popup with data
              a.onclick = function() {
                openPoolPopup(pool);
              };

              //Setup the card's inner html
              a.innerHTML = '<div style="background-image:url(' + pool.pic + ')" class="card-header align-items-flex-end"> ' + pool.name + ' </div > ' +
                '<div class="card-content card-content-padding">' +
                '  <p class="date">' + date.toLocaleString() + '</p>' +
                '  <p> ' + pool.description + '</p>' +
                '</div>';
              //Add the card to the pool list
              //poolList.appendChild(a);
              console.log(pool.state);
              //Add the pool to the html depending on its state
              switch (pool.state) {
                case "active":
                  $$("#active-pools").append(a);
                  break;
                case "open":
                  $$("#open-pools").append(a);
                  break;
                case "draft":
                  $$("#draft-pools").append(a);
                  break;
                case "closed":
                  $$("#closed-pools").append(a);
                  break;
                default:
                  $$("#draft-pools").append(a);
              }

            }
          });
          //We are done loading the pools so call the callback
          (callback) ? callback(): null;
          db.collection("universalData").doc("mainPage").get().then((mainPageData) => {
            $$('#poolcard-' + mainPageData.data().featuredPool).addClass("featured-pool");
          });

        }
      });

      ///

    });
  });

}

function openPoolPopup(pool) { //Opens the popup for the given pool
  console.log('Opening pool popup for pool: ', pool);

  $$('.pool-popup').find('#pool-pic').find('.pic-upload').css("background-image", ("url(" + pool.pic + ")"));
  $$('.pool-popup').find('#pool-pic').find('.pic-icon').html('edit');
  document.getElementById("pool-name").value = pool.name;
  document.getElementById("pool-name").dataset.id = pool.poolID;
  document.getElementById("pool-description").innerHTML = pool.description;
  var poolVisibilityDiv = document.getElementById("pool-visibility");
  $$("#pool-visibility").val(pool.state).change();

  //check to see if this pool is already featured or not
  db.collection("universalData").doc("mainPage").get().then(async function(mainPageData) {
    let featuredPool = await getPool(mainPageData.data().featuredPool);
    if (pool.id === mainPageData.data().featuredPool) { // if this is a featured pool

      // get featured image
      let displayPic = pool.pic;
      let featuredPic = storageRef.child('featured-pool-pic').getDownloadURL().then(picURL => {
        displayPic = picURL;
      }).catch(error => {});
      await featuredPic;
      //set featured image
      $$('.pool-popup').find('#featured-pool-pic').find('.pic-upload').css("background-image", ("url(" + displayPic + ")"));
      $$('.pool-popup').find('#featured-pool-pic').find('.pic-icon').html('edit');
      //update checkbox
      $$('#featured-pool-checkbox').prop('checked', true);
      $$('#featured-pool').show();
    } else {
      //set featured image
      $$('.pool-popup').find('#featured-pool-pic').find('.pic-upload').css("background-image", ("url(" + '' + ")"));
      $$('.pool-popup').find('#featured-pool-pic').find('.pic-icon').html('edit');
      //update checkbox
      $$('#featured-pool-checkbox').prop('checked', false);
      $$('#featured-pool').hide();
    }
  });

  //  POOL TAGS
  universalDataRef.get().then(function(doc) {
    universalData = doc.data();
    console.log(universalData);
    console.log("Setting up tag popup");
    $$('#pool-tags-list').empty();

    universalData.tags.forEach((tag, i) => {
      let tagEl = $$('<div id="' + tag.id + '" class="col-25 card card-outline tag-card" >\
          <div class="card-header">' + tag.title + '</div>\
          <div class="card-content card-content-padding">' + tag.description + '</div>\
        </div>');
      tagEl.attr('data-id', tag.id);
      if (pool.tags.includes(tag.id)) {
        tagEl.addClass('selected-tag');
      }
      tagEl.click(function() {
        selectTag(tag.id);
      });
      $$('#pool-tags-list').append(tagEl);
    });
  });

  $$('#pool-tag-button').click(function() {
    console.log("Opening tag popup");
    app.popup.open('.tag-popup');
  });


  $$('#featured-pool-checkbox').on('change', function(e) {
    if (e.target.checked) {
      $$('#featured-pool').show();
    } else {
      $$('#featured-pool').hide();
    }
  });

  let date2 = (pool.date != '') ? pool.date : new Date();
  poolDateInput.setValue([date2])

  // document.getElementById("pool-date").value = "";
  // document.getElementById("pool-time").value = "";

  document.getElementById("pool-questions").innerHTML = ''; //Clear any leftover html data from old questions

  //Clear the question and answer IDs because we are loading a new pool
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

  if (pool.state === "active" || pool.state === "closed") {
    $$('.delete-button').hide();
  } else {
    $$('.delete-button').show();
  }

  app.popup.open(".pool-popup");
};

function savePool() {
  app.preloader.show();

  //Get all the needed values from the html
  let id = document.getElementById("pool-name").dataset.id;
  let name = document.getElementById("pool-name").value;
  let description = document.getElementById("pool-description").innerHTML;
  let pic = $$('.pool-popup').find('#pool-pic').find('.pic-input')[0].files[0];
  let timestamp = poolDateInput.getValue()[0];
  let poolState = $$("#pool-visibility").val();
  let poolQuestions = document.getElementsByClassName("mc-question");
  let poolTieBreakers = document.getElementsByClassName("n-question");
  let featured = $$('#featured-pool-checkbox').prop('checked');
  let featuredPic = null;

  //If this is a featured pool load the image
  if (featured) {
    featuredPic = $$('.pool-popup').find('#featured-pool-pic').find('.pic-input')[0].files[0];
  }
  //Get tags from the chips
  let tags = [];
  $$('#pool-tags-list').find('.selected-tag').forEach((selectedTag, i) => {
    console.log($$(selectedTag).attr("id"), $$(selectedTag).attr("data-id"));
    tags.push($$(selectedTag).attr("data-id"));
  });

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
      correctAnswer: (correctAnswers[questionID]) ? correctAnswers[questionID] : null,
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
    name: name,
    description: description,
    picture: pic,
    date: timestamp,
    tags: tags,
    questions: questions,
    state: poolState,
    tiebreakers: tieBreakers,
    feature: featured, //// TODO: add stuff here
    featuredPic: featuredPic,
  });
}

//If the pool exist then this edits its data if it doesnt exist eg poolID=0||null then it creates a new pool. tags should be an array, poolStartDate should be a Timestamp
async function editPool(poolData, callback) {
  console.log("editing pool: " + poolData.poolID + " with data: ", poolData);
  app.preloader.show();
  try {
    let id;

    if (poolData.poolID != null && poolData.poolID != 0) { //If the poolID is valid edit the data
      id = poolData.poolID;
      let poolRef = db.collection('pools').doc(poolData.poolID);
      //Update the pools data
      await poolRef.update({
        name: (poolData.name) ? poolData.name : "No name given",
        description: (poolData.description) ? poolData.description : "No Description",
        date: (poolData.date) ? poolData.date : new Date(),
        tags: (poolData.tags) ? poolData.tags : [],
        questions: (poolData.questions) ? poolData.questions : [],
        tiebreakers: (poolData.tiebreakers) ? poolData.tiebreakers : [],
        state: (poolData.state) ? poolData.state : "hidden",
        private: false,
      });
      //Update the picture if it exists
      if (poolData.picture && poolData.picture != null) {
        await storageRef.child('pool-pictures').child(poolData.poolID).put(poolData.picture).then(function(snapshot) {
          console.log('Uploaded a blob or file!');
        });
      }
    } else { //The pool does not exist so create a pool and set its information
      let doc = await db.collection("pools").add({
        name: (poolData.name) ? poolData.name : "No name given",
        description: (poolData.description) ? poolData.description : "No Description",
        date: (poolData.date) ? poolData.date : new Date(),
        tags: (poolData.tags) ? poolData.tags : [],
        questions: (poolData.questions) ? poolData.questions : [],
        tiebreakers: (poolData.tiebreakers) ? poolData.tiebreakers : [],
        state: (poolData.state) ? poolData.state : "hidden",
        private: false,
      });
      //Upload the picture if it exists
      if (poolData.picture && poolData.picture != null) {
        await storageRef.child('pool-pictures').child(poolData.poolID).put(poolData.picture);
      }

      console.log('Created pool with id: ' + doc.id);
      id = doc.id;
    }

    await featurePool(id, poolData.featuredPic, poolData.feature);

    //We are done editing the pool so reload the pools then call any callbacks and return
    loadPools(function() {
      app.preloader.hide();
      //Close the uneeded UI and notify the admin that the pool was saved
      app.toast.show({
        text: "Pool Saved",
        closeTimeout: 3000,
      });
      app.popup.close(".pool-popup");
      (callback) ? callback(id): null;
      return id;

    });

  } catch (error) {
    console.error(error);
    app.preloader.hide();
    app.toast.show({
      text: error,
      closeTimeout: 10000,
      closeButton: true
    });
    app.popup.close(".pool-popup");
  }

  /*//Unused code for calculating name intersection
  async function getPoolName(name, id, i) { //Generates a username for the user based on the given name and last name

    let nameToTry = name + ((i != null) ? ' ' + i : '');

    console.log('Trying: ' + nameToTry);
    let pools = await db.collection('pools').where("name", "==", nameToTry).get();
    console.log(pools.docs[0].id, " id: " + id);
    if (pools.size > 0 && pools.docs[0].id != id) {

      (i != null) ? i++ : i = 2;

      console.log('poolName: "' + nameToTry + '" already taken trying again.');
      return await getPoolName(name, id, i);
    } else {
      return nameToTry;
    }

  }
  */
}

function duplicatePool() { //Duplicates the specified pool then opens the popup
  let id = document.getElementById("pool-name").dataset.id;
  console.log('Duplicating pool: ' + id);
  getPool(id).then(function(poolData) {
    let newPool = {
      name: poolData.name + '(Copy)',
      description: poolData.description,
      tags: poolData.tags,
      questions: poolData.questions,
      tiebreakers: poolData.tiebreakers,
      state: 'draft',
    };
    //clear the selected questions
    newPool.questions.forEach((question, i) => {
      newPool.questions[i].correctAnswer = null;
      newPool.questions[i].answers.forEach((answer, x) => {
        newPool.questions[i].answers[x].correct = false;
      });
    });

    editPool(newPool, function(editedPoolID) {
      console.log("Made a new duplicate pool with ID: " + editedPoolID);
      $$('#poolcard-' + editedPoolID)[0].click();
    });
  });

}


///////*Announcements*\\\\\\\

function newAnnouncement() {
  //clear any existing values in the popup
  $$(".announcement-popup").find('.pic-upload').css("background-image", "");
  $$(".announcement-popup").find('.pic-icon').html("add_photo_alternate");
  $$(".announcement-popup").find('#send-announcement').off('click').click(
    function() {
      app.preloader.show();

      let title = $$('#announcment-title').val();
      let description = $$('#announcment-description').val();
      let link = $$('#announcment-link').val();
      let announcement = {
        title: title,
        description: description,
        link: link,
        test: false,
      };
      console.log("Sending announcement: ", announcement);

      sendAnnouncement(announcement).then(result => {
        app.preloader.hide();
        console.log(result);
      }).catch(error => {
        app.preloader.hide();
        console.error(error);
      });

    });
  $$(".announcement-popup").find('#send-test-announcement').off('click').click(
    function() {
      app.preloader.show();

      let title = $$('#announcment-title').val();
      let description = $$('#announcment-description').val();
      let link = $$('#announcment-link').val();
      let announcement = {
        title: title,
        description: description,
        link: link,
        test: true,
      };
      console.log("Sending announcement: ", announcement);

      sendAnnouncement(announcement).then(result => {
        app.preloader.hide();
        console.log(result);
      }).catch(error => {
        app.preloader.hide();
        console.error(error);
      });

    });

  //open the popup
  app.popup.open(".announcement-popup");

}

///////*TAGS*\\\\\\\

$$('#edit-tags-button').click(function() {
  if ($$('#edit-tags-button').html() == "Edit") {
    console.log("Edit tags");
    app.sortable.enable('#sortable-tags-list')

    $$('#edit-tags-button').html("Save");
    $$('#tags-list').find('input').prop('readOnly', false);
    $$('#new-tag-button').show();
    $$('#cancel-edit-tags-button').show();
    $$('.delete-tag-button').show();

  } else {
    console.log("Save tags");

    saveTags();

    app.sortable.disable('#sortable-tags-list')
    $$('#edit-tags-button').html("Edit");
    $$('#tags-list').find('input').prop('readOnly', true);
    $$('#new-tag-button').hide();
    $$('#cancel-edit-tags-button').hide();
    $$('.delete-tag-button').hide();

  }
});

$$('#cancel-edit-tags-button').click(function() {
  app.preloader.show();
  loadTags().then(function() {
    app.preloader.hide();
  });
  app.sortable.disable('#sortable-tags-list')
  $$('#edit-tags-button').html("Edit");
  $$('#tags-list').find('input').prop('readOnly', true);
  $$('#new-tag-button').hide();
  $$('#cancel-edit-tags-button').hide();
  $$('.delete-tag-button').hide();

});

$$('#new-tag-button').click(function() {
  let tagEl = $$('<li class="tag-input">\
    <div class="item-content">\
      <div class="item-media"><i class="material-icons icon">sports_football</i></div>\
      <div class="item-inner">\
      <button class="delete-tag-button button color-red" type="button" name="button" style="width:10%;" >Delete</button>\
        <div class="item-title">\
          <input class="tag-title-input" type="text" name="Title" placeholder="Title">\
        </div>\
        <input class="tag-description-input" type="text" style="text-align:right;" name="Description" placeholder="Description">\
      </div>\
    </div>\
    <div class="sortable-handler"></div>\
  </li>');
  tagEl.attr('data-id', makeid(10)); // TODO: Check for id conflicts

  $$("#tags-list").append(tagEl);
  $$('.delete-tag-button').click(function() {
    console.log("Deleteing tag.");
    $$(this).parent().parent().parent().remove();
  });
});

function selectTag(id) {
  console.log("Selecting tag:" + id);
  if (!$$('#' + id).hasClass('selected-tag')) {
    $$('#' + id).addClass('selected-tag');
  } else {
    $$('#' + id).removeClass('selected-tag');
  }
}

async function loadTags() { //Clears the current tags then loads them from the server
  console.log("Loading tags");

  universalData = (await universalDataRef.get()).data();
  console.log(universalData);
  $$("#tags-list").empty();

  universalData.tags.forEach((tag, i) => {
    let tagEl = $$('<li class="tag-input">\
      <div class="item-content">\
        <div class="item-media"><i class="material-icons icon">sports_football</i></div>\
        <div class="item-inner">\
        <button class="delete-tag-button button color-red" type="button" name="button" style="width:10%;display:none;" >Delete</button>\
          <div class="item-title">\
            <input class="tag-title-input" type="text" name="Title" placeholder="Title" value="' + tag.title + '" readonly>\
          </div>\
          <input class="tag-description-input" type="text" style="text-align:right;" name="Description" placeholder="Description" value="' + tag.description + '" readonly>\
        </div>\
      </div>\
      <div class="sortable-handler"></div>\
    </li>');
    tagEl.attr('data-id', tag.id);
    //tagEl.data("id", "gksajdhgfkajsdhg");
    $$("#tags-list").append(tagEl);
  });

  $$('.delete-tag-button').hide();
  $$('.delete-tag-button').click(function() {
    console.log("Deleteing tag.");
    $$(this).parent().parent().parent().remove();
  });

  return 1;
}

async function saveTags() { //Saves the tags and their order as currently displyed in the tags section
  app.preloader.show();
  //console.log($$('#tags-list').find('.tag-input'));
  let tagElements = $$('#tags-list').find('.tag-input');
  let newTags = [];

  tagElements.forEach((tagElement, i) => {
    //console.log($$(tagElement).find('input'));
    console.log($$(tagElement).attr("test"), $$(tagElement).data('id'));
    newTags.push({
      id: $$(tagElement).attr("data-id"),
      title: $$(tagElement).find('.tag-title-input').val(),
      description: $$(tagElement).find('.tag-description-input').val(),
    });
  });
  console.log(newTags);

  await universalDataRef.update({
    tags: newTags,
  });

  loadTags();

  app.preloader.hide();

  return 1;
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

/*
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
}*/