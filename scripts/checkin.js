/*
 * Meetup Checkin App
 *
 */
namespace.module('gdg-checkin', function(exports, require) {
  var funcs = require('namespace.funcs');
  funcs.patch();

  exports.extend({
    'CheckinApp': CheckinApp,
    'VERSION': '0.1.0'
  });

  function CheckinApp() {
    this.root = new Firebase(firebasePath, new Firebase.Context());
    console.log('Firebase initialized');
    this.authPromise = authPromise(this.root);
    this.authPromise.then(function(auth) {
      this.auth = auth;
    }.bind(this));
  }

  CheckinApp.methods({
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

});
