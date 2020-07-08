function featurePool(idToFeature) {
    console.log("Featureing pool id: " + idToFeature);
    db.collection("universalData").doc("mainPage").update({ featuredPool: idToFeature }).then(result => {
        console.log(result);
    }).catch(error => {
        console.error(error);
    });
}