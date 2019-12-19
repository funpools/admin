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