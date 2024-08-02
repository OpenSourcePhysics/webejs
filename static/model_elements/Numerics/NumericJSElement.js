/*
 * Copyright (C) 2024 Francisco Esquembre
 * 2024 01 Implementation of JS Model Elements to WebEJS
 */

var WebEJS_MODEL_ELEMENTS = WebEJS_MODEL_ELEMENTS || {};

/**
  * HardwareAccelerometer
  * Basic functions needed by WebEJS to generate the code for this model element
 **/
 
WebEJS_MODEL_ELEMENTS["org.colos.ejss.model_elements.numerics.NumericJavascriptElement"] = function() {
  var self = {};

  self.getGenericName = function() { return "NumericJS"; }

  self.getConstructorName = function() { return "numeric"; }

  self.getInitializationCode = function(name) { // Code for the LINT in JS
    return "var numeric = {};"; 
  }

  self.getSourceCode = function(name) { 
    return "var " + name + " = numeric;";
  }

  self.getImportStatements = function() { // Required for Lint
    return "Numerics/numeric-1.2.6.min.js"; 
  }

  return self;

};
