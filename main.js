var app = new Framework7({
  root: '#app',
  name: 'My App',
  id: 'com.myapp.test',
  theme: 'aurora',
  routes: [{
      path: '/home/',
      url: 'index.html',
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

var mainView = app.views.create('.view-main');



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


var loadedUsers = []



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
        a.onclick = function() {
          // TODO: Load the pools page
        };
        a.innerHTML = '<div style="background-image:url(' + pool.pic + ')" class="card-header align-items-flex-end">' + pool.name + '</div>' +
          '<div class="card-content card-content-padding">' +
          '  <p class="date">Starts on January 21, 2015</p>' +
          '  <p>Pool ' + pool.description + '</p>' +
          '</div>' +
          '<div class="card-footer"><a href="#" class="link">Something</a><a href="#" class="link">Start Event</a></div>';
        poolList.appendChild(a);
      });
    });
  });
}

//If the pool exist then this edits its data if it doesnt exist eg poolID=0||null then it creates a new pool. tags should be an array, poolStartDate should be a Timestamp
function editPool(poolID, poolName, poolDescription, poolPicture, poolStartDate, tags) {

  //If the poolID is not null and not 0 edit the data
  if (poolID && poolID != 0) {
    var poolRef = db.collection('pools').doc(poolID);
    //Edit pool name
    if (poolName) {
      poolRef.update({
          name: poolName,
        })
        .then(function() {
          console.log("pool successfully updated!");
        })
        .catch(function(error) {
          console.error("Error updating pool: ", error);
        });
    }
    if (poolDescription) {
      poolRef.update({
          description: poolDescription,
        })
        .then(function() {
          console.log("pool successfully updated!");
        })
        .catch(function(error) {
          console.error("Error updating pool: ", error);
        });
    }
    if (poolPicture) {
      var profilePictureRef = storageRef.child('profile-pictures').child(User.uid);
      profilePictureRef.put(file).then(function(snapshot) {


      });
    }
    if (poolStartDate) {
      poolRef.update({
          startDate: poolStartDate,
        })
        .then(function() {
          console.log("pool successfully updated!");
        })
        .catch(function(error) {
          console.error("Error updating pool: ", error);
        });
    }
    if (tags) {
      ///will be an array
      poolRef.update({
          tags: tags,
        })
        .then(function() {
          console.log("pool successfully updated!");
        })
        .catch(function(error) {
          console.error("Error updating pool: ", error);
        });
    }
  } else {
    //the pool does not exist so create a pool and set its information
    db.collection("pools").add({
        name: poolName,
        description: poolDescription,
        startDate: poolStartDate,
        tags: tags,
      })
      .then(function() {
        console.log("Successfully added a new pool!");
      })
      .catch(function(error) {
        console.error("Error adding pool: ", error);
      });
  }

}






/////