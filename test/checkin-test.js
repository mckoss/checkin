namespace.module('gdg-checkin.test', function(exports, require) {
  var checkin = require('gdg-checkin');
  require('namespace.funcs').patch();

  var FIREBASE_ROOT = 'https://gdg-checkin.firebaseio.com/';

  window.addEventListener('load', init);

  function init() {
  }

  QUnit.test("Checkin App", function(assert) {
    assert.ok(checkin.CheckinApp != undefined, "Checkin App defined.");
  });
});
