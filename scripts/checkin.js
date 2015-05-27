/*
 * Meetup Checkin App
 *
 */
namespace.module('gdg-checkin', function(exports, require) {
  var funcs = require('namespace.funcs');
  var promises = require('promise-wrapper');
  funcs.patch();

  var ROOT = "gdg-checkin.firebaseio.com";
  var IMAGE_SIZE = 150;
  var app;

  exports.extend({
    'CheckinApp': CheckinApp,
    'VERSION': '0.1.0'
  });

  window.addEventListener('load', init);

  function init() {
    app = new CheckinApp();
    document.querySelector('#checkin-button')
      .addEventListener('click', app.onCheckin.bind(app));
    document.querySelector('#logout-button')
      .addEventListener('click', app.onLogout.bind(app));
  }

  function CheckinApp() {
    this.root = new Firebase(ROOT);
    this.users = this.root.child("users");

    this.authPromise = authPromise(this.root);
    this.authPromise.then(function(auth) {
      this.auth = auth;
    }.bind(this));

    this.ready()
      .then(this.profileFromAuth.bind(this))
      .then(this.onProfile.bind(this));
  }

  CheckinApp.methods({
    onCheckin: function() {
      console.log("Checking in...");
      function errorHandler(error) {
        if (!error) {
          return;
        }
        console.log("Auth Error: " + error);
      }
      this.root.authWithOAuthRedirect('google', errorHandler, {
        scope: "profile,email"
      });
    },

    profileFromAuth: function(auth) {
      console.log("Checking auth: ", auth);
      this.getP = promises.get("https://www.googleapis.com/plus/v1/people/me",
                               {Authorization: "Bearer " + auth.google.accessToken});
      return this.getP.then(function(result) {
        console.log("Full profile", result);
        return {
          uid: auth.uid,
          name: result.displayName,
          email: auth.google.email,
          plusId: auth.google.id,
          quote: result.braggingRights || "",
          image: resize(result.image.url, IMAGE_SIZE)
        };
      });
    },

    onProfile: function(profile) {
      console.log("Profile:", profile);
      this.profile = profile;
      this.users.child(profile.uid).set(profile);
    },

    onLogout: function() {
      this.root.unauth();
    },

    ready: function() {
      return this.authPromise;
    }

  }); // CheckinApp.methods

  // Return a comparison function on (asc) property of args
  function compareProp(propName) {
    return function(a, b) {
      if (a[propName] < b[propName]) {
        return -1;
      }
      if (a[propName] > b[propName]) {
        return 1;
      }
      return 0;
    };
  }

  // Return a function with inverted compare sense.
  function compareDesc(fn) {
    return function(a, b) {
      return -fn(a, b);
    };
  }

  function authPromise(ref) {
    return new Promise(function(resolve, reject) {
      function onAuth(authData) {
        if (authData) {
          console.log('Authenticated: ', authData);
          resolve(authData);
          ref.offAuth(onAuth);
          return;
        }
      }

      ref.onAuth(onAuth);
    });
  }

  // Get Firebase value from a query as a Promise.
  function getValue(ref, allowNull) {
    return new Promise(function(resolve, reject) {
      ref.once('value',
               function(snap) {
                 var result = snap.val();
                 if (result === null && !allowNull) {
                   reject(new Error("No data at location: " + ref.toString()));
                   return;
                 }
                 resolve(result);
               },
               function(error) {
                 reject(new Error(error.toString()));
               });
    });
  }

  function setValue(ref, value) {
    return new Promise(function(resolve, reject) {
      ref.set(value, function(error) {
        if (error === null) {
          resolve(true);
        } else {
          reject(new Error(error.toString()));
        }
      });
    });
  }

  function pushValue(ref, value) {
    return new Promise(function(resolve, reject) {
      var pushRef = ref.push(value, function(error) {
        if (error === null) {
          resolve(pushRef);
        } else {
          reject(new Error(error.toString()));
        }
      });
    });
  }

  function resize(url, size) {
    return url.replace(/sz=[0-9]+/, "sz=" + size);
  }

});
