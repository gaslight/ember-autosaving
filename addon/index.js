import Ember from 'ember';
var get = Ember.get;
var set = Ember.set;
var setProperties = Ember.setProperties;
var debounce = Ember.run.debounce;
var cancel = Ember.run.cancel;
var computed = Ember.computed;

function isConfiguredProperty(options, prop) {
  Ember.assert("You can configure the `only` option or the `except` option, but not both", !(options.only && options.except));

  if (options.only) {
    return options.only.indexOf(prop) !== -1;
  } else if (options.except) {
    return options.except.indexOf(prop) === -1;
  } else {
    return true;
  }
}

var AutosaveProxy = Ember.ObjectProxy.extend({
  _pendingSave: null,
  _previousContent: null,
  _content: null,
  _options: {},

  content: computed('content', {
    get: function(){
      return this._content;
    },
    set: function(key, value){
      this._flushPendingSave();
      this._content = value;
      return value;
    }
  }),

  setUnknownProperty: function(key, value) {
    set(this._content, key, value);

    if (isConfiguredProperty(this._options, key)) {
      this._pendingSave = debounce(this, this._save, get(this, '_saveDelay'));
    }
  },

  _save: function() {
    this._options.save(this._content);
    this._pendingSave = null;
  },

  unknownProperty: function(key) {
    return this._content.get(key);
  },

  willDestroy: function() {
    this._flushPendingSave();
  },

  _flushPendingSave: function() {
    if (this._pendingSave) {
      var context = this._pendingSave[0];
      var fn = this._pendingSave[1];

      // Immediately call the pending save
      fn.call(context);

      // Cancel the pending debounced function
      cancel(this._pendingSave);
    }
  },

  _saveDelay: computed('_options', function() {
    return get(this, '_options')['saveDelay'] ;
  }),
});

AutosaveProxy.reopenClass({
  defaultOptions: {
    // Executed with the context of the model
    save: function(model) {
      model.save();
    },

    saveDelay: 1000
  },

  config: function(options) {
    this.options = options;
  },

  create: function(attrs, options) {
    var obj = this._super(attrs);

    obj._options = Ember.copy(this.defaultOptions);
    setProperties(obj._options, this.options);
    setProperties(obj._options, options);

    return obj;
  }
});

export function computedAutosave(propertyName, options) {
  return computed(propertyName, {
    get: function(){
      return AutosaveProxy.create({ content: get(this, propertyName) }, options);
    },
    set: function(key, value){
      set(this, propertyName, value);
      return AutosaveProxy.create({ content: get(this, propertyName) }, options);
    }
  });
}

export default computedAutosave;

export var AutosaveProxy;
