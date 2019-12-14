var app = new Framework7({
  root: '#app',
  name: 'My App',
  id: 'com.myapp.test',
  routes: [
    // Add your routes here
    // Example:
    /*
    {
      path: '/about/',
      url: 'about.html',
    },
    */
    {
      path: '/home/',
      url: 'index.html',
    },
    {
      path: '/login-screen/',
      url: 'pages/login.html',
      on: {
        pageInit: function(e, page) {
          //When the pages is Initialized setup the signIn button
          document.getElementById('sign-in-button').addEventListener('click', function() {
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
  var err = document.getElementById("errmsg");
  err.innerHTML = "";
  firebase.auth().signInWithEmailAndPassword(email, password).catch(function(error) {
    // Handle Errors here.
    var errorCode = error.code;
    var errorMessage = error.message;
    console.log("Failed to login: " + error.message);
    err.innerHTML = "Oops! " + error.message;
  }).then(function() {
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
    console.log("found pool in array");
    callback(loadedUsers[userID]);
  } else {
    var poolPic = "";
    // Create a reference to the file we want to download
    var poolPictureRef = storageRef.child('pool-pictures').child(poolID);
    // Get the download URL
    poolPictureRef.getDownloadURL().then(function(url) {
      poolPic = url;
    }).catch(function(error) {
      poolPic = "https://cdn.framework7.io/placeholder/nature-1000x600-3.jpg";
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

function loadPools() {
  //Get all pools in the database // TODO:only load the gloabal pools and maybe the most popular custom pools
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
        a.innerHTML = '<div style="background-image:url(https://cdn.framework7.io/placeholder/nature-1000x600-3.jpg)" class="card-header align-items-flex-end">' + pool.name + '</div>' +
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






/////