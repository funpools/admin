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
var questionIDs = [];
// new pool multiple choice question
$$('#mc-question').on('click', function() {

  //store the question number for later use
  var questionNumb = makeid(10);
  questionIDs.push(questionNumb);
  //add the new question html to the page
  $$('#pool-questions').append('<div id=' + questionNumb + ' class="question mc-question list no-hairlines no-hairlines-between">\
    <ul>\
      <li class="item-content item-input">\
        <div class="item-inner">\
        <div>\
          <div class="item-title item-label">Multiple Choice Question</div>\
          <div class="item-input-wrap">\
            <input id ="question-description-' + questionNumb + '" type="text" placeholder="Your question">\
          </div>\
          </div>\
          <div class="item-after">\
            <button class="button" onclick="deleteQuestion(this)">Delete</button>\
          </div>\
        </div>\
      </li>\
      <div class="seporator"></div>\
      <li class="item-content item-input">\
        <div class="item-inner">\
          <div>\
            <div class="item-title item-label">Answer</div>\
            <div class="item-input-wrap">\
              <input class="' + questionNumb + '-answer" type="text" placeholder="Your answer">\
            </div>\
          </div>\
          <div class="item-after">\
            <button class="button" onclick="setAnswer(this)">Correct</button>\
          </div>\
        </div>\
      </li>\
    </ul>\
    <button class="button mc-answer-' + questionNumb + '">+ Add Answer</button>\
  </div>');

  // add event listner for new multiple choice answer
  $$('.mc-answer-' + questionNumb).on('click', function(event) {
    $$('.mc-answer-' + questionNumb).prev().append('<li class="item-content item-input">\
      <div class="item-inner">\
        <div>\
          <div class="item-title item-label">Answer</div>\
          <div class="item-input-wrap">\
            <input class="' + questionNumb + '-answer" type="text" placeholder="Your answer">\
          </div>\
        </div>\
        <div class="item-after">\
        <button class="button" onclick="deleteAnswer(this)">Delete</button>\
          <button class="button" onclick="setAnswer(this)">Correct</button>\
        </div>\
      </div>\
    </li>');
  });

});


//remove an answer from a multiple choice question
function deleteAnswer(el) {
  var answer = el.parentElement.parentElement.parentElement;
  answer.parentElement.removeChild(answer);
}


//set the selected answer the correct answer for a multiple choice question
function setAnswer(el) {
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



// new pool numeric question
$$('#n-question').on('click', function() {

  //store the question number for later use
  var questionNumb = makeid(10);


  //add the new question html to the page
  $$('#pool-questions').append('<div class="question n-question list no-hairlines no-hairlines-between">\
    <ul>\
      <li class="item-content item-input">\
      <div class="item-inner">\
      <div>\
        <div class="item-title item-label">Numeric Question</div>\
        <div class="item-input-wrap">\
          <input type="text" placeholder="Your question">\
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
            <input type="number">\
          </div>\
        </div></div>\
      </li>\
    </ul>\
  </div>');
});

// hide pool button
$$('.hide-confirm').on('click', function() {
  app.dialog.confirm('Unpublishing this pool means it will no longer be visible to the public. You can always republish pools.', function() {
    app.popup.close(".pool-popup");
    // TODO: Hide pool
  });
});

//save pool
$$('.pool-save').on('click', function() {

  app.preloader.show();

  //store all the values
  var id = document.getElementById("pool-name").dataset.id;
  var name = document.getElementById("pool-name").value;
  var description = document.getElementById("pool-description").innerHTML;
  var pic = document.getElementById('pic-input').files[0];
  var timestamp = document.getElementById('pool-date').valueAsNumber + document.getElementById('pool-time').valueAsNumber;
  var poolQuestions = document.getElementsByClassName("question");


  var tags = [];

  //get tags
  var foo = document.getElementById("pool-tags").getElementsByClassName("chip-label");
  for (var i = 0; i < foo.length; i++) {
    tags.push(foo[i].innerHTML);
    console.log(foo[i].innerHTML);
  }


  // /console.log(poolQuestions);
  console.log(questionIDs.length);
  //question - description - ' + questionNumb
  var questions = [];

  for (var i = 0; i < questionIDs.length; i++) {


    var answers = [];
    var answerEL = document.getElementsByClassName(questionIDs[i] + "-answer");
    for (var x = 0; x < answerEL.length; x++) {

      answers.push(answerEL[x].value);
    }

    questions.push({
      description: document.getElementById('question-description-' + questionIDs[i]).value,
      answers: answers,
    });

    console.log(questionIDs[i]);
  }
  console.log(questions);

  // var eleChild = eleCategory.getElementsByClassName("autoDropdown");
  // alert(eleChild.length);



  //save the pool to the database
  editPool(id, name, description, pic, timestamp, tags);
});


//pool popup
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


  //open the popup
  app.popup.open(".pool-popup");

});


