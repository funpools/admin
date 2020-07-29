//////*******Pools section********\\\\\\\
const invalidPool = {
  poolID: "invalid",
  tags: [],
  name: "invalid",
  description: "invalid",
  rules: "invalid",
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
          description: poolData.description ? poolData.description : "No Description",
          rules: poolData.rules ? poolData.rules : "No Rules",
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
        description: poolData.description ? poolData.description : "No Description",
        rules: poolData.rules ? poolData.rules : "No Rules",
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
              //console.log('private pool not displaying.');
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

async function openPoolPopup(pool) { //Opens the popup for the given pool
  console.log('Opening pool popup for pool: ', pool);
  //Reset all elements
  $$('.pool-delete').parent().show();
  $$('.pool-save').parent().show();

  $$('.pool-popup').find('#pool-pic').find('.pic-upload').css("background-image", ("url(" + pool.pic + ")"));
  $$('.pool-popup').find('#pool-pic').find('.pic-icon').html('edit');
  document.getElementById("pool-name").value = pool.name;
  document.getElementById("pool-name").dataset.id = pool.poolID;
  document.getElementById("pool-description").innerHTML = pool.description;
  $$("#pool-rules").html(pool.rules);
  var poolVisibilityDiv = document.getElementById("pool-visibility");
  $$("#pool-visibility").val(pool.state).change();


  if (pool.admins.includes(User.uid) || User.superUser) {
    console.log("This user is an admin of this pool or a super user");
  } else {
    console.log("This user is not an admin of this pool and not a super user");
    $$('.pool-delete').parent().hide();
    $$('.pool-save').parent().hide();
  }

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
    $$('#pool-tags-list').html("");
    universalData.tags.forEach((tag, i) => {
      let tagEl = $$('<div id="' + tag.id + '" class="tag-chip no-select">' + tag.title + '</div>');
      tagEl.attr('data-id', tag.id);
      if (pool.tags.includes(tag.id)) {
        tagEl.addClass('tag-chip-selected');
      }
      tagEl.click(() => {
        $$('#' + tag.id).toggleClass('tag-chip-selected');
      });
      $$('#pool-tags-list').append(tagEl);
    });
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

  if (pool.state === "active" || pool.state === "closed") { //hide the delete button if the pool is active or closed
    $$('.delete-button').hide();
  }


  let admins = [];
  let adminSnapshot = await db.collection('admins').get();
  for (var i = 0; i < adminSnapshot.docs.length; i++) {
    admins.push({
      uid: adminSnapshot.docs[i].id,
      name: adminSnapshot.docs[i].data().name,
      profilePic: "./unknown.jpg",
    });
    //getUser(uid, function(admin) {});
  }
  //console.log(admins);
  $$('#admins-list').html('');

  //clear any current permissions
  $$('#chips-div').children().empty();
  admins.forEach((admin, i) => {

    // add to list
    $$('#admins-list').append('<li class="user-' + admin.uid + '"><div class="item-content">' +
      '<div class="item-media popup-close"><div style="background-image: url(' + admin.profilePic + ')" class="picture"></div></div>' +
      '<div class="item-inner" onclick="addChip(this, \'' + admin.uid + '\')"><div class="item-title">' + admin.name + '</div>' +
      '<div class="item-after"></div></div></div></li>');

    // add to chips
    if (pool.admins.includes(admin.uid)) {
      addChip($$('.user-' + admin.uid).find('.item-inner')[0], admin.uid);
    }

    if (i == pool.admins.length - 1) {
      //setup searchbar
      var searchbar = app.searchbar.create({
        el: '.admins-searchbar',
        searchContainer: '#admins-list',
        searchIn: '.item-title',
      });
    }
  });


  app.popup.open(".pool-popup");
};

function addChip(el, uid) { // add an admin chip
  console.log("ADDED CHIP");
  getUser(uid, function(user) {
    //if user is not already selected
    if ($$('.chip-' + user.uid).length < 1) {

      //add chip
      $$('#chips-div').children().append('<div class=" u-chip animate fadeInDown chip chip-' + user.uid +
        '" data-uid="' + user.uid + '"><div class="chip-media" style="background-image: url(' + user.profilePic +
        ')"></div><div class="chip-label">' + user.fullName() +
        '</div><a href="#" onclick="removeChip(this, \'' + user.uid +
        '\')" class="chip-delete"></a></div>');

      //animate height
      $$('#chips-div').css("height", $$('#chips-div').children()[0].scrollHeight + "px");

      //add check mark by user
      $$(el).find('.item-after').html('<i class="icon material-icons animate fadeIn">check</i>');
    }
  });
}

function removeChip(el, uid) { //Add a user chip to private pool invit
  //remove chip
  $$(el).parent().remove();

  //animate height
  $$('#chips-div').css("height", $$('#chips-div').children()[0].scrollHeight + "px");

  //remove check mark by user
  $$('.user-' + uid).find('.item-after').html('');
}

async function savePool() {
  app.preloader.show();

  //Get all the needed values from the html
  let id = document.getElementById("pool-name").dataset.id;
  let name = document.getElementById("pool-name").value;
  let description = document.getElementById("pool-description").innerHTML;
  let rules = $$("#pool-rules").html();
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
  //Get tags from the chips // TODO: Remove this is not needed
  let tags = [];
  $$('#pool-tags-list').find('.tag-chip-selected').forEach((selectedTag, i) => {
    console.log($$(selectedTag).attr("id"), $$(selectedTag).attr("data-id"));
    tags.push($$(selectedTag).attr("data-id"));
  });

  let admins = [];
  await $$('#chips-div').find('.u-chip').forEach((adminChip, i) => {
    console.log($$(adminChip).attr("uid"), $$(adminChip).attr("data-uid"));
    admins.push($$(adminChip).attr("data-uid"));
  });
  console.log(admins);

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
    rules: rules,
    picture: pic,
    date: timestamp,
    tags: tags,
    questions: questions,
    state: poolState,
    tiebreakers: tieBreakers,
    feature: featured, //// TODO: add stuff here
    featuredPic: featuredPic,
    admins: admins,
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
        rules: (poolData.rules) ? poolData.rules : "No Rules",
        date: (poolData.date) ? poolData.date : new Date(),
        tags: (poolData.tags) ? poolData.tags : [],
        questions: (poolData.questions) ? poolData.questions : [],
        tiebreakers: (poolData.tiebreakers) ? poolData.tiebreakers : [],
        state: (poolData.state) ? poolData.state : "hidden",
        private: false,
        admins: (poolData.admins) ? poolData.admins : [],
      });
      //Update the picture if it exists
      if (poolData.picture && poolData.picture != null) {
        await storageRef.child('pool-pictures').child(poolData.poolID).put(poolData.picture).then(function(snapshot) {
          console.log('Uploaded a blob or file!');
        });
      }

      loadedPools[id] = {
        state: (poolData.state) ? poolData.state : "hidden",
      };
    } else { //The pool does not exist so create a pool and set its information
      //make sure that the user is included as an admin
      let poolAdmins = (poolData.admins) ? poolData.admins : [];
      (poolAdmins.includes(User.uid)) ? null: poolAdmins.push(User.uid);

      let doc = await db.collection("pools").add({
        name: (poolData.name) ? poolData.name : "No name given",
        description: (poolData.description) ? poolData.description : "No Description",
        rules: (poolData.rules) ? poolData.rules : "No Rules",
        date: (poolData.date) ? poolData.date : new Date(),
        tags: (poolData.tags) ? poolData.tags : [],
        questions: (poolData.questions) ? poolData.questions : [],
        tiebreakers: (poolData.tiebreakers) ? poolData.tiebreakers : [],
        state: (poolData.state) ? poolData.state : "hidden",
        private: false,
        admins: poolAdmins,
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


async function newPool() { // New pool button on click
  //clear any existing values in the popup
  $$(".pool-popup").find('.pic-upload').css("background-image", "");
  $$(".pool-popup").find('.pic-icon').html("add_photo_alternate");
  $$("#pool-name").val("");
  $$("#pool-description").html("");
  document.getElementById("pool-name").dataset.id = "0";
  $$("#pool-visibility").val("draft").change();
  $$("#pool-rules").html("");
  $$("#pool-tags").html("");
  $$("#pool-questions").html("");
  poolDateInput.setValue([new Date()]); //Set the value of the date to be nothing

  // TODO: Load admins name data
  let admins = [];
  let adminSnapshot = await db.collection('admins').get();
  for (var i = 0; i < adminSnapshot.docs.length; i++) {
    admins.push(adminSnapshot.docs[i].id);
  }
  $$('#admins-list').html('');
  //clear any current admin permissions
  $$('#chips-div').children().empty();
  admins.forEach((uid, i) => {
    getUser(uid, function(admin) {
      // add to list
      $$('#admins-list').append('<li class="user-' + admin.uid + '"><div class="item-content">' +
        '<div class="item-media popup-close"><div style="background-image: url(' + admin.profilePic + ')" class="picture"></div></div>' +
        '<div class="item-inner" onclick="addChip(this, \'' + admin.uid + '\')"><div class="item-title">' + admin.fullName() + '</div>' +
        '<div class="item-after"></div></div></div></li>');

      if (i == admins.length - 1) {
        //setup searchbar
        var searchbar = app.searchbar.create({
          el: '.admins-searchbar',
          searchContainer: '#admins-list',
          searchIn: '.item-title',
        });
      }
    });
  });
  //open the popup
  app.popup.open(".pool-popup");
  return "Cleared data and opened popup."
}

function duplicatePool() { //Duplicates the specified pool then opens the popup
  let id = document.getElementById("pool-name").dataset.id;
  getPool(id).then(function(poolData) {
    let newPool = {
      name: poolData.name + '(Copy)',
      description: poolData.description ? poolData.description : "No Description",
      rules: poolData.rules ? poolData.rules : "No Rules",
      tags: [],
      questions: poolData.questions,
      tiebreakers: poolData.tiebreakers,
      state: 'draft',
      admins: [User.uid],
    };
    console.log('Duplicating pool: ' + id);
    //clear the selected questions
    newPool.questions.forEach((question, i) => {
      newPool.questions[i].correctAnswer = null;
      newPool.questions[i].answers.forEach((answer, x) => {
        newPool.questions[i].answers[x].correct = false;
      });
    });

    editPool(newPool, function(editedPoolID) {
      console.log("Made a new duplicate pool: " + editedPoolID + ",", newPool);
      $$('#poolcard-' + editedPoolID)[0].click();
    });
  });

}

async function featurePool(idToFeature, featuredPic, feature) {
  app.preloader.show();

  let mainPageData = (await db.collection("universalData").doc("mainPage").get()).data();
  let pool = await getPool(idToFeature);
  app.preloader.hide();


  //if we are trying to feature this pool and it is open
  if (feature && pool.state == "open") {
    //if this pool will replace another featured pool then do some fancy code to confirm the admin wants to do this
    if (idToFeature != mainPageData.featuredPool && (mainPageData.featuredPool != null && mainPageData.featuredPool != '')) {
      let confirmationPromise = new Promise(function(resolve, reject) {
        app.dialog.confirm("Featuring this pool will overwrite any other featured pools. Are you sure you wish to proceed?", function() {
          resolve();
        }, function() {
          reject();
        });
      });

      try {
        await confirmationPromise;
        console.log("Confirmed the remove featured Pool operation.");
      } catch (e) {
        console.log("Canceled the remove featured pool operation.");
        return 0;
      }
    }
    console.log("Featureing pool id: " + idToFeature);
    await db.collection("universalData").doc("mainPage").update({
      featuredPool: idToFeature
    });

    //Update the picture if it exists
    if (featuredPic != null) { //If there is a picture upload it and display the progress
      console.log("Uploading pic");

      var progress = 0;
      let progressDialog = app.dialog.progress('Uploading featured photo', progress);
      var uploadTask = storageRef.child('featured-pool-pic').put(featuredPic);

      app.preloader.hide();
      // Listen for state changes, errors, and completion of the upload.
      uploadTask.on(firebase.storage.TaskEvent.STATE_CHANGED, // or 'state_changed'
        function(snapshot) {
          // Get task progress, including the number of bytes uploaded and the total number of bytes to be uploaded
          progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log('Upload is ' + progress + '% done');
          progressDialog.setProgress(progress);
        },
        function(error) {
          // A full list of error codes is available at: https://firebase.google.com/docs/storage/web/handle-errors
          console.error(error);
        },
        function() {
          console.log("Finished uploading photo.");
          progressDialog.close();
          app.preloader.show();
        });

      await uploadTask;

      return 1;
    } else {
      console.log("No photo to upload.");
      app.preloader.hide();
      return 1;
    }

  } else {
    if (idToFeature == mainPageData.featuredPool) { //If this is the currently featured pool then remove it from the featuredpool
      if (pool.state != "open") { //If this is the featured pool but it is not open then dont allow it to be featured
        app.dialog.alert("This pool is no longer featured in the app because it's state is no longer open");
      }
      let confirmationPromise = new Promise(function(resolve, reject) {
        app.dialog.confirm("This operation will remove this pool from the featured pool. Are you sure you wish to proceed?", function() {
          resolve();
        }, function() {
          reject();
        });
      });

      try {
        await confirmationPromise;
        console.log("Confirmed the featurePool operation.");
      } catch (e) {
        console.log("Canceled the feature pool operation.");
        return 0;
      }

      console.log("Removeing featured pool id: " + idToFeature);
      await db.collection("universalData").doc("mainPage").update({
        featuredPool: '',
      });

      return -1;
    } else if (feature) {
      if (pool.state != "open") { //If this is the featured pool but it is not open then dont allow it to be featured
        app.dialog.alert("This pool cannot be featured in the app because it's state is not open.");
      }
    }
  }

}