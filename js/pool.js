async function featurePool(idToFeature, featuredPic) {
  app.preloader.show();

  let mainPageData = (await db.collection("universalData").doc("mainPage").get()).data();

  //if this pool will replace another featuredpool then do some fancy code to confirm the admin wants to do this
  if (idToFeature != mainPageData.featuredPool) {
    app.preloader.hide();
    let confirmationPromise = new Promise(function(resolve, reject) {
      app.dialog.confirm("Featuring this pool will overwrite any other featured pools. Are you sure you wish to proceed?", function() {
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

}