function signIn(email, password) {
  app.preloader.show();
  firebase.auth().signInWithEmailAndPassword(email, password).catch(function(error) {
    app.preloader.hide();
    app.toast.show({
      text: error,
      closeTimeout: 10000,
      closeButton: true
    });
  }).then(function() {
    app.preloader.hide();
    //Put any code that needs to happen after login here
    console.log("Signed in!");
  });
}

function signOut() {
  firebase.auth().signOut().then(function() {
    // Sign-out successful.
  }).catch(function(error) {
    throw (error);
    console.log("Failed to sign out: " + error.message);
  });
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

var loadedUsers = []; //
function getUser(userID, callback) {
  //example usage
  //  getUser('MTyzi4gXVqfKIOoeihvdUuVAu3E2', function(user) {
  //  console.log(user);});
  //If we have already loaded this users data then return it else load it from the database
  if (userID in loadedUsers) {
    console.log("found user in array");
    callback(loadedUsers[userID]);
  } else {
    var profilePic = "";
    // Create a reference to the file we want to download
    var profilePictureRef = storageRef.child('profile-pictures').child(userID);
    // Get the download URL
    profilePictureRef.getDownloadURL().then(function(url) {
      profilePic = url;
    }).catch(function(error) {
      profilePic = "https://www.keypointintelligence.com/img/anonymous.png";
    }).then(function() {
      db.collection("users").doc(userID).get().then(function(userData) {
        loadedUsers[userID] = {
          uid: userID,
          username: userData.get("username"),
          firstName: userData.get("firstName"),
          lastName: userData.get("lastName"),
          picURL: profilePic,
        };
        console.log("loaded user: " + userID);
        callback(loadedUsers[userID]);
      });
    });
  }
}

//If the pool exist then this edits its data if it doesnt exist eg poolID=0||null then it creates a new pool. tags should be an array, poolStartDate should be a Timestamp
function editUser(username, firstName, lastName, pic, password) {
  //If the user document is not null and not 0 edit the data
  var userRef = db.collection('users').doc(uid);
  db.collection('users').doc(uid).get().then(function(userData) {
    if (userData.exists) {
      //Edit pool name
      if (username) {
        userRef.update({
            username: username,
          })
          .then(function() {
            console.log("username successfully updated!");
          })
          .catch(function(error) {
            console.error("Error updating user: ", error);
          });
      }
      if (firstName) {
        userRef.update({
            firstName: firstName,
          })
          .then(function() {
            console.log("user firstName successfully updated!");
          })
          .catch(function(error) {
            console.error("Error updating user: ", error);
          });
      }
      if (lastName) {
        userRef.update({
            lastName: lastName,
          })
          .then(function() {
            console.log("user lastName successfully updated!");
          })
          .catch(function(error) {
            console.error("Error updating user: ", error);
          });
      }
      if (pic) {
        var profilePictureRef = storageRef.child('profile-pictures').child(uid);
        profilePictureRef.put(file).then(function(snapshot) {
          //after picture is posted
        });
      }
      if (password) {
        // TODO: paswords
      }
    } else {
      //the user doc does not exist so create a new doc and set its information
      db.collection("users").doc(uid).set({
          username: username,
          firstName: firstName,
          lastName: lastName,
        })
        .then(function() {
          console.log("Successfully added a new pool!");
        })
        .catch(function(error) {
          console.error("Error adding pool: ", error);
        });
    }
  });
}

function searchUsers() {
  var usersList = document.getElementById("all-users-list");

  usersList.innerHTML = 'Searching...';
  var search = document.getElementById('user-search').value;
  console.log('searched for ' + search);
  db.collection('users').where("username", ">=", search).get().catch(function(error) {
    console.log(error);
  }).then(function(users) {
    usersList.innerHTML = "";
    if (users.size === 0)
      usersList.innerHTML = "No users matching \"" + search + "\" were found.";
    console.log(users.size);
    users.forEach(function(userDoc) {
      getUser(userDoc.id, function(user) {
        var li = document.createElement('li');
        li.innerHTML = '<a href="#" class="item-link item-content">' +
          '<div class="item-media"><img src="' + user.picURL + '" width="32px" style="border-radius: 50%" /></div>' +
          '<div class="item-inner">' +
          '<div class="item-description">' + user.username + '</div>' +
          '</div>' +
          '</a>';
        usersList.appendChild(li);
        console.log(user);
      });
    });
  });

}

var loadedPools = []; //An array of all the pools we have loaded
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
          pic: poolPic,
          tags: poolData.get("tags"),
          questions: poolData.get("questions"),
        };

        callback(loadedPools[poolID]);
      });
    });

  }
}



