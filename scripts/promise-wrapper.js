namespace.module("promise-wrapper", function (exports, require) {
  require('namespace.funcs').patch();

  exports.extend({
    'wrapSync': wrapSync,
    'wrapCallback': wrapCallback,
    'get': wrapSync(get),
    'Demand': Demand
  });

  // wrapSync promisify converts a synchronous function to one using promises
  // as arguments and returning a promise value.
  // v = fn(a, b, c, ...) => vP = fn(aP, bP, cP, ...)
  function wrapSync(fn) {
    return function() {
      // Note: w/o this array copy - the arguments argument is
      // modified before the Promise all is called???
      var args = Array.prototype.slice.call(arguments);
      return Promise.all(args).then(function (values) {
        return fn.apply(undefined, values);
      });
    }
  }

  // wrapCallback converts callback based function to promise
  // based one.
  //
  // fn(a, b, c, ..., callback) ... callback(v) => vP = fn(aP, bP, cP, ...)
  //
  // The signature for the callback is assumed to be called with
  // a singal value (which will be the resolution of the promise).
  function wrapCallback(fn) {
    return function() {
      // Note: w/o this array copy - the arguments argument is
      // modified before the Promise all is called???
      var args = Array.prototype.slice.call(arguments);
      return Promise.all(args).then(function (values) {
        return new Promise(function (resolve, reject) {
          values.push(resolve);
          fn.apply(undefined, values);
        });
      });
    }
  }

  // Helper to make Promise version of XHR.
  function get(url) {
    return new Promise(function(resolve, reject) {
      var req = new XMLHttpRequest();

      req.open('GET', url);

      req.onload = function() {
        var result;

        if (req.status == 200) {
          try {
            result = JSON.parse(req.response);
          } catch (e) {
            reject(e);
            return;
          }
          resolve(result);
        } else {
          reject(new Error(req.statusText));
        }
      };

      req.onerror = function() {
        reject(Error("Network Error"));
      };

      req.send();
    });
  }

  // A Demand is like a Promise but the executor function will not be
  // called until the first time the then function is called (i.e.
  // the promise only tries to execute when a value is requested from it).
  function Demand(fnExec) {
    this.fnExec = fnExec;
  }

  Demand.methods({
    then: function (fnResolve, fnReject) {
      if (this.promise === undefined) {
        this.promise = new Promise(this.fnExec);
      }

      this.promise.then(fnResolve, fnReject);
    },

    catch: function(fnReject) {
      return this.then(undefined, fnReject);
    }
  });

  // TODO:
  // autoRetry(fn, retries) - Retries a promise returning function
  // timeoutPromise(fn, ms) - reject the promise if it has not completed in ms time
});
