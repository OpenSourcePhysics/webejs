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

/*
  // -------------------------------
  // Implementation of ModelElement
  // -------------------------------
  
  public ImageIcon getImageIcon() { return ELEMENT_ICON; }
  
  public String getGenericName() { return "Accelerometer"; }
  
  public String getConstructorName() { return "accelerometer"; }
  
  public String getInitializationCode(String _name) { // Code for the LINT in JS
    return "var EJSS_HARDWARE = EJSS_HARDWARE || {};"; 
  }

  public String getSourceCode(String name) { // Code that goes into the body of the model 
    return "var " + name + " = EJSS_HARDWARE.accelerometer();";
  }  

  public String getImportStatements() { // Required for Lint
    return "Hardware/window_sensors.js"; 
  }

  // -------------------------------
  // Help and edition
  // -------------------------------

  public String getTooltip() {
    return "provides access to the built-in accelerometer";
  }
  
  @Override
  protected String getHtmlPage() { 
    return "org/colos/ejss/model_elements/hardware/Accelerometer.html"; 
  }
  
}
*/