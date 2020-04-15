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
      profilePic = "./unknown.jpg";
    }).then(function() {
      db.collection("users").doc(userID).get().then(function(userData) {
        loadedUsers[userID] = {
          uid: userID,
          username: userData.get("username") ? userData.get("username") : 'undefined',
          firstName: userData.get("firstName") ? capitalizeFirstLetter(userData.get("firstName")) : 'undefined',
          lastName: userData.get("lastName") ? capitalizeFirstLetter(userData.get("lastName")) : 'undefined',
          picURL: profilePic,
        };
        console.log("loaded user: " + userID);
        callback(loadedUsers[userID]);
      });
    });
  }
}

function banUser(uid) {
  app.toast.show({
    text: "This feature is coming soon!"
  });
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

  $$('.search-user-preloader').show();
  $$('#all-users-list').html('');

  //get query
  let query = $$('#user-search').val().toLowerCase();

  //where we will store the results
  var foundUsers = {};

  //an array to store our query promises
  let querys = [];

  //Add the querys
  querys.push(db.collection('users').where("username", "==", query).get());
  querys.push(db.collection('users').where("firstName", "==", query).get());
  querys.push(db.collection('users').where("lastName", "==", query).get());

  //Await all the the querys then add their results
  Promise.all(querys).catch(function(error) {

    $$('.search-user-preloader').hide();
    $$('#all-users-list').html('There was an error loading results. Please try again later.');

    console.error(error.message);
    return;
  }).then(function(queryDoc) {
    queryDoc.forEach(function(queryResults) {
      queryResults.forEach(function(userDoc) {
        //If this user has already been found add to its priority
        if (foundUsers[userDoc.id]) {
          foundUsers[userDoc.id] += 2;
        } else {
          foundUsers[userDoc.id] = 2;
        }
      });
    });

    //Sort by priority
    var sortable = [];
    for (var user in foundUsers) {
      sortable.push([user, foundUsers[user]]);
    }

    //If nothing is found
    if (sortable.length < 1) {
      $$('#all-users-list').html('There were no users matching \"' + query + '\"');
      $$('.search-user-preloader').hide();
      return;
    }

    sortable.sort(function(a, b) {
      return b[1] - a[1];
    });

    //get user info and display on list
    let lastUser = sortable[sortable.length - 1][0];
    sortable.forEach(function(userDoc) {
      getUser(userDoc[0], function(user) {
        $$('#all-users-list').append('<li><div class="item-content">' +
          '<div class="item-media"><div class="picture" style="background-image: url(' + user.picURL + ')"></div></div>' +
          '<div class="item-inner">' +
          '<div class="item-title-row"><div class="item-title">' + user.username + '</div><div class="item-after"><a href="#" onclick="banUser(\'' + user.uid + '\')" class="button color-red">Ban User</a></div></div>' +
          '<div class="item-text">' + user.firstName + ' ' + user.lastName + '</div>' +
          '</div></div></li>');

        //hide preloader on last result
        if (user.uid == lastUser) {
          $$('.search-user-preloader').hide();
        }
      });


    });
  });
}

function forgotPassword() {
  //show prompt dialog
  app.dialog.prompt('What is your email address?', function(email) {

    //show loading dialog
    app.dialog.preloader('Sending reset email...');

    //attempt to send reset email
    firebase.auth().sendPasswordResetEmail(email).then(function() {
      app.dialog.close();
      app.dialog.alert('A password reset email was sent to your address.');
    }).catch(function(error) {
      app.dialog.close();
      app.dialog.alert(error.message);
      console.error(error.message);
    });
  });
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}