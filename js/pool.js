async function featurePool(idToFeature) {
  app.preloader.show();
  console.log("Featureing pool id: " + idToFeature);

  await db.collection("universalData").doc("mainPage").update({
    featuredPool: idToFeature
  });

  let pic = $$('.feature-popup').find('.pic-input')[0].files[0];
  //Update the picture if it exists
  if (pic != null) { //If there is a picture upload it and display the progress
    console.log("uploading pic");

    var progress = 0;
    let progressDialog = app.dialog.progress('Uploading photo', progress);
    var uploadTask = storageRef.child('featured-pool-pic').put(pic);


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
        app.popup.close(".feature-popup");
        progressDialog.close();
        app.preloader.hide();
      });
  } else {
    console.log("No photo to upload.");
    app.popup.close(".feature-popup");
    app.preloader.hide();
  }
}