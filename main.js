var app = new Framework7({
  root: '#app',
  name: 'Fun Sports Pools Admin',
  id: 'com.myapp.test',
  theme: 'aurora',
  routes: [{
      path: '/home/',
      url: 'index.html',
      on: {
        pageInit: function(e, page) {

        },
      }
    },
    {
      path: '/login/',
      url: 'pages/login.html',
      on: {
        pageInit: function(e, page) {
          //When the pages is Initialized setup the signIn button
          document.getElementById('log-in-button').addEventListener('click', function() {
            var email = document.getElementById("uname").value;
            var password = document.getElementById("pword").value;
            signIn(email, password);
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

// Hide pool button on click
$$('.hide-confirm').on('click', function() {
  app.dialog.confirm('Unpublishing this pool means it will no longer be visible to the public. You can always republish pools.', function() {
    app.popup.close(".pool-popup");
    // TODO: Hide pool
  });
});

// Save pool button on click
$$('.pool-save').on('click', function() {

  app.preloader.show();

  //store all the values
  var id = document.getElementById("pool-name").dataset.id;
  var name = document.getElementById("pool-name").value;
  var description = document.getElementById("pool-description").innerHTML;
  var pic = document.getElementById('pic-input').files[0];
  var timestamp = document.getElementById('pool-date').valueAsNumber + document.getElementById('pool-time').valueAsNumber;
  var poolQuestions = document.getElementsByClassName("question");
  //Get tags from the chips
  var tags = [];
  var chips = document.getElementById("pool-tags").getElementsByClassName("chip-label");
  for (var i = 0; i < chips.length; i++) {
    tags.push(chips[i].innerHTML);
  }

  console.log(poolQuestions);

  var questions = {};
  //For each question
  for (var i = 0; i < poolQuestions.length; i++) {
    var questionID = poolQuestions[i].id;
    console.log(questionID);
    var numericAnswer = document.getElementById(questionID + "-numeric-answer");
    //check to see if this question has a numeric answer
    if (numericAnswer != null) {
      //Add this numeric question to the questions object
      questions[questionIDs[i]] = {
        description: document.getElementById('question-description-' + questionID).value,
        answer: numericAnswer.value,
      };
    } else {
      //Get the questions answers and store them in an object called answers
      var answerEL = document.getElementsByClassName(questionID + "-answer");
      var answers = {};
      for (var x = 0; x < answerEL.length; x++) {
        answers[answerEL[x].id] = {
          correct: (correctAnswers[questionID] == answerEL[x].id), //Inline if statement to check if this answer id the correct one
          text: answerEL[x].value,
        };
      }
      //Add this multiple choice question to the questions object
      questions[questionIDs[i]] = {
        description: document.getElementById('question-description-' + questionID).value,
        answers: answers,
      };
    }
  }
  console.log(questions);

  //Save the pool to the database
  editPool(id, name, description, pic, timestamp, tags, questions);
});

// New pool button on click
$$('.new-pool').on('click', function() {

  //clear any existing values in the popup
  document.getElementById('pic-preview').style.backgroundImage = "";
  document.getElementById("pool-name").value = "";
  document.getElementById("pool-name").dataset.id = "0";
  document.getElementById("pool-description").innerHTML = "";
  $$("#pool-tags").html("");
  $$("#pool-questions").html("");

  document.getElementById("pool-date").value = "";
  document.getElementById("pool-time").value = "";
  console.log("aaa");
  //open the popup
  app.popup.open(".pool-popup");

});

var answerIDs = [];
//Adds an answer to the html // NOTE: this only adds the answer to the html not the data base
function addAnswer(questionID, answerID, answerText, correct) {
  // TODO: Check to see if this id is already in the database. If so dont add the answer
  answerIDs.push(answerID);
  $$('.mc-answer-' + questionID).prev().append('<li class="item-content item-input">\
  <div class="item-inner">\
    <div>\
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
  document.getElementById(answerID + "-setanswer").addEventListener("click", function() {
    setAnswer(this, questionID, answerID);
  });
  document.getElementById(answerID).value = answerText;
  if (correct) {
    setAnswer(document.getElementById(answerID + "-setanswer"), questionID, answerID);
  }
}

var questionIDs = [];
// This is adds a multiple choice question to the html // NOTE: This only adds the question to the html not the database // TODO: add Numeric questions as well
function addQuestion(questionID, description, answers) {
  // TODO: Check to see if this questionId has been added already if so dont add the question
  questionIDs.push(questionID);
  // Add the question html to the pool questions element
  $$('#pool-questions').append('<div id=' + questionID + ' class="question mc-question list no-hairlines no-hairlines-between">\
  <ul>\
    <li class="item-content item-input">\
      <div class="item-inner">\
      <div>\
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

  //setup the add answer button
  $$('.mc-answer-' + questionID).on('click', function(event) {
    var answerID = makeid(10);
    addAnswer(questionID, answerID);
  });
  //Setup the question description
  document.getElementById("question-description-" + questionID).value = description;

  // if the answers array is valid
  if (answers != null && answers != []) {
    console.log("validarray");
    var i = 0;
    //For each answer
    Object.keys(answers).forEach(function(answerID) {
      //Add the answer to the html
      addAnswer(questionID, answerID, answers[answerID].text, answers[answerID].correct);
      //Check to see if this is the first answer if so then remove the delete button
      if (i < 1) {
        var deleteButton = document.getElementById(answerID + "-deleteanswer");
        deleteButton.parentNode.removeChild(deleteButton);
      }

      i++;
    });
  } else {
    //Add the default first answer to the html
    answerID = makeid(10);
    addAnswer(questionID, answerID, '', false);
    //remove the answers delete button
    var deleteButton = document.getElementById(answerID + "-deleteanswer");
    deleteButton.parentNode.removeChild(deleteButton);
  }

}

// This is adds a numeric question to the html // NOTE: This only adds the question to the html not the databasex
function addNumericQuestion(questionID, description, answer) {
  // TODO: Check to see if this questionId has been added already if so dont add the question
  questionIDs.push(questionID);

  // Add the question html to the pool questions element
  $$('#pool-questions').append('<div  id="' + questionID + '"  class="question n-question list no-hairlines no-hairlines-between">\
    <ul>\
      <li class="item-content item-input">\
      <div class="item-inner">\
      <div>\
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
        <div class="item-inner"><div>\
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
//set the selected answer the correct answer for a multiple choice question
function setAnswer(el, questionID, answerID) {
  correctAnswers[questionID] = answerID;
  console.log(correctAnswers);
  var answer = el.parentElement.parentElement.parentElement;
  var answers = answer.parentElement.childNodes;

  for (var i = 0; i < answers.length; i++) {
    answers[i].style = "";
  }
  answer.style.backgroundColor = "rgba(76, 175, 80, .2)";
}

//remove a question from the list
function deleteQuestion(el) {
  deleteAnswer(el.parentElement.parentElement);
}


function setupMainPage() {
  //direct user to main page if not already there
  db.collection("admins").doc(uid).get().catch(function(error) {
    console.log(error.message);
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

      if (self.app.views.main.router.currentRoute.path != '/') {
        self.app.views.main.router.navigate('/home/');
        console.log("navigated to main page");
      }
      loadPools();
      //editUser('Administrator', 'test', 'user', null, null);
      document.getElementById("username").innerHTML = "Hi, " + User.username;
      var panel = app.panel.create({
        el: '.panel-left',
        resizable: true,
        visibleBreakpoint: 300,
      });

      //hide splash screen
      var sc = document.getElementById("splash-screen");
      if (sc)
        sc.parentElement.removeChild(sc);
    } else {
      console.log("This user is not an admin!");
    }
  });
}


//////*******Pools section********\\\\\\\
var loadedPools = []; //An array of all the pools we have loaded
// An asyc method to get pool data
function getPool(poolID, callback) {
  //If we have already loaded this users data then return it else load it from the database
  if (poolID in loadedPools) {
    console.log("found pool in array");
    callback(loadedPools[poolID]);
  } else {
    var poolPic = "";
    // Create a reference to the file we want to download
    var poolPictureRef = storageRef.child('pool-pictures').child(poolID);
    // Get the download URL for the picture
    poolPictureRef.getDownloadURL().then(function(url) {
      poolPic = url;
    }).catch(function(error) {
      poolPic = "https://cdn.framework7.io/placeholder/nature-1000x600-3.jpg";
    }).then(function() {
      db.collection("pools").doc(poolID).get().then(function(poolData) {
        loadedPools[poolID] = {
          poolID: poolID,
          name: poolData.get("name"),
          description: poolData.get("description"),
          date: poolData.get("startDate"),
          pic: poolPic,
          tags: poolData.get("tags"),
          questions: poolData.get("questions"),
        };

        callback(loadedPools[poolID]);
      });
    });

  }
}

// This loads the pools. This can also be used to refresh the pools page
function loadPools() {

  //Close any open pool popup
  app.popup.close(".pool-popup");
  //Remove any old pool data from th html.// TODO: also remove the data from the loadedPools array. This will ensure that we have the most up to date data avalible
  loadedPools = [];
  document.getElementById("pool-list").innerHTML = '';

  var pools = [];
  //Then get all pools in the database and setup the cards. // TODO:only load the global pools and maybe the most popular custom pools
  db.collection("pools").get().then(function(poolsSnapshot) {
    poolsSnapshot.forEach(function(doc) {
      //Get the pool Data
      getPool(doc.id, function(poolDAT) {
        //Add the pool data to an array for later use
        pools.push(poolDAT);
        //once the array length is the same as the number of pools we have loaded sort the array then add all the pools top the html
        if (pools.length >= poolsSnapshot.size) {
          console.log("loaded all the pool data");
          pools.sort((a, b) => (a.name > b.name) ? 1 : -1);
          pools.forEach(function(pool) {

            var poolList = document.getElementById("pool-list");
            console.log(pool.date);
            var date = ((pool.date != null && !isNaN(pool.date) && pool.date != 0) ? new Date(pool.date) : "This pool does not have a date");
            //setup the pool card
            var a = document.createElement('div');
            a.classList.add("card");
            a.classList.add("pool-card");
            a.classList.add("col-30");
            //When the card is clicked fill the popup with data
            a.onclick = function() {
              document.getElementById('pic-preview').style.backgroundImage = "url(" + pool.pic + ")";
              document.getElementById("pool-name").value = pool.name;
              document.getElementById("pool-name").dataset.id = pool.poolID;
              document.getElementById("pool-description").innerHTML = pool.description;
              var date = new Date(pool.date);
              document.getElementById("pool-date").value = "";
              document.getElementById("pool-time").value = "";

              document.getElementById("pool-questions").innerHTML = ''; //Clear any leftover html data from old questions

              //Clear the question and answer IDs because we are loading a new page
              questionIDs = [];
              answerIDs = [];
              correctAnswers = [];
              //Check to see if this pool has any questions. If so then load them // TODO: maybe if there are no questions then add a blank question at the bottom of the code?
              if (pool.questions != 'undefined' && pool.questions != null) {

                //For each question in the pool.
                Object.keys(pool.questions).forEach(function(questionID) {

                  //Check to see if the question is Numeric
                  if (pool.questions[questionID].answer != null) {
                    //Add the question to the html
                    addNumericQuestion(questionID, pool.questions[questionID].description, pool.questions[questionID].answer);
                  } else {
                    //Add the question to the html
                    addQuestion(questionID, pool.questions[questionID].description, pool.questions[questionID].answers);
                  }
                });
              }

              //add in tags
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
          });
        }
      });


      ///

    });
  });
}

//If the pool exist then this edits its data if it doesnt exist eg poolID=0||null then it creates a new pool. tags should be an array, poolStartDate should be a Timestamp
function editPool(poolID, poolName, poolDescription, poolPicture, poolStartDate, tags, questions) {

  //Clear the loaded pools array this is to make sure we load the most up to date data
  loadedPools = [];
  //If the poolID is not null and not 0 edit the data
  if (poolID && poolID != 0) {
    var poolRef = db.collection('pools').doc(poolID);

    poolRef.update({
      name: poolName,
      description: poolDescription,
      startDate: poolStartDate,
      tags: tags,
      questions: questions,
    }).then(function() {
      // TODO: check if pool pic is valid if not set the default pic?
      if (poolPicture) {
        var poolPictureRef = storageRef.child('pool-pictures').child(poolID);
        poolPictureRef.put(poolPicture).then(function() {
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
      name: poolName,
      description: poolDescription,
      startDate: poolStartDate,
      tags: tags,
    }).then(function(doc) {
      var profilePictureRef = storageRef.child('pool-pictures').child(doc.id);
      profilePictureRef.put(poolPicture).then(function() {
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
    }).catch(function(error) {
      app.preloader.hide();
      app.toast.show({
        text: error,
        closeTimeout: 10000,
        closeButton: true
      });
    });
  }

}


//displays uploaded picture on screen
function previewPic(event) {
  document.getElementById('pic-preview').style.backgroundImage = "url(" + URL.createObjectURL(event.target.files[0]) + ")";
  document.getElementById('pic-icon').innerHTML = "edit";
}

//add a tag on edit pool page
function addTag(el) {
  chipsDiv = document.getElementById("pool-tags");
  if (el.value.includes(",")) {
    var tag = el.value.split(',')[0].toLowerCase();
    var chip = document.createElement("div");
    chip.innerHTML = '<div class="chip" onclick="deleteTag(this)"><div class="chip-label">' + tag + '</div><a href="#" class="chip-delete"></a></div>';
    chipsDiv.appendChild(chip.childNodes[0]);
    el.value = "";
    el.focus();
    el.select();

  }

}

//delete tag on pool page
function deleteTag(el) {
  el.parentElement.removeChild(el);
}