//This loads the pools. This can also be used to refresh the pools page
function loadPools() {
  //Remove any old pool data from th html.// TODO: also remove the data from the loadedPools array. This will ensure that we have the most up to date data avalible
  document.getElementById("pool-list").innerHTML = '';
  //Then get all pools in the database and setup the cards. // TODO:only load the global pools and maybe the most popular custom pools
  db.collection("pools").get().then(function(pools) {
    pools.forEach(function(doc) {
      getPool(doc.id, function(pool) {
        var poolList = document.getElementById("pool-list");
        var a = document.createElement('div');
        a.classList.add("card");
        a.classList.add("pool-card");
        a.classList.add("col-30");

        //fill popup with content and show it when card is clicked
        a.onclick = function() {
          document.getElementById('pic-preview').style.backgroundImage = "url(" + pool.pic + ")";
          document.getElementById("pool-name").value = pool.name;
          document.getElementById("pool-name").dataset.id = pool.poolID;
          document.getElementById("pool-description").innerHTML = pool.description;

          var date = new Date(pool.time);
          document.getElementById("pool-date").value = "";
          document.getElementById("pool-time").value = "";

          var questionsList = document.getElementById("pool-questions");
          questionsList.innerHTML = '';
          console.log(pool.questions.keys);
          Object.keys(pool.questions).forEach(function(questionID) { //for each question
            console.log("questionid:" + questionID + "question data:");
            console.log(pool.questions[questionID]);
            questionIDs.push(questionID);
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
              <button class="button mc-answer-' + questionID + '">+ Add Answer</button>\
            </div>');
            //setup add answer button
            $$('.mc-answer-' + questionID).on('click', function(event) {
              var answerID = makeid(10);
              $$('.mc-answer-' + questionID).prev().append('<li class="item-content item-input">\
                <div class="item-inner">\
                  <div>\
                    <div class="item-title item-label">Answer</div>\
                    <div class="item-input-wrap">\
                      <input id="' + answerID + '" class="' + questionID + '-answer" type="text" placeholder="Your answer">\
                    </div>\
                  </div>\
                  <div class="item-after">\
                  <button class="button" onclick="deleteAnswer(this)">Delete</button>\
                    <button class="button" onclick="setAnswer(this)">Correct</button>\
                  </div>\
                </div>\
              </li>');
            });

            //set the questions description
            document.getElementById("question-description-" + questionID).value = pool.questions[questionID].description;

            Object.keys(pool.questions[questionID].answers).forEach(function(answerID) { //for each answer
              console.log(answerID + " " + pool.questions[questionID].answers[answerID]);
              $$('.mc-answer-' + questionID).prev().append('<li class="item-content item-input">\
                <div class="item-inner">\
                  <div>\
                    <div class="item-title item-label">Answer</div>\
                    <div class="item-input-wrap">\
                      <input id="' + answerID + '" class="' + questionID + '-answer" type="text" placeholder="Your answer">\
                    </div>\
                  </div>\
                  <div class="item-after">\
                  <button class="button" onclick="deleteAnswer(this)">Delete</button>\
                    <button class="button" onclick="setAnswer(this)">Correct</button>\
                  </div>\
                </div>\
              </li>');

              document.getElementById(answerID).value = pool.questions[questionID].answers[answerID].text;

            });



          });


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
        var date = new Date();
        a.innerHTML = '<div style="background-image:url(' + pool.pic + ')" class="card-header align-items-flex-end">' + pool.name + '</div>' +
          '<div class="card-content card-content-padding">' +
          '  <p class="date">' + date.toLocaleString() + '</p>' +
          '  <p>Pool ' + pool.description + '</p>' +
          '</div>';
        poolList.appendChild(a);
      });


    });
  });
}

//If the pool exist then this edits its data if it doesnt exist eg poolID=0||null then it creates a new pool. tags should be an array, poolStartDate should be a Timestamp
function editPool(poolID, poolName, poolDescription, poolPicture, poolStartDate, tags) {

  loadedPools = [];

  //If the poolID is not null and not 0 edit the data
  if (poolID && poolID != 0) {
    var poolRef = db.collection('pools').doc(poolID);

    poolRef.update({
      name: poolName,
      description: poolDescription,
      startDate: poolStartDate,
      tags: tags,
    }).then(function() {
      var profilePictureRef = storageRef.child('pool-pictures').child(poolID);
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