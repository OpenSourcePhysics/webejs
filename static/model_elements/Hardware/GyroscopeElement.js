/*
 * Copyright (C) 2024 Francisco Esquembre
 * 2024 01 Implementation of JS Model Elements to WebEJS
 */

var WebEJS_MODEL_ELEMENTS = WebEJS_MODEL_ELEMENTS || {};

/**
  * HardwareGyroscope
  * Basic functions needed by WebEJS to generate the code for this model element
 **/
 
WebEJS_MODEL_ELEMENTS["org.colos.ejss.model_elements.hardware.GyroscopeElement"] = function() {
  var self = {};

  self.getGenericName = function() { return "Gyroscope"; }

  self.getConstructorName = function() { return "gyroscope"; }

  self.getInitializationCode = function(name) { // Code for the LINT in JS
    return "var EJSS_HARDWARE = EJSS_HARDWARE || {};"; 
  }

  self.getSourceCode = function(name) { 
    return "var " + name + " = EJSS_HARDWARE.gyroscope();";
  }

  self.getImportStatements = function() { // Required for Lint
    return "Hardware/window_sensors.js"; 
  } 

  return self;

};

/*
  // -------------------------------
  // Implementation of ModelElement
  // -------------------------------
  
  public String getInitializationCode(String _name) { // Code for the LINT in JS
    return "var EJSS_HARDWARE = EJSS_HARDWARE || {};"; 
  }

  public String getSourceCode(String name) { // Code that goes into the body of the model 
    return "var " + name + " = EJSS_HARDWARE.gyroscope();";
  }  

  public String getImportStatements() { // Required for Lint
    return "Hardware/window_sensors.js"; 
  }

}
*/