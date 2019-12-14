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
    //self.app.views.main.router.navigate('/home/');
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

var loadedPools = []; //An array of all the pools we have loaded
function getPool(poolID, callback) {

  //If we have already loaded this users data then return it else load it from the database
  if (poolID in loadedPools) {
    console.log("found user in array");
    callback(loadedUsers[userID]);
  } else {
    var poolPic = "";

    // Create a reference to the file we want to download
    var poolPictureRef = storageRef.child('pool-pictures').child(poolID);

    // Get the download URL
    poolPictureRef.getDownloadURL().then(function(url) {
      poolPic = url;
    }).catch(function(error) {
      poolPic = "https://www.keypointintelligence.com/img/anonymous.png";
    }).then(function() {
      db.collection("pools").doc(poolID).get().then(function(poolData) {
        loadedPools[poolID] = {
          poolID: poolID,
          poolName: poolData.get("name"),
          description: poolData.get("description"),
          poolPic: poolPic,
        };
        //console.log("loaded user: " + userID);
        callback(loadedPools[poolID]);
      });
    });

  }
}