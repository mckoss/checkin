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

    document.querySelector('#login-button')
      .addEventListener('click', app.onLogin.bind(app));
    document.querySelector('#logout-button')
      .addEventListener('click', app.onLogout.bind(app));

    var eventTitle = document.querySelector('#event-title');
    var eventId = document.querySelector('#event-id');
    document.querySelector('#new-event-button')
      .addEventListener('click', function() {
        app.onNewEvent(eventId.value, eventTitle.value);
      });

    document.querySelector('#checkin-button')
      .addEventListener('click', function() {
        app.onCheckin(eventId.value);
      });

    setInterval(checkAnchor, 500);
  }

  var lastAnchor;
  function checkAnchor() {
    var hash = window.location.hash.slice(1);
    var checkinsDiv = document.querySelector('#checkins');
    var titleElement = document.querySelector('#event-heading');
    if (hash !== lastAnchor) {
      lastAnchor = hash;
      if (lastAnchor) {
        document.body.className = "event";
        app.showEvent(lastAnchor, titleElement, checkinsDiv);
        return;
      }
      checkinsDiv.innerHTML = '';
      document.body.className = "main";
    }
  }

  function CheckinApp() {
    this.root = new Firebase(ROOT);
    this.users = this.root.child('users');
    this.events = this.root.child('events');
    this.checkins = this.root.child('checkins');

    this.authPromise = authPromise(this.root);
    this.authPromise.then(function(auth) {
      this.auth = auth;
    }.bind(this));

    this.ready()
      .then(this.profileFromAuth.bind(this))
      .then(this.onProfile.bind(this));
  }

  CheckinApp.methods({
    onLogin: function() {
      console.log("Logging in...");
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

    onNewEvent: function(eventId, eventTitle) {
      console.log("Writing event: " + eventId);
      this.events.child(eventId).set({
        owner: this.profile.uid,
        title: eventTitle
      });
    },

    onCheckin: function(eventId) {
      if (!this.profile) {
        this.onLogin();
        return;
      }

      console.log("Checking in: " + eventId);
      if (!this.profile) {
        alert("Not yet signed in.");
        return;
      }
      this.checkins.push({
        eid: this.eventId,
        uid: this.profile.uid
      });
    },

    showEvent: function(eventId, titleElement, checkinsDiv) {
      var self = this;
      console.log("Showing checkins for " + eventId);
      if (this.lastEventHandler) {
        this.checkins.off("child_added", this.lastEventHandler);
      }
      this.eventId = eventId;
      this.events.child(eventId).once("value", function(snapshot) {
        var event = snapshot.val();
        titleElement.textContent = event.title;
      });
      this.checkinsDiv = checkinsDiv;
      this.checkinsDiv.innerHTML = "";
      this.lastEventHandler = this.checkins
        .orderByChild("eid").equalTo(eventId).on("child_added", function(snapshot) {
          var checkin = snapshot.val();
          self.users.child(checkin.uid).once("value", function(snapshot) {
            var profile = snapshot.val();
            self.onUserCheckin(profile);
          });
        });
    },

    onUserCheckin: function(profile) {
      console.log("User Checkin: ", profile);
      var root = document.createElement('div');
      root.className = 'attendee';
      root.innerHTML = '<img src="' + profile.image + '"><br>' + profile.name;
      prependChild(this.checkinsDiv, root);
    },

    ready: function() {
      return this.authPromise;
    }

  }); // CheckinApp.methods

  function prependChild(parent, newElement) {
    parent.insertBefore(newElement, parent.firstChild);
  }

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
