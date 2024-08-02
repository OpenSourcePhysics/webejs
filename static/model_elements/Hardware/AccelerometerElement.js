/*
 * Copyright (C) 2024 Francisco Esquembre
 * 2024 01 Implementation of JS Model Elements to WebEJS
 */

var WebEJS_MODEL_ELEMENTS = WebEJS_MODEL_ELEMENTS || {};

/**
 * HardwareAccelerometer
 * Basic functions needed by WebEJS to generate the code for this model element
**/

WebEJS_MODEL_ELEMENTS["org.colos.ejss.model_elements.hardware.AccelerometerElement"] = function() {
  var self = {};

  self.getGenericName = function() { return "Accelerometer"; }

  self.getConstructorName = function() { return "accelerometer"; }

  self.getInitializationCode = function(name) { // Code for the LINT in JS
    return "var EJSS_HARDWARE = EJSS_HARDWARE || {};"; 
  }

  self.getSourceCode = function(name) { 
    return "var " + name + " = EJSS_HARDWARE.accelerometer();";
  }

  self.getImportStatements = function() { // Required for Lint
    return ""; 
  } 
  
  return self;
};
