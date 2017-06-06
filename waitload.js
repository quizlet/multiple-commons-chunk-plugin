// Call QWait('xxx', 'yyy'[, 'zzz' ...], do_stuff)
// to execute do_stuff when xxx, yyy, and zzz have all
// been loaded by QLoad
var preWait = window.QWait.p || [],
  preLoad = window.QLoad.p || [],
  unfired = [],
  loaded = {};

QWait = function() {
  var labels = arguments,
    // .pop() doesn't work on `arguments`
    // so just keep in mind that labels
    // also holds the function as the last value
    label_length = labels.length - 1,
    func = labels[label_length],
    unloaded_labels = [],
    i = label_length;

  // filter out labels we've already loaded
  while (i--) {
    if (!loaded.hasOwnProperty(labels[i])) {
      unloaded_labels.push(labels[i]);
    }
  }

  // if we have more than 0 unloaded labels, save this function
  // to be executed when all labels have been loaded
  if (unloaded_labels.length) {
    unfired.push({ labels: unloaded_labels, func: func });
  } else {
    func();
  }
};

// Call QLoad('xxx') to register 'xxx' as available
QLoad = function(label) {
  var i, m, j, curlabel_length;

  // Iterate over all unfired functions, looking for ones to fire
  for ((i = 0), (m = unfired.length); i < m; i++) {
    j = curlabel_length = unfired[i].labels.length;
    // see if this unfired function has the label we need
    while (j--) {
      if (unfired[i].labels[j] === label) {
        unfired[i].labels.splice(j, 1);
        // if that was the last remaining label, we can
        // fire this function.
        // it's possible this func will call QLoad itself,
        // in which case we re-invoke this function because
        // we've changed the underlying data structure and it's
        // easier to start with the variables reset
        if (curlabel_length === 1) {
          unfired.splice(i, 1)[0].func();
          QLoad(label);
          return;
        }
        break;
      }
    }
  }

  // remember that we've already loaded this for future waiters
  loaded[label] = 1;
};

preLoad.forEach(function(args) {
  QLoad.apply(window, args);
});

preWait.forEach(function(args) {
  QWait.apply(window, args);
});

// debug unfired labels (everything should have loaded after 20 secs)
setTimeout(function() {
  var i = unfired.length, alreadyWarned = {}, suffix = '';

  while (i--) {
    suffix = unfired[i].labels.join(',');
    if (!alreadyWarned[suffix]) {
      Rollbar.warning('QWait pending ' + suffix, {
        done: Object.keys(loaded),
      });
      alreadyWarned[suffix] = 1;
    }
  }
}, 20000);

if ('readyState' in document) {
  if (document.readyState === 'complete') QLoad('dom');
  document.onreadystatechange = function() {
    if (document.readyState === 'complete') {
      QLoad('dom');
    }
  };
}
