/*
 * Copyright (C) 2024 Francisco Esquembre
 * This code is part of the WebEJS authoring and simulation tool
 */

/**
 * Generation tools
 * @module generation
 */

var WebEJS_GEN = WebEJS_GEN || {};

/**
 * Static class to generate the model HTML code
 * @class simulation 
 */

WebEJS_GEN.generate_code = {
  
	// ----------------------------------------------------
	// UTILS
  // ----------------------------------------------------

	addListing : function(code, listing, prefix, comment) {
    var count = 0
    //print ("Listing : <",listing,'>')
    //print ("Lines : ",listing.split('\n'))
    for (const line of listing.split('\n')) {
      count += 1;
      code.push(prefix+line+" // > "+comment+" - line " + count);
    }
  },

	// ------------------------------
  // Code generation
	// ------------------------------

	appendCodeEnabled : function(code, pages) {
    for (const page of pages) {
      const name = page['Name'].trim();
      const active = page['Active'];
      code.push("    __pagesEnabled['"+name+"'] = "+active+";");
    }
  },

  appendInitializationCode : function(code, initialization_pages) {
    for (const page of initialization_pages) {
      const name = page['Name'].trim();
      const pagecode = page['Code'];
      code.push("  _model.addToInitialization(function() {");
      code.push("    if (!__pagesEnabled['"+name+"']) return;");
      WebEJS_GEN.generate_code.addListing(code,pagecode,'    ', "Initialization page: " + name);
      code.push("  });\n");
    }
  },

  appendFixedRelationsCode : function(code, fixed_relations_pages) {
    for (const page of fixed_relations_pages) {
      const name = page['Name'].trim();
      const pagecode = page['Code'];
      code.push("  _model.addToFixedRelations(function() {");
      code.push("    if (!__pagesEnabled['"+name+"']) return;");
      WebEJS_GEN.generate_code.addListing(code,pagecode,'    ', "Fixed Relations page: " + name);
      code.push("  });\n");
    }
  },

  appendCustomCode : function(code, custom_pages) {
    for (const page of custom_pages) {
      if (page['Active']!="true") continue;
      const name = page['Name'].trim();
      const pagecode = page['Code'];
      WebEJS_GEN.generate_code.addListing(code,pagecode,'  ', "Custom code page: " + name);
      code.push("");
    }
  },
	
	// --------------------------------
  // Evolution code
  // --------------------------------

  appendEvolutionEnabled : function(code, pages) {
    for (const page of pages) {
      const name = page['Name'].trim();
      const active = page['Active'];
      code.push("    __pagesEnabled['"+name+"'] = "+active+";");
      if (page['Type'] == "ODE_EDITOR") {
        if ('Events' in page) {
          for (const inner_page of page['Events']['pages']) {
            const inner_name   = inner_page['Name'].trim();
            const inner_active = inner_page['Active'];
            code.push("    __pagesEnabled['"+inner_name+"'] = "+inner_active+";");
          }
        }
        if ('Discontinuities' in page) {
          for (const inner_page of page['Discontinuities']['pages']) {
            const inner_name   = inner_page['Name'].trim();
            const inner_active = inner_page['Active'];
            code.push("    __pagesEnabled['"+inner_name+"'] = "+inner_active+";");
          }
        }
        if ('ErrorHandling' in page) {
          for (const inner_page of page['ErrorHandling']['pages']) {
            const inner_name   = inner_page['Name'].trim();
            const inner_active = inner_page['Active'];
            code.push("    __pagesEnabled['"+inner_name+"'] = "+inner_active+";");
          }
        }
      }
    }
  },

  appendEvolutionResetCode : function(code, numODEs) {
    code.push("  _model.addToReset(function() {");
    code.push("    _privateOdesList=[];");
    for (var i=1; i<=numODEs; i++) {
      code.push("    _ODEi_evolution"+i+" = _ODE_evolution"+i+"();");
      code.push("    _privateOdesList.push(_ODEi_evolution"+i+");");
    }
    code.push("  })\n");
    return numODEs;
  },


  appendEvolutionCode : function(code, evolution_pages, numODEs) {
    if (numODEs > 0) {
      code.push("  _model.addToInitialization(function() {");
      code.push("    _initializeSolvers();");
      code.push("  });");
      code.push("");
    }
        
    // evolution (including ODEs, because order is important)
    var odeCounter = 0;
    for (const page of evolution_pages) {
      const name = page['Name'].trim();
      code.push("  _model.addToEvolution(function() {");
      code.push("    if (!__pagesEnabled['"+name+"']) return;");
      if (page['Type'] == "ODE_EDITOR") { 
        odeCounter += 1;
        code.push("    _ODEi_evolution"+odeCounter+".step();");
      }
      else {
        pagecode = page['Code'];
        WebEJS_GEN.generate_code.addListing(code,pagecode,'  ', "Evolution page: " + name);
      }
      code.push("  })\n");
    }
  },
	
};
	

/*
 * Copyright (C) 2024 Francisco Esquembre
 * This code is part of the WebEJS authoring and simulation tool
 */

/**
 * Generation tools
 * @module generation
 */

var WebEJS_GEN = WebEJS_GEN || {};

/**
 * Static class to generate the model HTML code
 * @class simulation 
 */

WebEJS_GEN.generate_model = {
  
	// ----------------------------------------------------
  // Static methods
  // ----------------------------------------------------

  getModelCode : function(simulation, fullModel) {
    const model = simulation['model'];
    const variable_pages = model['variables']['pages'];
    const evolution_pages = fullModel ? model['evolution']['pages'] : null;
    var numODEs = 0;

    var code = [];
    code.push("function _simulation (_topFrame, _libraryPath, _codebasePath, _inputParameters) {");
    WebEJS_GEN.generate_model.__appendInitialCode(code,model,fullModel);
    WebEJS_GEN.generate_variables.appendDefinition(code, variable_pages);

    if (fullModel) {
      WebEJS_GEN.generate_variables.appendSerializeCode(code, variable_pages);

      for (const page of evolution_pages) if (page['Type'] == "ODE_EDITOR") numODEs++;
      WebEJS_GEN.generate_ode.appendODEdeclaration(code, numODEs);
      
      // resetting pages enabled
      code.push("  _model.addToReset(function() {");
      WebEJS_GEN.generate_code.appendCodeEnabled(code,model['initialization']['pages']);
      WebEJS_GEN.generate_code.appendEvolutionEnabled(code,evolution_pages);
      WebEJS_GEN.generate_code.appendCodeEnabled(code,model['fixed_relations']['pages']);
      code.push("  });\n")
    }
    
    WebEJS_GEN.generate_variables.appendReset(code, variable_pages);
    
    if (fullModel) {
      code.push("  if (_inputParameters) {");
      code.push("    _inputParameters = _model.parseInputParameters(_inputParameters);");
      code.push("    if (_inputParameters) _model.addToReset(function() { _model._readParameters(_inputParameters); });");
      code.push("  }\n");

      // evolution's ODEs
      if (numODEs>0) WebEJS_GEN.generate_ode.appendODEreset(code, numODEs);

      // reset Model parameters
      const pauseOnExit = (simulation['information']['RunAlways']=="false") ? 'true' : 'false';
      code.push("  _model.addToReset(function() {");
      WebEJS_GEN.generate_model.__appendModelParametersCode(code, model['evolution'], '    ', pauseOnExit);
      code.push("  });\n");
    }
    
    // Custom code goes first to avoid "used before defined" messages
    WebEJS_GEN.generate_code.appendCustomCode (code, model['custom']['pages']);

    if (fullModel) {
      WebEJS_GEN.generate_code.appendInitializationCode(code,model['initialization']['pages']);
      WebEJS_GEN.generate_code.appendEvolutionCode     (code,evolution_pages,numODEs);

      code.push("  _model.addToFixedRelations(function() { _isPaused = _model.isPaused(); _isPlaying = _model.isPlaying(); });\n");
      WebEJS_GEN.generate_code.appendFixedRelationsCode(code,model['fixed_relations']['pages']);
      code.push("  // Intentionally repeated"); 
      code.push("  _model.addToFixedRelations(function() { _isPaused = _model.isPaused(); _isPlaying = _model.isPlaying(); });\n");
    
      if (numODEs > 0) {
        var ode_pages = [];
        for (const page of evolution_pages)
          if (page['Type'] == "ODE_EDITOR") ode_pages.push(page);
        WebEJS_GEN.generate_ode.appendODEcode(code,ode_pages,variable_pages,true);
      }
    }

    // and that's it!
    code.push("  _model._fontResized = function(iBase,iSize,iDelta) {")
    code.push("    _view._fontResized(iBase,iSize,iDelta);")
    code.push("  }; // end of _fontResized\n")

    const view = simulation['view'];
    const variables_list = WebEJS_GEN.generate_variables.getVariableList(variable_pages);
    WebEJS_GEN.generate_view.appendCreationCode(code, view, variables_list, fullModel);
    
    if (fullModel) {
      WebEJS_GEN.generate_model.__appendModelParametersCode(code, model['evolution'], '  ', ''); // No pause on exit
    }  
    
    code.push("  _createView(); // this includes _model.reset()")
    code.push("  return _model;")
    code.push("}\n");

    const description_pages = fullModel ? simulation['description']['pages'] : [];
    return {
      'model': code.join('\n'),
      'view': WebEJS_GEN.generate_view.getTreeCode(view['Tree'], description_pages, variables_list, fullModel)
    };
    
  },

	// ------------------------------
	// UTILS
	// ------------------------------

	__appendInitialCode : function(code, model, fullmodel) {
		code.push(WebEJS_GEN.generate_model.__INITIAL_CODE);
		if (fullmodel) {
			WebEJS_GEN.generate_model.__addElementsCode(code, model);
			code.push(WebEJS_GEN.generate_model.__FULLMODEL_ADDITIONAL_CODE);
		}
	},

	__appendModelParametersCode : function(code, evolution, prefix, pause_on_exit) {
		// reset Model parameters
		var useAutoPlay = false;
		for (const page of evolution['pages']) {
			if (page['Active']=="true") {
				useAutoPlay = true;
				break;
			}
		}
		const evolution_info = evolution['information'];
		if (useAutoPlay) {
			code.push(prefix+ "_model.setAutoplay("+evolution_info['Autoplay']+");");
			if (pause_on_exit)
				code.push(prefix+"_model.setPauseOnPageExit("+pause_on_exit+");");
		}
		else code.push(prefix+"_model.setAutoplay(false);");

		if (evolution_info['FPS'].trim()) 
			code.push(prefix+"_model.setFPS("+evolution_info['FPS']+");");
		else 
			code.push(prefix+"_model.setFPS(10);");
		if (evolution_info['SPD'].trim())
			code.push(prefix+"_model.setStepsPerDisplay("+evolution_info['SPD']+");");
		else
			code.push(prefix+"_model.setStepsPerDisplay(1);");
	},

	// --------------------------
	// Model elements
	// --------------------------

	__getElementInfo : function(classname, list) {
		for (const group of list) {
			if ('elements' in group)
					for (const element of group['elements']) 
							if (element['classname']==classname)
								return element;
		}
		console.error("----->>>>> ERROR IN GENERATING MODEL ELEMENTS");
		console.error ("  : classname not supported: "+classname);
		return null;
	},

	addElementsScriptCode : function(code, model, fullmodel) {
		const model_elements = model['elements']['list'];
		if (model_elements.length<=0) return;

		const system_elements = sMainGUI.getSystemInformation('model_elements'); 
		if (fullmodel) {
			const jsList = []
			for (const element of model_elements) {
				const info = WebEJS_GEN.generate_model.__getElementInfo(element['Classname'],system_elements);
				if (info) {
					for (const jsLib of info['js']) 
						if (!jsList.includes(jsLib))
							jsList.push(jsLib);
				}
			}	
			for (const jsLib of jsList) 
				code.push("<script src='"+sMainGUI.getSystemInformation('model_elements_folder')+jsLib+"'></script>"); // TODO
		}
		else {
			var lintList = [];
			var codeList = [];
			for (const element of model_elements) {
				const info = WebEJS_GEN.generate_model.__getElementInfo(element['Classname'],system_elements);
				if (info) {
							const named_lint_code = info['lint_code'].replaceAll('{{NAME}}',element['Name']);
							if (!lintList.includes(named_lint_code))
								lintList.push(named_lint_code);
							const named_code = info['source_code'].replaceAll('{{NAME}}',element['Name']);
							if (!codeList.includes(named_code))
									codeList.push(named_code);
				}
			}
			code.push("<script type=\"text/javascript\"><!--//--><![CDATA[//><!--");

			for (const lintCode of lintList)
					code.push('      '+lintCode);
			code.push('');
			for (const sourceCode of codeList)
					code.push('      '+sourceCode);            
			code.push("//--><!]]></script>\n");
		}
	},

	__addElementsCode : function(code, model) {
		const model_elements = model['elements']['list'];
		if (model_elements.length<=0) return
		const system_elements = sMainGUI.getSystemInformation('model_elements');
		for (const element of model_elements) {
			const info = WebEJS_GEN.generate_model.__getElementInfo(element['Classname'],system_elements);
			if (info) {
				const named_code = info['source_code'].replaceAll('{{NAME}}',element['Name']);
				code.push('  ' + named_code);
			}
		}
	},

	// --------------------------------
  // Constant pieces
  // --------------------------------

	__INITIAL_CODE : `
  var _model = EJSS_CORE.createAnimationLMS();
  var _view;
  var _isPlaying = false;
  var _isPaused = true;
  var _isEPub = false;
  var _isMobile = (navigator===undefined) ? false : navigator.userAgent.match(/iPhone|iPad|iPod|Android|BlackBerry|Opera Mini|IEMobile/i);

  var _stringProperties = {};
  var _tools = {
    showInputDialog : EJSS_INTERFACE.BoxPanel.showInputDialog,
    showOkDialog : EJSS_INTERFACE.BoxPanel.showOkDialog,
    showOkCancelDialog : EJSS_INTERFACE.BoxPanel.showOkCancelDialog,
    downloadText: EJSS_TOOLS.File.downloadText,
    uploadText: function(action) { EJSS_TOOLS.File.uploadText(_model,action); } 
  };

  function _play()  { _isPaused = false; _isPlaying = true;  _model.play();  }
  function _pause() { _isPaused = true;  _isPlaying = false; _model.pause(); }
  function _step()  { _pause();  _model.step(); }
  function _reset() { _model.reset();  _isPaused = _model.isPaused(); _isPlaying = _model.isPlaying(); }
  _model._play  = _play;
  _model._pause = _pause;
  _model._step  = _step;
  _model._reset = _reset;`,

__FULLMODEL_ADDITIONAL_CODE : `
  function _update() { _model.update(); }
  function _initialize() { _model.initialize(); }
  function _setFPS(_fps) { _model.setFPS(_fps); }
  function _setDelay(_delay) { _model.setDelay(_delay); }
  function _setStepsPerDisplay(_spd) { _model.setStepsPerDisplay(_spd); }
  function _setUpdateView(_updateView) { _model.setUpdateView(_updateView); }
  function _setAutoplay(_auto) { _model.setAutoplay(_auto); }
  function _println(_message) { console.log(_message); }
  function _breakAfterThisPage() { _model.setShouldBreak(true); }
  function _resetSolvers() { if (_model.resetSolvers) _model.resetSolvers(); }
  function _saveText(name,type,content) { if (_model.saveText) _model.saveText(name,type,content); }
  function _saveState(name) { if (_model.saveState) _model.saveState(name); }
  function _saveImage(name,panelname) { if (_model.saveImage) _model.saveImage(name,panelname); }
  function _readState(url,type) { if (_model.readState) _model.readState(url,type); }
  function _readText(url,type,varname) { if (_model.readText) _model.readText(url,type,varname); }
  // Is this still needed if we don't have locales???
  function _getStringProperty(propertyName) {
    var _value = _stringProperties[propertyName];
    if (_value===undefined) return propertyName;
    else return _value;
  }

  var __pagesEnabled = [];
  function _setPageEnabled(pageName,enabled) { __pagesEnabled[pageName] = enabled; }
`

};
	

/*
 * Copyright (C) 2024 Francisco Esquembre
 * This code is part of the WebEJS authoring and simulation tool
 */

/**
 * Generation tools
 * @module generation
 */

var WebEJS_GEN = WebEJS_GEN || {};

/**
 * Static class to generate the HTML code for ODEs
 */

WebEJS_GEN.generate_ode = {
  
	// ----------------------------------------------------
	// ODE Evolution code
  // ----------------------------------------------------

  appendODEdeclaration : function(code, numODEs) {
    const odes_names = []
    if (numODEs>0) {
      code.push("  var _privateOdesList;");
      for (var i=1; i<=numODEs; i++) {
        code.push("  var _ODEi_evolution"+i+";");
        if (i==1) odes_names.push("_ODEi_evolution" + i);
        else      odes_names.push(",_ODEi_evolution" + i);
        code.push("  var _userEvents"+i+" = [];\n");
      }
    }
    code.push("  _model.getOdes = function() { return ["+odes_names.join('')+"]; }\n");
    code.push("  _model.removeEvents = function(){");
    for (var i=1; i<=numODEs; i++) code.push("    _userEvents"+i+" = [];");
    code.push("  }\n");
  },

  appendODEreset : function(code, numODEs) {
    code.push("  _model.addToReset(function() {");
    code.push("    _privateOdesList=[];");
    for (var i=1; i<=numODEs; i++) {
      code.push("    _ODEi_evolution"+i+" = _ODE_evolution"+i+"();");
      code.push("    _privateOdesList.push(_ODEi_evolution"+i+");");
    }
    code.push("  });\n");
  },

  appendODEcode : function(code, ode_pages, variable_pages, fullmodel) {
    if (!fullmodel) { // just declare empty historic functions
      for (const page of ode_pages) 
        for (const equation of page['Equations']) 
          if (equation['state'].trim())
            code.push("  function _historic_"+equation['state']+"(__time) {}");
      return
    }

    code.push(WebEJS_GEN.generate_ode.INIT_SOLVER_PIECE)

    // BLOCKLY
    code.push("  _getODE = function (_odeName) {");
    var counter = 1;
    for (const page of ode_pages) {
      code.push("    if (_odeName=='"+page['Name']+"') return _ODEi_evolution"+counter+";");
      counter++;
    }
    code.push("    return null;");
    code.push("  }");

    code.push(WebEJS_GEN.generate_ode.GET_EVENT_SOLVER_PIECE);
    counter = 1;
    for (const page of ode_pages) {
      const ode_code = WebEJS_GEN.generate_ode.oneODE(page, counter, variable_pages);
      ode_code.appendCode(code);
      ode_code.appendHistoricFunctionsCode(code);
      counter++;
    }
  },


	// ------------------------------
  // Inner class
	// ------------------------------

  oneODE : function(ode_page, page_counter, variable_pages) {
    var self = {};

    self.odePage = ode_page;
    self.pageIndex = page_counter;

    self.indepVar = ode_page['IndependentVariable'];
    self.eqnList = [];
    self.followedByDerivative = [];
    
    for (const equation of ode_page['Equations']) {
      const state = equation['state'].trim();
      const rate = equation['rate'].trim();
      if (state.length <= 0 || rate.length <= 0) continue;

      if (rate.endsWith(';')) rate = rate.slice(0, -1);
      const indexInState = state.indexOf('[');
      var isArray = true;
      if (indexInState < 0) // If is has no [] or [i], it could still be an array.
        isArray = WebEJS_GEN.generate_variables.isArrayOfDouble(variable_pages, state); // ask the variables editor

      if (isArray) {
        if (indexInState < 0) { // Check if the rate is an array, too.
          const isRateAnArray = WebEJS_GEN.generate_variables.isArrayOfDouble(variable_pages, rate);
          if (isRateAnArray) self.eqnList.push({ 'state': state, 'index': '__i', 'rate': rate + "[__i]" }); // Standard index + add index to rate
          else self.eqnList.push({ 'state': state, 'index': '__i', 'rate': rate });         // Standard index + add index to rate
        }
        else { // get the index
          // tokens = re.findall("\[(.*?)\]", state)
          const tokens = [];
          for (const tk of state.split(/\s+|\[|\]/)) if (tk) tokens.push(tk);
          const theState = tokens.pop(0)
          if (tokens.len <= 0) self.eqnList.push({ 'state': theState, 'rate': rate }); // No index
          else self.eqnList.push({ 'state': theState, 'index': tokens.pop(0), 'rate': rate }); // f.i. x[i]
        }
      }
      else self.eqnList.push({'state' : state, 'rate' : rate }); // No index
    }

    // See which states are followed by their derivatives
    if (self.eqnList.length>0) {
      var lastRate = self.eqnList[0]["rate"];
      for (var i=1; i<self.eqnList.length; i++) {
        const equation = self.eqnList[i];
        var thisState = equation["state"];
        if ('index' in equation) thisState += "["+equation["index"]+"]";
        if (thisState==lastRate) self.followedByDerivative.push(self.eqnList[i-1]);
        lastRate = equation["state"];
      }
    }

    // Check Verlet ordering
    if (ode_page['Method'].toLowerCase().indexOf("verlet")>=0) {
      for (var i=0; i<self.eqnList.length-1; i+=2) {
        if (! self.followedByDerivative.includes(self.eqnList[i])) 
          alert('ODE error! Verlet order not respected in ODE page : ' + ode_page['Name']);
      }
    }
    //print ("Equations = ",self.eqnList)

  self.appendHistoricFunctionsCode = function(code) {
    const odeName = "_ODEi_evolution" + self.pageIndex;
    var totalSizeStr = "0";
    for (const equation of self.eqnList) {
      const state = equation['state'];
      code.push("  function _historic_"+state+"(__time) {");
      if ('index' in equation) {
        const length = state + '.length';
        code.push("    var __beginIndex = "+totalSizeStr+";");
        code.push("    return "+odeName+".getEventSolver().getStateHistory().interpolate(__time,new Array("+length+"),__beginIndex,"+length+");" );
        code.push("  }\n")
        totalSizeStr += " + " + length;
      }
      else {
        code.push("    var __index = "+totalSizeStr+";");
        code.push("    return "+odeName+".getEventSolver().getStateHistory().interpolate(__time,_index);");
        code.push("  }\n");
        totalSizeStr += " + 1 ";
      }
    }
  }

  self.appendCode = function(code) {
    const pageName    = self.odePage['Name'];
    // NOTE: Paco says... should'nt this be the other way round??? (i.e. with "true")
    const includeSynchronization = "false" == self.odePage['ForceSynchronization'];
    // State templates
    const setStateTemplate        = self.__setStateFromVariablesTemplate(false);
    const setStateTemplateSynchro = includeSynchronization ? self.__setStateFromVariablesTemplate(true) : setStateTemplate;
    const getStateTemplate        = self.__getVariablesFromStateTemplate(false);
    const getStateTemplateTemp    = self.__getVariablesFromStateTemplate(true);

    const eventPages   = ('Events' in self.odePage) ? self.odePage['Events']['pages'] : [];
    const discPages    = ('Discontinuities' in self.odePage) ? self.odePage['Discontinuities']['pages'] : [];
    
    code.push("  function _ODE_evolution"+self.pageIndex+"() {");
    code.push("    var __odeSelf = {};");
    code.push("    var __eventSolver;");
    code.push("    var __solverClass = _getEngineSolverClass('"+self.odePage['Method']+"');");
    code.push("    var __state=[];");

    for (var counter=1; counter<=eventPages.length; counter++)
      code.push("    var _ODE_evolution"+self.pageIndex+"_Event"+counter+";");

    for (var counter=1; counter<=discPages.length; counter++)
      code.push("    var _ODE_evolution"+self.pageIndex+"_Discontinuity"+counter+";");

    if (self.odePage['ErrorHandling']['pages'].length<=0)
      code.push("    var __ignoreErrors=false;");

    code.push("    var __mustInitialize=true;");
    code.push("    var __isEnabled=true;");
    code.push("    var __mustUserReinitialize=false;");
    if (includeSynchronization) code.push("    var __mustReinitialize=true;\n");

    for (const equation of self.eqnList) {
      if ('index' in equation) code.push("    var _"+equation['state']+"Length;");
    }

    // BLOCKLY
    code.push("\n    __odeSelf._getOdeVars = function (){ return "+self.__getVarsNames()+"; }\n");
    // END OF BLOCKLY

    code.push("    __odeSelf.setSolverClass = function(__aSolverClass) {");
    code.push("      __solverClass = __aSolverClass;");
    code.push("      __instantiateSolver();");
    code.push("    }\n");

    code.push("    function __instantiateSolver() {");
    code.push("      __state=[];");
    for (const equation of self.eqnList) {
      if ('index' in equation) code.push("      _"+equation['state']+"Length = "+equation['state']+".length;");
    }
    code.push("      __pushState();");
    code.push("      __eventSolver = EJSS_ODE_SOLVERS.interpolatorEventSolver(__solverClass(),__odeSelf);");
    code.push("      __mustInitialize = true;");
    code.push("    }\n");

    code.push("    __odeSelf.setEnabled = function(_enabled) { __isEnabled = _enabled; }\n");

    code.push("    __odeSelf.getIndependentVariableValue = function() { return __eventSolver.getIndependentVariableValue(); }\n");

    code.push("    __odeSelf.getInternalStepSize = function() { return __eventSolver.getInternalStepSize(); }\n");

    code.push("    __odeSelf.isAccelerationIndependentOfVelocity = function() { return "+self.odePage['AccelerationIndependentOfVelocity']+"; }\n");

    code.push("    __odeSelf.initializeSolver = function() {");
    code.push("      if (__arraysChanged()) { __instantiateSolver(); __odeSelf.initializeSolver(); return; }");
    code.push("      __pushState();");

    //print ('ODE = ',self.odePage)       

    const stepSize      = ('Increment'    in self.odePage) ? self.odePage['Increment'].trim()    : '0';
    const intStepSize   = ('InternalStep' in self.odePage) ? self.odePage['InternalStep'].trim() :  '';
    const historyLength = ('MemoryLength' in self.odePage) ? self.odePage['MemoryLength'].trim() :  '';
    const maxStep       = ('MaximumStep' in self.odePage)  ? self.odePage['MaximumStep'].trim()  :  '';
    const maxNumberOfSteps = self.odePage['MaximumNumberOfSteps'].trim();

    if (intStepSize) code.push("      __eventSolver.initialize("+intStepSize+");");
    else             code.push("      __eventSolver.initialize("+stepSize+");");
    code.push("      __eventSolver.setBestInterpolation("+self.odePage['UseBestInterpolation']+");");
    if (historyLength) code.push("      __eventSolver.setHistoryLength("+historyLength+");");
    if (maxStep)       code.push("      __eventSolver.setMaximumInternalStepSize("+maxStep+");");
    if (maxNumberOfSteps) code.push("      __eventSolver.setMaximumInternalSteps("+maxNumberOfSteps+");");

    code.push("      __eventSolver.removeAllEvents();");

    for (var counter=1; counter<=eventPages.length; counter++) {
      const eventPage = eventPages[counter-1]
      code.push("      if (__pagesEnabled['"+eventPage['Name']+"']) __eventSolver.addEvent(_ODE_evolution"+self.pageIndex+"_Event"+counter+"());");
    }

    for (var counter=1; counter<=discPages.length; counter++) {
      const discPage = discPages[counter-1]
      code.push("      if (__pagesEnabled['"+discPage['Name']+"']) __eventSolver.addDiscontinuity(_ODE_evolution"+self.pageIndex+"_Discontinuity"+counter+"());");
    }

    // FOR BLOCKLY 
    code.push("      for (k in _userEvents"+self.pageIndex+") {__eventSolver.addEvent(_userEvents"+self.pageIndex+"[k]);}");
    // END OF BLOCKLY

    if ('ZenoEffect' in self.odePage) {
      if (self.odePage['ZenoEffect']['Code']) code.push("      __eventSolver.addZenoEffectListener(__odeSelf);");
    }

    code.push("      __eventSolver.setEstimateFirstStep("+self.odePage['EstimateFirstStep']+");");
    code.push("      __eventSolver.setEnableExceptions(false);");

    const absTol = self.odePage['AbsoluteTolerance'].trim();
    var toleranceStr = '';
    if (absTol) {
        var relTol = ('RelativeTolerance' in self.odePage) ? self.odePage['RelativeTolerance'].trim() : null;
        if (!relTol) relTol = absTol;
        toleranceStr = "setTolerances("+absTol+","+relTol+")";
    }
    if (toleranceStr) code.push("      __eventSolver."+toleranceStr+";");
    if (includeSynchronization) code.push("      __mustReinitialize = true;");
    code.push("      __mustInitialize = false;");
    code.push("    }\n");

    code.push("    function __pushState() {");
    //code.push(self.__setStateFromVariablesCode("__state",includeSynchronization))
    code.push(setStateTemplateSynchro.replaceAll('{{PREFIX}}','      ').replaceAll('{{STATE_STR}}',"__state"));
    
    code.push("    }\n");

    code.push("    function __arraysChanged () {");
    for (var i=0; i<self.eqnList.length; i++) {
        const equation = self.eqnList[i];
        if ('index' in equation) {
          const state = equation['state']
          code.push("      if (_"+state+"Length != "+state+".length) return true;");
        }
    }
    code.push("      return false;");
    code.push("    }\n");

    code.push("    __odeSelf.getEventSolver = function() {");
    code.push("      return __eventSolver;");
    code.push("    }\n");

    code.push("    __odeSelf.resetSolver = function() {")
    code.push("      __mustUserReinitialize = true;")
    code.push("    }\n")

    code.push("    __odeSelf.automaticResetSolver = function() {");
    if (includeSynchronization) code.push("      __mustReinitialize = true;");
    code.push("    }\n");

    code.push("    function __errorAction () {");
    if (self.odePage['ErrorHandling']['pages'].length>0) {
      if (includeSynchronization) {
        code.push("      // Make sure the solver is reinitialized;");
        code.push("      __mustReinitialize = true;");
      }
      code.push("      var _errorCode = __eventSolver.getErrorCode();");
      for (const handler of self.odePage['ErrorHandling']['pages']) {
        const handlerName = handler['Name'];
        const handlerType = handler['Type'];
        const pagecode = handler['Code'];
        const comment = handler['Comment'];
        code.push("      if (__pagesEnabled['"+handlerName+"']) {");
        if (handlerType=="ANY_ERROR") code.push("        { // For any error: " + comment);
        else code.push("        if (__eventSolver.getErrorCode()==EJSS_ODE_SOLVERS.ERROR."+handlerType+") { // " + comment);
        WebEJS_GEN.generate_code.addListing(code, pagecode, '          ', "ErrorHandler for "+pageName+" - " + handlerName);
        code.push("        }");
        code.push("      }");
      }
    }
    else { // No error code
      code.push("      if (__ignoreErrors) return;");
      code.push("      console.log (__eventSolver.getErrorMessage());");
      code.push("      if (window.confirm('Numerical solver error. Continue the simulation?')) __ignoreErrors = true;");
      code.push("      else _pause();");
      if (includeSynchronization) {
        code.push("      // Make sure the solver is reinitialized;");
        code.push("      __mustReinitialize = true;");
      }
    }
    code.push("    }\n");

    code.push("    __odeSelf.step = function() { return __privateStep(false); }\n");
    code.push("    __odeSelf.solverStep = function() { return __privateStep(true); }\n");

    code.push("    function __privateStep(__takeMaximumStep) {");
    code.push("      if (!__isEnabled) return 0;");
    code.push("      if ("+stepSize+"===0) return 0;");
    code.push("      if (__mustInitialize) __odeSelf.initializeSolver();");
    code.push("      if (__arraysChanged()) { __instantiateSolver(); __odeSelf.initializeSolver(); }");
    code.push("      __eventSolver.setStepSize("+stepSize+");");
    if (intStepSize)      code.push("      __eventSolver.setInternalStepSize("+intStepSize+");");
    else                  code.push("      __eventSolver.setInternalStepSize("+stepSize+");");
    if (historyLength)    code.push("      __eventSolver.setHistoryLength("+historyLength+");");
    if (maxStep)          code.push("      __eventSolver.setMaximumInternalStepSize("+maxStep+");");
    if (maxNumberOfSteps) code.push("      __eventSolver.setMaximumInternalSteps("+maxNumberOfSteps+");");        

    if ('EventMaximumStep' in self.odePage) {
        const eventStep = self.odePage['EventMaximumStep'].trim();
        if (eventStep) code.push("      __eventSolver.setMaximumEventStep("+eventStep+");");
    }
    if (toleranceStr) code.push("      __eventSolver."+toleranceStr+";");
    code.push("      __pushState();");

    code.push("      if (__mustUserReinitialize) {");
    code.push("        __eventSolver.userReinitialize();");
    code.push("        __mustUserReinitialize = false;");
    if (includeSynchronization) code.push("        __mustReinitialize = false;");
    code.push("        if (__eventSolver.getErrorCode()!=EJSS_ODE_SOLVERS.ERROR.NO_ERROR) __errorAction();");
    code.push("      }");
    if (includeSynchronization) {
      code.push("      else if (__mustReinitialize) {");
      code.push("        __eventSolver.reinitialize();");
      code.push("        __mustReinitialize = false;");
       code.push("        if (__eventSolver.getErrorCode()!=EJSS_ODE_SOLVERS.ERROR.NO_ERROR) __errorAction();");
      code.push("      }"); 
    }
    else {
      code.push("      __eventSolver.reinitialize(); // force synchronization: inefficient!");
      code.push("      if (__eventSolver.getErrorCode()!=EJSS_ODE_SOLVERS.ERROR.NO_ERROR) __errorAction();");
    }

    code.push("      var __stepTaken = __takeMaximumStep ? __eventSolver.maxStep() : __eventSolver.step();");
    //code.push(self.__getVariablesFromStateCode("__state",False))
    code.push(getStateTemplate.replaceAll('{{STATE_STR}}',"__state").replaceAll('{{PREFIX}}','      '));
    code.push("      // Check for error");
    code.push("      if (__eventSolver.getErrorCode()!=EJSS_ODE_SOLVERS.ERROR.NO_ERROR) __errorAction();");
    code.push("      return __stepTaken;");
    code.push("    }\n");

    code.push("    __odeSelf.getState = function() { return __state; }\n");

    if (('DelayList' in self.odePage) && (self.odePage['DelayList'].trim())) { // Use delays
      code.push("    __odeSelf.setStateHistory = function(_history) { }; // deliberately left empty\n");

      code.push("    __odeSelf.getDelays = function(__aState) {");
      // code.push(self.__getVariablesFromStateCode("__aState",True))
      code.push(getStateTemplateTemp.replaceAll('{{STATE_STR}}',"__aState").replaceAll('{{PREFIX}}','      '))
      code.push("      return ["+self.odePage['DelayList']+"];");
      code.push("    }\n");

      code.push("    __odeSelf.getMaximumDelay = function() {");
      const maxDelayStr = self.odePage['DelayMaximum'].trim();
      if (maxDelayStr) 
        code.push("      return "+maxDelayStr+";");
      else {
        code.push("      var _delaysArray = __odeSelf.getDelays(__state);" );
        code.push("      var _maximum = Number.POSITIVE_INFINITY;" );
        code.push("      for (var _i=0,_n=_delaysArray.length; _i<_n; _i++) _maximum = Math.max(_maximum,Math.abs(_delaysArray[_i]));" );
        code.push("      return _maximum;" );
      }
      code.push("    }\n");
        
      code.push("    __odeSelf.getInitialConditionDiscontinuities = function() {")
      code.push("      return ["+self.odePage['DelayAddDiscont']+"];"); 
      code.push("    }\n");
        
      code.push("    function _userDefinedInitialCondition(_time) {"); // This is because the user returns a smaller array (not including time)
      code.push("      // In case it uses the independent variable");
      code.push("      var "+self.indepVar+" = _time;");
      if (self.odePage['DelayInitialCondition']['Code'].trim()) {
        WebEJS_GEN.generate_code.addListing(code, self.odePage['DelayInitialCondition']['Code'], '      ', 
                                          "Delay initial conditions page: " + pageName);
      }
      else {
        code.push("      return []; // > Error? Delay initial conditions page NOT SET: " + pageName);
        alert('DDE error! Initial conditions for DDE not set in page ' + pageName);
      }
      code.push("    }\n");
        
      code.push("    __odeSelf.getInitialCondition = function(_time, _state) {");
      code.push("      var _userDelayInitCond = _userDefinedInitialCondition(_time);");
      code.push("      if (_userDelayInitCond!==null) {");
      code.push("        for (var _i=0, _n=_state.length-1; _i<_n; _i++) _state[_i] = _userDelayInitCond[_i];");
      code.push("        _state[_state.length-1] = _time;");
      code.push("      }");
      code.push("    }\n");
    }

    code.push("    __odeSelf.getRate = function(_aState,_aRate) {");
    if (self.odePage['PreliminaryCode']['Code'].trim()) {
      code.push("      _aRate[_aRate.length-1] = 0.0; // In case the prelim code returns");
      code.push("      var __index=-1; // so that it can be used in preliminary code");
      //code.push(self.__getVariablesFromStateCode("_aState",True))
      code.push(getStateTemplateTemp.replaceAll('{{STATE_STR}}',"_aState").replaceAll('{{PREFIX}}','      '));
      code.push("      // Preliminary code: " + self.odePage['PreliminaryCode']['Comment']);
      WebEJS_GEN.generate_code.addListing(code, self.odePage['PreliminaryCode']['Code'], '      ',  "Preliminary code for ODE " + pageName);
    }
    else{
      // code.push(self.__getVariablesFromStateCode("_aState",True))
      code.push(getStateTemplateTemp.replaceAll('{{STATE_STR}}',"_aState").replaceAll('{{PREFIX}}','      '));
    }

    self.__computeRateCode (code,"Rate for ODE: " + pageName);
    code.push("    } //end of getRate\n");

    if ('ZenoEffect' in self.odePage) {
      if (self.odePage['ZenoEffect']['Code'].trim()) {
        code.push("    // Implementation of org.opensourcephysics.numerics.ZenoEffectListener");
        code.push("    __odeSelf.zenoEffectAction = function(_anEvent, _aState) {");
        //code.push(self.__getVariablesFromStateCode("_aState", False))
        code.push(getStateTemplate.replaceAll('{{STATE_STR}}', "_aState").replaceAll('{{PREFIX}}', '      '));
        WebEJS_GEN.generate_code.addListing(code, self.odePage['ZenoEffect']['Code'], '        ', "Zeno code for ODE." + pageName);
        // code.push(self.__setStateFromVariablesCode("_aState", False))
        code.push(setStateTemplate.replaceAll('{{PREFIX}}', '      ').replaceAll('{{STATE_STR}}', "_aState"));
        code.push("        return "+self.odePage['ZenoEffect']['StopAfterEffect']+";");
        code.push("      }\n");
      }
    }


    // Now build the event classes

    // FOR BLOCKLY
    code.push(WebEJS_GEN.generate_ode.BLOCKLY_ADD_EVENT_PIECE
                .replaceAll('{{EXTRACT_VARIABLES_A_STATE}}',
                  // self.__getVariablesFromStateCode("_aState",True ,' '*10))
                  getStateTemplateTemp.replaceAll('{{STATE_STR}}',"_aState").replaceAll('{{PREFIX}}','          '))
                .replaceAll('{{EXTRACT_VARIABLES_STATE}}',
                  // self.__getVariablesFromStateCode("__state",False,' '*10))
                  getStateTemplate.replaceAll('{{STATE_STR}}',"__state").replaceAll('{{PREFIX}}','          '))
                .replaceAll('{{UPDATE_VARIABLES_STATE}}',
                  setStateTemplate.replaceAll('{{PREFIX}}','          ').replaceAll('{{STATE_STR}}',"__state"))
                .replaceAll('{{PAGE_INDEX}}', self.pageIndex));
    
    // End BLOCKLY

    for (var counter=0; counter<eventPages.length; counter++) {
      const event = eventPages[counter];
      code.push("    _ODE_evolution"+self.pageIndex+"_Event"+(counter+1)+" = function() {");
      code.push("      var _eventSelf = {};");
      code.push("      _eventSelf.getTypeOfEvent = function() { return EJSS_ODE_SOLVERS.EVENT_TYPE."+event['EventType']+"; }");
      code.push("      _eventSelf.getRootFindingMethod = function() { return EJSS_ODE_SOLVERS.EVENT_METHOD."+event['Method']+"; }");
      code.push("      _eventSelf.getMaxIterations = function() { return "+event['Iterations']+"; }");
      if (('Tolerance' in event) && (event['Tolerance'].trim())) 
          code.push("      _eventSelf.getTolerance = function() { return "+event['Tolerance']+"; }");
      else
          code.push("      _eventSelf.getTolerance = function() { return "+absTol+"; }\n");

      code.push("      _eventSelf.evaluate = function(_aState) {");
      // code.push(self.__getVariablesFromStateCode("_aState",True,'        '))
      code.push(getStateTemplateTemp.replaceAll('{{STATE_STR}}',"_aState").replaceAll('{{PREFIX}}','        '));
      WebEJS_GEN.generate_code.addListing(code,event['ZeroCondition'],'        ',"Event zero-condition for page " + pageName);
      code.push("      }\n");

      code.push("      _eventSelf.action = function() {");
      // code.push(self.__getVariablesFromStateCode("__state",False,'        '))
      code.push(getStateTemplate.replaceAll('{{STATE_STR}}',"__state").replaceAll('{{PREFIX}}','        '));
      code.push("        var _returnValue = __userDefinedAction();");
      //code.push(self.__setStateFromVariablesCode("__state",False,'        '))
      code.push(setStateTemplate.replaceAll('{{PREFIX}}','        ').replaceAll('{{STATE_STR}}',"__state"));

      code.push("        return _returnValue;");
      code.push("      }\n");

      code.push("      function __userDefinedAction() {");
      WebEJS_GEN.generate_code.addListing(code,event['Action'],'        ',"Event action for page " + pageName);
      code.push("        return "+event['StopAtEvent']+";");
      code.push("      }");

      code.push("      return _eventSelf;");
      code.push("    } // End of event\n");
    }

    for (var counter=0; counter<discPages.length; counter++) {
      const discPage = discPages[counter];
      code.push("    _ODE_evolution"+self.pageIndex+"_Discontinuity"+(counter+1)+" = function() {");
      code.push("      var _discontinuitySelf = {};\n");

      if (('Tolerance' in discPage) && (discPage['Tolerance'])) 
          code.push("      _discontinuitySelf.getTolerance = function() { return "+discPage['Tolerance']+"; }\n");
      else
          code.push("      _discontinuitySelf.getTolerance = function() { return "+absTol+"; }\n");

      code.push("      _discontinuitySelf.evaluate = function(_aState) {");
      // code.push(self.__getVariablesFromStateCode("_aState",True))
      code.push(getStateTemplateTemp.replaceAll('{{STATE_STR}}',"_aState").replaceAll('{{PREFIX}}','      '));
      WebEJS_GEN.generate_code.addListing(code, discPage['ZeroCondition'],'        ',"Discontinity zero-condition for page " + pageName);
      code.push("      }\n");

      code.push("      _discontinuitySelf.action = function() {");
      // code.push(self.__getVariablesFromStateCode("__state",False,'        '))
      code.push(getStateTemplate.replaceAll('{{STATE_STR}}',"__state").replaceAll('{{PREFIX}}','        '));
      code.push("        var _returnValue = __userDefinedAction();");
      // code.push(self.__setStateFromVariablesCode("__state",False,'        '))
      code.push(setStateTemplate.replaceAll('{{PREFIX}}','        ').replaceAll('{{STATE_STR}}',"__state"));
      code.push("        return _returnValue;");
      code.push("      }\n");

      code.push("      function __userDefinedAction() {");
      WebEJS_GEN.generate_code.addListing(code,discPage['Action'].trim(),'        ',"Discontinuity action for page " + pageName);
      code.push("        return "+discPage['StopAtDiscontinuity']+";");
      code.push("      }\n");

      code.push("      return _discontinuitySelf;");
      code.push("    } // End of discontinuity\n");
    }

    code.push("    __instantiateSolver();");

    code.push("    return __odeSelf;");
    code.push("  }\n");

  }
    
    // --------------------------------
    // Utilities
    // --------------------------------

    // FOR BLOCKLY
    self.__getVarsNames = function() {
      var names = "[";
      for (var i=0; i<self.eqnList.length; i++) {
        const equation = self.eqnList[i];
        const state = equation['state'];
        if (i==0) names += "'" +state+"'";
        else      names += ",'"+state+"'";
      }
      if (self.eqnList.length>0) names += ",'"+self.indepVar+"']";
      else                       names += "'" +self.indepVar+"']";
      return names;
    }
    // END OF BLOCKLY

    self.__computeRateCode = function(code, comment) {
      code.push("      // Compute the rate");
      code.push("      var __cRate=0;");
      const indexSet = ["__i"];

      var skip_next = false;
      for (var i=0; i<self.eqnList.length; i++) {
        if (skip_next) {
          skip_next = false;
          continue;
        }
        const equation = self.eqnList[i];
        const state = equation['state']
        const fullInfo = " // "+comment+" : "+state;
        const rate = equation['rate']
        if ('index' in equation) {
          const index = equation['index'].trim();
          if (! indexSet.includes(index)) {
            code.push("      var "+index+";");
            indexSet.push(index);
          }
          if (self.followedByDerivative.includes(equation)) {
            const nextEquation = self.eqnList[i+1];
            const nextState = nextEquation['state'];
            const nextRate  = nextEquation['rate'];
            code.push("      for ("+index+"=0;"+index+"<_"+state+"Length;"+index+"++) { // These two alternate in the state");
            code.push("        _aRate[__cRate++] = Array.isArray("+rate+") ? "+rate+"["+index+"] : "+rate+";" + fullInfo);
            code.push("        _aRate[__cRate++] = Array.isArray("+nextRate+") ? "+nextRate+"["+index+"] : "+nextRate+"; // "+comment+" :" + nextState);
            code.push("      }");
            skip_next = true;
          }
          else {
            code.push("      for ("+index+"=0;"+index+"<_"+state+"Length;"+index+"++) {");
            code.push("        _aRate[__cRate++] = Array.isArray("+rate+") ? "+rate+"["+index+"] : "+rate+";" + fullInfo);
            code.push("      }")
          }
        }
        else {
          code.push("      _aRate[__cRate++] = "+rate+";" + fullInfo);
        }
      }
      code.push("      _aRate[__cRate++] = 1; // independent variable");
      code.push("      return _aRate;");
    }

    // --------------------------------
    // Templates
    // --------------------------------


    self.__setStateFromVariablesTemplate = function(addSynchro) {
      const template = [];
      template.push("{{PREFIX}}// Copy our variables to {{STATE_STR}}[]");
      template.push("{{PREFIX}}var __j=0;");
      template.push("{{PREFIX}}var __n=0;");
      template.push("{{PREFIX}}var __cIn=0;");
      
      var skip_next = false;
      for (var i=0; i<self.eqnList.length; i++) {
        if (skip_next) {
          skip_next = false;
          continue;
        }
        const equation = self.eqnList[i];
        const state = equation['state'];
        if ('index' in equation) {
          if (self.followedByDerivative.includes(equation)) {
            const nextEquation = self.eqnList[i+1];
            const nextState = nextEquation['state'];
            if (addSynchro) {
              template.push("{{PREFIX}}if (!__mustReinitialize)");
              template.push("{{PREFIX}}  for (__j=0,__n=__cIn; __j<_"+state+"Length; __j++)");
              template.push("{{PREFIX}}    if ({{STATE_STR}}[__n++]!="+state+"[__j] || {{STATE_STR}}[__n++]!="+nextState+"[__j]) { __mustReinitialize = true; break; }");
            }
            template.push("{{PREFIX}}for (__j=0; __j<_"+state+"Length; __j++) { // These two alternate in the state");
            template.push("{{PREFIX}}   {{STATE_STR}}[__cIn++] = "+state+"[__j];");
            template.push("{{PREFIX}}   {{STATE_STR}}[__cIn++] = "+nextState+"[__j];");
            template.push("{{PREFIX}}}");
            skip_next = true;
          }
          else {
            if (addSynchro) {
              template.push("{{PREFIX}}if (!__mustReinitialize)");
              template.push("{{PREFIX}}  for (__j=0,__n=__cIn; __j<_"+state+"Length; __j++)");
              template.push("{{PREFIX}}     if ({{STATE_STR}}[__n++]!="+state+"[__j]) { __mustReinitialize = true; break; }");
            }
            template.push("{{PREFIX}}  for (__j=0;__j<_"+state+"Length; __j++) {");
            template.push("{{PREFIX}}    {{STATE_STR}}[__cIn++] = "+state+"[__j];");
            template.push("{{PREFIX}}  }");
          }
        }
        else {
          if (addSynchro) template.push("{{PREFIX}}if ({{STATE_STR}}[__cIn]!="+state+") __mustReinitialize = true;");
          template.push("{{PREFIX}}{{STATE_STR}}[__cIn++] = "+state+";");
        }
      }
      if (addSynchro) template.push("{{PREFIX}}if ({{STATE_STR}}[__cIn]!="+self.indepVar+") __mustReinitialize = true;");
      template.push("{{PREFIX}}{{STATE_STR}}[__cIn++] = "+self.indepVar+";");
      return template.join('\n');
    }

    self.__getVariablesFromStateTemplate = function(declareTemporary) {
      const code = [];
      code.push("{{PREFIX}}// Extract our variables from {{STATE_STR}}");
      code.push("{{PREFIX}}var __i=0;");
      code.push("{{PREFIX}}var __cOut=0;");
      var skip_next = false;
      
      for (var i=0; i<self.eqnList.length; i++) {
        if (skip_next) {
          skip_next = false;
          continue;
        }
        const equation = self.eqnList[i];
        const state = equation['state'];
        if ('index' in equation) {
          if (declareTemporary) code.push("{{PREFIX}}var "+state+" = [];");
          if (self.followedByDerivative.includes(equation)) {
            const nextEquation = self.eqnList[i+1];
            const nextState = nextEquation['state'];
            if (declareTemporary) code.push("{{PREFIX}}var "+nextState+" = [];");
            code.push("{{PREFIX}}for (__i=0; __i<_"+state+"Length; __i++) { // These two alternate in the state");
            code.push("{{PREFIX}}  "+state+"[__i] = {{STATE_STR}}[__cOut++];");
            code.push("{{PREFIX}}  "+nextState+"[__i] = {{STATE_STR}}[__cOut++];");
            code.push("{{PREFIX}}}");
            skip_next = true;
          }
          else {
            code.push("{{PREFIX}}for (__i=0;__i<_"+state+"Length; __i++) {");
            code.push("{{PREFIX}}  "+state+"[__i] = {{STATE_STR}}[__cOut++];");
            code.push("{{PREFIX}}}");
          }
        }
        else {
          if (declareTemporary) code.push("{{PREFIX}}var "+state+" = {{STATE_STR}}[__cOut++];");
          else                  code.push("{{PREFIX}}"+state+" = {{STATE_STR}}[__cOut++];");
        }
      }
      if (declareTemporary) code.push("{{PREFIX}}var "+self.indepVar+" = {{STATE_STR}}[__cOut++];")
      else                  code.push("{{PREFIX}}"+self.indepVar+" = {{STATE_STR}}[__cOut++];");
      return code.join('\n');
    }

  return self; // End of inner class oneODE
},

	// --------------------------------
  // Constant pieces
  // --------------------------------

  INIT_SOLVER_PIECE : `
  function _initializeSolvers() {
    for (var i=0,n=_privateOdesList.length; i<n; i++) _privateOdesList[i].initializeSolver();
  }

  function _automaticResetSolvers() {
    for (var i=0,n=_privateOdesList.length; i<n; i++) _privateOdesList[i].automaticResetSolver();
  }

  _model.resetSolvers = function() {
    for (var i=0,n=_privateOdesList.length; i<n; i++) _privateOdesList[i].resetSolver();
  }
`,

  GET_EVENT_SOLVER_PIECE : `
  function _getEventSolver(_odeName) {
    var ode = _getODE(_odeName);
    if (ode===null) return null;
    return ode.getEventSolver();
  }

  function _getEngineSolverClass(classname) {
    classname = classname.toLowerCase();
    if (classname.indexOf('rungekuttafehlberg')>=0) return EJSS_ODE_SOLVERS.cashKarp45;
    if (classname.indexOf('cash')>=0)   return EJSS_ODE_SOLVERS.cashKarp45;
    if (classname.indexOf('boga')>=0)   return EJSS_ODE_SOLVERS.bogackiShampine23;
    if (classname.indexOf('dopri5')>=0) return EJSS_ODE_SOLVERS.doPri5;
    if (classname.indexOf('dopri8')>=0) return EJSS_ODE_SOLVERS.doPri853;
    if (classname.indexOf('richa')>=0)  return EJSS_ODE_SOLVERS.eulerRichardson;
    if (classname.indexOf('euler')>=0)  return EJSS_ODE_SOLVERS.euler;
    if (classname.indexOf('fehlberg78')>=0) return EJSS_ODE_SOLVERS.fehlberg78;
    if (classname.indexOf('fehlberg8')>=0)  return EJSS_ODE_SOLVERS.fehlberg8;
    //if (classname.indexOf('radau')>=0)  return EJSS_ODE_SOLVERS.radau5;
    if (classname.indexOf('runge')>=0)  return EJSS_ODE_SOLVERS.rungeKutta4;
    if (classname.indexOf('verlet')>=0) return EJSS_ODE_SOLVERS.velocityVerlet;
    return EJSS_ODE_SOLVERS.rungeKutta4;
  }

  function _setSolverClass(_odeName, _engine) {
    var ode = _getODE(_odeName);
    if (ode===null) return;
    if (!_engine.setODE) _engine = _getEngineSolverClass(_engine);
    if (_engine) ode.setSolverClass(_engine);
  }
`,

  BLOCKLY_ADD_EVENT_PIECE : `
    __odeSelf._addEvent = function(userCondition,userAction,eventType,eventMethod,maxIter,eventTolerance,endAtEvent) {
    
      var __User_Event = function (userCondition,userAction,eventType,eventMethod,maxIter,eventTolerance,endAtEvent) {
        var _eventSelf = {};
        _eventSelf.getTypeOfEvent = function() { return eventType; }
        _eventSelf.getRootFindingMethod = function() { return eventMethod; }
        _eventSelf.getMaxIterations = function() { return maxIter; }
        _eventSelf.getTolerance = function() { return eventTolerance; }

        _eventSelf.evaluate = function(_aState) {
{{EXTRACT_VARIABLES_A_STATE}}
          return eval(userCondition);
        }

        _eventSelf.action = function() {
{{EXTRACT_VARIABLES_STATE}}
          var _returnValue = __userDefinedAction();
{{UPDATE_VARIABLES_STATE}}
          return _returnValue;
        }

        function __userDefinedAction() {
          if (undefined != functions) eval(functions.toString());
          eval(userAction);
          return endAtEvent;
        }

        return _eventSelf;
      } // End of event
     _userEvents{{PAGE_INDEX}}.push(__User_Event(userCondition,userAction,eventType,eventMethod,maxIter,eventTolerance,endAtEvent));
    }
`

};
	

/*
 * Copyright (C) 2024 Francisco Esquembre
 * This code is part of the WebEJS authoring and simulation tool
 */

/**
 * Generation tools
 * @module generation
 */

var WebEJS_GEN = WebEJS_GEN || {};

/**
 * Main GUI
 * @class variables 
 * Static class to generate variables' code and info from a simulation
 */

WebEJS_GEN.generate_variables = {
  
	// ----------------------------------------------------
  // Static methods
  // ----------------------------------------------------

	getVariableList : function(variable_pages) {
		var list = [];
		for (const page of variable_pages) 
			if (page['Active']=="true")
				for (const variable of page['Variables']) {
					const name = variable['Name'].trim();
					if (name) {
            var index = name.indexOf("["); // at least between []
            if (index < 0) list.push(name);
            else list.push(name.substring(0, index));
          }
				}
		return list;
	},

	isArrayOfDouble : function(variable_pages,name) {

		function __getVariableByName(variable_pages,name) {
			for (const page of variable_pages) 
					if (page['Active']=="true")
							for (const variable of page['Variables'])
								if (variable['Name']==name) return variable;
			return null;
		}
	
		// Here starts isArrayOfDouble

		const variable = __getVariableByName(variable_pages,name);
		if (!variable) return false;
		const dimension = variable["Dimension"].replaceAll(" ", "");
		return dimension && dimension.trim().length>0;
	},

	// ------------------------------
	// UTILS
	// ------------------------------

	/*
	  splits an array variable in name, index. index defaults to "__i", As in
    	- "myVar[]" into "myVar" and "__i"
      - "myVar[" into "myVar" and "__i"
      - "myVar[i]" into "myVar" and "i"
 	
	__splitArrayVariable : function(name) {
		var index = name.indexOf("["); // at least between []
		if (index<0) return { 'name' : name, 'index' : '__i' }; 
		const just_name = name.substring(0,index);
		const name_tail = name.substring(index+1);
		index = name_tail.indexOf("]");
		if (index<0) return { 'name' : just_name, 'index' : '__i' };
		return { 'name' : just_name, 'index' : name_tail.substring(0,index) };
	},
*/
	
	// --------------------------
	// Code generation
	// --------------------------

	appendDefinition : function(code, variable_pages) {

		// Gets the name of a variable, also if it is an array variable
		function __nameOfVariable(name) {
			var index = name.indexOf("["); // at least between []
			if (index < 0) return name;
			return name.substring(0, index);
		}

		// Here starts appendDefinition

		for (const page of variable_pages) {
			if (page['Active']=="true") {
				const pagename = page['Name'];
				for (const variable of page['Variables']) {
					var name = variable['Name'].trim();
					if (name) {
						name = __nameOfVariable(name);
						code.push("  var "+name+"; // Model.Variables."+pagename+"."+name);
					}
				}
				code.push("");
			}
		}
	},

	appendSerializeCode : function(code, variable_pages) {
		function __iterateVariables(variable_pages, listener) {
			for (const page of variable_pages) {
				if (page['Active']=="true") {
					for (const variable of page['Variables']) {
						const name = variable['Name'].trim();
						if (name) {
							var index = name.indexOf("["); // at least between []
							if (index < 0) listener(variable, name, '');
							else { // It is an array variable
								/* 
								splits an array variable in name, index. index defaults to "__i".
								As in
									- "myVar[]" into "myVar" and "__i"
									- "myVar[" into "myVar" and "__i"
									- "myVar[i]" into "myVar" and "i"
								*/
								const just_name = name.substring(0, index);
								const name_tail = name.substring(index + 1);
								index = name_tail.indexOf("]");
								if (index < 0) listener(variable, just_name, '__i');
								else listener(variable, just_name, name_tail.substring(0, index));
							}
						}
					}
				}	
			}
		}

		// Here starts appendSerializeCode
		
		code.push("  function _serialize() { return _model.serialize(); }\n");
		code.push("  _model._userSerialize = function() {");
		var dict = [];
		__iterateVariables(variable_pages,
			(variable,name,index) => { 
				dict.push(name+" : " + name);
		});
		code.push("    return { "+dict.join(', ')+" };");
		code.push("  }");

		code.push("  function _serializePublic() { return _model.serializePublic(); }\n");
		code.push("  _model._userSerializePublic = function() {");
		dict = []
		__iterateVariables(variable_pages,
			(variable,name,index) => { 
				if ('domain' in variable) {
					if (variable['domain'].includes('public') || variable['domain'].includes('output')) 
						dict.push(name+" : " + name);
				}
				else dict.push(name+" : " + name);
			});
		code.push("    return { "+dict.join(', ')+" };");
		code.push("  }\n");

		code.push("  _model._readParameters = function(json) {");
		__iterateVariables(variable_pages,
			(variable,name,index) => { 
				code.push("    if(typeof json."+name+" != 'undefined') "+name+" = json."+name+";");
			});
		code.push("  }\n");

		code.push("  _model._readParametersPublic = function(json) {");
		__iterateVariables(variable_pages,
			(variable,name,index) => { 
				if ('domain' in variable) {
					if (variable['domain'].includes('public') || variable['domain'].includes('output')) 
						code.push("    if(typeof json."+name+" != 'undefined') "+name+" = json."+name+";");
				}
				else code.push("    if(typeof json."+name+" != 'undefined') "+name+" = json."+name+";");
			});
		code.push("  }");

		code.push(WebEJS_GEN.generate_variables.__FINAL_SERIALIZE_CODE)
	},

	appendReset : function(code, variable_pages) {

		function __nonEmptyTokens(aString) {
			var tokens = [];
			for (const tk of aString.split(/\s+|\[|\]/)) {
				if (tk) tokens.push(tk);
			}
			return tokens;
		}

		function __initCodeForAnArray(linePrefix, comment, lineOfIndexes, name, dimension, value) {
			if (!value) {
				//tokens = re.findall("\[(.*?)\]", dimension)
				const tokens = __nonEmptyTokens(dimension);
				return linePrefix+name+" = new Array("+tokens.shift()+"); "+ comment;
			}
			
			if (value.startsWith("new ") || value.startsWith("["))
				return linePrefix+name+" = "+value+"; " + comment;
	
			const line = [];
			//tokens = re.findall("\[(.*?)\]", dimension)
			const tokens = __nonEmptyTokens(dimension);
			line.push(linePrefix+name+" = new Array("+tokens[0]+"); "+ comment);
	
			line.push(linePrefix + "(function () {");
	
			prefix = "  " + linePrefix;
			accumIndexStr = "";

			var tokensIndexes=null;
			const dim = tokens.length;
	
			if (lineOfIndexes) {
				tokensIndexes = lineOfIndexes.split(",");
				line.push(prefix+"var "+lineOfIndexes+";");
			}
			else {
				if (dim>1) {
					var lineExtra = '';
					for (var i=1; i<dim; i++) lineExtra+=", _i"+ i;
					line.push(prefix+"var _i0"+lineExtra+";");
				}
				else line.push(prefix+"var _i0;");
			}
	
			for (var i=0; i<dim; i++) {
				const kDim = tokens.shift();
				var indexStr = lineOfIndexes ? tokensIndexes.shift().trim() : "_i"+i; 
				line.push(prefix+"for ("+indexStr+"=0; "+indexStr+"<"+kDim+"; "+indexStr+"+=1) { "+ comment);
				prefix += "  "
				accumIndexStr += "["+indexStr+"]";
				if (i<dim-1) line.push(prefix+name+accumIndexStr+" = [];");
				else line.push(prefix+name+accumIndexStr+" = "+value+"; "+comment);
			}
	
			for (var i=0; i<dim; i++) {
				prefix = prefix.substring(2);
				line.push(prefix+"}");
			}
			line.push(linePrefix+"}());");
			return line.join('\n');
		} // End of __initCodeForAnArray

		// Here starts appendReset

		for (const page of variable_pages) {
			if (page['Active']!="true") continue;

			const pagename = page['Name'];
			code.push("  _model.addToReset(function() { // Reset of " + pagename);              
				
			for (const variable of page['Variables']) {
				const name = variable['Name'].trim();
				if (!name) continue;
				const value = variable["Value"].trim();
				const dimension = variable["Dimension"].replaceAll(" ", "");
				var comment = "// Model.Variables."+pagename+"."+ name;

				if (dimension && dimension.trim()) { // it is an array
						var varName = name;
						const tokens = __nonEmptyTokens(dimension);
						const dim = tokens.length;
						const tokensIndexes = __nonEmptyTokens(varName,"\s+|\[|\]");
						const dimIndex = tokensIndexes.length;
						var lineOfIndexes = null;
						if (dimIndex>1) {
							varName = tokensIndexes.shift();
							var lineOfIndexes = tokensIndexes.shift();
							while (tokensIndexes.length>0) lineOfIndexes += ", "+tokensIndexes.shift();
							if ((dimIndex-1)!=dim)
								alert("Syntax error: Dimension brackets in variable name "+name+" ("+pagename+") do not match the dimension "+dimension);
						}
						code.push(__initCodeForAnArray('    ',comment, lineOfIndexes, varName, dimension, value));
				}
				else {
						if (value) code.push("    "+name+" = "+value+"; "+comment);
				}
			}				
			code.push("  }); // End of reset of "+pagename+"\n");
		}
	},


	// --------------------------------
  // Constant pieces
  // --------------------------------

	__FINAL_SERIALIZE_CODE : `
  function _unserializePublic(json) { return _model.unserializePublic(json); }

  _model._userUnserializePublic = function(json) {
    _model._readParametersPublic(json);
    _resetSolvers();
    _model.update();
  }

  function _unserialize(json) { return _model.unserialize(json); }

  _model._userUnserialize = function(json) {
    _model._readParameters(json);
    _resetSolvers();
    _model.update();
  }
`

};
	

/*
 * Copyright (C) 2024 Francisco Esquembre
 * This code is part of the WebEJS authoring and simulation tool
 */

/**
 * Generates the HTML code for the view
 * @module generation
 */

var WebEJS_GEN = WebEJS_GEN || {};

/**
 * Static class to generate the model HTML code
 * @class simulation 
 */

WebEJS_GEN.generate_view = {
	
	// ------------------------------
	// UTILS
	// ------------------------------

	__getPropertyInfo : function(properties,propertyName) {
			for (const prop of properties) if (prop['name']==propertyName) return prop;
			return {};
	},

	__getElementPropertyList : function(fullclass) {
			const classList = fullclass.split('.');
			const VIEW_ELEMENTS_INFO = sMainGUI.getSystemInformation('view_elements_info');
			const info = VIEW_ELEMENTS_INFO[classList[0]][classList[1]];
			var list = [];
			if ('properties' in info) list.push(...info['properties']);
			if ('parent' in info) list.push(...WebEJS_GEN.generate_view.__getElementPropertyList(info['parent']));
			return list;
	},

  _isJSExpressionWithIdentifiers : function(code) {
    try {
      const ast = esprima.parseScript(code, { tokens: true });
      //console.log(ast);
      for (var i in ast.tokens) {
        const token = ast.tokens[i];
        if (token.type == "Identifier") return true;
      }
    } 
    catch (error) {
      // console.error(error);
    }
    return false;
  },

  

	// ----------------------------------------------------
  // Code generation
  // ----------------------------------------------------

	// Properties of type PREVIOUS need to be processed first
	__getSortedProperties : function(properties,class_properties) {
		var sorted = [];
		var secondGroup = [];
		// first round for PREVIOUS properties
		for (const property of properties) {
				const prop_name = property['name'];
				const prop_info = WebEJS_GEN.generate_view.__getPropertyInfo(class_properties,prop_name);
				if (!('types' in prop_info)) continue;
				if (('modifiers' in prop_info) && (prop_info['modifiers'].includes('PREVIOUS'))) sorted.push(property);
				else secondGroup.push(property);
		}
		sorted.push(...secondGroup);
		return sorted;
	},	

	__getMultilineValue : function(value,types) {
		//print ("Replacing HTML value",value)
		if (value.startsWith("{") && value.endsWith("}")) return value;

		// put all lines in one
		value = value.replaceAll('\n', ' ').replaceAll('\r', ' ').trim();

		if (types.includes('String')) {
			const lead = value.at(0);
			const trail = value.at(-1);
			if (lead =='"' || lead =="'") value = value.slice(1);
			if (trail=='"' || trail=="'") value = value.slice(0,-1);
			value = "\"" + value.replaceAll("\\", "\\\\").replaceAll("\"","\\\"") + "\"";
		}
		return value;
	},	

  __appendDefinition : function(code, tree, parent, variables_list) {
    for (const el of tree) {
      var uses_graphic_canvas = false;
			const fullclass = sMainGUI.getSystemInformation('view_elements')['classnames'][el['Type']];
  		const prop_code = []
		  if (('Properties' in el) && el['Properties'].length) {
				const class_properties = WebEJS_GEN.generate_view.__getElementPropertyList(fullclass);
				for (const property of WebEJS_GEN.generate_view.__getSortedProperties(el['Properties'],class_properties)) {
					const prop_name = property['name'];
					const prop_info = WebEJS_GEN.generate_view.__getPropertyInfo(class_properties,prop_name);
					const value = property['value']
					if (prop_name=='GraphicsMode') {
						if (value == 'Canvas') uses_graphic_canvas = True
          }
					if (! ('types' in prop_info)) { // TODO This happens for onClick in Canvas, for instance
						console.error ("property has no 'types' field !!!");
            console.error ("prop :"+prop_name+" for element :"+el['Name']);
            console.error ("prop_info:");
            console.error (prop_info);
            continue;
          }
					if (prop_info['types'].includes('Action')) continue
					if ((value.startsWith("%") && value.endsWith("%")) || variables_list.includes(value)) continue
					if (! WebEJS_GEN.generate_view._isJSExpressionWithIdentifiers(value)) {
						/* is it needed??
								# its type is string
								if JSParser.getJSConstantType(value) == JSParser.CONSTANTTYPE.STRING:
										if (value.startswith('"') and value.endswith('"')): value = value[1:-1]
										value = '"' + value.replace('\\', '\\\\').replace('"', '\"') + '"'
						*/
						if (('modifiers' in prop_info) && (prop_info['modifiers'].includes('MULTILINE')))
							text = WebEJS_GEN.generate_view.__getMultilineValue(value,prop_info['types']);
						else 
              text = value.replaceAll('\r', ' ').replaceAll('\n', ' ').trim()
						prop_code.push('      .setProperty("'+prop_name+'",'+text+')');
          }
        }
      } // end of if properties in el
		  if (uses_graphic_canvas)
				command = "    _view._addElement("+fullclass+", '"+el['Name']+"', _view."+parent+", 'GRAPHICS2D_CANVAS')"
		  else
				command = "    _view._addElement("+fullclass+", '"+el['Name']+"', _view."+parent+")";
		  if (prop_code.length) {
				code.push(command);
				prop_code.push("      ;");
				code.push(prop_code.join('\n'));
      }
		  else code.push(command+";");
		  if ('Children' in el)
				WebEJS_GEN.generate_view.__appendDefinition(code,el['Children'],el['Name'],variables_list);
		}
		return code.join('\n');
	},	

  // this method is actually used when generating the model
  __appendLinks : function(code, tree, variables_list, fullmodel) {
    for (const el of tree) {
      const fullclass = sMainGUI.getSystemInformation('view_elements')['classnames'][el['Type']];
      const el_name = el['Name'];
      if ('Properties' in el) {
        const class_properties = WebEJS_GEN.generate_view.__getElementPropertyList(fullclass);
        for (const property of WebEJS_GEN.generate_view.__getSortedProperties(el['Properties'],class_properties)) {
          const prop_name = property['name'];
          const prop_info = WebEJS_GEN.generate_view.__getPropertyInfo(class_properties, prop_name);
          var value = property['value'].trim()
          if (!('types' in prop_info)) { // TODO This happens for onClick in Canvas, for instance
            console.error("property has no 'types' field !!!");
            console.error("prop :" + prop_name + " for element :" + el['Name']);
            console.error("prop_info:");
            console.error(prop_info);
            continue;
          }
          if (prop_info['types'].includes('Action')) {
            if (!fullmodel) continue
            const comment = "// Action "+prop_name+" for element " + el_name;
            if (value.startsWith("%") && value.endsWith("%")) {
              value = value.slice(1, -1); // action is a function name
              code.push("      _view." + el_name + ".setAction('" + prop_name + "', " + value + "); " + comment);
            }
            else { // action is js code
              code.push("      _view." + el_name + ".setAction('" + prop_name + "', function(_data, _info) { " + comment);
              var count = 0;
              for (const line of value.split('\n')) {
                count = count + 1
                code.push("        " + line + " // property " + prop_name + " of " + el_name + ": line " + count);
              }
              code.push("      });");
            }
          }
          else {
            const hasPercentages = value.startsWith("%") && value.endsWith("%");
            if (hasPercentages || variables_list.includes(value)) {
              const command = "_view." + el_name + ".linkProperty('" + prop_name + "',";
              const comment = "// linking " + prop_name + " of " + el_name;
              if (hasPercentages) value = value.slice(1, -1);
              const params = "function() { return " + value + "; }, function(_v) { " + value + " = _v; });";
              code.push("      " + command + " " + params + " " + comment);
            }
            else {
              value = value.replaceAll('\r', ' ').replaceAll('\n', ' ');
              if (WebEJS_GEN.generate_view._isJSExpressionWithIdentifiers(value)) {
                const command = "_view." + el_name + ".linkProperty('" + prop_name + "',";
                const comment = "// linking " + prop_name + " of " + el_name;
                const params = value.includes("return") ?
                  "function() { " + value + "; });" :
                  "function() { return " + value + "; });";
                code.push("      " + command + " " + params + " " + comment);
              }
            }
          }
        }
      }
      if ('Children' in el)
        WebEJS_GEN.generate_view.__appendLinks(code, el['Children'], variables_list, fullmodel);
    }
  },

  getTreeCode : function(view_tree,description_pages,variables_list,fullmodel) {
    const code = [];
    if (!fullmodel)
      code.push("function _getBase64Image(__base64ImageName) { return __base64ImageName; }\n");

    code.push("function _simulationView (_topFrame,_libraryPath,_codebasePath) {");
    code.push("  var _view = EJSS_CORE.createView(_topFrame);\n");

    code.push("  if (_libraryPath)  _view._setLibraryPath(_libraryPath);");
    code.push("  if (_codebasePath) _view._setResourcePath(_codebasePath);\n");

    var i=0;
    for (const page of description_pages) {
      if (page['External']== 'true')
        code.push("  _view._addDescriptionPage(\""+page['Name']+"\",\""+page['Code'].trim()+"\");");
      else 
         code.push("  _view._addDescriptionPage(\""+page['Name']+"\",\"_description_"+i+".html\");");
      i++;
    }

    code.push("\n  _view._reset = function() {");
    code.push("    _view._clearAll();");
    if (view_tree.length)
      WebEJS_GEN.generate_view.__appendDefinition(code,view_tree, '_topFrame',variables_list);
    else // Tree is empty, generate minimal view
      code.push(WebEJS_GEN.generate_view.__EMPTY_VIEW.replaceAll('{{WEBEJS_ASSETS_FOLDER}}',sMainEjsAssetsFolder));
    code.push("  }; // end of _view._reset");
    code.push("  return _view;");
    code.push("}");
    code.push("");
    return code.join('\n');
  },

  appendCreationCode : function(code,view,variables_list,fullmodel) {
    code.push("  function _createView() {");
    code.push("    _view = new _simulationView(_topFrame,_libraryPath,_codebasePath);");
    code.push("    var _view_super_reset = _view._reset;");
    code.push("    _view._reset = function() {");
    code.push("      _view_super_reset();");
    if (fullmodel) { // Root view properties
      const class_properties = WebEJS_GEN.generate_view.__getElementPropertyList('EJSS_SIMULATION.root');
      for (const property of view['RootProperties']) {
        const prop_name = property['name']
        const prop_info = WebEJS_GEN.generate_view.__getPropertyInfo(class_properties,prop_name)
        var value = property['value'].trim();
        console.log ("Root Property %s has types = %s",(prop_name, prop_info['types']))
        if (prop_info['types'].includes('Action')) {
          if (value.startsWith("%") && value.endsWith("%"))
            value = value.slice(1,-1); // action is a function name
          else
            value = "function(_data, _info) { "+value+" }"; // action is js code
        }
        else {
          if (('modifiers' in prop_info) && prop_info['modifiers'].includes('MULTILINE'))
            value = WebEJS_GEN.generate_view.__getMultilineValue(value,prop_info['types']);
        }
        const comment = "// Root property " + prop_name;
        code.push("      _view._setRootProperty(_model,'"+prop_name+"', "+value+"); " + comment);
      }
    }

    WebEJS_GEN.generate_view.__appendLinks(code, view['Tree'],variables_list,fullmodel);
    code.push("    }; // end of new reset");
    code.push("");
    code.push("    _model.setView(_view);");
    code.push("    _model.reset();");
    if (fullmodel)
      code.push("    _view._enableEPub();");
    code.push("  } // end of _createView\n");
  },

	// --------------------------------
  // Constant pieces
  // --------------------------------

	__EMPTY_VIEW : `  
	var _model = EJSS_CORE.createAnimationLMS();
  const EMPTY_HTML = \`<span style="text-align: center; color:red; font-size: 2em;">Your view is empty</span>
        <hr/>
        <span style="text-align: center; font-size: 1.5em;">To populate your view:</span>
        <ul>
            <li style="list-style-type: none; font-size: 1.25em;">
                1. Select the <span style='font-weight: bold; color: rgb(0,128,192);'>View</span> panel on the top left group of buttons (see figure.)
            </li>
            <li style="list-style-type: none; text-align: center;">
                <img width='60%' src='{{WEBEJS_ASSETS_FOLDER}}/WebEJS/EmptyView/ViewButton.png' />
            </li>
            <li style="list-style-type: none;">
                <span style="font-size: 1.25em;">
                    2. Drag an drop an element from the <b>Compound</b> or <b>Containers</b> palettes onto the <b>Simulation view</b>.
                </span>
                <br/><br/>
                The image shows the <b>SingleDrawing</b> compound element being dragged onto the simulation view.
                This creates a nice initial setting for a simulation with a two-dimensional scene.
            </li>
            <li style="list-style-type: none;">
                <img width='95%' src="{{WEBEJS_ASSETS_FOLDER}}/WebEJS/EmptyView/DragAndDrop.png" />
            </li>
            <li style="list-style-type: none;">
                <span style="font-size: 1.25em;">
                    3. Add and customize elements to fit your needs...
                </span>
                <br/><br/> 
                For more information visit <a href="https://www.um.es/fem/EjsWiki/Main/View" target="_blank" rel="noopener noreferrer">the EJS View help</a>.
            </li>
        </ul>
        \`;
    _view._addElement(EJSS_INTERFACE.panel, '_empty_panel', _view._topFrame)
       // .setProperty("Background","#ebe9e9")
        .setProperty("Html",EMPTY_HTML)
`

};
	

/*
 * Copyright (C) 2024 Francisco Esquembre
 * This code is part of the WebEJS authoring and simulation tool
 */

/**
 * Generation tools
 * @module generation
 */

var WebEJS_GEN = WebEJS_GEN || {};

/**
 * Generation of a simulation HTML
 * @param options Options ofr generation:
 *  - fullModel : true if the HTML should include the full model (versus only the minimum to display the view)
 *  - separatePage : true if the HTML will run in a separate browser tab (vs in an iFrame)
 *  - useCDN : Use the provided CDN (versus using attached _ejs_library, as in a package)
 *  - forPackage : true if the HTML is part of a package (versus it is run here)
 */

WebEJS_GEN.generate = function(mOptions) {

  function __optionHasValue(keyword,value) {
    return keyword in mOptions && mOptions[keyword]==value;
   }
   
   var mEjsLibraryFolder = (__optionHasValue('useCDN', true) ? sMainEjsAssetsFolder : './') + '_ejs_library/';
   var mCodebaseFolder ;
  
  if (__optionHasValue('forPackage', true)) mCodebaseFolder = 'null';
  else {
    const prefix = window.location.protocol + "//" + window.location.host;
    mCodebaseFolder = prefix + sMainGUI.getURLpathFor('');
  }

  // --------------------------------
  // Constant pieces
  // --------------------------------

  const NAME = 'WebEJS : the web version of Easy JavaScript Simulations';
  const VERSION = "1.0";
  const VERSION_DATE = "2404101";
  const WEB_SITE = "https://t.um.es/webejs";
  
  const EJS_CSS            = "css/ejss.css";
  const LIB_MAX_FILENAME   =  "ejsS.v1.max.js"  // prety JS libray
	const LIB_MIN_FILENAME   = "ejsS.v1.min.js"  // uglified JS library
	const COMMON_SCRIPTS     = "scripts/common_script.js"
	const TEXT_SIZE_DETECTOR = "scripts/textresizedetector.js"

  const __VERBOSE_SCRIPT = `
    <script type='text/javascript'><!--//--><![CDATA[//><!--
      var gOldOnError = window.onerror;
      window.onerror = function myErrorHandler(errorMsg, url, lineNumber) {
        console.log(errorMsg + " (at " + url.toString() + " => line:" + lineNumber + ")" );
        if (gOldOnError) return gOldOnError(errorMsg, url, lineNumber);
        return false;
      }
    //--><!]]></script>`;
  
  const __START_UP_SCRIPT = `
      var _model;
      var _scorm;
      window.addEventListener('load',
        function () {
          _model = new {{MODEL_NAME}}("_topFrame","{{EJS_LIBRARY_FOLDER}}","{{CODEBASE_FOLDER}}");
  
          if (typeof _isApp !== "undefined" && _isApp) _model.setRunAlways(true);
          TextResizeDetector.TARGET_ELEMENT_ID = '_topFrame';
          TextResizeDetector.USER_INIT_FUNC = function () {
            var iBase = TextResizeDetector.addEventListener(function(e,args) {
                _model._fontResized(args[0].iBase,args[0].iSize,args[0].iDelta);
                },null);
            _model._fontResized(iBase);
          };
          _model.onload();
        }, false);`;

	// ------------------------------
	// UTILS
	// ------------------------------

  function __getMetadataCode(information) {
    const title = information['Title'];
    const logos = information['Logo'];
    const authors = information['Author'];
    const authorlogos = information['AuthorLogo'];
    const authorList = authors.join(', ');
    var simcopyright = information['Copyright'].trim();
    if (!simcopyright) simcopyright = authorList;
    const now = new Date();

    var code = [];
    code.push("    <div id='metadata' class='metadata'>");
    code.push("      <br />");
    code.push("      <div id='title_author'>");
    code.push("        <hr />");
    code.push("        <b>Title and author:</b>");
    code.push("        <p>");
    if (title) code.push("          "+title + "<br/>");
    for (const l of logos) code.push("          <img alt='Logo' src='" + l + "'/>");
    code.push("        </p>");
    code.push("        <p>");
    for (const al of authorlogos) code.push("          <img alt='author image' src='" + al + "'/>");
    code.push(authorList);
    code.push("        </p>");
    code.push("        <hr />");
    code.push("      </div>");
    code.push("      <p></p>");
    code.push("      <div id='copyright_message'>");
    code.push("        <div class='cc_left'  style='float:left'>");
    code.push("          &#169;" + now.getFullYear() + ", " + simcopyright + ". <br />");
    code.push("          Compiled with <a href='" + WEB_SITE + "' target='_blank'>" + NAME + "</a>.<br />");
    code.push("          Version " + VERSION + " (" + VERSION_DATE + ")");
    code.push("        </div>");
    code.push("        <div class='cc_right' style='float:right'>");
    code.push("          Released under a <a rel='license' target='_blank' href='https://creativecommons.org/licenses/by-nc-sa/4.0/deed.en_US'>");
    code.push("          <img alt='Creative Commons Attribution-NonCommercial-ShareAlike' src='" + mEjsLibraryFolder + "images/cc_icon.png' />");
    code.push("          </a> license.");
    code.push("        </div>");
    code.push("      </div>");
    code.push("    </div>");
    return code.join("\n");
  }

  function __getScriptsImportCode(simulation) {
    var code = [];
    // Add .js files in auxiliary files
    for (filename of simulation['information']['AuxiliaryFiles'])
      if (filename.trim().toLowerCase().endsWith('.js'))
        code.push("    <script src='"+mCodebaseFolder+filename+"'></script>");
    // TODO : Must append JS files in Auxiliary FOLDERS!
    // Add scripts from model elements
    WebEJS_GEN.generate_model.addElementsScriptCode(code,simulation['model'],mOptions['fullModel']);
    return code.join("\n");
  }

  function __createHeader(information, cssFilenameList, manifestFile, scriptsImportCode, mainScriptCode) {
    var buffer = ['<?xml version="1.0" encoding="utf-8"?>'];
    buffer.push('<!DOCTYPE html>');
    buffer.push('<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">');
    buffer.push('  <head>');
    buffer.push('    <meta charset="utf-8" />');
    buffer.push('    <title>' + information['Title'] + '</title>');
    buffer.push(information['HTMLHead']);

    // Find CSS file to include
    for (const cssFilename of cssFilenameList)
      buffer.push('    <link rel="stylesheet"  type="text/css" href="' + cssFilename + '" />');

    if (manifestFile)
      buffer.push('\n    <link rel="manifest" href="' + manifestFile + '" />');
    
    buffer.push(__VERBOSE_SCRIPT);

    // TODO ... how was this done? The script must be recreated...???
    //buffer.push('    <script src="' + mEjsLibraryFolder + COMMON_SCRIPTS + '"></script>');
    buffer.push('    <script src="' + mEjsLibraryFolder + TEXT_SIZE_DETECTOR + '"></script>');
    buffer.push('    <script src="' + mEjsLibraryFolder + LIB_MIN_FILENAME + '"></script>');

    if (scriptsImportCode) buffer.push(scriptsImportCode);
    if (mainScriptCode) buffer.push(mainScriptCode);
    buffer.push("\n  </head>");

    return buffer;
  }

  // ------------------------------
  // Generate 
  // ------------------------------

  const simulation = sMainGUI.saveObject();
  const information = simulation['information'];
  const metadataCode = __optionHasValue('separatePage', true) ? __getMetadataCode(information): '';
  const scriptsImportCode = __getScriptsImportCode(simulation);

  // css files
  const cssFiles = [mEjsLibraryFolder + EJS_CSS];
  for (const user_css of information['CSSFile'].split(';')) {
    if (user_css.toLowerCase().endsWith('.css')) cssFiles.push(user_css);
  } 

  // manifest, if PWA
  var manifestFile = '';
  if (__optionHasValue('type', 'PWA')) cssFiles.push('manifest.json'); // This is actually a json

  var simulationCode = WebEJS_GEN.generate_model.getModelCode(simulation, __optionHasValue('fullModel',true));
  var mainScript = ['    <script type="text/javascript"><!--//--><![CDATA[//><!--'];
  mainScript.push(simulationCode['model']);
  mainScript.push(simulationCode['view']);
  mainScript.push('    //--><!]]></script>')

  var buffer = __createHeader(information, cssFiles, manifestFile, scriptsImportCode, mainScript.join('\n'));

  buffer.push('  <body>')
  buffer.push('    <div role="button" id="_topFrame" style="text-align:center"></div>')
  if (metadataCode) buffer.push(metadataCode);
  buffer.push('    <script type="text/javascript"><!--//--><![CDATA[//><!--');
  buffer.push(__START_UP_SCRIPT.replaceAll("{{MODEL_NAME}}", '_simulation')
                               .replaceAll("{{EJS_LIBRARY_FOLDER}}", mEjsLibraryFolder)
                               .replaceAll("{{CODEBASE_FOLDER}}", mCodebaseFolder));
  if (__optionHasValue('separatePage', false))
    buffer.push('        window.console = window.parent.console;');

  buffer.push("    //--><!]]></script>");
  if (__optionHasValue('extraScripts', true))
    buffer.push(options['extraScripts']);
  buffer.push("  </body>");
  buffer.push("</html>");

  return buffer.join("\n");
}

/*
 * Copyright (C) 2021 Jesús Chacón, Francisco Esquembre and Félix J. Garcia 
 * This code is part of the WebEJS authoring and simulation tool
 */

/**
 * GUI tools
 * @module core
 */

var WebEJS_GUI = WebEJS_GUI || {};

/**
 * Main GUI
 * @class Model 
 * @constructor  
 */

WebEJS_GUI.comm = function(sessionID) {
	var self = {};
	//console.log ("====== Session ID = "+sessionID)

	function addSessionID(url) {
		if (url.indexOf('?')>=0) return url + '&id='+sessionID;
		else return url + '?id='+sessionID;
	}

	// ----------------------------
	// Ajax functions
	// ----------------------------

	function ajaxError(error, message, data) {
		if (data) sMainGUI.errorLine(sMainResources.getString(message)+" : "+data); 
		else sMainGUI.errorLine(sMainResources.getString(message)); 
		sMainGUI.errorLine(sMainResources.getString("Server message")+" : "+error.responseText); 
		sMessageForm.showWarning("Communication error", message, "Check out the output area.");
	}

	function ajaxGet(url, onSuccess, onErrorMessage, onErrorData) {
		$.ajax({
			type: 'GET', 
			url: addSessionID(url),
			headers: { "X-CSRFToken":csrftoken },
			contentType: 'application/json; charset=UTF-8',
			success : onSuccess, 
			error : error => { ajaxError(error, onErrorMessage, onErrorData); }
		});
	}

	function ajaxPost(url, message, onSuccess, onErrorMessage, onErrorData, onErrorListener) {
		$.ajax({
			type: 'POST', 
			url: addSessionID(url),
			headers: { "X-CSRFToken":csrftoken },
			contentType: 'application/json; charset=UTF-8',
			processData: false,
			data: JSON.stringify(message),
			success : onSuccess, 
			error : error => { 
				ajaxError(error, onErrorMessage, onErrorData);
				if (onErrorListener) onErrorListener(); 
			}
		});
	}
	
	function ajaxUpload(url, file, onSuccess, onErrorMessage, onErrorData, onErrorListener) {
		const formData = new FormData();
		formData.append("file", file);
		$.ajax({
			method: 'POST', 
			type: 'POST', 
			url: addSessionID(url),
//			headers: { "X-CSRFToken":csrftoken },
			cache: false,
			enctype:"multipart/form-data",
			contentType: false,
			processData: false,
			data: formData,
			success : onSuccess, 
			error : error => { 
				ajaxError(error, onErrorMessage, onErrorData);
				if (onErrorListener) onErrorListener(); 
			}
		});
	}

	// ----------------------------
	// Entry
	// ----------------------------

	self.disconnect = function() {
		window.location = addSessionID("/logout");
	}

	// ----------------------------
	// System calls
	// ----------------------------

	self.getSystemInformation = function(onSuccess) {
		ajaxGet('/system/system_information', 
			onSuccess, "Error reading system information from server!");
	}

	self.saveWebEJSOptions = function(options) {
		ajaxPost('/system/save_options', options, 
			message => { sMainGUI.logLine(sMainResources.getString("WebEJS options correctly saved")+' ('+message+')'); }, 
			"Error saving WebEJS options!");
	}

	  
	self.addCustomElement = function(element) {
		ajaxPost('/system/add_custom_element', element, 
			elementName => { sMainGUI.logLine(sMainResources.getString("Custom element correctly added")+" : "+elementName); }, 
			"Error adding custom element!");
	}

	self.deleteCustomElement = function(elementType) {
		ajaxPost('/system/delete_custom_element', elementType, 
			type => { sMainGUI.logLine(sMainResources.getString("Custom element correctly deleted")+" : "+type); }, 
			"Error deleting custom element!");
	}

	self.updateRecentFiles = function(path) {
		if (path) {
			ajaxPost('/system/recent_files', { action : 'add', path : path }, 
				function(result) { sMainWebEJSOptions.setRecentFiles(result.files); }, 
				"Error updating recent files list!");
		}
		else {
			ajaxPost('/system/recent_files', { action : 'clean' }, 
				function() { sMainWebEJSOptions.setRecentFiles([]); }, 
				"Error cleaning recent files list!");
		}
  	}

	// ---------------------------------
	// Preview of the simulation's view
	// ---------------------------------

	self.getPreviewURL = function(fullmodel, separated) {
		var url = '/preview?id='+sessionID;
		if (fullmodel) url += "&fullmodel=true";
		if (separated) url += "&separated=true";
		return url;
	}

	// ----------------------------
	// Loading a simulation model
	// ----------------------------

	self.newSimulation = function() {
		sMessageForm.showTemporal("Loading new simulation...",
		  sLocaleFor("Cleaning files..."), "This message should dissapear automatically when done.");
		ajaxGet('/simulation/new?name=NewSimulation.ejs', 
			response => { sMainGUI.readObject(response['simulation']); }, 
			"Error creating new file!");
	}
	
	self.getSimulation = function() {
		ajaxGet('/simulation/get', 
			response => { sMainGUI.readObject(response['simulation']); }, 
			"Error reading file!");
	}

	function loadDownloadedSimulation(files) {
		const options = []
		for (i in files) options.push({'name' : files[i]});
		sMainSelectChoiceForm.show('Choose simulation from the ZIP',options,files[0],
			function(selected) {
				sMessageForm.showTemporal("Loading downloaded simulation...",
				sLocaleFor("Cleaning files..."), "This message should dissapear automatically when done.");
				ajaxGet('/simulation/set_loaded?model='+selected, 
					response => { sMainGUI.readObject(response['simulation']); },
					"Error reading downloaded file!");
			}, null, true
		);
	}

	function processLoadResponse(response) {
		if ('simulation' in response) return sMainGUI.readObject(response['simulation']);
		if ('files' in response) {
			const files = response['files'];
			if (files.length>0) return loadDownloadedSimulation(files);
		}
		// Something went wrong
		sMainGUI.errorLine(sMainResources.getString("No simulation or file list in the server response!")); 
		sMessageForm.showWarning("Reading error", 
			'There is no valid simulation file in ZIP!!!', 
			"Check out the output area.");
	}

	self.uploadUserZIPFile = function(file) {
		ajaxUpload('/simulation/upload_local_zip', file, 
			response => {
				sMainGUI.logLine(sMainResources.getString("ZIP file correctly uploaded."));
				processLoadResponse(response);
			},	
			"Error uploading user's file: ",file);
	}		

	self.downloadLibraryModel = function(model_url,model_name) {
		sMessageForm.showTemporal("Downloading model...", model_name,
			"This message should dissapear automatically when done.");
		ajaxGet('/simulation/library_download?url='+encodeURIComponent(model_url),	
			response => { 
				sMessageForm.hide();
				sMainGUI.logLine(sMainResources.getString("ZIP file correctly downloaded."));
				processLoadResponse(response);
			},	
			"Error downloading library model: ",model_name);
	}

	self.openFromLibrary = function() {
		sMainLibraryChooser.show(
			function(model_url,model_name) { 
				self.downloadLibraryModel(model_url,model_name);
			}
		);
	}

	// ----------------------------
	// Updating the simulation
	// ----------------------------

	// If onSuccess is null, then the simulatyion is run and displayed in a separate window
	/**
	 * Communicates a change in the simulation
	 * One that requires regerating it in the server
	 * @param {json} report Information on the change, may be null
	 * @param {function} onSuccess What to do if the update is successfull. 
	 * If null, the full simulation is displayed
	 * @param {*} onErrorListener 
	 */
	self.updateSimulation = function(report, onSuccess, onErrorListener) {
		var simulation = sMainGUI.saveObject();
		var jsonObj =  { 'simulation' : simulation };
		if (report)  jsonObj['report'] = report;
		ajaxPost('/simulation/update', jsonObj, onSuccess,
			"Error updating simulation!", null, onErrorListener);
	}

	/*
	self.runSimulation = function(onSuccess, onErrorListener) {
		ajaxPost('/simulation/run', simulation, onSuccess, onErrorListener);
	}
	*/

	self.sendActionReport = function(report, onSuccess, onErrorListener) {
		self.updateSimulation(report, onSuccess, onErrorListener);
		//ajaxPost('/report', report, onSuccess, "Error sending report!", report.action, onErrorListener);
	}

	// ----------------------------
	// Exporting the simulation
	// ----------------------------

	self.zipSimulation = function(generate, listener) {
		var simulation = sMainGUI.saveObject();
		var name = simulation.information.Title.trim();
		if ( name == "" || name == null) name = 'untitled';
		else if (name.endsWith('.')) name = name.substring(0,name.length-1);
		if (generate) name = 'webejs_model_'+name+'.zip';
		else name = 'webejs_src_'+name+'.zip';
		sMainFilenameForm.show(name, filename => {
			var url = '/simulation/zip_simulation?filename='+encodeURI(filename);
			if (generate) url += '&generate=true'
			ajaxPost(url, simulation, 
				result => { 
					sMainGUI.logLine(sMainResources.getString("ZIP simulation file correctly created."));
					console.log("Zip ok created");
					console.log(result);
					window.location = result['url'];
					if (listener) listener();
				},	
				"Error creating ZIP simulation file!");
		})
	}		

	// ----------------------------
	// List workspace methods
	// ----------------------------

	/**
	 Checks if a required file is in the URL section of the server
	 */
	self.checkRequiredFile = function(filepath, onSuccess, onError) {
		const fullpath = sMainGUI.getURLpathFor(filepath);
		var request = new XMLHttpRequest();  
		request.open('GET', fullpath, true);
		request.onreadystatechange = function(){
	    if (request.readyState === 4) {
	        if (request.status === 404) {
				if(onError) onError(filepath);
	        }
			else {
				if (onSuccess){
					if (!filepath.startsWith('/')) {
						if (!filepath.startsWith('./')) filepath = './'+filepath;
					}
					onSuccess(filepath,fullpath);
				} 
			}
   		 }
		};
		request.send();
	} 

	// --------------------------------
	// Manage workspace
	// ---------------------------------

	self.refreshUserFiles = function(listener) {
		ajaxGet('/manage/file_list',
			response => { listener(response['listing']); },
			'Updating user files failed');
	}

	self.userFileCommand = function(arguments,listener) {
		ajaxPost('/manage/file_command', arguments, 
			response => { 
				listener(response['params']);
			},
			listener,
			'User file command failed:'+arguments);
	}



  return self;
}
/*
 * Copyright (C) 2021 Jesús Chacón, Francisco Esquembre and Félix J. Garcia 
 * This code is part of the WebEJS authoring and simulation tool
 */

/**
 * GUI tools
 * @module core
 */

var WebEJS_GUI = WebEJS_GUI || {};

/**
 * Main GUI
 * @class Model 
 * @constructor  
 */

WebEJS_GUI.main = function() {
	var self = {};
	var mVersionName = "WebEJS 1.0beta"
	var mSimulationReceived = null;

	var mHasChanged = false;
	//var mSimulationFilename = "NewSimulation.ejss";
	var mSimulationURLpath = '';
	var mSystemInformation = {};
	
	self.getURLpathFor = function(path) { return mSimulationURLpath + path; }
	
/*	
	var mSimulationSourcePath = '';

	self.getSourcePath = function() { return mSimulationSourcePath; }

	self.getWritePath = function() {
		const index = mSimulationFilename.lastIndexOf('.');
		const filename = (index>0) ? mSimulationFilename.substring(0,index) : mSimulationFilename;
		return mSimulationSourcePath+filename+'.webejs';
	}
	self.getExportFilename = function(prefix) { // 'model' or 'src'
		const index = mSimulationFilename.lastIndexOf('.');
		const filename = (index>0) ? mSimulationFilename.substring(0,index) : mSimulationFilename;
		return '_ejs_'+prefix+'_'+filename+'.zip';
	}
*/

	self.getSystemInformation = function(keyword) { return mSystemInformation[keyword]; }
	self.getSystemIconURL = function(src) { return mSystemInformation.system_icons_dir+src; }
	self.getWebEJSLogo = function() { return self.getSystemIconURL("WebEJS_logo.png"); }
	self.getWebEJSLogoImg = function() { 
		return '<img  src="'+sMainGUI.getWebEJSLogo()+'" height="40" class="me-2 d-inline-block align-bottom">';
	}

	var outputSize 	= 25, outputSizeDelta  = 25, outputSizeMin  = 25, outputSizeMax  = 75;
	var previewSize = 50, previewSizeDelta = 25, previewSizeMin = 25, previewSizeMax = 75;
	
	// --------------------------------------
	// Fine tuning the interface
	// --------------------------------------
	
	self.showPanel = function(keyword) {
		if (!$('#'+keyword+'Panel').hasClass('d-none')) return;
		var keys = [ 'sModel', 'sDescription', 'sView'];
		var index = keys.indexOf(keyword);
		if (index !== -1) keys.splice(index, 1);
		for (var i in keys) {
			$('#'+keys[i]+'Panel').addClass('d-none');
			$('#sMainRadioButtons .'+keys[i]+'Btn').removeClass('sRadioButtonOn').addClass('sRadioButtonOff');
		} 
		$('#'+keyword+'Panel').removeClass('d-none');
		$('#sMainRadioButtons .'+keyword+'Btn').removeClass('sRadioButtonOff').addClass('sRadioButtonOn');
	}

	function isPreviewVisible() {
		return !($('#sPreviewPanel').hasClass('d-none'));
	}
	
	function switchVisibility(keyword) {
		if ($('#'+keyword+'Panel').hasClass('d-none')) {
			$('#'+keyword+'Panel').removeClass('d-none');
			$('#sMainRadioButtons .'+keyword+'Btn').removeClass('sRadioButtonOff').addClass('sRadioButtonOn');
			$('#sMainRadioButtons .'+keyword+'BtnPlus').prop('disabled',false);
			$('#sMainRadioButtons .'+keyword+'BtnMinus').prop('disabled',false);
		} 
		else {
			$('#'+keyword+'Panel').addClass('d-none');
			$('#sMainRadioButtons .'+keyword+'Btn').removeClass('sRadioButtonOn').addClass('sRadioButtonOff');
			$('#sMainRadioButtons .'+keyword+'BtnPlus').prop('disabled',true);
			$('#sMainRadioButtons .'+keyword+'BtnMinus').prop('disabled',true);
		}
	}

	$("#sMainRadioButtons .sDescriptionBtn").click(()=>{ self.showPanel('sDescription');}); 
	$("#sMainRadioButtons .sModelBtn").click(()=>{ self.showPanel('sModel');}); 
	$("#sMainRadioButtons .sViewBtn").click(()=>{ self.showPanel('sView');}); 

	self.setSimulationOptionsRadio = function(on) {
			if (on) $("#sMainRadioButtons .sInformationBtn").removeClass('sRadioButtonOff').addClass('sRadioButtonOn');
			else    $("#sMainRadioButtons .sInformationBtn").removeClass('sRadioButtonOn').addClass('sRadioButtonOff');
	}
	
	$("#sMainRadioButtons .sInformationBtn").click(function() {
			sMainSimulationOptions.toggle();
		});
	
	$('#sPreviewPanel').css('min-width',previewSize+'vw');
	$("#sMainRadioButtons .sPreviewBtn").click(()=>{ 
		switchVisibility('sPreview');
		if (isPreviewVisible()) mPreviewArea.updatePreview();
	}); 
	
	$("#sMainRadioButtons .sPreviewBtnPlus").click(()=>{
		previewSize = Math.min(previewSizeMax,previewSize+previewSizeDelta);
		$('#sPreviewPanel').css('min-width',previewSize+'vw');
	}); 
	$("#sMainRadioButtons .sPreviewBtnMinus").click(()=>{
		previewSize = Math.max(previewSizeMin,previewSize-previewSizeDelta);
		$('#sPreviewPanel').css('min-width',previewSize+'vw');
	}); 

	$('#sOutputPanel').css('min-height',outputSize+'vh');
	$("#sMainRadioButtons .sOutputBtn").click(()=>{switchVisibility('sOutput');}); 
	$("#sMainRadioButtons .sOutputBtnPlus").click(()=>{
		outputSize = Math.min(outputSizeMax,outputSize+outputSizeDelta);
		$('#sOutputPanel').css('min-height',outputSize+'vh');
	}); 
	$("#sMainRadioButtons .sOutputBtnMinus").click(()=>{
		outputSize = Math.max(outputSizeMin,outputSize-outputSizeDelta);
		$('#sOutputPanel').css('min-height',outputSize+'vh');
	}); 

	// toolbar tooltips and actions
	
	sMainRefreshTooltips();

	$(".sMainMenuAction").click(function(event) {
		const action = event.currentTarget.dataset.action;
		$(this).tooltip('hide');
		self.mainAction(action);
	});

	// --------------------------------------
	// Simulation parts
	// --------------------------------------

	var mDescriptionPanel = WebEJS_GUI.descriptionWorkpanel('#sDescriptionPanel');
	var mModelPanel = WebEJS_GUI.modelWorkpanel();   
	var mViewPanel  = WebEJS_GUI.viewWorkpanel();  
	var mPreviewArea   = WebEJS_GUI.previewArea();   
	var mOutputArea    = WebEJS_GUI.outputArea();

	self.getModel = function() { return mModelPanel; }

	self.println = function (message) {
    mOutputArea.println(message);
  }
  self.logLine = function (message) { mOutputArea.logLine(message); }
  self.infoLine = function (message) { mOutputArea.infoLine(message); }
  self.warningLine = function (message) { mOutputArea.warningLine(message); }
  self.errorLine = function (message) { mOutputArea.errorLine(message); }

	self.setChanged = function() {
		mHasChanged = true;
	}

  var mViewIsReady = false;
	var mInitCount=0;
	var mReadingWarnings = [];
	
	self.addReadingWarning = function(warning) {
		mReadingWarnings.push(warning);
	}
	
	function processReadingWarnings() {
		if (mReadingWarnings.length<=0) return;
		var html = '';
		for (var i=0; i<mReadingWarnings.length; i++) {
			const warning = mReadingWarnings[i];
			html += "<p>"+warning+"</p>";
		}
		sMessageFormAux.showWarningHTML("Reading Warnings",html);
	}

  function doReadSimulation() {
		if (mSimulationReceived==null) {
			alert ("WebEJS has received no simulation. You should not see this alert!!!");
			return;
		}
		mReadingWarnings = [];
		mSimulationURLpath = mSimulationReceived['url_path'];
		
		window.top.document.title = mVersionName; //+' - '+mSimulationFilename;

		sMainSimulationOptions.readObject(mSimulationReceived['information']);
		mDescriptionPanel.readObject(mSimulationReceived);
		
		var result = mModelPanel.readObject(mSimulationReceived);
		
		if (!mViewIsReady) alert ("WebEJS view not yet ready. You should not see this alert!!!");
    result = result && mViewPanel.readObject(mSimulationReceived);

		if (result) {
			self.logLine(sLocaleFor("File successfully read!")); //+" : "+mSimulationFilename);
			if (isPreviewVisible()) mPreviewArea.updatePreview();
			sMessageForm.hide();
			processReadingWarnings();
		}
		else {
			sMessageForm.showHTML('<h5>'+sLocaleFor("File read with errors!")+'</h5>', "Error reading file!");
			self.errorLine(sLocaleFor("File read with errors!")); //+" : "+mSimulationFilename);
			mPreviewArea.clearPreview(sLocaleFor("Error reading simulation"));
		}
		sMainResources.prepareForTranslation('#sMainWorkpanel');
		sMainSimulationOptions.updateDetectedFiles();
		mHasChanged = false;
	}

	self.saveObject = function() {
    var simulation = {}; 
		simulation['information'] = sMainSimulationOptions.saveObject();
		simulation['description'] = mDescriptionPanel.saveObject();
		simulation['model'] = mModelPanel.saveObject();
		simulation['view'] = mViewPanel.saveObject();
		return simulation;
	}

	self.readObject = function(received) {
		mSimulationReceived = received;
		console.info("Simulation received:");
		console.info(mSimulationReceived);
    if (mViewIsReady === false) readSimulationWhenReady();
    else doReadSimulation();
  }

  function readSimulationWhenReady() {
    if (mViewIsReady === false) {
      mInitCount++;
      mOutputArea.clear();
      mOutputArea.logLine(sLocaleFor("WebEJS initializing...")+" "+mInitCount);
      window.setTimeout(readSimulationWhenReady, 500); /* this checks the flag every 100 milliseconds*/
    } 
    else {
      mOutputArea.clear();
      mOutputArea.infoLine(sLocaleFor("WebEJS is ready!"));
      doReadSimulation();
    }
  }
  
	self.getDetectedFiles = function() {
		var detectedFiles = sMainSimulationOptions.getDetectedFiles();
		detectedFiles.push(...mDescriptionPanel.getDetectedFiles());
		detectedFiles.push(...mModelPanel.getDetectedFiles());
		detectedFiles.push(...mViewPanel.getDetectedFiles());
		return detectedFiles;
	}

	// ----------------------------
	// Refreshing the preview
	// ----------------------------
	
	self.isViewEmpty = function() {
		return mViewPanel.viewIsEmpty();
	}

	self.getTitleForPreview = function() {
		var title = sMainSimulationOptions.getTitle();
		if (title.trim().length<=0) title = sLocaleFor("Simulation"); //mSimulationFilename;
		return title; 		
	}	

	self.reportPreview = function(report) {
		if (!isPreviewVisible()) return;
		//if (self.isViewEmpty()) return;
		mPreviewArea.reportPreview(report);
	}	

	// ----------------------------
	// Actions
	// ----------------------------
	
	function checkForChanges(listener) {
		if (mHasChanged) {
			sMainConfirmationForm.showWarning("The simulation has changed", 
				"Proceeding will make you loose the changes!","Proceed",
				listener);
/*
			sYesNoCancelForm.show("The simulation has changed!",
				mSimulationFilename,
				'<h5 class="text-primary">'+
					sLocaleFor("Do you want to save it?")+
				'</h5>',
				function(answer) { 
					if (answer=="CANCEL") return;
					if (answer=="YES") sMainComm.saveSimulation();
					listener();
				}
			);
			*/
		}
		else listener();
	}

	self.mainAction = function(action,value) {
		switch (action) {
			case "New" : 			checkForChanges(sMainComm.newSimulation); return;
			case "LoadLocal"   : 	checkForChanges(function() { $('#mMainLoadLocalField').click(); }); return;
			case "OpenLibrary" : 	checkForChanges(sMainComm.openFromLibrary); return;
			
			case "FileManager" : 	sMainFileChooser.showManager(); return;
			case "ZipSource"   : 	sMainComm.zipSimulation(false, function() { mHasChanged=false; }); return;
			
			case "Search" :  		sMessageForm.showHTML("Search option","<h5>Not yet implemented</h5>"); return;
			case "Run" 			 : 	mPreviewArea.runSimulation(); return;
			case "ZipSimulation" : 	sMainComm.zipSimulation(true); return;

			case "Translate" : 		translateTo(value); return;
			case "Options" : 		sMainWebEJSOptions.show(); return;
			
			// Only if there is Disk service
			case "Open" : 			checkForChanges(sMainComm.openSimulation); return;
			case "OpenRecent" :		checkForChanges(function() { sMainComm.loadDiskSimulation(value); }); return;
			case "CleanRecent" : 	sMainComm.updateRecentFiles(null); return;
			case "Save" : 			sMainComm.saveSimulation(); return;
			case "SaveAs" : 		sMainComm.saveAsSimulation(); return;
			case "Package" : 		sMainComm.packageSimulation(); return;
			// End of Disk Service

			case "Info" : 			window.open(sMainWebEJS_wiki,"_blank"); return;
			case "Disconnect" : 
				checkForChanges(function(){
					sMainConfirmationForm.show("Disconnection",
						"Sure you want to disconnect?",
						"Disconnect", 
						sMainComm.disconnect);
				}); 
				return;
			
			case "RefreshPreview" : mPreviewArea.updatePreview(); return;
			case "SwitchFullmodel" : mPreviewArea.updatePreview(); return;
		}
	}

	function translateTo(language) {
		sMainResources.setLocale(language);
	}

	// ---- Final start-up
	
	sMainComm.getSystemInformation(result => {
  		mSystemInformation = result; 
  		console.log (result);
 			mViewPanel.buildPalette(mSystemInformation);
 			mModelPanel.getElementsPanel().buildPalette(mSystemInformation);
  		mViewIsReady = true;
	});

  return self;
}
/*
 * Copyright (C) 2021 Jesús Chacón, Francisco Esquembre and Félix J. Garcia 
 * This code is part of the Web EJS authoring and simulation tool
 */

/**
 * GUI forms
 * @module core
 */

/**
	* Creates a form to ask for a new name
 */
WebEJS_GUI.optionsWebEJSPanel = function() {
	var self = {};
  
  const _HTML = `
  <div class="modal modal-dialog-scrollable fade" id="sMainWebEJSOptionsModal" data-bs-backdrop="static" data-bs-keyboard="false" tabindex="-1" aria-hidden="true">
		
	<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
		
		<div class="modal-content">
      	
			<div class="modal-header bg-light text-dark">
    		<img  id="mWebEJSOptionsEditorLogo" height="40" class="me-2 d-inline-block align-bottom;">
      		<h5 class="sTranslatable text-primary modal-title">WebEJS options</h5>
				</img>
      	<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
    	</div>  
    	<!------------------  end modal header --------------->
      	
			<div class="modal-body">
			
				<!-- begin tab headers -->
				<ul class="nav nav-tabs" id="mWebEJSOptionsEditorTabs" role="tablist">
			  	<li class="nav-item" role="presentation">
	     			<button class="sTranslatable nav-link active" id="mWebEJSOptionsEditorAspectTab" 
			 		  		data-bs-toggle="tab" data-bs-target="#mWebEJSOptionsEditorAspectDiv"  
	     			  	type="button" role="tab" aria-controls="mWebEJSOptionsEditorAspectDiv" aria-selected="true">
	     			  	Aspect
	     			 </button>
	    		</li>
			  	<!-- li class="nav-item" role="presentation">
	     			<button class="sTranslatable nav-link " id="mWebEJSOptionsEditorRunningTab" 
						 		data-bs-toggle="tab" data-bs-target="#mWebEJSOptionsEditorRunningDiv"  
	   					 	type="button" role="tab" aria-controls="mWebEJSOptionsEditorRunningDiv" aria-selected="false">
     					 Running
	     			</button>
	    		</li>
			  	<li class="nav-item" role="presentation">
	     			<button class="sTranslatable nav-link" id="mWebEJSOptionsEditorExportTab" 
			 		  		data-bs-toggle="tab" data-bs-target="#mWebEJSOptionsEditorExportDiv"  
	     			  	type="button" role="tab" aria-controls="mWebEJSOptionsEditorExportDiv" aria-selected="false">
	     			  Export
	     			</button>
	    		</li>
			  	<li class="nav-item" role="presentation">
	     			<button class="sTranslatable nav-link" id="mWebEJSOptionsEditorDigitalLibrariesTab" 
			 			 		data-bs-toggle="tab" data-bs-target="#mWebEJSOptionsEditorDigitalLibrariesDiv"  
	     			  	type="button" role="tab" aria-controls="mWebEJSOptionsEditorDigitalLibrariesDiv" aria-selected="false">
	     			  DL
	  				</button>
	    			</li-->
			 		<li class="nav-item" role="presentation">
	    			<button class="sTranslatable nav-link" id="mWebEJSOptionsEditorAuthorTab" 
						  	data-bs-toggle="tab" data-bs-target="#mWebEJSOptionsEditorAuthorDiv"  
	     				  type="button" role="tab" aria-controls="mWebEJSOptionsEditorAuthorDiv" aria-selected="false">
	   					 Author
	   				</button>
  				</li>
				</ul> 
				<!-- end tab headers -->
	     			
				<!-- begin tab content -->
				<div class="tab-content" id="mWebEJSOptionsEditorTabsContent">
			 		  
					<div class="tab-pane fade show " id="mWebEJSOptionsEditorRunningDiv" 
			 			  	role="tabpanel" aria-labelledby="mWebEJSOptionsEditorRunningTab">
				 				
			 		</div>
			 		  	
			 		<div class="tab-pane fade show" id="mWebEJSOptionsEditorExportDiv" 
			 			   role="tabpanel" aria-labelledby="mWebEJSOptionsEditorExportTab">
							
			 		</div>
			 		  	
			 		<!-- begin ASPECT content -->
			 		<div class="tab-pane fade show active" id="mWebEJSOptionsEditorAspectDiv" 
			 			   role="tabpanel" aria-labelledby="mWebEJSOptionsEditorAspectTab">
			 			  			
							<div class="mb-2 input-group">
								<span class="sTranslatable input-group-text">Language</span>
								<select id="mWebEJSOptionsEditorLanguage" class="form-select">
									<option selected value="en">English</option>
									<option value="es">Español</option>
								</select>
							</div>

			 			<div class="input-group-text form-check mb-2" id="mWebEJSOptionsEditorShowPanel">
					  	<span class="form-check form-check-inline">
								<label class="inline sTranslatable">Panel at start-up:</label>
					  	</span>
					  	<span class="form-check form-check-inline">
					  		<input class="form-check-input" type="radio" checked 
					 				name="mWebEJSOptionsEditorShowPanel" id="mWebEJSOptionsEditorShowPanelDescription" value="Description">
					  		<label class="form-check-label sTranslatable" for="mWebEJSOptionsEditorShowPanelDescription">Description</label>
					  	</span>
					  	<span class="form-check form-check-inline">
					  		<input class="form-check-input" type="radio" 
					 				name="mWebEJSOptionsEditorShowPanel" id="mWebEJSOptionsEditorShowPanelModel" value="Model">
					  		<label class="form-check-label sTranslatable" for="mWebEJSOptionsEditorShowPanelModel">Model</label>
					  	</span>
					  	<span class="form-check form-check-inline">
					  		<input class="form-check-input" type="radio" 
					 				name="mWebEJSOptionsEditorShowPanel" id="mWebEJSOptionsEditorShowPanelView" value="View">
					  		<label class="form-check-label sTranslatable" for="mWebEJSOptionsEditorShowPanelView">View</label>
					  	</span>
						</div>

					<!-----------------------------
					   Preview options
					  ---------------------------->
						<div class="form-check mt-2 mb-2 mx-3">
							<input class="form-check-input" type="checkbox" value="" checked 
								 name="mWebEJSOptionsEditorShowPreview" id="mWebEJSOptionsEditorShowPreview">
							<label class="sTranslatable form-check-label" for="mWebEJSOptionsEditorShowPreview">
								Show preview at start up
							</label>
						</div>
						<div class="input-group-text form-check mb-2" id="mWebEJSOptionsEditorShowPreviewSize">
					  	<span class="form-check form-check-inline">
								<label class="inline sTranslatable">Preview size:</label>
					  	</span>
					  	<span class="form-check form-check-inline">
					  		<input class="form-check-input" type="radio" 
					 				name="mWebEJSOptionsEditorShowPreviewSize" id="mWebEJSOptionsEditorShowPreviewSizeSmall" value="small">
					  		<label class="form-check-label sTranslatable" for="mWebEJSOptionsEditorShowPreviewSizeSmall">Small</label>
					  	</span>
					  	<span class="form-check form-check-inline">
					  		<input class="form-check-input" type="radio" checked 
					 				name="mWebEJSOptionsEditorShowPreviewSize" id="mWebEJSOptionsEditorShowPreviewSizeMedium" value="medium">
					  		<label class="form-check-label sTranslatable" for="mWebEJSOptionsEditorShowPreviewSizeMedium">Medium</label>
					  	</span>
					  	<span class="form-check form-check-inline">
					  		<input class="form-check-input" type="radio" 
					 			  name="mWebEJSOptionsEditorShowPreviewSize" id="mWebEJSOptionsEditorShowPreviewSizeLarge" value="large">
					  		<label class="form-check-label sTranslatable" for="mWebEJSOptionsEditorShowPreviewSizeLarge">Large</label>
					  	</span>
						</div>
					<!-----------------------------
					   Output options
					  ---------------------------->
						<div class="form-check mb-2 mx-3">
							<input class="form-check-input" type="checkbox" value="" checked 
								 name="mWebEJSOptionsEditorShowOutput" id="mWebEJSOptionsEditorShowOutput">
							<label class="sTranslatable form-check-label" for="mWebEJSOptionsEditorShowOutput">
								Show Output at start up
							</label>
						</div>
						<div class="input-group-text form-check mb-2" id="mWebEJSOptionsEditorShowOutputSize">
					  	<span class="form-check form-check-inline">
								<label class="inline sTranslatable">Output size:</label>
					  	</span>
					  	<span class="form-check form-check-inline">
					  		<input class="form-check-input" type="radio" 
					 				name="mWebEJSOptionsEditorShowOutputSize" id="mWebEJSOptionsEditorShowOutputSizeSmall" value="small">
					  		<label class="form-check-label sTranslatable" for="mWebEJSOptionsEditorShowOutputSizeSmall">Small</label>
					  	</span>
					  	<span class="form-check form-check-inline">
					  		<input class="form-check-input" type="radio" checked 
					 				name="mWebEJSOptionsEditorShowOutputSize" id="mWebEJSOptionsEditorShowOutputSizeMedium" value="medium">
					  		<label class="form-check-label sTranslatable" for="mWebEJSOptionsEditorShowOutputSizeMedium">Medium</label>
					  	</span>
					  	<span class="form-check form-check-inline">
					  		<input class="form-check-input" type="radio" 
					 			  name="mWebEJSOptionsEditorShowOutputSize" id="mWebEJSOptionsEditorShowOutputSizeLarge" value="large">
					  		<label class="form-check-label sTranslatable" for="mWebEJSOptionsEditorShowOutputSizeLarge">Large</label>
					  	</span>
						</div>

					<!-----------------------------
					   Other options
					  ---------------------------->
						<div class="form-check mt-2 mb-2 mx-3">
							<input class="form-check-input" type="checkbox" value="" 
								 name="mWebEJSOptionsEditorShorterLabels" id="mWebEJSOptionsEditorShorterLabels">
							<label class="sTranslatable form-check-label" for="mWebEJSOptionsEditorShorterLabels">
								Use short labels
							</label>
				    </div>
																
			 		</div>
			 		<!-- end ASPECT content -->
			 		
			 		<div class="tab-pane fade show" id="mWebEJSOptionsEditorDigitalLibrariesDiv" 
			 			   role="tabpanel" aria-labelledby="mWebEJSOptionsEditorDigitalLibrariesTab">
			 		</div>
	
				 		<!-- begin AUTHOR content -->
			 		<div class="tab-pane fade show" id="mWebEJSOptionsEditorAuthorDiv" 
			 			   role="tabpanel" aria-labelledby="mWebEJSOptionsEditorAuthorTab">
			 			   
			 			<div class="mb-2">
          		<label for="mWebEJSOptionsEditorAuthorNameValue" class="sTranslatable form-label form-label-sm">Name</label>
          		<input type="text" class="form-control form-control-sm" name="mWebEJSOptionsEditorAuthorNameValue" id="mWebEJSOptionsEditorAuthorNameValue"
            		placeholder="Enter your name here" >
        		</div>
			 			<div class="mb-2">
          		<label for="mWebEJSOptionsEditorAuthorAffiliationValue" class="sTranslatable form-label form-label-sm">Affiliation</label>
          		<input type="text" class="form-control form-control-sm" name="mWebEJSOptionsEditorAuthorAffiliationValue" id="mWebEJSOptionsEditorAuthorAffiliationValue"
            		placeholder="Enter your affiliation here" >
        		</div>
			 			<div class="mb-2">
          		<label for="mWebEJSOptionsEditorAuthorContactValue" class="sTranslatable form-label form-label-sm">Contact</label>
						  <textarea class="form-control" id="mWebEJSOptionsEditorAuthorContactValue" rows="5"></textarea>
        		</div>
			 			   
			 		</div>
						
				</div>
				<!-- end tab content -->
					
			</div>
    	<!------------------  end modal body --------------->
		
			<div class="modal-footer">
				<button type="button" id="mWebEJSOptionsEditorCancelButton" class="sTranslatable btn btn-secondary me-auto" data-dismiss="modal">Done</button>
				<button type="button" id="mWebEJSOptionsEditorSaveButton" class="sTranslatable btn btn-primary float-left">Save as browser cookies</button>
			</div>
	    <!------------------  end modal footer --------------->
		
		</div>
		<!------------------  end modal content --------------->

			
	</div>	
	<!------------------  end modal-dialog --------------->

</div>
<!------------------  end modal --------------->
`;

  $( "body" ).append( $(_HTML) );
	var mModal = new bootstrap.Modal(document.getElementById('sMainWebEJSOptionsModal'))
  $('#mWebEJSOptionsEditorLogo').attr("src",sMainEjsLogo);


	$('#mWebEJSOptionsEditorCancelButton').click(function() {
		mModal.hide();
	});

	$('#mWebEJSOptionsEditorSaveButton').click(function() {
		sMainComm.saveWebEJSOptions(collectValues());
		mModal.hide();
	});

	$('#mWebEJSOptionsEditorLanguage').on('change', function(e){
		sMainResources.setLocale(this.value);
		console.log(this.value,
					this.options[this.selectedIndex].value,
					$(this).find("option:selected").val(),);
	});

	// ----------------------------
	// Preview options
	// ----------------------------
	
	function setPreviewSize() {
		const checked = $('input[name=mWebEJSOptionsEditorShowPreviewSize]:checked');
		switch (checked.val()) {
			case "small" : $('#sPreviewPanel').css('min-width','25vw'); break;
			case "large" : $('#sPreviewPanel').css('min-width','75vw'); break;
			default : $('#sPreviewPanel').css('min-width','50vw'); break;
		}
	}
	
	$('#mWebEJSOptionsEditorShowPreviewSize').on('change', setPreviewSize);

	// ----------------------------
	// Output options
	// ----------------------------
	
	function setOutputSize() {
		const checked = $('input[name=mWebEJSOptionsEditorShowOutputSize]:checked');
		switch (checked.val()) {
			case "small" : $('#sOutputPanel').css('min-height','25vh'); break;
			case "large" : $('#sOutputPanel').css('min-height','75vh'); break;
			default : $('#sOutputPanel').css('min-height','50vh'); break;
		}
	}
	
	$('#mWebEJSOptionsEditorShowOutputSize').on('change', setOutputSize);

	// ----------------------------
	// Other options
	// ----------------------------
	
	function setShorterLabels() {
		if ($('#mWebEJSOptionsEditorShorterLabels').is(":checked")) {
			$('#sModelVariables-tab .sModelTabLabel').text('Vars');
			$('#sModelInitialization-tab .sModelTabLabel').text('Init');
			$('#sModelEvolution-tab .sModelTabLabel').text('Evol');
			$('#sModelFixedRelations-tab .sModelTabLabel').text('FixRel');
			$('#sModelCustom-tab .sModelTabLabel').text('Cstm');
			$('#sModelElements-tab .sModelTabLabel').text('Elms');
		}	
		else {
			$('#sModelVariables-tab .sModelTabLabel').text('Variables');
			$('#sModelInitialization-tab .sModelTabLabel').text('Initialization');
			$('#sModelEvolution-tab .sModelTabLabel').text('Evolution');
			$('#sModelFixedRelations-tab .sModelTabLabel').text('Fixed Relations');
			$('#sModelCustom-tab .sModelTabLabel').text('Custom');
			$('#sModelElements-tab .sModelTabLabel').text('Elements');
		}
		sMainResources.updateTranslation([
			'#sModelVariables-tab',
			'#sModelInitialization-tab',
			'#sModelEvolution-tab',
			'#sModelFixedRelations-tab',
			'#sModelCustom-tab',
			'#sModelElements-tab'
		]);
	}
		
	$('#mWebEJSOptionsEditorShorterLabels').on('change', setShorterLabels);


	// ----------------------------
	// Input/Output options
	// ----------------------------

	function collectValues() {
		var options = {};
		options['panel_at_start_up'] = $('input[name=mWebEJSOptionsEditorShowPanel]:checked').val();
		options['show_preview_at_start_up'] = $('#mWebEJSOptionsEditorShowPreview').is(":checked") ? "true" : "false";
		options['preview_size'] = $('input[name=mWebEJSOptionsEditorShowPreviewSize]:checked').val();
		options['show_output_at_start_up'] = $('#mWebEJSOptionsEditorShowOutput').is(":checked") ? "true" : "false";
		options['output_size'] = $('input[name=mWebEJSOptionsEditorShowOutputSize]:checked').val();
		options['use_short_labels'] = $('#mWebEJSOptionsEditorShorterLabels').is(":checked") ? "true" : "false";
		options['author_name'] = $('#mWebEJSOptionsEditorAuthorNameValue').val();
		options['author_affiliation'] = $('#mWebEJSOptionsEditorAuthorAffiliationValue').val();
		options['author_contact'] = $('#mWebEJSOptionsEditorAuthorContactValue').val();
		return options;

	}
	
	self.show = function() {
		mModal.show();
	}

	function checkDefaults(options) {
		if (!('panel_at_start_up' in options)) 				options['panel_at_start_up'] = "Description";
		
		if (!('show_preview_at_start_up' in options)) options['show_preview_at_start_up'] = "true";
		if (!('preview_size' in options)) 						options['preview_size'] = "medium";

		if (!('show_output_at_start_up' in options)) 	options['show_output_at_start_up'] = "true";
		if (!('output_size'  in options)) 						options['output_size']  = "small";

		if (!('use_short_labels' in options)) 				options['use_short_labels'] = "false";

		if (!('author_name' in options)) 							options['author_name'] = "";
		if (!('author_affiliation' in options)) 			options['author_affiliation'] = "";
		if (!('author_contact' in options)) 					options['author_contact'] = "";

		return options;
	}
		
	self.readOptions = function(options) {
		options = checkDefaults(options);
		const panel = options['panel_at_start_up'];
		
		$('#mWebEJSOptionsEditorShowPanel input[value='+panel).prop('checked',true);
		sMainGUI.showPanel('s'+panel);
		
		if (options['show_preview_at_start_up']=="false") {
			$('#mWebEJSOptionsEditorShowPreview').prop("checked", false);
			$('#sPreviewPanel').addClass('d-none');
			$('#sMainRadioButtons .sPreviewBtn').removeClass('sRadioButtonOn').addClass('sRadioButtonOff');
			$('#sMainRadioButtons .sPreviewBtnPlus').prop('disabled',true);
			$('#sMainRadioButtons .sPreviewBtnMinus').prop('disabled',true);
		}
		if (options['show_output_at_start_up']=="false") {
			$('#mWebEJSOptionsEditorShowOutput').prop("checked", false);
			$('#sOutputPanel').addClass('d-none');
			$('#sMainRadioButtons .sOutputBtn').removeClass('sRadioButtonOn').addClass('sRadioButtonOff');
			$('#sMainRadioButtons .sOutputBtnPlus').prop('disabled',true);
			$('#sMainRadioButtons .sOutputBtnMinus').prop('disabled',true);
		}
		$('#mWebEJSOptionsEditorShowPreviewSize input[value='+options['preview_size']).prop('checked',true);
		setPreviewSize();
		$('#mWebEJSOptionsEditorShowOutputSize input[value='+options['output_size']).prop('checked',true);
		setOutputSize();
		
		if (options['use_short_labels']=="true") {
			$('#mWebEJSOptionsEditorShorterLabels').prop("checked", true);
			setShorterLabels();
		}
		
		$('#mWebEJSOptionsEditorAuthorNameValue').val(options['author_name'])
		$('#mWebEJSOptionsEditorAuthorAffiliationValue').val(options['author_affiliation']);
		$('#mWebEJSOptionsEditorAuthorContactValue').val(options['author_contact']);
	}
	
	self.setRecentFiles = function(files) {
    // Read previously opened files
    const ul = $('#sMainMenu_Previous');
	if (!ul) {
		alert("No recent files");
		return;
	}
    ul.empty();
    ul.append($('<li><span class="sTranslatable dropdown-item-text fw-bold">Recent files:</span></li>'));
    ul.append($('<li><hr class="dropdown-divider"></li>'));
    if (files.length>0) {
      for (var i=0; i<files.length; i++) {
        const li = $('<li><button type="button" class="sRecentFileAction btn btn-outline-primary border-0" data-action="OpenRecent"></button></li>');
        var path = files[i];
        if (path.startsWith('/source/')) $(li).find('button').text(path.substring(8));
        else $(li).find('button').text(path);
        $(li).find('button').data('path',path)
        ul.append(li);
      }
    }
    else {
      ul.append($('<li><span class="sTranslatable dropdown-item-text">(No recent files)</span></li>'));
    }
    ul.append($('<li><hr class="dropdown-divider"></li>'));
    ul.append($('<li><button type="button" class="sTranslatable sRecentFileAction btn fw-bold" data-action="CleanRecent">Clean list</button></li>'));
  
    $(".sRecentFileAction").click(function() {
      const action = $(this).data('action');
      const path = $(this).data('path');
      sMainGUI.mainAction(action,path);
    });     
      
  }
  
	return self;
}

/*
 * Copyright (C) 2021 Jesús Chacón, Francisco Esquembre and Félix J. Garcia 
 * This code is part of the Web EJS authoring and simulation tool
 */

/**
 * GUI tools
 * @module core
 */

var WebEJS_GUI = WebEJS_GUI || {};

const sDescriptionIFrameOnLoad = function(hash) {
		  var head = $('#mDescriptionExternalPageFrame_'+hash).contents().find("head");
		  var css = '<link href="'+sMainEjsAssetsFolder+'_ejs_library/css/ejss.css" rel="stylesheet" type="text/css" />';
	   //console.log("HEad was:")
			//console.log (head);
		  head.append(css);
	     //console.log("HEad is now:")
			//console.log (head);
			sMainSimulationOptions.updateDetectedFiles();
}
  
WebEJS_GUI.descriptionWorkpanel = function(mMainPanelSelector) {
	const TABBED_PANEL = WebEJS_TOOLS.tabbedPanel();

	var self = {};
	var mHTMLEditors = {};

	// Implementation of TabbedPanel (begin)

	self.getMainPanelSelector	= function() { return mMainPanelSelector; }
	self.getKeyword	= function() { return 'Description'; }
	self.getPageName	= function() { return 'Desc Page'; }
	self.getDefaultPageType = function() { return 'DESCRIPTION_EDITOR'; }

	// ----- optional functions for TabbedPanel
	
	self.isPageSecondType = function(mPageDiv) { 
		return mPageDiv.find('.mDescriptionExternalHTMLFileField').length>0; 
	}	
	self.getSecondType = function() { return 'DESCRIPTION_VIEWER'; }
	self.getSecondTypeLabel = function() { return 'Create a new HTML display page'; }
	
	self.reportableChange = function(command) { sMainGUI.setChanged(); }
	
	// ----- end of optional functions for TabbedPanel


	// Rest of the implementation of TabbedPanel at the end

	// -----------------------------
	// Once-only GUI initialization
	// -----------------------------

	// --------------------------
	// read and write
	// --------------------------

	function getLocalePages(pages, locale) {
		var localePages = [];
		var otherLocales = false;
		for (var i=0; i<pages.length; i++) {
			const page = pages[i];
			if (page.Locale!=locale) {
				sMainGUI.println(sMainResources.getString("WARNING: Ignoring locale file ("+page.Locale+") description for page: "+page.Name));
				otherLocales = true;				
			}
			else localePages.push(page);
		}
		if (otherLocales) { 
			sMainGUI.addReadingWarning(
				'<p>'+
					sMainResources.getString("The description of this simulation has non-default locale pages.")+
					'<br>'+
					'<small class="text-danger">'+
						sMainResources.getString("Locales (translations) are ignored and lost when you save!")+
					'</small>'+
				'</p>'
			);
		}
		return localePages;
	}

	self.readObject = function(saved) {
		if (!('description' in saved && 'pages' in saved.description) ) {
			self.setNoPages();
		}
		else { // read pages
			const pages = saved.description.pages;
			if (pages==null || pages.length<=0) self.setNoPages();
			else {
				const localePages = getLocalePages(pages,'_default_');
				$(mMainPanelSelector).html(TABBED_PANEL.panelHTML(self,localePages));
				TABBED_PANEL.initPanel(self,localePages);					
			}
		}
		return true;
	}

	self.saveObject = function() {
		//const localePages = getFullPages(TABBED_PANEL.getAllPagesObject(self));
		return { 'pages' : TABBED_PANEL.getAllPagesObject(self) };
	}

	self.getDetectedFiles = function() {
		return TABBED_PANEL.getAllPagesDetectedFiles(self);
	}

	// ---------------------------------------
	// TabbedPanel implementation (continued)
	// ---------------------------------------


	self.setNoPages = function() {
		$(mMainPanelSelector).html(
			'<div class="h-100 col-12 mx-auto btn-group-vertical" style="flex-grow:1;">'+
				'<button class="sDescriptionBtn sPanelNoPageBtn rounded-0 col-12 h-50 active" data-type="'+self.getDefaultPageType()+'" >'+
					'<h5 class="sTranslatable">Click to create a description page</h5>'+
				'</button>'+
				'<button class="sDescriptionBtn sPanelNoPageBtn rounded-0 col-12 h-50 active" data-type="'+self.getSecondType()+'" >'+
					'<h5 class="sTranslatable">Click to create an HTML display page</h5>'+
				'</button>'+
			'</div>');
		TABBED_PANEL.initPanel(self,null);
	}
		
	self.pageMainBuilder = function(mHash, mPage, mType) {
		if (mType=='DESCRIPTION_VIEWER' || (mPage && mPage.External=="true")) return htmlViewerPage(mHash,mPage);
		return ''+
			'<div class="sCommentPanel" style="flex-basis:0;flex-grow: 0">'+
				'<div class="h-100 input-group input-group-sm">'+
					'<span class="sTranslatable sDescriptionBtn input-group-text">Title</span>'+
					'<input type="text" class="sPageCommentField form-control" id="mDescriptionEditorTitle_'+mHash+'"'+
					(mPage && mPage.Title ? ' value="'+ mPage.Title+'"' :'') +	'>' +	
				'</div>'+			
			'</div>' +
			'<div id = "mDescriptionInternalPage_'+mHash+'" class="d-flex flex-column" style="flex-grow:1" >'+ 
				'<textarea id="mDescriptionEditorArea_'+mHash+'" class="suneditor" style="flex-grow:1">'+
				'</textarea>'+
			'</div>'+
			'';

		//return '<div class="suneditor" id="mdescriptionPageEditor_'+mHash+'" style="flex-grow:1"></div>';
	}

	// self.pageCommentBuilder = function(mHash, mPage)  // No comments on description pages

	self.showUserFileError = function(path) {
		var html = 
			'<p>'+
				sMainResources.getString("The selected file is not included in your simulation list of <i>User files</i>:")+
			'</p>'+
			'<p class="text-danger">'+path+'</p>' +
			'<p>'+sMainResources.getString("Please, add it before using it.","User file error")+'</p>';
		sMessageForm.showHTML('User File Error',html);
	}
	
	self.pageInitialization = function(mPageDiv, mPageObject) {
		const hash = TABBED_PANEL.getPageDivHash(mPageDiv);
		var title = (mPageObject ? mPageObject.Title  : TABBED_PANEL.getPageDivName(self,mPageDiv));
		$("#mDescriptionEditorTitle_"+hash).val(title);
		if (self.isPageSecondType(mPageDiv)) { // Initialization in case of external HTML
						
			mPageDiv.find('.cFileChooser').on("click", (event)=>{ 
				if (TABBED_PANEL.isPageDisabled(self,mPageDiv)) return;
				WebEJS_TOOLS.selectFile(['html','xhtml'], 
					function(path,urlPath) { 
						$('#mDescriptionExternalHTMLFileField_'+hash).val(path);
						$('#mDescriptionExternalPageFrame_'+hash).attr('src', urlPath); 
						//sMainSimulationOptions.addToDetectedFiles(path); // This is why the list is refreshed BEFORE the file is loaded
					},
					true, // Check existence
					null // No helper div
				);
			});
					
		}
		else { // Initialization in case of HTML editor page
			var code = (mPageObject ? mPageObject.Code : '<h1>'+TABBED_PANEL.getPageDivName(self,mPageDiv)+'</h1>');
			mHTMLEditors[hash] = SUNEDITOR.create(document.getElementById('mDescriptionEditorArea_'+hash),{
				// All of the plugins are loaded in the "window.SUNEDITOR" object in dist/suneditor.min.js file
				// Insert options
				//resizingBar: false,
				//resizeEnable : false,
				//resizingBarContainer : document.querySelector('#mDescriptionInternalPage_'+hash),
				// Language global object (default: en)
			 	width:"100%",
				height: 250 ,	
				//maxHeight: 500,
				buttonList: [
		        ['undo', 'redo'],
		       
		        ['bold', 'underline', 'italic', ':t-More Text-default.more_text', 'strike', 'subscript', 'superscript' ],
		        ['formatBlock', 'list', 'fontColor', 'horizontalRule', ':p-More Paragraph-default.more_paragraph', 'font', 'fontSize', 'hiliteColor', 'textStyle', 'align', 'lineHeight',  'paragraphStyle', 'blockquote'],
		                    
		        ['removeFormat'],
		       // '/', // Line break
		        ['outdent', 'indent'],
		        ['link', 'image', ':r-More Rich-default.more_plus', 'table', 'video', 'audio' /** ,'math' */], // You must add the 'katex' library at options to use the 'math' plugin.
		        ['codeView', ':v-View-text.View','fullScreen', 'showBlocks',  'preview']
		    ],
				lang: SUNEDITOR_LANG[sMainResources.getLocale()]
			});
			//console.log (code);
			mHTMLEditors[hash].setContents(convertToAbsolute(code));
		}
	}
/*
					toolbarContainer : '#'+id,
					showPathLabel : false,
					charCounter : true,
					//maxCharCount : 720,
					width : '100%',
					//maxWidth : '700px',
					height : '100%',
		//    minHeight : '100px',
		//    maxHeight: '250px',
					buttonList : [
		        ['undo', 'redo', 'font', 'fontSize', 'formatBlock'],
		        ['bold', 'underline', 'italic', 'strike', 'subscript', 'superscript', 'removeFormat'],
		        //'/' // Line break
		        ['fontColor', 'hiliteColor', 'outdent', 'indent', 'align', 'horizontalRule', 'list', 'table'],
		        ['link', 'image', 'video', 'fullScreen', 'showBlocks', 'codeView', 'preview']
					],
				});
				*/

	
	self.disablePage = function(mPageHash,mDisabled) {
    const pageDiv = TABBED_PANEL.getDivPageByHash(self,mPageHash);
		if (!self.isPageSecondType(pageDiv)) {
			if (mDisabled) mHTMLEditors[mPageHash].disable();
			else mHTMLEditors[mPageHash].enable();
		}
	}
	
	self.pageDeleted = function(mPageDiv) {
		const hash = TABBED_PANEL.getPageDivHash(mPageDiv);
		if (!self.isPageSecondType(mPageDiv)) {
			mHTMLEditors[hash] = null;
		}
	}

	function makeItHtmlPage(code) {
		return ''+
			'<html>\n'+
				'<head></head>\n'+
				'<body>\n'+
					code + '\n'+
				'</body>\n'+
			'</html>';
	} 
	
	self.getPageObject = function(mPageHash) {
		var page = TABBED_PANEL.getPageObject(self,mPageHash);
		const isExternal = self.isPageSecondType(TABBED_PANEL.getDivPageByHash(self,mPageHash));
		page.Locale 	= '_default_';
		page.Title 		= $("#mDescriptionEditorTitle_"+mPageHash).val();
		page.External =  isExternal ? "true" : "false",
		page.Code 	  = isExternal 	?  $('#mDescriptionExternalHTMLFileField_'+mPageHash).val() 
									: makeItHtmlPage(convertToRelative(mHTMLEditors[mPageHash].getContents()));
		return page;
	}

	function addSrcToList(detectedFiles, contents, prefix) {
		contents.find('img').each(function () {
			var src = $(this).attr("src");
			if (src.indexOf('//')<0) { // Ignore internet files
				if (! src.startsWith(prefix)) src = prefix+src; // Add prefix
				detectedFiles.push(src);
			}
		});
	} 

	self.getPageDetectedFiles = function(mPageHash) {
		const isExternal = self.isPageSecondType(TABBED_PANEL.getDivPageByHash(self,mPageHash));
		var detectedFiles = [];
		if (isExternal) {
			const file = $('#mDescriptionExternalHTMLFileField_'+mPageHash).val().trim();
			if (file.length>0) {
				detectedFiles.push(file); 
				const name = file.split('\\').pop().split('/').pop();
				const path = file.substring(0,file.length-name.length);
				addSrcToList(detectedFiles,$('#mDescriptionExternalPageFrame_'+mPageHash).contents(),path);
			}
		} 
		else {
			// detectedFiles.push(...getEmbeddedFiles(mHTMLEditors[mPageHash].getContents()));
			addSrcToList(detectedFiles,$(mHTMLEditors[mPageHash].getContents()),'./');
		}
		return detectedFiles;
	}

	function htmlViewerPage(mHash, mPage) {
		var src = '';
		var path = '';
		if (mPage && mPage.Code) {
			path = mPage.Code.trim();
			if (path.startsWith('./')) {
				src = sMainGUI.getURLpathFor(path.substring(2));
			}
			else src = path;
		}
		var html =  ''+
			'<div id="mDescriptionExternalPage_'+mHash+'" class="d-flex flex-column" style="flex-grow:1">'+
				'<div class="sCommentPanel" style="flex-basis:0;flex-grow: 0">'+
					'<div class="h-100 input-group input-group-sm">'+
						'<span class="sTranslatable input-group-text">Title</span>'+
						'<input type="text" class="sPageCommentField form-control" id="mDescriptionEditorTitle_'+mHash+'"'+
						(mPage && mPage.Title ? ' value="'+ mPage.Title+'"' :'') +	'>' +	
					'</div>'+			
				'</div>' +
				'<div class="d-flex flex-column col-12 " style="flex-grow:1">'+
					'<iframe id="mDescriptionExternalPageFrame_'+mHash+'" class="mDescriptionIFrame py-0" title="Description page"'+
					' onload="sDescriptionIFrameOnLoad('+mHash+')" style="flex-grow:1; overflow: auto;" '+
						(src.length>0 ? ' src="'+src+'"' :'') +	'>' +	
					'</iframe>'+
				'</div>'+

				'<div class="mFileChooserPanel d-flex flex-row" style="flex-basis:0;flex-grow: 0">'+
					'<div class="input-group input-group-sm" style="flex-grow: 1;">'+
						'<span class="sTranslatable input-group-text">HTML File</span>'+
						'<input type="text" class="mDescriptionExternalHTMLFileField form-control" '+
							'id="mDescriptionExternalHTMLFileField_'+mHash+'"'+
							' placeholder="&lt;Type or click the button to the right to select HTML file&gt;" aria-label="Filepath"'+
						(path.length>0 ? ' value="'+ path+'"' :'') +	'>' +	
							'<span class="input-group-text">'+
								'<i class=" bi bi-file-richtext cFileChooser" '+
									' data-field="#mDescriptionExternalHTMLFileField_'+mHash+'" '+
									' style="font-size: 1rem;"></i>'+
							'</span>'+
					'</div>'+	
				'</div>'+	

			'</div>';
		return html;
	}

	/*
  function getEmbeddedFiles (_text) {
	var detectedFiles = [];
    const prefix = window.location.protocol + "//" + window.location.host+'/'+sMainGUI.getURLpathFor('');
    const prefix_length = prefix.length;
    var textLowercase = _text.toLowerCase();
    var index = textLowercase.indexOf("<img");
    while (index>=0) {
      var index2 = textLowercase.indexOf("/>",index);
      if (index2<0) {
        hasSlash = false;
        index2 = textLowercase.indexOf('>',index);
      }
      if (index2<0) break; // This is a syntax error , actually
      var tag = textLowercase.substring(index,index2);
      // Process the tag
      var srcBegin = tag.indexOf("src=\"")+5;
      var srcEnd = index+tag.indexOf("\"",srcBegin);
      srcBegin = index + srcBegin;
      var filename = _text.substring(srcBegin,srcEnd);
      if (filename.startsWith(prefix)) {
				filename = './'+filename.substring(prefix_length);
			 }
			detectedFiles.push(filename);
      // Search next tag
      textLowercase = textLowercase.substring(index2);
      _text = _text.substring(index2);
      index = textLowercase.indexOf("<img");
    }
    return detectedFiles;
  }

*/
	const TO_RELATIVE_TO_XML_FILE = 0;
	const TO_ABSOLUTE_URL = 1;
	//const TO_REQUIRED_BY_HTML = 2;
	
  function convertSRCtags (_text, _type) {
    const prefix = window.location.protocol + "//" + window.location.host+'/'+sMainGUI.getURLpathFor('');
    const prefix_length = prefix.length;
    var textLowercase = _text.toLowerCase();
    var textChanged = '';
    // Compute relativePath
//    var relativePath = sMainGUI.getURLpathFor(''), pathToLib=relativePath+'ejs_library/'; // Levels up to get to the _ejs_library
//    if (_type==TO_REQUIRED_BY_HTML) {
//      relativePath = sMainGUI.getURLpathFor('');
//      char[] pathChars = relativePath.toCharArray();
//      for (int i=0; i<pathChars.length; i++) if (pathChars[i]=='/') pathToLib += "../";

//    }
    var index = textLowercase.indexOf("<img");
    while (index>=0) {
      var hasSlash = true;
      var index2 = textLowercase.indexOf("/>",index);
      if (index2<0) {
        hasSlash = false;
        index2 = textLowercase.indexOf('>',index);
      }
      if (index2<0) break; // This is a syntax error , actually
      var tag = textLowercase.substring(index,index2);
      // Process the tag
      var srcBegin = tag.indexOf("src=\"")+5;
      var srcEnd = index+tag.indexOf("\"",srcBegin);
      srcBegin = index + srcBegin;
      var filename = _text.substring(srcBegin,srcEnd);
      switch (_type) {
        case TO_RELATIVE_TO_XML_FILE : 
        	if (filename.startsWith(prefix)) {
				    filename = './'+filename.substring(prefix_length);
			     }
        	break;
        //case TO_REQUIRED_BY_HTML : filename = convertToRequiredByHTML(_ejs,filename,relativePath,pathToLib); break;
        default :
        case TO_ABSOLUTE_URL :
          if (filename.startsWith('./')) {
				    filename = prefix+filename.substring(2);
			     }
          break;
      }
      textChanged+=(_text.substring(0,srcBegin)+filename);
      textChanged+=(_text.substring(srcEnd,index2));
      if (!hasSlash) textChanged+=("/");
      // Search next tag
      textLowercase = textLowercase.substring(index2);
      _text = _text.substring(index2);
      index = textLowercase.indexOf("<img");
    }
    textChanged+=(_text);
    return textChanged;
  }

  function convertToRelative (htmlCode) { return convertSRCtags(htmlCode,TO_RELATIVE_TO_XML_FILE); }
  
  function convertToAbsolute(htmlCode) { return convertSRCtags(htmlCode,TO_ABSOLUTE_URL); }
		
	// --------------------------
	// Final start-up
	// --------------------------

	return self;
}
/*
 * Copyright (C) 2021 Jesús Chacón, Francisco Esquembre and Félix J. Garcia 
 * This code is part of the Web EJS authoring and simulation tool
 */

/**
 * WebEJS_GUI
 * @module core
 */

var WebEJS_GUI = WebEJS_GUI || {};

/**
 * WebEJS_GUI.modelPanel
 */

/**
 * @class modelPanel 
 * @constructor  
 */
WebEJS_GUI.modelWorkpanel = function() {
	var self = {};
		 
	var mVariablesPanel 		= WebEJS_GUI.variablesPanel('#sModelVariablesPanel');
	var mInitializationPanel	= WebEJS_GUI.codePanel('initialization','#sModelInitializationPanel');
	var mEvolutionPanel			= WebEJS_GUI.evolutionPanel('#sModelEvolutionMain');
	var mFixedRelationsPanel	= WebEJS_GUI.codePanel('fixed_relations','#sModelFixedRelationsPanel');
	var mCustomPanel			= WebEJS_GUI.codePanel('custom','#sModelCustomPanel');
	var mElementsPanel			= WebEJS_GUI.elementsPanel('#sModelElementsPanel');

	self.getVariables = function() { return mVariablesPanel; }
	self.getCustomCode = function() { return mCustomPanel; }
	self.getElementsPanel = function() { return mElementsPanel; }

	// --------------------------
	// Prepare GUI
	// --------------------------

	function switchPage(activeTab) {
		$('.sModelContentDiv').each(function () {
			if ($(this).index()==activeTab) $(this).removeClass('d-none');
			else $(this).addClass('d-none');
		});
		$('.sModelTabButton').each(function () {
			const index = $(this).closest('li').index();
      if (index==activeTab) $(this).removeClass('bi-circle').addClass('bi-record-circle'); 
      else $(this).removeClass('bi-record-circle').addClass('bi-circle');
		});
	}

	function initPage() {
		// This is required for flex working fine with tabs!!!
		$('.sModelTabButton').click((event)=>{
			var activeTab = $(event.target).closest("li").index();
			switchPage(activeTab);
		});		
		switchPage(0);
	}

	// --------------------------
	// API
	// --------------------------
	
	self.saveObject = function() {
		var model = {};
		model['variables']			= mVariablesPanel.saveObject();
		model['initialization']	= mInitializationPanel.saveObject();
		model['evolution']			= mEvolutionPanel.saveObject();
		model['fixed_relations']	= mFixedRelationsPanel.saveObject();
		model['custom']					= mCustomPanel.saveObject();
		model['elements']				= mElementsPanel.saveObject();
		return model;
	}

	self.readObject = function(saved) {
		var model;
		if ('model' in saved) model = saved['model'];
		else model = { 
			'variables' : {}, 
			'initialization' : {}, 
			'evolution' : {}, 
			'fixed_relations' : {}, 
			'custom' : {}, 
			'elements' : {} 
		}
		var result = true;
		result &= mVariablesPanel.readObject		(model['variables'] ); 
		result &= mInitializationPanel.readObject	(model['initialization']);
		result &= mEvolutionPanel.readObject		(model['evolution']);
		result &= mFixedRelationsPanel.readObject	(model['fixed_relations']);
		result &= mCustomPanel.readObject			(model['custom']);
    result &= mElementsPanel.readObject		(model['elements']);
		return result;					
	}

	self.getDetectedFiles = function() {
		return [];
	}

	// --------------------------
	// Tabs API
	// --------------------------

	initPage();
	
	return self;
}


/*
 * Copyright (C) 2021 Jesús Chacón, Francisco Esquembre and Félix J. Garcia 
 * This code is part of the Web EJS authoring and simulation tool
 */

/**
 * GUI tools
 * @module core
 */


 
/**
 * @class evolutionPanel 
 * @constructor  
 */
WebEJS_GUI.odeEventsPanel = function(mEvolutionPanel, mEvolutionPageDiv, mEvolutionPageObject) {
  const TABBED_PANEL = WebEJS_TOOLS.tabbedPanel();
  const mEvolutionPageHash = TABBED_PANEL.getPageDivHash(mEvolutionPageDiv);
  const mEvolutionPageName = TABBED_PANEL.getPageDivName(mEvolutionPanel,mEvolutionPageDiv);
  
  const mKeyword = "ODEEventsEditor_"+mEvolutionPageHash;
  const mID = 'm'+mKeyword; 
  const mMainPanelSelector = '#'+mID+"-Panel";

	var self = {};
	
	var mEventMaximumStep = "";
  var mEventContents = { pages : [] };
  var mZenoContents  = { Code : '', Comment : '', StopAfterEffect : 'true' };
  if (mEvolutionPageObject) {
    mEventMaximumStep = mEvolutionPageObject.EventMaximumStep;
    if ('Events'     in mEvolutionPageObject) {
      if (typeof mEvolutionPageObject.Events === 'object' && 
          'pages' in mEvolutionPageObject.Events) 
        mEventContents = mEvolutionPageObject.Events;
    }
    if ('ZenoEffect' in mEvolutionPageObject) {
      if (typeof mEvolutionPageObject.ZenoEffect === 'object' && 
          'Code' in mEvolutionPageObject.ZenoEffect) 
        mZenoContents  = mEvolutionPageObject.ZenoEffect;
    }
    mEvolutionPanel.showNumberOfEvents(mEventContents.pages.length, mEvolutionPageDiv);
  } 

  var mPanel = null; // The panel for the event tabbed panel 
  var mZenoPanel = null; // The single Zeno Effect panel
  var mConditionEditorByHash = {};
  var mActionEditorByHash = {};
  var mZenoEditor = null;

	// Implementation of TabbedPanel (begin)

	self.getMainPanelSelector	= function() { return mMainPanelSelector; }
	self.getKeyword	= function() { return mKeyword; }
	self.getPageName	= function() { return 'Event'; }

	self.getDefaultPageType = function() { return 'EVENT_EDITOR'; }
  
	// ----- optional functions for TabbedPanel

  self.pageDeleted = function(mPageDiv) {
    const hash = TABBED_PANEL.getPageDivHash(mPageDiv);
    delete mConditionEditorByHash[hash];
    delete mActionEditorByHash[hash];
    mEvolutionPanel.showNumberOfEvents(TABBED_PANEL.getPagesCount(self)-1, mEvolutionPageDiv);
  }

  self.reportableChange = function(message) {
    mEvolutionPanel.reportableChange(message);
  }
    
	// ----- end of optional functions for TabbedPanel

	// Rest of the implementation of TabbedPanel at the end

  // --------------------------
  // read and write
  // --------------------------

  self.getContent = function(contents) {
    if (mPanel) collectContents();
    if (mZenoPanel) collectZenoContents();
    contents.EventMaximumStep = mEventMaximumStep;
    contents.Events     = mEventContents;
    contents.ZenoEffect = mZenoContents;
  }

  function collectContents() {
    mEventMaximumStep = $('#'+mID+'-ZenoSteps').val();
    mEventContents = { 'pages' : TABBED_PANEL.getAllPagesObject(self) };
  }

  function collectZenoContents() {
    mZenoContents = { 
      Code : mZenoEditor.getValue(),
      Comment : $('#'+mID+'-ZenoComment').val(),
      StopAfterEffect : $('#'+mID+'-ZenoStopCheckbox').is(":checked") ? "true" : "false" 
    };
  }
  
  // --------------------------
  // Interface
  // --------------------------

  const mPreferredSize = {
    width: Math.min(window.innerWidth*0.9,1000),
    height: Math.min(window.innerHeight*0.9,800)
  }; 

  const mZenoPreferredSize = {
    width: Math.min(window.innerWidth*0.7,800),
    height: Math.min(window.innerHeight*0.7,600)
  };
  
  self.show = function() {
    if (mPanel) {
      mPanel.resize(mPreferredSize); 
      mPanel.reposition();
      mPanel.front();
    }
    else createPanel();
  }

  self.hide = function() {
    if (mPanel) mPanel.close(); 
  }

  function showZeno() {
    if (mZenoPanel) {
      mZenoPanel.resize(mZenoPreferredSize); 
      mZenoPanel.reposition();
      mZenoPanel.front();
    }
    else createZenoPanel();
  }
  
  function readObject() {
    var pages = mEventContents.pages;
    if (pages==null || pages.length<=0) self.setNoPages();
    else {
      $(mMainPanelSelector).html(TABBED_PANEL.panelHTML(self,pages));
      TABBED_PANEL.initPanel(self,pages);
    }
    return true;
  }

  // Create and show the jsPanel
  function createPanel() {
    sMainHideTooltips();
    const options = {
      content: 
				'<div id="'+mID+'-Panel" class="sModelSubpanel h-100 col-12 d-flex flex-column" style="flex-grow:1"></div>',
      onbeforeclose: function(panel) {
        if (mZenoPanel) mZenoPanel.close();
        collectContents();
        mPanel = null;
        return true;
      },
      position: { at: 'center', of : '#sMainWorkpanel' },
      footerToolbar: 
        '<div class="h-100 d-flex flex-row" style="flex-grow:1">'+
          '<div class="input-group input-group-sm" style="flex-grow:1;">'+
            '<button type="button" id="'+mID+'-ZenoButton" '+
                ' class="sTranslatable sModelBtn btn btn-outline-secondary">'+
                sLocaleFor("Zeno effect action")+
            '</button>'+
            '<span id="'+mID+'-ZenoLabel" class="sTranslatable sModelBtn input-group-text">'+
              sLocaleFor("Check events at steps not larger than")+
            '</span>'+
            '<input type="text" class="ms-1 form-control" id="'+mID+'-ZenoSteps"'+
              sMainNoAutocorrect+
              ' aria-describedby="'+mID+'-ZenoLabel" '+
              ' style="width:4em;" aria-label="'+sLocaleFor("Zeno step")+'">'+
//            '<button type="button" '+
//                ' class="sTranslatable sModelBtn btn btn-outline-secondary ">'+
            '<span class="input-group-text" >'+
              '<i class="sModelBtn bi bi-link cVariableChooser" '+
                ' data-types="int|double" '+
                ' data-field="#'+mID+'-ZenoSteps" '+
                ' style="font-size: 1rem;"></i>'+
            '</span>'+
//            '</button>'+
          '</div>'+
          '<button type="button" id="'+mID+'-Button" style="flex-grow:0; flex-basis:0;" '+
            'class="sTranslatable ms-1 input-group-button btn btn-primary float-left">Done</button>'+
        '</div>',

      callback : function(panel) {
        $('#'+mID+'-Button').click(function() { panel.close(); });
        $('#'+mID+'-ZenoButton').click(function() { showZeno(); });
        $('#'+mID+'-ZenoSteps').change(function() { mEvolutionPanel.reportableChange('ODE ZenoSteps'); });
    		$(panel).find('.cVariableChooser').on("click", (event)=>{ 
	        mEvolutionPanel.selectVariable(event,mEvolutionPageName);
    });   
				readObject();
      }
    };
		const titleString = sMainResources.getString('Events for ODE')+' : '+mEvolutionPageName;
    mPanel = WebEJS_TOOLS.createJSPanel(titleString, options, {  minimize: 'remove' }, mPreferredSize);
    $('#'+mID+'-ZenoSteps').val(mEventMaximumStep);
  }
  
  // Create and show the jsPanel
  function createZenoPanel() {
    sMainHideTooltips();
    const options = {
      content: 
        '<div class="h-100 col-12 d-flex flex-column" style="flex-grow:1">'+
          '<div class="container p-0" style="flex-grow:0; flex-basis:0;">'+
            '<div class="row">'+
              
              '<div class="col">'+
                '<span class="sTranslatable sModelBtn input-group-text btn text-decoration-none">'+
                  sLocaleFor("Action")+
                '</span>'+
              '</div>'+

              '<div class="col input-group">'+
                '<span class="form-check">'+
                  '<input class="form-check-input" type="checkbox" value="" checked '+
                    ' name="'+mID+'-ZenoStopCheckbox" id="'+mID+'-ZenoStopCheckbox">'+
                  '<label class="sTranslatable form-check-label" for="'+mID+'-ZenoStopCheckbox">'+
                    sLocaleFor("End step after effect")+
                  '</label>'+
                '</span>'+
              '</div>'+
              
            '</div>'+ // end of row
          '</div>'+ // end of header for Action
          '<div class="ace h-100" id="'+mID+'-ZenoEditor" style="flex-grow:1"></div>'+
        '</div>',
      onbeforeclose: function(panel) {
        collectZenoContents();
        mZenoPanel = null;
        return true;
      },
      position: { at: 'center', of : '#sMainWorkpanel' },
      footerToolbar: 
        '<div class="h-100 d-flex flex-row" style="flex-grow:1">'+
          '<div class="input-group input-group-sm" style="flex-grow:1;">'+
            '<span class="sTranslatable sModelBtn input-group-text">'+sLocaleFor("Comment")+'</span>'+
            '<input type="text" class="flex flex-grow form-control" id="'+mID+'-ZenoComment"'+
              ' placeholder="'+sLocaleFor("Page comment")+'" aria-label="'+sLocaleFor("Page comment")+'">'+
          '</div>'+
          '<button type="button" id="'+mID+'-ZenoCloseButton" style="flex-grow:0; flex-basis:0;" '+
            'class="sTranslatable ms-1 input-group-button btn btn-primary float-left">Done</button>'+
        '</div>',
      callback : function(panel) {
        $('#'+mID+'-ZenoCloseButton').click(function() { 
          mZenoPanel.close(); 
        });
        
        mZenoEditor = TABBED_PANEL.initializeCodeEditor(mID+"-ZenoEditor",mZenoContents.Code,
          ()=>{ mEvolutionPanel.reportableChange('Zeno Action'); }, // onBlur
          ()=>{ mEvolutionPanel.nonReportableChange('Zeno Action'); });
        $('#'+mID+'-ZenoStopCheckbox').prop("checked", (mZenoContents.StopAfterEffect=="true"));
        $('#'+mID+'-ZenoComment').val(mZenoContents.Comment);
        
        $('#'+mID+'-ZenoStopCheckbox').on("change", ()=>{ 
          mEvolutionPanel.reportableChange('Zeno stop'); 
          });
        $('#'+mID+'-ZenoComment').on("change", ()=>{ mEvolutionPanel.reportableChange('Zeno Comment'); });
      }
    };
		const titleString = sMainResources.getString('Zeno effect action for ODE')+' : '+mEvolutionPageName;
    mZenoPanel = WebEJS_TOOLS.createJSPanel(titleString, options, {  minimize: 'remove' }, mZenoPreferredSize);
  }
  
  
  // ---------------------------------------
  // TabbedPanel implementation (continued)
  // ---------------------------------------

  self.setNoPages = function() {
    $(mMainPanelSelector).html(
      '<button class="sModelBtn sPanelNoPageBtn active" style="flex-grow:1;">'+
        '<h5 class="sTranslatable">'+sLocaleFor('Click to create a page of')+' '+sLocaleFor('Events')+'</h5>'+
      '</button>');
    TABBED_PANEL.initPanel(self,null);
  }

  self.pageInitialization = function(mPageDiv, mPageObject) {
    const hash = TABBED_PANEL.getPageDivHash(mPageDiv);
		const pageName = TABBED_PANEL.getPageDivName(self,mPageDiv);
		
    var zeroCode   = (mPageObject ? mPageObject.ZeroCondition : "return 1.0; // Condition for "+ pageName);
    var actionCode = (mPageObject ? mPageObject.Action        : "// Action for "+ pageName);

    mConditionEditorByHash[hash] = TABBED_PANEL.initializeCodeEditor(mID+'-ZeroEditor-'+hash,zeroCode,
          ()=>{ mEvolutionPanel.reportableChange('Event Zero Condition'); }, // onBlur
          ()=>{ mEvolutionPanel.nonReportableChange('Event Zero Condition'); });
    mActionEditorByHash[hash] = TABBED_PANEL.initializeCodeEditor(mID+'-ActionEditor-'+hash,actionCode,
          ()=>{ mEvolutionPanel.reportableChange('Event Action'); }, // onBlur
          ()=>{ mEvolutionPanel.nonReportableChange('Event Action'); });
    
    mPageDiv.find('input').on("change", (event)=>{ mEvolutionPanel.reportableChange('ODE Event change '+event.target.id); });
    mPageDiv.find('select').on("change", (event)=>{ mEvolutionPanel.reportableChange('ODE Event change '+event.target.id); });
   
   /*
    $('#'+mID+'-TypeSelector-'+hash).on("change", ()=>{ nonReportableChange('Event Type'); });
    $('#'+mID+'-IterationsField-'+hash).on("change", ()=>{ nonReportableChange('Event Iterations'); });
    $('#'+mID+'-MethodSelector-'+hash).on("change", ()=>{ nonReportableChange('Event Method'); });
    $('#'+mID+'-TolField-'+hash).on("change", ()=>{ nonReportableChange('Event Tolerance'); });
    $('#'+mID+'-EndCheckbox-'+hash).on("change", ()=>{ nonReportableChange('Event ends step'); });
    $('#'+mID+'-Comment-'+hash).on("change", ()=>{ nonReportableChange('Event Comment'); });
*/
    if (mPageObject) {
      $('#'+mID+'-TypeSelector-'+hash+' option[value="'+mPageObject.EventType+'"]').attr('selected', true);    
      $('#'+mID+'-IterationsField-'+hash).val(mPageObject.Iterations);
      $('#'+mID+'-MethodSelector-'+hash+' option[value="'+mPageObject.Method+'"]').attr('selected', true);    

      $('#'+mID+'-TolField-'+hash).val(mPageObject.Tolerance);
      $('#'+mID+'-EndCheckbox-'+hash).prop("checked", (mPageObject.StopAtEvent=="true"));
      $('#'+mID+'-Comment-'+hash).val(mPageObject.Comment);
    }
    
    mPageDiv.find('.cVariableChooser').on("click", (event)=>{ 
      if (TABBED_PANEL.isPageDisabled(self,mPageDiv)) return;
        mEvolutionPanel.selectVariable(event,TABBED_PANEL.getPageDivName(self, mPageDiv));
    });   

    mEvolutionPanel.showNumberOfEvents(TABBED_PANEL.getPagesCount(self), mEvolutionPageDiv);
  }

  self.getPageObject = function(mPageHash) {
    var page = TABBED_PANEL.getPageObject(self,mPageHash);
    page.Action = mActionEditorByHash[mPageHash].getValue();
    page.Comment = $('#'+mID+'-Comment-'+mPageHash).val();
    page.EventType = $('#'+mID+'-TypeSelector-'+mPageHash+' option:selected').val();
    page.Iterations = $('#'+mID+'-IterationsField-'+mPageHash).val();
    page.Method = $('#'+mID+'-MethodSelector-'+mPageHash+' option:selected').val();
    page.StopAtEvent = $('#'+mID+'-EndCheckbox-'+mPageHash).is(":checked") ? "true" : "false";
    page.Tolerance = $('#'+mID+'-TolField-'+mPageHash).val();
    page.ZeroCondition = mConditionEditorByHash[mPageHash].getValue();
    return page;
  }
        
  self.pageMainBuilder = function(mHash, mPage) {
    return ''+
      '<div class="h-100 d-flex flex-column" style="flex-grow:1">'+
      
          '<div class="container p-0" style="flex-grow:0; flex-basis:0;">'+
            '<div class="row">'+
          
              '<div class="col input-group">'+
                '<span class="sTranslatable sModelBtn input-group-text">'+
                  sLocaleFor("Type")+
                '</span>'+
                '<select id="'+mID+'-TypeSelector-'+mHash+'" class="form-select" >'+
                  '<option value="STATE_EVENT">State event</option>'+
                  '<option value="CROSSING_EVENT" selected>Zero crossing</option>'+
                  '<option value="POSITIVE_EVENT">Positive crossing</option>'+
                '</select>'+
              '</div>'+
  
              '<div class="col input-group">'+
                '<span class="sTranslatable sModelBtn input-group-text">'+
                  sLocaleFor("Iterations")+
                '</span>'+
                '<input id="'+mID+'-IterationsField-'+mHash+'" type="text" class="form-control" '+
                  sMainNoAutocorrect+
                  'style="width:4em;" value="100">'+
                '<span class="input-group-text" >'+
                  '<i class="sModelBtn bi bi-link cVariableChooser" '+
                    ' data-types="int|double" '+
                    ' data-field="#'+mID+'-IterationsField-'+mHash+'" '+
                    ' style="font-size: 1rem;"></i>'+
                '</span>'+
              '</div>'+
  
              '<div class="col input-group">'+
                '<span class="sTranslatable sModelBtn input-group-text">'+
                  sLocaleFor("Method")+
                '</span>'+
                '<select id="'+mID+'-MethodSelector-'+mHash+'" class="form-select">'+
                  '<option value="BISECTION" selected>BISECTION</option>'+
                  '<option value="SECANT">SECANT</option>'+
                '</select>'+
              '</div>'+
  
            '</div>'+
          '</div>'+

          '<div class="container" style="flex-grow:1;">'+
          
            '<div class="row d-flex flex-column" style="height:50%;">'+
            
              '<div class="container p-0" style="flex-grow:0; flex-basis:0;">'+
                '<div class="row">'+
                  '<div class="col">'+
                      '<span id="'+mID+'-ZeroLabel" class="sTranslatable sModelBtn input-group-text btn text-decoration-none" >'+
                        sLocaleFor("Zero condition")+
                      '</span>'+
                  '</div>'+

                  '<div class="col input-group">'+
                    '<span class="sTranslatable sModelBtn input-group-text">'+
                      sLocaleFor("Tol")+
                    '</span>'+
                    '<input id="'+mID+'-TolField-'+mHash+'" type="text" class="form-control" '+
                      sMainNoAutocorrect+
                      'style="width:8em;" value="1.0e-5" >'+
                    '<span class="input-group-text" >'+
                      '<i class="sModelBtn bi bi-link cVariableChooser" '+
                        ' data-types="int|double" '+
                        ' data-field="#'+mID+'-TolField-'+mHash+'" '+
                        ' style="font-size: 1rem;"></i>'+
                    '</span>'+
                  '</div>'+
                '</div>'+ // end of row
              '</div>'+ // end of container for Zero condition header


              '<div class="ace" id="'+mID+'-ZeroEditor-'+mHash+'" style="flex-grow:1"></div>'+
            '</div>'+ // end of first BIG 50% row
              
            '<div class="row d-flex flex-column" style="height:50%;">'+

              '<div class="container p-0" style="flex-grow:0; flex-basis:0;">'+
                '<div class="row">'+
                  
                  '<div class="col">'+
                    '<span class="sTranslatable sModelBtn input-group-text btn text-decoration-none">'+
                      sLocaleFor("Action")+
                    '</span>'+
                  '</div>'+

                  '<div class="col input-group">'+
                    '<span class="form-check">'+
                      '<input class="form-check-input" type="checkbox" value="" checked '+
                        ' name="'+mID+'-EndCheckbox-'+mHash+'" id="'+mID+'-EndCheckbox">'+
                      '<label class="sTranslatable form-check-label" for="'+mID+'-EndCheckbox">'+
                        sLocaleFor("End step at event")+
                      '</label>'+
                    '</span>'+
                  '</div>'+
                  
                '</div>'+ // end of row
              '</div>'+ // end of header for Action

              '<div class="ace" id="'+mID+'-ActionEditor-'+mHash+'" style="flex-grow:1"></div>'+
            '</div>'+ // end of second BIG 50% row

          '</div>'+ // end of container
            
        '</div>';
        
  }
  
  self.pageCommentBuilder = function(mHash, mPage) {
    return ''+ 
      '<div class="input-group input-group-sm dropup drop-start" style="flex-grow: 1;">'+
        '<span class="sTranslatable sModelBtn input-group-text">Comment</span>'+
        '<input type="text" class="sPageCommentField form-control" id="'+mID+'-Comment-'+mHash+'"'+
          ' placeholder="Page comment" aria-label="Page comment">' + 
      '</div>';
  }     
  
	
	return self;
}

/*
 * Copyright (C) 2021 Jesús Chacón, Francisco Esquembre and Félix J. Garcia 
 * This code is part of the Web EJS authoring and simulation tool
 */

/**
 * GUI tools
 * @module core
 */


 
/**
 * @class evolutionPanel 
 * @constructor  
 */
WebEJS_GUI.odeParametersPanel = function(mEvolutionPanel, mEvolutionPageDiv, mEvolutionPageObject) {
  const TABBED_PANEL = WebEJS_TOOLS.tabbedPanel();
  const mEvolutionPageHash = TABBED_PANEL.getPageDivHash(mEvolutionPageDiv);
  const mEvolutionPageName = TABBED_PANEL.getPageDivName(mEvolutionPanel,mEvolutionPageDiv);
  
  const mKeyword = "ODEParametersEditor_"+mEvolutionPageHash;
  const mID = 'm'+mKeyword; 
  const mDiscontinuitiesKeyword = mID+"-DiscontinuitiesDiv";
  const mErrorHandlingKeyword = mID+"-ErrorHandlingDiv";

	var self = {};

	var mAccelerationIndependentOfVelocity = 'false'; // AccelerationIndependentOfVelocity
  var mForceSynchronization = 'false'; // ForceSynchronization
  var mUseBestInterpolation = 'false'; // UseBestInterpolation
  var mEstimateFirstStep = 'false'; // EstimateFirstStep

  var mMemoryLength = ''; // MemoryLength
  var mInternalStep = '';  // InternalStep
  var mMaximumStep = ''; // MaximumStep
  var mMaximumNumberOfSteps = '10000'; // MaximumNumberOfSteps
  var mRelativeTolerance = ''; // RelativeTolerance
  var mTolerance ='';  // Tolerance ignored???

	var mDelayList = ''; 				// DelayList
	var mDelayMaximum = ''; 		// DelayMaximum
  var mDelayAddDiscont = ''; 	// Pre-IC discontinuities
	var mDelayInitialCondition = { Comment: '', Code : '' }; // Code for preinitial conditions for 
  // Can be guessed

  // TODO : IS THIS USED???
	var mDirectIncidenceMatrix = ''; // ????

	// {Type: "DISCONTINUITY_EDITOR", Name: "Discontinuity page", Active: "true", Internal: "false", 
	//   DiscontinuityContent:{Tolerance: "1.0e-5", StopAtDiscontinuity: "true", ZeroCondition: "↵return 1.0;↵", Action: "↵// disc action↵", Comment: ""} }	
	var mDiscontinuityContents = { pages : [] }; // Discontinuities 
  // {Type: "ERROR_EDITOR", Name: "On Error page", Active: "true", Internal: "false", 
  // ErrorHandlingContent: {Comment: "", Code: "↵// error code 1↵", ErrorType: "ANY_ERROR"} } 
	var mErrorHandingContents  = { pages : [] }; // ErrorHandling

  if (mEvolutionPageObject) {
    mAccelerationIndependentOfVelocity = mEvolutionPageObject.AccelerationIndependentOfVelocity;
    mForceSynchronization = mEvolutionPageObject.ForceSynchronization;
    mUseBestInterpolation = mEvolutionPageObject.UseBestInterpolation;
    mEstimateFirstStep = mEvolutionPageObject.EstimateFirstStep;

    mMemoryLength = mEvolutionPageObject.MemoryLength;
    mInternalStep = mEvolutionPageObject.InternalStep;
    mMaximumStep = mEvolutionPageObject.MaximumStep;
    mMaximumNumberOfSteps = mEvolutionPageObject.MaximumNumberOfSteps;
    mRelativeTolerance = mEvolutionPageObject.RelativeTolerance;
    mTolerance = mEvolutionPageObject.Tolerance;

    mDelayList = mEvolutionPageObject.DelayList;
    mDelayMaximum = mEvolutionPageObject.DelayMaximum;
    mDelayAddDiscont = mEvolutionPageObject.DelayAddDiscont;
    mDelayInitialCondition = mEvolutionPageObject.DelayInitialCondition; 

    mDirectIncidenceMatrix  = mEvolutionPageObject.DirectIncidenceMatrix;

    const discont = mEvolutionPageObject.Discontinuities;
    if (discont && 'pages' in discont) mDiscontinuityContents = discont;
    const errorH = mEvolutionPageObject.ErrorHandling;
    if (errorH && 'pages' in errorH)  mErrorHandingContents = errorH;
  } 

	// --------------------------
	// read and write
	// --------------------------

  var mPanel = null; // The jsPanel for the dialog
  var mDiscontinuitiesEditor = WebEJS_GUI.odeDiscontinuityEditor(mEvolutionPanel,mDiscontinuitiesKeyword);
  var mErrorHandlingEditor    = WebEJS_GUI.odeErrorHandlingEditor(mEvolutionPanel,mErrorHandlingKeyword);
  var mDelayPreInitEditor = null;

  self.getContent = function(contents) {
    if (mPanel) collectContents();
    contents.AccelerationIndependentOfVelocity = mAccelerationIndependentOfVelocity;
    contents.ForceSynchronization = mForceSynchronization;
    contents.UseBestInterpolation = mUseBestInterpolation
    contents.EstimateFirstStep = mEstimateFirstStep;

    contents.MemoryLength = mMemoryLength;
    contents.InternalStep = mInternalStep;
    contents.MaximumStep = mMaximumStep;
    contents.MaximumNumberOfSteps = mMaximumNumberOfSteps;
    contents.RelativeTolerance = mRelativeTolerance;
    contents.Tolerance = mTolerance;

    contents.DelayList = mDelayList;
    contents.DelayMaximum = mDelayMaximum;
    contents.DelayAddDiscont = mDelayAddDiscont;
    contents.DelayInitialCondition = mDelayInitialCondition; 

    contents.DirectIncidenceMatrix = mDirectIncidenceMatrix;

    contents.Discontinuities = mDiscontinuityContents; 
    contents.ErrorHandling = mErrorHandingContents;
  }

  function collectContents() {
    mAccelerationIndependentOfVelocity = $('#'+mID+'-AccInd').is(":checked") ? "true" : "false";
    mForceSynchronization = $('#'+mID+'-ForceSynchro').is(":checked") ? "true" : "false";
    mUseBestInterpolation = $('#'+mID+'-BestInter').is(":checked") ? "true" : "false";
    mEstimateFirstStep = $('#'+mID+'-EstimateFirst').is(":checked") ? "true" : "false";

    mMemoryLength = $('#'+mID+'-MemoryLength').val()
    mInternalStep = $('#'+mID+'-InternalStep').val()
    mMaximumStep = $('#'+mID+'-MaximumStep').val()
    mMaximumNumberOfSteps = $('#'+mID+'-MaxNumSteps').val()
    mRelativeTolerance = $('#'+mID+'-RelTol').val()

/*
    mTolerance = mEvolutionPageObject.Tolerance;
*/
    mDelayList = $('#'+mID+'-Delays').val();
    mDelayMaximum = $('#'+mID+'-MaximumDelay').val();
    mDelayAddDiscont = $('#'+mID+'-DelayAddDisc').val();
    mDelayInitialCondition = { 
      Code : mDelayPreInitEditor.getValue(), 
      Comment : $('#'+mID+'-DelayComment').val() 
    };

/*
    mDirectIncidenceMatrix  
*/

    mDiscontinuityContents = { 'pages' : TABBED_PANEL.getAllPagesObject(mDiscontinuitiesEditor) };
    mErrorHandingContents  = { 'pages' : TABBED_PANEL.getAllPagesObject(mErrorHandlingEditor) };
  }
	
  // --------------------------
  // Interface
  // --------------------------

  const mPreferredSize = {
    width: Math.min(window.innerWidth*0.7,800),
    height: Math.min(window.innerHeight*0.7,800)
  }; 

  self.show = function() {
    if (mPanel) {
      mPanel.resize(mPreferredSize); 
      mPanel.reposition();
      mPanel.front();
    }
    else createPanel();
  }

  self.hide = function() {
    if (mPanel) mPanel.close(); 
  }

  function readObject() {
    $('#'+mID+'-AccInd').prop('checked', mAccelerationIndependentOfVelocity=="true");
    $('#'+mID+'-ForceSynchro').prop('checked', mForceSynchronization=="true");
    $('#'+mID+'-BestInter').prop('checked', mUseBestInterpolation=="true");
    $('#'+mID+'-EstimateFirst').prop('checked', mEstimateFirstStep=="true");

    $('#'+mID+'-MemoryLength').val(mMemoryLength);
    $('#'+mID+'-InternalStep').val(mInternalStep);
    $('#'+mID+'-MaximumStep').val(mMaximumStep);
    $('#'+mID+'-MaxNumSteps').val(mMaximumNumberOfSteps);
    $('#'+mID+'-RelTol').val(mRelativeTolerance);

    $('#'+mID+'-Delays').val(mDelayList);
    $('#'+mID+'-MaximumDelay').val(mDelayMaximum);
    $('#'+mID+'-DelayAddDisc').val(mDelayAddDiscont);
    $('#'+mID+'-DelayPreInitCode').val(mDelayInitialCondition.Code);
    $('#'+mID+'-DelayComment').val(mDelayInitialCondition.Comment);
            
    var pages = mDiscontinuityContents.pages;
    if (pages==null || pages.length<=0) mDiscontinuitiesEditor.setNoPages();
    else {
      $('#'+mDiscontinuitiesKeyword).html(TABBED_PANEL.panelHTML(mDiscontinuitiesEditor,pages));
      TABBED_PANEL.initPanel(mDiscontinuitiesEditor,pages);
    }
    pages = mErrorHandingContents.pages;
    if (pages==null || pages.length<=0) mErrorHandlingEditor.setNoPages();
    else {
      $('#'+mErrorHandlingKeyword).html(TABBED_PANEL.panelHTML(mErrorHandlingEditor,pages));
      TABBED_PANEL.initPanel(mErrorHandlingEditor,pages);
    }
    return true;
  }
  
  
  // Create and show the jsPanel
  function createPanel() {
    sMainHideTooltips();
    const options = {
      content: getTabsContent(),
      onbeforeclose: function(panel) {
        collectContents();
        mPanel = null;
        return true;
      },
      position: { at: 'center', of : '#sMainWorkpanel' },
      footerToolbar: 
        '<button type="button" id="'+mID+'-CloseButton" class="sTranslatable btn btn-primary float-left">Done</button>',

      callback : function(panel) {
        $('#'+mID+'-CloseButton').click(function() { panel.close(); });
        mDelayPreInitEditor = TABBED_PANEL.initializeCodeEditor(mID+'-DelayPreInitCode',mDelayInitialCondition.Code,
          ()=>{ mEvolutionPanel.reportableChange('Delay Pre Init Code Condition'); }, // onBlur
          ()=>{ mEvolutionPanel.nonReportableChange('Delay Pre Init Code Condition'); });
        
        $(panel).find('input').on("change", (event)=>{ mEvolutionPanel.reportableChange('ODE Parameter change '+event.target.id); });

        $(panel).find('.cVariableChooser').on("click", (event)=>{ 
          mEvolutionPanel.selectVariable(event,mEvolutionPageName);
        });
        readObject();
      }
    };
    const titleString = sMainResources.getString('Parameters for ODE')+' : '+mEvolutionPageName;
    mPanel = WebEJS_TOOLS.createJSPanel(titleString, options, {  minimize: 'remove' }, mPreferredSize);
  }
  
  function getTabsContent() {
    var html = 
    '<div class="sModelSubpanel h-100 col-12 d-flex flex-column">'+
        '<ul class="nav nav-tabs nav-fill border" role="tablist" >'+
          '<li class="nav-item" role="presentation">'+
            '<button class="sTranslatable sModelBtn nav-link active" id="'+mID+'-OperationTab" '+
                'data-bs-toggle="tab" data-bs-target="#'+mID+'-OperationDiv"  '+
                'type="button" role="tab" aria-controls="'+mID+'-OperationDiv" aria-selected="true">'+
              sLocaleFor('Operation') +
            '</button>'+
          '</li>'+
          '<li class="nav-item" role="presentation">'+
            '<button class="sTranslatable sModelBtn nav-link" id="'+mID+'-DiscontinuitiesTab" '+
                'data-bs-toggle="tab" data-bs-target="#'+mID+'-DiscontinuitiesDiv"  '+
                'type="button" role="tab" aria-controls="'+mID+'-DiscontinuitiesDiv" aria-selected="true">'+
              sLocaleFor('Discontinuities') +
            '</button>'+
          '</li>'+
          '<li class="nav-item" role="presentation">'+
            '<button class="sTranslatable sModelBtn nav-link" id="'+mID+'-DDETab" '+
                'data-bs-toggle="tab" data-bs-target="#'+mID+'-DDEDiv"  '+
                'type="button" role="tab" aria-controls="'+mID+'-DDEDiv" aria-selected="true">'+
              sLocaleFor('DDE') +
            '</button>'+
          '</li>'+
          '<li class="nav-item" role="presentation">'+
            '<button class="sTranslatable sModelBtn nav-link" id="'+mID+'-ErrorHandlingTab" '+
                'data-bs-toggle="tab" data-bs-target="#'+mID+'-ErrorHandlingDiv"  '+
                'type="button" role="tab" aria-controls="'+mID+'-ErrorHandlingDiv" aria-selected="true">'+
              sLocaleFor('ErrorHandling') +
            '</button>'+
          '</li>'+
        '</ul>'+
        '<div class="tab-content h-100 col-12 d-flex flex-column" style="flex-grow:1">'+
              
          '<div class="sModelSubpanel tab-pane show active"'+
              ' id="'+mID+'-OperationDiv" style="flex-grow:1"'+ 
              ' role="tabpanel" aria-labelledby="'+mID+'-OperationTab">'+
              
            '<div class="mt-2 form-check form-switch">'+
              '<input class="form-check-input" type="checkbox" id="'+mID+'-AccInd">'+
              '<label class="sTranslatable sModelBtn form-check-label" for="'+mID+'-AccInd">'+
                sLocaleFor('Acc Indep of Velocity')+
              '</label>'+
            '</div>'+
            
            '<div class="form-check form-switch">'+
              '<input class="form-check-input" type="checkbox" id="'+mID+'-ForceSynchro">'+
              '<label class="sTranslatable sModelBtn form-check-label" for="'+mID+'-ForceSynchro">'+
                sLocaleFor('Force synchronization')+
              '</label>'+
            '</div>'+
            
            '<div class="form-check form-switch">'+
              '<input class="form-check-input" type="checkbox" id="'+mID+'-BestInter">'+
              '<label class="sTranslatable sModelBtn form-check-label" for="'+mID+'-BestInter">'+
                sLocaleFor('Use best interpolation')+
              '</label>'+
            '</div>'+
            
            '<div class="form-check form-switch">'+
              '<input class="form-check-input" type="checkbox" id="'+mID+'-EstimateFirst">'+
              '<label class="sTranslatable sModelBtn form-check-label" for="'+mID+'-EstimateFirst">'+
                sLocaleFor('Estimate first step')+
              '</label>'+
            '</div>'+

            '<div class="mt-2 input-group">'+
              '<span class="sTranslatable sModelBtn input-group-text">'+
                  sLocaleFor("Memory length")+
              '</span>'+
              '<input id="'+mID+'-MemoryLength" type="text" class="form-control" '+sMainNoAutocorrect+'>'+
              '<span class="input-group-text" >'+
                '<i class="sModelBtn bi bi-link cVariableChooser" '+
                  ' data-types="int|double" '+
                  ' data-field="#'+mID+'-MemoryLength" '+
                  ' style="font-size: 1rem;"></i>'+
              '</span>'+
            '</div>'+

            '<div class="mt-2 input-group">'+
              '<span class="sTranslatable sModelBtn input-group-text">'+
                  sLocaleFor("Internal step size")+
              '</span>'+
              '<input id="'+mID+'-InternalStep" type="text" class="form-control"'+sMainNoAutocorrect+'>'+
              '<span class="input-group-text" >'+
                '<i class="sModelBtn bi bi-link cVariableChooser" '+
                  ' data-types="int|double" '+
                  ' data-field="#'+mID+'-InternalStep" '+
                  ' style="font-size: 1rem;"></i>'+
              '</span>'+
            '</div>'+

            '<div class="mt-2 input-group">'+
              '<span class="sTranslatable sModelBtn input-group-text">'+
                  sLocaleFor("Maximum step size")+
              '</span>'+
              '<input id="'+mID+'-MaximumStep" type="text" class="form-control" '+sMainNoAutocorrect+'>'+
              '<span class="input-group-text" >'+
                '<i class="sModelBtn bi bi-link cVariableChooser" '+
                  ' data-types="int|double" '+
                  ' data-field="#'+mID+'-MaximumStep" '+
                  ' style="font-size: 1rem;"></i>'+
              '</span>'+
            '</div>'+

            '<div class="mt-2 input-group">'+
              '<span class="sTranslatable sModelBtn input-group-text">'+
                  sLocaleFor("Max number of steps")+
              '</span>'+
              '<input id="'+mID+'-MaxNumSteps" type="text" class="form-control" '+sMainNoAutocorrect+'>'+
              '<span class="input-group-text" >'+
                '<i class="sModelBtn bi bi-link cVariableChooser" '+
                  ' data-types="int|double" '+
                  ' data-field="#'+mID+'-MaxNumSteps" '+
                  ' style="font-size: 1rem;"></i>'+
              '</span>'+
            '</div>'+

            '<div class="mt-2 input-group">'+
              '<span class="sTranslatable sModelBtn input-group-text">'+
                  sLocaleFor("Relative tolerance")+
              '</span>'+
              '<input id="'+mID+'-RelTol" type="text" class="form-control" '+sMainNoAutocorrect+'>'+
              '<span class="input-group-text" >'+
                '<i class="sModelBtn bi bi-link cVariableChooser" '+
                  ' data-types="int|double" '+
                  ' data-field="#'+mID+'-RelTol" '+
                  ' style="font-size: 1rem;"></i>'+
              '</span>'+
            '</div>'+
            
          '</div>'+

          '<div class="sModelSubpanel tab-pane fade"'+
            ' id="'+mID+'-DiscontinuitiesDiv" style="flex-grow:1"'+ 
            ' role="tabpanel" aria-labelledby="'+mID+'-DiscontinuitiesTab">'+
          '</div>'+

          '<div class="sModelSubpanel tab-pane fade"'+
            ' id="'+mID+'-DDEDiv" style="flex-grow:1"'+ 
            ' role="tabpanel" aria-labelledby="'+mID+'-DDETab">'+
            
            '<div class="mt-2 input-group">'+
              '<span class="sTranslatable sModelBtn input-group-text">'+
                  sLocaleFor("Delays")+
              '</span>'+
              '<input id="'+mID+'-Delays" type="text" class="form-control" '+sMainNoAutocorrect+'>'+
            '</div>'+

            '<div class="mt-2 input-group">'+
              '<span class="sTranslatable sModelBtn input-group-text">'+
                  sLocaleFor("Maximum delay")+
              '</span>'+
              '<input id="'+mID+'-MaximumDelay" type="text" class="form-control" '+sMainNoAutocorrect+'>'+
            '</div>'+

            '<div class="mt-2 input-group">'+
              '<span class="sTranslatable sModelBtn input-group-text">'+
                  sLocaleFor("Pre-IC discontinuities")+
              '</span>'+
              '<input id="'+mID+'-DelayAddDisc" type="text" class="form-control" '+sMainNoAutocorrect+'>'+
            '</div>'+

            '<label for="'+mID+'-DelayPreInitCode" class="mt-2 sModelBtn form-label">'+
                sLocaleFor('Code for pre-initial conditions for')+' '+mEvolutionPageName+
            '</label>'+
            '<div class="ace" id="'+mID+'-DelayPreInitCode" style="height: 150px;"></div>'+

            '<div class="mt-2 input-group">'+
              '<span class="sTranslatable sModelBtn input-group-text">'+
                  sLocaleFor("Comment")+
              '</span>'+
              '<input id="'+mID+'-DelayComment" type="text" class="form-control" >'+
            '</div>'+            
            
          '</div>'+

          '<div class="sModelSubpanel tab-pane fade"'+
            ' id="'+mID+'-ErrorHandlingDiv" style="flex-grow:1"'+ 
            ' role="tabpanel" aria-labelledby="'+mID+'-ErrorHandlingTab">'+
          '</div>'+
  
        '</div>'+

      '</div>';
    return html;
  }

	// --------------------------
	// Final start-up
	// --------------------------

	
	return self;
}


WebEJS_GUI.odeDiscontinuityEditor = function(mEvolutionPanel, mID) {
  const TABBED_PANEL = WebEJS_TOOLS.tabbedPanel();
  const mMainPanelSelector = '#'+mID;
  
	var self = {};
  var mConditionEditorByHash = {};
  var mActionEditorByHash = {};

	// Implementation of TabbedPanel (begin)

	self.getMainPanelSelector	= function() { return mMainPanelSelector; }
	self.getKeyword	= function() { return 'Discontinuity'; }
	self.getPageName	= function() { return 'Discontinuity Page'; }

	self.getDefaultPageType = function() { return 'DISCONTINUITY_EDITOR'; }

	// ----- optional functions for TabbedPanel

  self.pageDeleted = function(mPageDiv) {
    const hash = TABBED_PANEL.getPageDivHash(mPageDiv);
    delete mConditionEditorByHash[hash];
    delete mActionEditorByHash[hash];
  }

  self.reportableChange = function(message) {
    sMainGUI.setChanged();
  }
 
  self.setNoPages = function() {
    $(mMainPanelSelector).html(
      '<button class="sModelBtn sPanelNoPageBtn h-100 col-12 active" style="flex-grow:1;">'+
        '<h5 class="sTranslatable">'+sLocaleFor('Click to create a page of')+' '+sLocaleFor('Discontinuity')+'</h5>'+
      '</button>');
    TABBED_PANEL.initPanel(self,null);
  }

 self.pageInitialization = function(mPageDiv, mPageObject) {
    const hash = TABBED_PANEL.getPageDivHash(mPageDiv);
    const pageName = TABBED_PANEL.getPageDivName(self,mPageDiv);
    
    var zeroCode   = (mPageObject ? mPageObject.ZeroCondition : "return 1.0; // Condition for "+ pageName);
    var actionCode = (mPageObject ? mPageObject.Action        : "// Action for "+ pageName);

    mConditionEditorByHash[hash] = TABBED_PANEL.initializeCodeEditor(mID+'-ZeroEditor-'+hash,zeroCode,
          ()=>{ mEvolutionPanel.reportableChange('ODE Discontinuity Zero Condition'); }, // onBlur
          ()=>{ mEvolutionPanel.nonReportableChange('ODE Discontinuity Zero Condition'); });
    mActionEditorByHash[hash] = TABBED_PANEL.initializeCodeEditor(mID+'-ActionEditor-'+hash,actionCode,
          ()=>{ mEvolutionPanel.reportableChange('Disc Action'); }, // onBlur
          ()=>{ mEvolutionPanel.nonReportableChange('Disc Action'); });
    
    mPageDiv.find('input').on("change", (event)=>{ mEvolutionPanel.reportableChange('ODE Discontinuity change '+event.target.id); });

    if (mPageObject) {
      $('#'+mID+'-TolField-'+hash).val(mPageObject.Tolerance);
      $('#'+mID+'-EndCheckbox-'+hash).prop("checked", (mPageObject.StopAtDiscontinuity=="true"));
      $('#'+mID+'-Comment-'+hash).val(mPageObject.Comment);
    }
    
    mPageDiv.find('.cVariableChooser').on("click", (event)=>{ 
        mEvolutionPanel.selectVariable(event,TABBED_PANEL.getPageDivName(self, mPageDiv));
    });   

  }

  // {Type: "DISCONTINUITY_EDITOR",  
  //   DiscontinuityContent:{Tolerance: "1.0e-5", StopAtDiscontinuity: "true", 
  // ZeroCondition: "↵return 1.0;↵", Action: "↵// disc action↵", Comment: ""} } 

  self.getPageObject = function(mPageHash) {
    var page = TABBED_PANEL.getPageObject(self,mPageHash);
    page.Action = mActionEditorByHash[mPageHash].getValue();
    page.Comment = $('#'+mID+'-Comment-'+mPageHash).val();
    page.StopAtDiscontinuity = $('#'+mID+'-EndCheckbox-'+mPageHash).is(":checked") ? "true" : "false";
    page.Tolerance = $('#'+mID+'-TolField-'+mPageHash).val();
    page.ZeroCondition = mConditionEditorByHash[mPageHash].getValue();
    return page;
  }
        
  self.pageMainBuilder = function(mHash, mPage) {
    return ''+
      '<div class="container h-100 d-flex flex-column" style="flex-grow:1">'+
      
            '<div class="row d-flex flex-column" style="height:50%;">'+
            
              '<div class="container p-0" style="flex-grow:0; flex-basis:0;">'+
                '<div class="row">'+
                  '<div class="col">'+
                      '<span id="'+mID+'-ZeroLabel" class="sTranslatable sModelBtn input-group-text btn text-decoration-none" >'+
                        sLocaleFor("Zero condition")+
                      '</span>'+
                  '</div>'+

                  '<div class="col input-group">'+
                    '<span class="sTranslatable sModelBtn input-group-text">'+
                      sLocaleFor("Tol")+
                    '</span>'+
                    '<input id="'+mID+'-TolField-'+mHash+'" type="text" class="form-control" '+
                        sMainNoAutocorrect+
                        'style="width:8em;" value="1.0e-5" >'+
                    '<span class="input-group-text" >'+
                      '<i class="sModelBtn bi bi-link cVariableChooser" '+
                        ' data-types="int|double" '+
                        ' data-field="#'+mID+'-TolField-'+mHash+'" '+
                        ' style="font-size: 1rem;"></i>'+
                    '</span>'+
                  '</div>'+
                '</div>'+ // end of row
              '</div>'+ // end of container for Zero condition header


              '<div class="ace mt-1" id="'+mID+'-ZeroEditor-'+mHash+'" style="flex-grow:1; min-height:100px;"></div>'+
            '</div>'+ // end of first BIG 50% row
              
            '<div class="row d-flex flex-column" style="height:50%;">'+

              '<div class="container p-0" style="flex-grow:0; flex-basis:0;">'+
                '<div class="row">'+
                  
                  '<div class="col">'+
                    '<span class="sTranslatable sModelBtn input-group-text btn text-decoration-none">'+
                      sLocaleFor("Action")+
                    '</span>'+
                  '</div>'+

                  '<div class="col input-group">'+
                    '<span class="form-check">'+
                      '<input class="form-check-input" type="checkbox" value="" checked '+
                        ' name="'+mID+'-EndCheckbox-'+mHash+'" id="'+mID+'-EndCheckbox">'+
                      '<label class="sTranslatable form-check-label" for="'+mID+'-EndCheckbox">'+
                        sLocaleFor("End step at discontinuity")+
                      '</label>'+
                    '</span>'+
                  '</div>'+
                  
                '</div>'+ // end of row
              '</div>'+ // end of header for Action

              '<div class="ace mt-1" id="'+mID+'-ActionEditor-'+mHash+'" style="flex-grow:1; min-height:100px;"></div>'+
            '</div>'+ // end of second BIG 50% row
            
        '</div>';
        
  }
  
  self.pageCommentBuilder = function(mHash, mPage) {
    return ''+ 
      '<div class="input-group input-group-sm dropup drop-start" style="flex-grow: 1;">'+
        '<span class="sTranslatable sModelBtn input-group-text">Comment</span>'+
        '<input type="text" class="sPageCommentField form-control" id="'+mID+'-Comment-'+mHash+'"'+
          ' placeholder="Page comment" aria-label="Page comment">' + 
      '</div>';
  }  
	
	return self;
}

WebEJS_GUI.odeErrorHandlingEditor = function(mEvolutionPanel,mID) {
  const TABBED_PANEL = WebEJS_TOOLS.tabbedPanel();
  const mMainPanelSelector = '#'+mID;
  
  var self = {};
  var mEditorByHash = {};

  // Implementation of TabbedPanel (begin)

  self.getMainPanelSelector = function() { return mMainPanelSelector; }
  self.getKeyword = function() { return 'OnError'; }
  self.getPageName  = function() { return 'On Error Page'; }

  self.getDefaultPageType = function() { return 'ERROR_EDITOR'; }


  // ----- optional functions for TabbedPanel

  self.pageDeleted = function(mPageDiv) {
    const hash = TABBED_PANEL.getPageDivHash(mPageDiv);
    delete mEditorByHash[hash];
  }

  self.reportableChange = function(message) {
    sMainGUI.setChanged();
  }

  self.setNoPages = function() {
    $(mMainPanelSelector).html(
      '<button class="sModelBtn sPanelNoPageBtn h-100 col-12 active" style="flex-grow:1;">'+
        '<h5 class="sTranslatable">'+sLocaleFor('Click to create a page of')+' '+sLocaleFor('Error Handling')+'</h5>'+
      '</button>');
    TABBED_PANEL.initPanel(self,null);
  }

 self.pageInitialization = function(mPageDiv, mPageObject) {
    const hash = TABBED_PANEL.getPageDivHash(mPageDiv);
    const pageName = TABBED_PANEL.getPageDivName(self,mPageDiv);
    
    var code  = (mPageObject ? mPageObject.Code : "// Error handling for "+ pageName);
    mEditorByHash[hash] = TABBED_PANEL.initializeCodeEditor(mID+'-Editor-'+hash,code,
          ()=>{ mEvolutionPanel.reportableChange('ODE Error handling'); }, // onBlur
          ()=>{ mEvolutionPanel.nonReportableChange('ODE Error handling'); });

    mPageDiv.find('input').on("change", (event)=>{ mEvolutionPanel.reportableChange('ODE Error handling change '+event.target.id); });
    mPageDiv.find('select').on("change", (event)=>{ mEvolutionPanel.reportableChange('ODE Error handling change '+event.target.id); });

    if (mPageObject) {
      $('#'+mID+'-TypeSelector-'+hash+' option[value="'+mPageObject.ErrorType+'"]').attr('selected', true);    
      $('#'+mID+'-Comment-'+hash).val(mPageObject.Comment);
    }
    
  }
  // ErrorHandlingContent: {Comment: "", Code: "↵// error code 1↵", ErrorType: "ANY_ERROR"} } 

  self.getPageObject = function(mPageHash) {
    var page = TABBED_PANEL.getPageObject(self,mPageHash);
    page.Code = mEditorByHash[mPageHash].getValue();
    page.ErrorType = $('#'+mID+'-TypeSelector-'+mPageHash+' option:selected').val();
    page.Comment = $('#'+mID+'-Comment-'+mPageHash).val();
    return page;
  }
        
  self.pageMainBuilder = function(mHash, mPage) {
    return ''+
      '<div class=" h-100 d-flex flex-column" style="flex-grow:1">'+
                  
        '<div class="input-group" style="flex-grow:0; flex-basis:0;">'+
          '<span class="sTranslatable sModelBtn input-group-text">'+
            sLocaleFor("Error Type")+
          '</span>'+
          '<select id="'+mID+'-TypeSelector-'+mHash+'" class="form-select" >'+
            '<option value="ANY_ERROR">ANY ERROR </option>'+
            '<option value="INTERNAL_SOLVER_ERROR" selected>INTERNAL SOLVER ERROR</option>'+
            '<option value="EVENT_NOT_FOUND">EVENT NOT FOUND</option>'+
            '<option value="ILLEGAL_EVENT_STATE">ILLEGAL EVENT STATE</option>'+
            '<option value="TOO_MANY_STEPS">TOO MANY STEPS</option>'+
            '<option value="DID_NOT_CONVERGE">DID NOT CONVERGE</option>'+
          '</select>'+
        '</div>'+

        '<div class="ace mt-1" id="'+mID+'-Editor-'+mHash+'" style="flex-grow:1; min-height:200px;"></div>'+
              
        '</div>';
        
  }
  
  self.pageCommentBuilder = function(mHash, mPage) {
    return ''+ 
      '<div class="input-group input-group-sm dropup drop-start" style="flex-grow: 1;">'+
        '<span class="sTranslatable sModelBtn input-group-text">Comment</span>'+
        '<input type="text" class="sPageCommentField form-control" id="'+mID+'-Comment-'+mHash+'"'+
          ' placeholder="Page comment" aria-label="Page comment">' + 
      '</div>';
  }  
  
  return self;
}
/*
 * Copyright (C) 2021 Jesús Chacón, Francisco Esquembre and Félix J. Garcia 
 * This code is part of the Web EJS authoring and simulation tool
 */

/**
 * GUI tools
 * @module core
 */


 
/**
 * @class evolutionPanel 
 * @constructor  
 */
WebEJS_GUI.odePreliminaryCodePanel = function(mEvolutionPanel, mPageDiv, mPageObject) {
  const TABBED_PANEL = WebEJS_TOOLS.tabbedPanel();
  const mPageHash = TABBED_PANEL.getPageDivHash(mPageDiv);
  const mPageName = TABBED_PANEL.getPageDivName(mEvolutionPanel,mPageDiv);

  const titleString = sMainResources.getString('Preliminary code for ODE')+' : '+mPageName;
  const mID = "mODEPreliminaryCodeEditor_"+mPageHash;

	var self = {};
	
  var mContents = mPageObject ? 
    {  'Code'    : mPageObject.PreliminaryCode.Code, 
       'Comment' : mPageObject.PreliminaryCode.Comment }
    : 
    { 'Code'    : "// "+ titleString ,  'Comment' : '' };	

  var mPanel = null;
  var mEditor = null;

	// --------------------------
	// read and write
	// --------------------------
	
	self.getContent = function() {
    collectContents();
    return mContents;
  }

  function collectContents() {
    if (!mPanel) return;
    mContents = {
      'Code'   : mEditor.getValue(),  
      'Comment' : $('#'+mID+'-Comment').val() 
    };
  }

  // --------------------------
  // Interface
  // --------------------------

  const mPreferredSize = {
    width: Math.min(window.innerWidth*0.9,1200),
    height: Math.min(window.innerHeight*0.9,1200)
  }; 

  self.show = function() {
    if (!mPanel) return createPanel();
    mPanel.resize(mPreferredSize); 
    mPanel.reposition();
    mPanel.front();
  }

  self.hide = function() {
    if (mPanel) mPanel.close(); 
  }
  
  // Create and show the jsPanel
  function createPanel() {
    sMainHideTooltips();
    const options = {
      content: '<div id="'+mID+'-ace" class="ace h-100" style="flex-grow:1"></div>',
      onbeforeclose: function(panel) {
        collectContents();
        mPanel = null;
        return true;
      },
      position: { at: 'center', of : '#sMainWorkpanel' },
      footerToolbar: 
        '<div class="h-100 d-flex flex-row" style="flex-grow:1">'+
          '<div class="input-group input-group-sm" style="flex-grow:1;">'+
            '<span class="sTranslatable sModelBtn input-group-text">'+sLocaleFor("Comment")+'</span>'+
            '<input type="text" class="flex flex-grow form-control" id="'+mID+'-Comment"'+
              ' placeholder="'+sLocaleFor("Page comment")+'" aria-label="'+sLocaleFor("Page comment")+'">'+
          '</div>'+
          '<button type="button" id="'+mID+'-Button" style="flex-grow:0; flex-basis:0;" '+
            'class="sTranslatable ms-1 input-group-button btn btn-primary float-left">Done</button>'+
        '</div>',
      callback : function(panel) {
        $('#'+mID+'-Button').click(function() { mPanel.close(); });
        mEditor = TABBED_PANEL.initializeCodeEditor(mID+"-ace",mContents.Code,
          ()=>{ mEvolutionPanel.nonReportableChange('PrelimCode'); }, // onBlur
          ()=>{ mEvolutionPanel.nonReportableChange('PrelimCode'); });
        $('#'+mID+'-Comment').val(mContents.Comment);
      }
    };
    mPanel = WebEJS_TOOLS.createJSPanel(titleString, options, {  minimize: 'remove' }, mPreferredSize);
  }
  
  function getContentHtml() {
    return ''+
        '<div class="input-group input-group-sm" style="flex-grow:0; flex-basis:0;">'+
          '<span class="sTranslatable sModelBtn input-group-text">'+sLocaleFor("Comment")+'</span>'+
          '<input type="text" class="flex flex-grow form-control" id="'+mID+'-Comment"'+
            ' placeholder="'+sLocaleFor("Page comment")+'" aria-label="'+sLocaleFor("Page comment")+'">'+
        '</div>'+
      '</div>';
      /*
      panel.headertitle.style.color = $('.sModelBtn').css("color");// $('#sEvolutionPage_PreliminaryCode_CommentLabel_'+index+'").css("color");;
      panel.headerbar.style.background = "#e8ecee"; //"white";// $('#sEvolutionPage_PreliminaryCode_CommentLabel_'+index+'").css("color");;
      panel.headerbar.style.borderBottom = '1px solid '+$('.sModelBtn').css("color");// $('#sEvolutionPage_PreliminaryCode_CommentLabel_'+index+'").css("color");;
      panel.footer.style.padding = '0px';
      mPrelimCodeEditors[hash].Panel = panel;
      */
  }
    
	// --------------------------
	// Final start-up
	// --------------------------

	
	return self;
}

/*
 * Copyright (C) 2021 Jesús Chacón, Francisco Esquembre and Félix J. Garcia 
 * This code is part of the Web EJS authoring and simulation tool
 */


WebEJS_GUI.codePanelMenuAction = function(mAction, mCodeEditor, mChangeTarget) {
		switch (mAction) {
			case "CustomMethods":
				sMainSelectCodeForm.show("Custom methods",sMainGUI.getModel().getCustomCode().getCustomMethods(),mCodeEditor,mChangeTarget);
				break;
			case "ModelMethods":
				sMainSelectCodeForm.show("Model methods",sMainGUI.getSystemInformation('model_methods'),mCodeEditor,mChangeTarget);
				break;
			case "ViewMethods":
				sMainSelectCodeForm.show("View methods",sMainGUI.getSystemInformation('view_methods'),mCodeEditor,mChangeTarget);
				break;
			case "ToolsMethods":
				sMainSelectCodeForm.show("Tools methods",sMainGUI.getSystemInformation('tools_methods'),mCodeEditor,mChangeTarget);
				break;
			case "CodeWizard":
				break;
		}
	}

/**
 * @class codePanel 
 * @constructor  
 */
WebEJS_GUI.codePanel = function(mKeyword, mMainPanelSelector) {
	const TABBED_PANEL = WebEJS_TOOLS.tabbedPanel();
	const TEXT_TOOLS = WebEJS_TOOLS.textTools();

	var self = {};
	
	var mCodeEditors = {};
	
	// Implementation of TabbedPanel (begin)

	self.getKeyword	= function() {
		switch(mKeyword) {
			case 'initialization' : return  'Initialization';
			case 'fixed_relations' : return  'FixedRelations';
			case 'custom' : return  'Custom';
			default: return mKeyword; 
		}
	}
	
	self.getPageName	= function() { 
		switch(mKeyword) {
			case 'initialization' : return  'Init Page';
			case 'fixed_relations' : return  'FixRel Page';
			case 'custom' : return  'Custom Page';
			default: return 'Page'; 
		}
	}

	self.getMainPanelSelector	= function() { return mMainPanelSelector; }
	self.getDefaultPageType = function() { return 'CODE_EDITOR'; }


	// Rest of the implementation of TabbedPanel at the end
	
	// ---------------------------------
	// read and write
	// ---------------------------------
	
	function label(mKeyword) {
		switch(mKeyword) {
			case 'initialization' : return  'initialization';
			case 'fixed_relations' : return  'fixed relations';
			case 'custom' : return  'custom code';
		}
	}
	
	self.readObject = function(codeInfo) {
    	mCodeEditors = {};
		if (!('pages' in codeInfo)) self.setNoPages();
		else {
			const pages = codeInfo.pages;
			if (pages==null || pages.length<=0) self.setNoPages();
			else {
				$(mMainPanelSelector).html(TABBED_PANEL.panelHTML(self,pages));
				TABBED_PANEL.initPanel(self,pages);
			}
		}
		return true;
	}

	self.getPageObject = function(mPageHash) {
		var page = TABBED_PANEL.getPageObject(self,mPageHash);
		page.Comment =  $('#m'+mKeyword+'PageComment_'+mPageHash).val();
		page.Code	 = mCodeEditors[mPageHash].getValue();
		return page;
	}

	self.saveObject = function() {
		return { 'pages' : TABBED_PANEL.getAllPagesObject(self) };
	}

	// ---------------------
	// Code menu
	// ---------------------

	self.getCustomMethods = function() {
		var list = [];
		for (var hash in mCodeEditors) {
			const pageName = TABBED_PANEL.getPageDivNameByHash(self,hash);
			const code = mCodeEditors[hash].getValue();
			list.push(...TEXT_TOOLS.getCustomMethods(pageName,code));
		}
		return list;
	}

	// ---------------------------------------
	// TabbedPanel implementation (continued)
	// ---------------------------------------

	self.reportableChange = function(message) {
		sMainGUI.setChanged();
	}
	

	self.setNoPages = function() {
		$(mMainPanelSelector).html(
			'<button class="sModelBtn sPanelNoPageBtn active" style="flex-grow:1;">'+
				'<h5 class="sTranslatable">Click to create a page of '+label(mKeyword)+'</h5>'+
			'</button>');
		TABBED_PANEL.initPanel(self,null);
	}

	self.pageInitialization = function(mPageDiv, mPageObject) {
		const hash = TABBED_PANEL.getPageDivHash(mPageDiv);
		mPageDiv.find('.ace').each(function() { 
			var code = (mPageObject ? mPageObject.Code : "// "+ TABBED_PANEL.getPageDivName(self,mPageDiv));
			mCodeEditors[hash] = TABBED_PANEL.initializeCodeEditor($(this).attr('id'),code,
				()=>{ self.reportableChange('PageContent'); }, // onBlur
				()=>{ sMainGUI.setChanged(); });
		});
		
		mPageDiv.find('.sPageCommentField').on("change", ()=>{ sMainGUI.setChanged(); });
		mPageDiv.find('.cCodeMenuItem').on("click", (event)=>{ 
			WebEJS_GUI.codePanelMenuAction($(event.target).data('action'), mCodeEditors[hash], self);
		});	
	}

	self.pageDeleted = function(mPageDiv) {
		const hash = TABBED_PANEL.getPageDivHash(mPageDiv);
		delete mCodeEditors[hash];
	}

	self.pageMainBuilder = function(mHash, mPage) {
		return '<div class="ace" id="m'+mKeyword+'PageCodeEditor_'+mHash+'" style="flex-grow:1"></div>';
	}
	
	self.pageCommentBuilder = function(mHash, mPage) {
		return ''+ 
			'<div class="input-group input-group-sm dropup drop-start" style="flex-grow: 1;">'+
				'<span class="sTranslatable sModelBtn input-group-text">Comment</span>'+
				'<input type="text" class="sPageCommentField form-control" id="m'+mKeyword+'PageComment_'+mHash+'"'+
					' placeholder="Page comment" aria-label="Page comment"'+
					(mPage && mPage.Comment ? ' value="'+ mPage.Comment+'"' :'') +	'>' +	
			  '<span class="sModelBtn input-group-text dropdown-toggle"'+
						' data-bs-toggle="dropdown" aria-expanded="false" style="appearance:none">'+
						'<i class="bi bi-menu-down"></i>'+
				'</span>'+
					'<ul class="dropdown-menu" data-hash="'+mHash+'">'+
						'<li class="dropdown-item sTranslatable cCodeMenuItem" data-action="CustomMethods">Custom methods</li>'+
						'<li class="dropdown-item sTranslatable cCodeMenuItem" data-action="ModelMethods" >Model methods</li>'+
						'<li class="dropdown-item sTranslatable cCodeMenuItem" data-action="ViewMethods"  >View methods</li>'+
						'<li class="dropdown-item sTranslatable cCodeMenuItem" data-action="ToolsMethods" >Tools methods</li>'+
						'<li><hr class="dropdown-divider"></li>'+
						'<li class="dropdown-item sTranslatable cCodeMenuItem py-0" data-action="CodeWizard" >Code wizard</li>'+
					'</ul>'+
			'</div>';
	}			
	
	return self;
}

/*
 * Copyright (C) 2021 Jesús Chacón, Francisco Esquembre and Félix J. Garcia 
 * This code is part of the Web EJS authoring and simulation tool
 */

/**
 * GUI tools
 * @module core
 */

WebEJS_GUI.elementsPanel_dragFunction = function(event,suffix) {
  console.log("Drag saved: "+event.target.dataset.drag_info);
  event.dataTransfer.setData("text", "EJS-model_element:"+event.target.dataset.drag_info);
}
  
/**
 * @class elementsPanel 
 * @constructor  
 */
WebEJS_GUI.elementsPanel = function() {
	const mMEListElementSelector = '#sModelList';
	const SELECTED = 'border border-danger';

  var self = {};

	var mMODEL_ELEMENTS_FOLDER = '';
	var mMODEL_ELEMENTS = [];
	var mHash = 0;

	// --------------------------
	// Elements instances
	// --------------------------

	var mElementInstances = {};

	// ---------------------
	// read and write
	// ---------------------
		
	self.readObject = function(elementsInfo) {
		$(mMEListElementSelector).empty();
	 	const list = elementsInfo.list;
		for (var index in list) {
			const element = list[index];
			const instanceElement = createInstance(element.Classname,element.Name);
			if ('Contents' in element) {
				instanceElement.readXMLContents(element.Contents);
			}
		}
		return true;
	}

	self.saveObject = function() {
		var list = [];
		$(mMEListElementSelector).find('.list-group-item').each(function(index,listItemStr) {
      const listItem = $(listItemStr);
			var element = {
				Classname : listItem.data('classname'),
				Name : getItemName(listItem)
			};
			const instanceElement = mElementInstances[listItem.data('hash')];
			if (instanceElement.saveXMLContents) element['Contents'] = instanceElement.saveXMLContents()
			list.push(element);
		});
		return { 'list' : list };
	}
	
	// ---------------------
	// Setters and getters
	// ---------------------

	self.nonReportableChange = function(message) {
    console.log ("Model variable, non reportable change: "+message);
    sMainGUI.setChanged();
  }
  				

	// ---------------------------------------
	// Palette
	// ---------------------------------------

	function getItemName(listItem) {
		return listItem.find('.sMEListElementName').first().text();
	}

	function setItemName(listItem,name) {
		listItem.find('.sMEListElementName').first().text(name);
	}

	function createAccordionHTML(group) {
		var html = '';
		if ('html' in group) {
			html += '<span class="cMEreadme col m-2" style="user-select: none;" >'+
				'<figure class="figure m-2">'+
  				'<img src="'+sMainGUI.getSystemIconURL('info32.png')+'" class="m-0 figure-img img-fluid rounded mx-auto d-block" alt="Read Me" '+
					'   draggable="false"  data-name="'+group.name+'" data-html="'+group.html+'">'+
  				'<figcaption class="sModelBtn figure-caption text-end">'+sLocaleFor('Read me')+'</figcaption>'+
				'</figure>'+
			'</span>';
		}
		const elements = group.elements;
		for (var counter in elements) {
			const element = elements[counter];
			mMODEL_ELEMENTS.push(element);
			var title = element.name;
			if ('tooltip' in element) title += ' '+element.tooltip;
			html += '<span class=" cMEreadme col m-2" style="user-select: none;" >'+
				'<figure class="figure m-2"'+
					' draggable="true" ondragstart="WebEJS_GUI.elementsPanel_dragFunction(event)" data-drag_info="'+element.classname+'">' +
				'<img src="'+mMODEL_ELEMENTS_FOLDER+element.icon+'" class="m-0 figure-img img-fluid rounded mx-auto d-block" alt="'+element.name+'" '+
						' draggable="false"  data-bs-toggle="tooltip" data-bs-placement="top" '+
            ' data-html="'+element.html+'" data-name="'+element.name+'" title="'+title+'" >'+
					'<figcaption class="sModelBtn figure-caption text-center">'+element.name+'</figcaption>'+
				'</figure>'+
			'</span>';
		}
		return html;
	};

	function showElementHelp(name,url) {
    const options = 
		{
			theme : "bootstrap-light",
			headerLogo: sMainGUI.getWebEJSLogo(),
			headerTitle: '<h5 class="sTranslatable text-primary modal-title">'+name+'</h5>',
			headerControls: { smallify: 'remove', minimize: 'remove' },
			position: { at : 'center', of : '#sMainWorkpanel' },
			borderRadius: '.3rem',
			panelSize: {
				width: Math.min(window.innerWidth*0.7,600),
				height: Math.min(window.innerHeight*0.6,800)
			},
      //iframe : { width : '100%', height : '100%', src : mMODEL_ELEMENTS_FOLDER+url },
			content: '<iframe src="'+mMODEL_ELEMENTS_FOLDER+url+'" style="width: 100%; height: 100%;"></iframe>',
		};
    jsPanel.modal.create(options);
		$('.jsPanel-hdr').addClass(["p-1","bg-light"]);
		$('.jsPanel-content').addClass(["m-1", "p-2","bg-light",'border', "border-dark", "rounded"]);
	}

	self.buildPalette = function(systemInformation) {
		mMODEL_ELEMENTS_FOLDER = systemInformation['model_elements_folder'];
		elementGroups = systemInformation['model_elements'];
		mMODEL_ELEMENTS = [];
    for (var counter in elementGroups) {
			const id = "mModelElementPaletteRow_"+counter;
			const group = elementGroups[counter];
			var accordionDiv  = jQuery("<div/>", { class: "accordion-item p-0" });
			
      var html = ''+
          '<span class="accordion-header" id="'+id+'-header">'+
					'<button class="sModelBtn accordion-button py-1" type="button" data-bs-toggle="collapse" '+
					' data-bs-target="#'+id+'" aria-expanded="true" aria-controls="'+id+'">'+
						'<img id="'+id+'_group_button" class="cModelElementGroup" draggable="false" src="'+mMODEL_ELEMENTS_FOLDER+group.icon+'">' +
              group.name+
            '</button>'+
          '</span>'+
          '<div id="'+id+'" class="accordion-collapse collapse show" aria-labelledby="'+id+'-header">'+
            '<div class="mElementPaletteSubpanel accordion-body p-0">'+
							createAccordionHTML(group)+
            '</div>'+
	        '</div>';
			accordionDiv.html(html);
			$('#sModelElementsPaletteSubpanel').append(accordionDiv);
  	}
		
		$('.cMEreadme').on("click", (event) => {		
			showElementHelp($(event.target).data('name'),$(event.target).data('html'));
		});
	}

	// ---------------------------------------
	// List
	// ---------------------------------------

	// Set main bstreeview class to element.
	//$(mMEListElementSelector).addClass('bstreeview'); 
  
  // --- double-clicking on an element
  $(mMEListElementSelector).on('dblclick', '.list-group-item', function (event) {
    const treeItem = $(event.currentTarget).closest('.list-group-item');
		const hash = treeItem.data('hash');
		if (mElementInstances[hash].editConfiguration) mElementInstances[hash].editConfiguration();
    else {
			const element = getModelElement(treeItem.data('classname'));
			showElementHelp(element.name,element.html);     
		}
  });
  
  // --- Dragging and dropping on an element

  $(mMEListElementSelector).on('dragenter', function (event) {
    event.preventDefault(); 
    $(mMEListElementSelector).addClass(SELECTED);
  });
  
	$(mMEListElementSelector).on('dragover', function (event) {
		event.preventDefault(); 
    $(mMEListElementSelector).addClass(SELECTED);
	});

	$(mMEListElementSelector).on('dragleave', function (event) {
		event.preventDefault(); 
		$(mMEListElementSelector).removeClass(SELECTED);
	});

	$(mMEListElementSelector).on('dragenter', '.list-group-item', function (event) {
    event.preventDefault(); 
		//$(event.target).closest('.list-group-item').addClass(SELECTED);
    $(mMEListElementSelector).addClass(SELECTED);
  });	

  $(mMEListElementSelector).on('dragover', '.list-group-item', function (event) {
		event.preventDefault(); 
    $(mMEListElementSelector).addClass(SELECTED);
//		$(event.target).closest('.list-group-item').addClass(SELECTED);
  });

	/*
	$(mMEListElementSelector).on('dragleave', '.list-group-item', function (event) {
    event.preventDefault(); 
		$(event.target).closest('.list-group-item').removeClass(SELECTED);
  });
*/
  $(mMEListElementSelector).on('drop', function (event) {
    $(mMEListElementSelector).removeClass(SELECTED);
		if ($(event.target).hasClass('list-group-item')) {
			$(event.target).closest('.list-group-item').removeClass(SELECTED);
			console.log ("Target = "+getItemName($(event.target)));
		}
    const info = event.originalEvent.dataTransfer.getData("text");
    if (info.split(':')[0]!='EJS-model_element') return;
    const classname = info.split(':')[1];
    if (classname=='undefined') return;
    event.preventDefault();
		createInstance(classname);
		
  });

	$(mMEListElementSelector).on("click",'.item-icon',(event)=>{
    const listItem = $( event.target ).closest('.list-group-item');
		const name = getItemName(listItem);
    $( event.target ).parent().find('.cMEMenuHeader').text(sMainResources.getString("Menu for")+" "+name);
  });   

  $(mMEListElementSelector).on("click",'.cMEMenuItem',(event)=>{
    listItemMenuAction($( event.target ));
  });   

	function listItemMenuAction(menuItem) {
    const listItem = menuItem.closest('.list-group-item');
    const action = menuItem.data('action');
    //console.log("Action "+action + " for item: ");
    switch (action) {
      case "Edit" : 
				const hash = listItem.data('hash');
				mElementInstances[hash].editConfiguration();
				break;
      case "Rename" :
        const originalName = getItemName(listItem);
        sInputForm.show("Rename element","New name", originalName,
          function(name) {
            if (name===originalName) return;
            name = getUniqueName(name);
            setItemName(listItem,name);
          }
        );
        break;
      case "Remove" :
        sMainConfirmationForm.show(getItemName(listItem),
          "This action cannot be undone. Do you really want to remove this element?",
          "Remove",
          function() { 
						delete mElementInstances[listItem.data('hash')]
						listItem.remove(); 
					}
        );
        break;
      case "Help"     : 
				const element = getModelElement(listItem.data('classname'));
				showElementHelp(element.name,element.html);
				break;
    }
  }

	// -------------------------
  // Element instances
  // -------------------------
  
	function getModelElement(classname) {
		for (var i in mMODEL_ELEMENTS) {
			const element = mMODEL_ELEMENTS[i];
			if (element.classname == classname) return element;
		}
		sMainGUI.errorLine(sMainResources.getString("Attempt to create a NON-SUPPORTED model element:")); 
		sMainGUI.errorLine(sMainResources.getString("  - "+classname)); 
		/*
		sMessageForm.showWarning("MODEL ELEMENT reading error", 
			'The file includes a Model Element class not supported by WebEJS!', 
			"Check out the output area.");
		*/
			alert("Reading error:\n"+ 
			'The file includes a Model Element class not supported by WebEJS!\n'+
			"Check out the output area.");
		return null;
	}

	function getUniqueName(name) {
		name = name.replaceAll(' ','_');
    $(mMEListElementSelector).find('.list-group-item').each(function(index,listItemStr) {
      const listItem = $(listItemStr);
      if (getItemName(listItem)==name) name = getUniqueName(name+'New');
    });
    return name;
  }

	function findFirstBiggerClassname(classname) {
		const parts = classname.split('.');
		classname = parts[parts.length-1];
    var itemFound = null;
    $(mMEListElementSelector).find('.list-group-item').each(function(index,listItemStr) {
      const listItem = $(listItemStr);
			const itemParts = listItem.data('classname').split('.');
      if (itemParts[itemParts.length-1].localeCompare(classname)>0) {
				itemFound = listItem;
				return false;
			}
    });
    return itemFound;
  }

	function createInstance(classname,instanceName) {
		const element = getModelElement(classname);
		if (!element) return;
		mHash++;
		mElementInstances[mHash] = WebEJS_MODEL_ELEMENTS[element.classname]();
		if (!instanceName) {
			const lowername = element.name.charAt(0).toLowerCase()+element.name.substring(1);
			instanceName = getUniqueName(lowername);
		}
		var item = $(MODEL_ELEMENT_INSTANCE_TEMPLATE
			.replaceAll('{{CLASSNAME}}',classname)
			.replaceAll('{{NAME}}',instanceName)
			.replaceAll('{{HASH}}',mHash)
			.replaceAll('{{ICON}}',mMODEL_ELEMENTS_FOLDER+element.icon)
			.replaceAll('{{VISIBLE}}',mElementInstances[mHash].editConfiguration ? '' : 'd-none')
		);
		const bigger = findFirstBiggerClassname(element.classname);
		if (bigger) item.insertBefore(bigger);
		else $(mMEListElementSelector).append(item);
		return mElementInstances[mHash];
	}

	// -------------------------
	// Final initialization
	// -------------------------  

	return self;
}

MODEL_ELEMENT_INSTANCE_TEMPLATE = `
<div role="treeitem" class="list-group-item py-0 border-1" style="padding-left:10" data-hash={{HASH}} data-classname="{{CLASSNAME}}">
	<span class="dropdown">
		<img class="item-icon dropdown" style="padding: 0 2px 0 2px;" src="{{ICON}}" 
			id="mMEItemMenuIcon_{{HASH}}" type="button" data-bs-toggle="dropdown" aria-expanded="false">
		</img>
		<ul class="dropdown-menu py-0" aria-labelledby="mMEItemMenuIcon_{{HASH}}">
			<li><span class="cMEMenuHeader dropdown-item-text py-0 fw-bold">Menu</span></li>

			<li><hr class="dropdown-divider m-0"></li>
			<li class="{{VISIBLE}} dropdown-item sTranslatable cMEMenuItem" data-action="Edit">Edit</li>
			<li class="dropdown-item sTranslatable cMEMenuItem" data-action="Rename">Rename</li>
			<li class="dropdown-item sTranslatable cMEMenuItem" data-action="Help">Help</li>
			<li><hr class="dropdown-divider m-0"></li>
			<li class="dropdown-item sTranslatable cMEMenuItem" data-action="Remove">Remove</li>
		</ul>
	</span>
	<span class="sMEListElementName">{{NAME}}</span>
</div>
`;
/*
 * Copyright (C) 2021 Jesús Chacón, Francisco Esquembre and Félix J. Garcia 
 * This code is part of the Web EJS authoring and simulation tool
 */

/**
 * @class codePanel 
 * @constructor  
 */
WebEJS_GUI.eventPanel = function(mMainPanelSelector, mPageHash, mPages) {
	const TABBED_PANEL = WebEJS_TOOLS.tabbedPanel();
	const TEXT_TOOLS = WebEJS_TOOLS.textTools();

	var self = {};

	var mConditionEditors = {};
	var mActionEditors = {};

	// Implementation of TabbedPanel (begin)

	self.getKeyword	= function() { return ' Event'; }
	self.getPageName	= function() { return  'Event'; }
	self.getMainPanelSelector	= function() { return mMainPanelSelector; }
	self.getDefaultPageType = function() { return 'EVENT_EDITOR'; }
	
	// Rest of the implementation of TabbedPanel at the end
	
	// ---------------------------------
	// read and write
	// ---------------------------------

	const mBasicHtml = ''+
		'<div class="col-12 h-100 d-flex flex-column">'+
			'#{content}'+
			'<div class="m-1 d-flex flex-row" style="flex-basis:0;flex-grow: 0">'+
				'<div class="input-group input-group-sm" style="flex-basis:0;">'+
					'<label class="sTranslatable sModelBtn input-group-text cODEZenoEffectButton">Zeno effect action</label>'+
				'</div>'+
				'<div class="input-group input-group-sm me-1" style="flex-grow: 1">'+
					'<span class="sTranslatable sModelBtn input-group-text p-1 pe-2">Check events at steps no larger than</span>'+
					'<input type="text" class="form-control form-control-sm ps-1 cODEEventsStepSize" '+
						sMainNoAutocorrect+
						' id="mEventPageEditor_StepSize_'+mPageHash+'" >'+
					'<span class="input-group-text">'+
						'<i class="sModelBtn bi bi-link cVariableChooser" '+
							' data-types="int|double" '+
							' data-field="#mEventPageEditor_StepSize_'+mPageHash+'" '+
							' style="font-size: 1rem;"></i>'+
					'</span>'+
				'</div>'+
			'</div>'+
		'</div>';
		
  function getVariables(typesStr) {
    const typeList = typesStr.split('|');
    var varList = sMainGUI.getModel().getVariables().getVariablesOfType (typeList);
    var options = [];
    for (var i=0; i<varList.length; i++) {
      const variable =varList[i];
      const description = '('+variable.type+variable.dimension+') : '+variable.comment;
      options.push({ name : variable.name, value : variable.name, description :  description, style : 'sModelBtn' });
     }
    return options;
  } 
  
	self.readObject = function(pages) { // event pages
		if (pages==null || pages.length<=0) self.setNoPages();
		else {	
			$(mMainPanelSelector).html(TABBED_PANEL.panelHTML(self,pages));
			TABBED_PANEL.initPanel(self,pages);
		}
		$(mMainPanelSelector).find('.cODEZenoEffectButton').on("click", (event)=>{
			alert("Zenno efect panel here"); 
		});		
		$(mMainPanelSelector).find('.cVariableChooser').on("click", (event)=>{ 
			var types = $(event.target).data('types').split('|');
			var fieldSelector = $(event.target).data('field');
			var currentValue = $(fieldSelector).val().trim();
      sMainSelectChoiceForm.show("List of suitable variables",getVariables(types),value,
        function(newValue) {
          if (newValue==value) return;
          $(fieldSelector).val(newValue);
          self.nonReportableChange("Parameter changed on "+TABBED_PANEL.getPageDivName(self, mPageDiv));
      });

		});		
	}

	self.getPageObject = function(mPageHash) {
		var page = TABBED_PANEL.getPageObject(self,mPageHash);
		page.Comment = $('#m'+mKeyword+'PageComment_'+mPageHash).val();
		page.Code    = mCodeEditors[mPageHash].getValue();
		return page;
	}

	self.saveObject = function() {
		return { 'pages' : TABBED_PANEL.getAllPagesObject(self) };
	}

	// ---------------------------------------
	// TabbedPanel implementation (continued)
	// ---------------------------------------

	self.reportableChange = function(message) {
		sMainGUI.setChanged();
	}
	
	self.setNoPages = function() {
		var html = mBasicHtml.replace( /#{content}/g, 
			'<button class="sModelBtn sPanelNoPageBtn active" style="flex-grow:1;">'+
				'<h5 class="sTranslatable">Click to create an event page</h5>'+
			'</button>'
		);
		$(mMainPanelSelector).html(html);
		TABBED_PANEL.initPanel(self,null);
	}

	self.pageInitialization = function(mPageDiv, mPageObject) {
		const hash = TABBED_PANEL.getPageDivHash(mPageDiv);
		mPageDiv.find('.ace').each(function() { 
			var code = (mPageObject ? mPageObject.Code : "// "+ TABBED_PANEL.getPageDivName(self,mPageDiv));
			mCodeEditors[hash] = TABBED_PANEL.initializeCodeEditor($(this).attr('id'),code,
				()=>{ self.reportableChange('PageContent'); }, // onBlur
				()=>{ sMainGUI.setChanged(); });
		});
		
		mPageDiv.find('.sPageCommentField').on("change", ()=>{ sMainGUI.setChanged(); });
		mPageDiv.find('.cCodeMenuItem').on("click", (event)=>{ 
			WebEJS_GUI.codePanelMenuAction($(event.target).data('action'), mCodeEditors[hash], self);
			codeMenuAction(mPageDiv, $(event.target).data('action'));
		});	
	}

	self.pageDeleted = function(mPageDiv) {
		const hash = TABBED_PANEL.getPageDivHash(mPageDiv);
		mCodeEditors[hash] = null;
	}

	self.pageMainBuilder = function(mHash, mPage) {
		return '<div class="ace" id="m'+mKeyword+'PageCodeEditor_'+mHash+'" style="flex-grow:1"></div>';
	}
	
	self.pageCommentBuilder = function(mHash, mPage) {
		return ''+ 
			'<div class="input-group input-group-sm dropup drop-start" style="flex-grow: 1;">'+
				'<span class="sTranslatable sModelBtn input-group-text">Comment</span>'+
				'<input type="text" class="sPageCommentField form-control" id="m'+mKeyword+'PageComment_'+mHash+'"'+
					' placeholder="Page comment" aria-label="Page comment"'+
					(mPage && mPage.Comment ? ' value="'+ mPage.Comment+'"' :'') +	'>' +	
			  '<span class="sModelBtn input-group-text dropdown-toggle"'+
						' data-bs-toggle="dropdown" aria-expanded="false" style="appearance:none">'+
						'<i class="bi bi-menu-down"></i>'+
				'</span>'+
					'<ul class="dropdown-menu" data-hash="'+mHash+'">'+
						'<li class="dropdown-item sTranslatable cCodeMenuItem" data-action="CustomMethods">Custom methods</li>'+
						'<li class="dropdown-item sTranslatable cCodeMenuItem" data-action="ModelMethods" >Model methods</li>'+
						'<li class="dropdown-item sTranslatable cCodeMenuItem" data-action="ViewMethods"  >View methods</li>'+
						'<li class="dropdown-item sTranslatable cCodeMenuItem" data-action="ToolsMethods" >Tools methods</li>'+
						'<li><hr class="dropdown-divider"></li>'+
						'<li class="dropdown-item sTranslatable cCodeMenuItem py-0" data-action="CodeWizard" >Code wizard</li>'+
					'</ul>'+
			'</div>';
	}			
	
	return self;
}

/*
 * Copyright (C) 2021 Jesús Chacón, Francisco Esquembre and Félix J. Garcia 
 * This code is part of the Web EJS authoring and simulation tool
 */

/**
 * GUI tools
 * @module core
 */


 
/**
 * @class evolutionPanel 
 * @constructor  
 */
WebEJS_GUI.evolutionPanel = function(mMainPanelSelector) {
	const TABBED_PANEL = WebEJS_TOOLS.tabbedPanel();

	var self = {};
	var mTablePanel = WebEJS_TOOLS.tablePanel(self);
  var mRealTimeVariable = ''; // Never displayed (so far)

  // For code pages
	var mCodeEditors = {};
	// For ODE pages
	var mPrelimCodeEditors = {};
	var mEventsEditors = {};
  var mParametersEditors = {};
  
	// Implementation of TabbedPanel (begin)

	self.getMainPanelSelector	= function() { return mMainPanelSelector; }
	self.getKeyword	= function() { return 'Evolution'; }
	self.getPageName	= function() { return 'Evol Page'; }

	self.getDefaultPageType = function() { return 'EVOLUTION_EDITOR'; }

	// ----- optional functions for TabbedPanel

	self.getSecondType = function() { return 'ODE_EDITOR'; }

	self.getSecondTypeLabel = function() { return 'Create a new page of ODEs'; }
	
	self.isPageSecondType = function(mPageDiv) {
		return mPageDiv.find('.cODEtable').length>0;
	}
	
	self.disablePage = function(pageHash,mDisabled) {
    if (self.isPageSecondType(TABBED_PANEL.getDivPageByHash(self,pageHash))) {
      if (mDisabled) {
        mPrelimCodeEditors[pageHash].hide();
        mEventsEditors[pageHash].hide();
        mParametersEditors[pageHash].hide();
      }
    }
	}

	// ----- end of optional functions for TabbedPanel

	// Rest of the implementation of TabbedPanel at the end
	
	// -----------------------------
	// Once-only GUI initialization
	// -----------------------------

	$("#sEvolParamFPSRange").on("input", (data)=>{ 
		var value = data.target.value;
		if (value<25) $ ('#sEvolParamFPS').val(value);
		else  $ ('#sEvolParamFPS').val(100);
		self.nonReportableChange('FPS changed');
	});	
	
	$("#sEvolParamFPSRange").on("mouseup", (data)=>{
		var command = { 'action' : 'SetFPS', 'value': data.target.value };
		self.nonReportableChange(command);
	});
	
	$("#sEvolParamFPSRange").on("touchend", (data)=>{
		var command = { 'action' : 'SetFPS', 'value': data.target.value };
		self.nonReportableChange(command);
	});

	$("#sEvolParamFPS").on("change", ()=>{
		var value = Math.round($('#sEvolParamFPS').val());
		if (isNaN(value)) value = 15;
		if (value<1) value = 1;
		if (value>24) {
			$('#sEvolParamFPSRange').val(25);
			value = 100;
		}
		else $('#sEvolParamFPSRange').val(value);
		$ ('#sEvolParamFPS').val(value);
		var command = { 'action' : 'SetFPS', 'value' : value };
		self.nonReportableChange(command);
	});
	
	$("#sEvolParamSPD").on("change", ".sEvolParamSPD", ()=>{
		var command = { 'action' : 'SetSPD', 'value': $('#sEvolParamSPD').val() }
		self.nonReportableChange(command);
	});

	// --------------------------
	// read and write
	// --------------------------

	self.readObject = function(evolutionInfo) {
    mCodeEditors = {};
    mPrelimCodeEditors = {};
    mEventsEditors = {};
    mParametersEditors = {};

		if (!('information' in evolutionInfo)) {
			$('#sEvolParamFPSRange').val(20);
			$('#sEvolParamFPS').val(20);
			$('#sEvolParamSPD').val(1);
			$('#sEvolParamAutoplay').prop('checked', true);
      mRealTimeVariable = '';
		}
		else {
			// read global evolution parameters
			const information = evolutionInfo.information
			if (information.FPS>24) $('#sEvolParamFPSRange').val(25);
			else $('#sEvolParamFPSRange').val(information.FPS);
			$('#sEvolParamFPS').val(information.FPS);
			$('#sEvolParamSPD').val(information.SPD);
			if (information.Autoplay=="false") $('#sEvolParamAutoplay').prop('checked', false);
      else $('#sEvolParamAutoplay').prop('checked', true);
      if ('RealTimeVariable' in evolutionInfo) mRealTimeVariable = evolutionInfo.RealTimeVariable;
      else mRealTimeVariable = '';
    }
    if (!('pages' in evolutionInfo)) self.setNoPages();
    else {
			const pages = evolutionInfo.pages;
			if (pages==null || pages.length<=0) self.setNoPages();
			else {
        $(mMainPanelSelector).html(TABBED_PANEL.panelHTML(self,pages));
        TABBED_PANEL.initPanel(self,pages);
        mTablePanel.processRowsToSet();
        //sInitMathJax();
			}
		}
		return true;
	}

  self.getPageObject = function(pageHash) {
    var page = TABBED_PANEL.getPageObject(self,pageHash);
    page.Comment = $('#mEvolutionPageComment_'+pageHash).val();

    if (self.isPageSecondType(TABBED_PANEL.getDivPageByHash(self,pageHash))) {
      page.IndependentVariable = $('#mEvolutionPageEditor_IndependentVariable_'+pageHash).val();
      page.Increment           = $('#mEvolutionPageEditor_Increment_'+pageHash).val();
      page.Equations = mTablePanel.getTableRows(pageHash);
      page.Method = $('#mEvolution_PageEditor_Method_'+pageHash+' option:selected').val();
      page.AbsoluteTolerance  = $('#mEvolution_PageEditor_Tolerance_'+pageHash).val();

      page.PreliminaryCode = mPrelimCodeEditors[pageHash].getContent();     
      mEventsEditors[pageHash].getContent(page);     
      mParametersEditors[pageHash].getContent(page);
    }
    else {
      page.Code = mCodeEditors[pageHash].getValue();
    }
    return page;
  }

	self.saveObject = function() {
		return {
			'information' : {
				'FPS' : $('#sEvolParamFPSRange').val(),
				'SPD' : $('#sEvolParamSPD').val(),
        'RealTimeVariable' : mRealTimeVariable,
				'Autoplay' : $('#sEvolParamAutoplay').prop('checked') ? "true" : "false"
			},
			'pages' : TABBED_PANEL.getAllPagesObject(self) 
		};
	}
	
	// ---------------------------------------
	// TabbedPanel implementation (continued)
	// ---------------------------------------

  self.nonReportableChange = function(message) {
    console.info ("Model evolution, non reportable change: "+message);
    sMainGUI.setChanged();
  }

	self.reportableChange = function(message) {
    console.info ("Model evolution, reportable change: "+message);
		sMainGUI.setChanged();
	}
	
	self.setNoPages = function() {
		$(mMainPanelSelector).html(
			'<div class="h-100 col-12 mx-auto btn-group-vertical" style="flex-grow:1;">'+
				'<button class="sModelBtn sPanelNoPageBtn col-12 h-50 active" data-type="'+self.getDefaultPageType()+'" >'+
					'<h5 class="sTranslatable">Click to create a page of code</h5>'+
				'</button>'+
				'<button class="sModelBtn sPanelNoPageBtn col-12 h-50 active" data-type="'+self.getSecondType()+'" >'+
					'<h5 class="sTranslatable">Click to create a page of ODEs</h5>'+
				'</button>'+
			'</div>');
		TABBED_PANEL.initPanel(self,null);
	}
		
  self.pageMainBuilder = function(pageHash, page, mType) {
    if (mType=='ODE_EDITOR') return odeHTML(pageHash,page);
    return '<div class="ace" id="mEvolutionPageCodeEditor_'+pageHash+'" style="flex-grow:1"></div>';
  }
  
  self.pageCommentBuilder = function(pageHash, page) {
    return ''+
      '<div class="input-group input-group-sm" style="flex-grow: 1;">'+
        '<span class="sTranslatable sModelBtn input-group-text">Comment</span>'+
        '<input type="text" class="sPageCommentField form-control" id="mEvolutionPageComment_'+pageHash+'"'+
          ' placeholder="Page comment" aria-label="Page comment"'+
          (page && page.Comment ? ' value="'+ page.Comment+'"' :'') +  '>' + 
      '</div>'; 
  }

  function getVariables(typesStr) {
    const typeList = typesStr.split('|');
    var varList = sMainGUI.getModel().getVariables().getVariablesOfType (typeList);
    var options = [];
    for (var i=0; i<varList.length; i++) {
      const variable =varList[i];
      const description = '('+variable.type+variable.dimension+') : '+variable.comment;
      options.push({ name : variable.name, value : variable.name, description :  description, style : 'sModelBtn' });
     }
    return options;
  } 

  self.selectVariable = function(event, pageName) {
    const types = $(event.target).data('types');
    const fieldSelector = $(event.target).data('field');
    const value = $(fieldSelector).val().trim();
    sMainSelectChoiceForm.show("List of suitable variables",getVariables(types),value,
      function(newValue) {
        if (newValue==value) return;
        $(fieldSelector).val(newValue);
        if ($(event.target).hasClass("cEvolutionIndepVar")) refreshStates(pageHash);
        self.nonReportableChange("Parameter changed on "+pageName+ " ("+ fieldSelector+")");
      }
    );
  }
  
  self.pageInitialization = function(mPageDiv, mPageObject) {
    const pageHash = TABBED_PANEL.getPageDivHash(mPageDiv);
    
    if (self.isPageSecondType(mPageDiv)) { // Initialization in case of ODE page
      const pageName = TABBED_PANEL.getPageDivName(self,mPageDiv);
      mPrelimCodeEditors[pageHash] = WebEJS_GUI.odePreliminaryCodePanel(self,mPageDiv,mPageObject);
      mEventsEditors[pageHash] = WebEJS_GUI.odeEventsPanel(self,mPageDiv,mPageObject);
      mParametersEditors[pageHash] = WebEJS_GUI.odeParametersPanel(self,mPageDiv,mPageObject);
      
      mPageDiv.find('.cVariableChooser').on("click", (event)=>{ 
        if (TABBED_PANEL.isPageDisabled(self,mPageDiv)) return;
        self.selectVariable(event,TABBED_PANEL.getPageDivName(self, mPageDiv));
      });   

      mPageDiv.find('.cODEIndepVar').on("change", (event)=>{
        refreshStates(pageHash);
      });

      mPageDiv.find('.cODEPrelimCodeButton').on("click", function() {
        if (TABBED_PANEL.isPageDisabled(self,mPageDiv)) return;
        mPrelimCodeEditors[pageHash].show();
      }); 

      mPageDiv.find('.cODEEventsButton').on("click", function() {
        if (TABBED_PANEL.isPageDisabled(self,mPageDiv)) return;
        mEventsEditors[pageHash].show();
      }); 

      mPageDiv.find('.cODEParametersButton').on("click", function() {
        if (TABBED_PANEL.isPageDisabled(self,mPageDiv)) return;
        mParametersEditors[pageHash].show();
      }); 

      mPageDiv.find('.cODEPrelimCodeButton').on("click", function() {
        if (TABBED_PANEL.isPageDisabled(self,mPageDiv)) return;
        mPrelimCodeEditors[pageHash].show();
      }); 

      mTablePanel.tableInitialization(pageHash);
    }
    else { // Initialization for a page of code
      mPageDiv.find('.ace').each(function() { 
        var code = (mPageObject ? mPageObject.Code : "// "+ TABBED_PANEL.getPageDivName(self,mPageDiv));
        mCodeEditors[pageHash] = TABBED_PANEL.initializeCodeEditor($(this).attr('id'),code,
          ()=>{ self.reportableChange('PageContent'); }, // onBlur
          ()=>{ sMainGUI.setChanged(); });
      });
    }
  }
  
  self.pageDeleted = function(mPageDiv) {
    const hash = TABBED_PANEL.getPageDivHash(mPageDiv);
    if (self.isPageSecondType(mPageDiv)) {
      mPrelimCodeEditors[hash].hide();
      delete mPrelimCodeEditors[hash];
      mEventsEditors[hash].hide();
      delete mEventsEditors[hash];
      mParametersEditors[hash].hide();
      delete mParametersEditors[hash];
    }
    else {
      delete mCodeEditors[hash];
    }
  }

  // ---------------------------------------
  // ODE HTML 
  // ---------------------------------------

	function odeHTML(pageHash, page) {
		const solvers = sMainGUI.getSystemInformation('solvers');
		const eqnList = page ? page.Equations : [];

		var html =  ''+
			'<div class="tabContent d-flex flex-column" style="flex-grow:1">'+
				'<div id="mEvolutionPageEditor_'+pageHash+'" class="cODEtable table-responsive d-flex flex-column" style="flex-grow:1">'+
					// --- ODE table header ---
				  '<div class="m-1 d-flex flex-row" style="flex-basis:0;flex-grow: 0">'+
						'<div class="input-group input-group-sm me-1" style="flex-grow: 1">'+
							'<span class="sTranslatable sModelBtn input-group-text p-1 pe-2">Indep. Var.</span>'+
							'<input type="text" class="form-control form-control-sm ps-1 cODEIndepVar" '+
              sMainNoAutocorrect+
								' id="mEvolutionPageEditor_IndependentVariable_'+pageHash+'" '+ (page ? 'value='+page.IndependentVariable : '')+'>'+
							'<span class="input-group-text">'+
								'<i class="sModelBtn bi bi-link cVariableChooser cEvolutionIndepVar" '+
									' data-types="int|double" '+
									' data-field="#mEvolutionPageEditor_IndependentVariable_'+pageHash+'" '+
									' style="font-size: 1rem;"></i>'+
							'</span>'+
						'</div>'+
						'<div class="input-group input-group-sm me-1" style="flex-grow: 1">'+
							'<span class="sTranslatable sModelBtn input-group-text p-1 pe-2">Increment</span>'+
							'<input type="text" class="form-control form-control-sm ps-1 sODEIncrement" '+
              sMainNoAutocorrect+
                ' id="mEvolutionPageEditor_Increment_'+pageHash+'" '+ (page ? 'value='+page.Increment : '')+'>'+
							'<span class="input-group-text" >'+
								'<i class="sModelBtn bi bi-link cVariableChooser" '+
									' data-types="int|double" '+
									' data-field="#mEvolutionPageEditor_Increment_'+pageHash+'" '+
									' style="font-size: 1rem;"></i>'+
							'</span>'+
						'</div>'+
						'<div class="input-group input-group-sm" style="flex-basis:0;">'+
							'<label class="sTranslatable sModelBtn input-group-text cODEPrelimCodeButton">Prelim code</label>'+
						'</div>'+
					'</div>'+
					// --- ODE table ---
					'<div class="sModelBorderedPanel table-responsive" style="flex-grow: 1">'+
					   mTablePanel.getTableHTML(pageHash,COLUMN_HEADERS,eqnList)+
					'</div>'+
		    // --- ODE table footer ---
          '<div class="m-1" style="flex-basis: 0;flex-grow: 0">'+
					 '<div class="d-flex flex-row">'+
					
						'<div class="input-group input-group-sm me-1" style="flex-grow: 5">'+
							'<span class="sTranslatable sModelBtn input-group-text p-1 pe-2">Solver</span>'+
							'<select class="form-select" id="mEvolution_PageEditor_Method_'+pageHash+'">';
							
			const selectedKey = (page ? page.Method : sMainGUI.getSystemInformation('default_solver'));
			for (methodIndex in solvers) {
				var method = solvers[methodIndex];
				if (method.key == selectedKey) html += 
								'<option selected value="'+method.key+'">'+method.name+'</option>';
				else html += 
								'<option value="'+method.key+'">'+method.name+'</option>';
			}
			html +=	'</select>'+
						'</div>'+
						
						'<div class="input-group input-group-sm me-1" style="flex-grow: 5">'+
							'<span class="sTranslatable sModelBtn input-group-text p-1 pe-2">Tol</span>'+
							'<input type="text" class="form-control form-control-sm ps-1" '+
								' placeholder="Absolute tolerance" aria-label="Absolute tolerance"'+
                sMainNoAutocorrect+
								' id="mEvolution_PageEditor_Tolerance_'+pageHash+'" '+	
								(page && page.AbsoluteTolerance ? ' value="'+ page.AbsoluteTolerance+'"' :'') +	'>' +	
							'<span class="input-group-text">'+
								'<i class="sModelBtn bi bi-link col-12 cVariableChooser" '+
									' data-types="int|double" '+
									' data-field="#mEvolution_PageEditor_Tolerance_'+pageHash+'" '+
									' data-name="tolerance" '+
									' style="font-size: 1rem;">'+
								'</i>'+
							'</span>'+
						'</div>'+
						
						'<div class="input-group input-group-sm me-1" style="flex-basis: 0">'+
							'<span class="input-group-text sODEParameters cODEParametersButton"><i class="sModelBtn bi bi-table" style="font-size: 1rem;"></i></span>'+
						'</div>'+
						'<div class="input-group input-group-sm" style="flex-basis:0;">'+
							'<span class="sTranslatable sModelBtn cODEEventsButton input-group-text p-1 pe-2" id="mEvolution_PageEvents_'+pageHash+'">'+sLocaleFor('Events')+'</span>'+
						'</div>'+
						
				'</div>'+
			'</div>'+
		'</div>'+
		'</div>';
		return html;
	}

  self.showNumberOfEvents = function(numberOfEvents,mPageDiv) {
    const pageHash = TABBED_PANEL.getPageDivHash(mPageDiv);
    $("#mEvolution_PageEvents_"+pageHash).text(numberOfEvents+' '+sLocaleFor('Events'))
    
  }
  
  // ---------------------------------------
  // TablePanel implementation 
  // ---------------------------------------

  function refreshStates(pageHash) {
    mTablePanel.getRows(pageHash).each(function() {
      const stateElement = $( this ).find('.cODEstate').first();
      const value = stateElement.find('.cODEvalue').val();
      setState(stateElement, pageHash, value) 
    });
  }
  
  function setState(element, pageHash, value) {
    const indepVar = $('#mEvolutionPageEditor_IndependentVariable_'+pageHash).val(); 
    var diffSign = (sMainSimulationOptions.useDeltaForODEs()) ? '\\Delta' : 'd'; 
    diffSign = (sMainSimulationOptions.useDeltaForODEs()) ? '&#916;' : 'd'; 
    var rateHtml = '$ \\frac{'+diffSign+' \\, '+value+' } {'+diffSign+' \\, '+indepVar+' } $'; 
    rateHtml = '<span class="fw-bold">'+diffSign+'</span> '+value+'<span class="fw-bold"> / '+diffSign+'</span> '+indepVar; 
    element.find('.cODEvalue').val(value);
    element.find('.cODEdisplay').html(rateHtml);
    //sInitMathJax();
  }

  function setRate(element, value) {
    element.find('.cODEvalue').val(value);
    element.find('.cODEdisplay').html(value);
  }
  
  self.tableRowInitialization = function(pageHash, odeHash, odeTr) {
    
    odeTr.find('.cODEstate').on("click", (event)=>{ 
      const pageDiv = TABBED_PANEL.getDivPageByHash(self,pageHash);
      if (TABBED_PANEL.isPageDisabled(self,pageDiv)) return;
      const parent = $( event.target ).closest('.cODEstate');
      const value = parent.find('.cODEvalue').val();
      sMainSelectChoiceForm.show("List of suitable variables",getVariables('double|double[]'),value,
        function(newValue) {
          if (newValue==value) return;
          setState(parent,pageHash,newValue);
          if (odeTr.is(':last-child')) mTablePanel.appendEmptyRow(pageHash);
          self.nonReportableChange("ODE state changed on "+pageHash);
          //sInitMathJax();
        });
    });   

    odeTr.find('.cODErate').on("click", (event)=>{ 
      const pageDiv = TABBED_PANEL.getDivPageByHash(self,pageHash);
      if (TABBED_PANEL.isPageDisabled(self,pageDiv)) return;
      const parent = $( event.target ).closest('.cODErate');
      const value = parent.find('.cODEvalue').val();
      sMainSelectChoiceForm.show("List of suitable variables",getVariables('int|int[]|double|double[]'),value,
        function(newValue) {
          if (newValue==value) return;
          setRate(parent,newValue);
          if (odeTr.is(':last-child')) mTablePanel.appendEmptyRow(pageHash);
          self.nonReportableChange("ODE Rate changed on "+pageHash);
        });
    });   

  }
  
  const COLUMN_HEADERS = [ { name : 'State'}, { name : ''}, { name : 'Rate', class : 'col-11' } ];

  self.getTableEmptyRow = function() { return { 'state' : '', 'rate' : '' }; }
  
  self.getTableRowHTML = function(pageHash, rowHash, rowID) {
    return ''+
      '<td id="'+rowID+'State" class="col-4 cODEstate">'+
        '<input hidden class="cODEvalue" type="text" '+sMainNoAutocorrect+'/>'+
        '<span class="cODEdisplay fw-normal" ></span>'+
      '</td>'+
      '<td class="fw-bold">=</td>'+ // Had class pt-2 for MathJax
      '<td id="'+rowID+'Rate" class="col-8 cODErate">'+ // Had class pt-2 for MathJax
        '<input hidden class="cODEvalue" type="text" '+sMainNoAutocorrect+'/>'+
        '<span class="cODEdisplay fw-normal" ></span>'+
      '</td>';
  }

  self.setTableRow = function(pageHash,rowID,equation) {
    setState($('#'+rowID+'State'),pageHash,equation.state);
    setRate($('#'+rowID+'Rate'),equation.rate);
  }

  //const sSELECTOR=0; // Thsi one is added by mTablePanel
  const sSTATE=1;
  //const sEQUAL_SIGN=2;
  const sRATE=3;
 
  self.getTableRowObject = function(tdArray) {
    return {
      'state'    : $(tdArray[sSTATE]).find('.cODEvalue').val(),
      'rate'     : $(tdArray[sRATE]).find('.cODEvalue').val()
    };  
  }

  // ---------------------------------------
  // End of TablePanel implementation 
  // ---------------------------------------

	// --------------------------
	// Final start-up
	// --------------------------

	
	return self;
}

/* TO DO TODO Not yet used... but should!
WebEJS_GUI.ODE_HTML = `
<div class="tabContent d-flex flex-column" style="flex-grow:1">
  <div id="mEvolutionPageEditor_{{pageHash}}" class="cODEtable table-responsive d-flex flex-column" style="flex-grow:1">

    <!--- ODE table header --->
    <div class="m-1 d-flex flex-row" style="flex-basis:0;flex-grow: 0">
      <div class="input-group input-group-sm me-1" style="flex-grow: 1">
        <span class="sTranslatable sModelBtn input-group-text p-1 pe-2">Indep. Var.</span>
        <input type="text" class="form-control form-control-sm ps-1 cODEIndepVar" 
                spellcheck="off" autocorrect="off" autocapitalize="none" autocomplete="off"          
                id="mEvolutionPageEditor_IndependentVariable_{{pageHash}}" {{indVarValue}} >
        <span class="input-group-text">
          <i class="sModelBtn bi bi-link cVariableChooser cEvolutionIndepVar" 
              data-types="int|double" 
              data-field="#mEvolutionPageEditor_IndependentVariable_{{pageHash}}" 
              style="font-size: 1rem;">
          </i>
        </span>
      </div>
      <div class="input-group input-group-sm me-1" style="flex-grow: 1">
        <span class="sTranslatable sModelBtn input-group-text p-1 pe-2">Increment</span>
        <input type="text" class="form-control form-control-sm ps-1 sODEIncrement" 
            spellcheck="off" autocorrect="off" autocapitalize="none" autocomplete="off"          
            id="mEvolutionPageEditor_Increment_{{pageHash}}" {{incrementValue}} >
        <span class="input-group-text" >
          <i class="sModelBtn bi bi-link cVariableChooser" 
              data-types="int|double" 
              data-field="#mEvolutionPageEditor_Increment_{{pageHash}}" 
              style="font-size: 1rem;">
          </i>
        </span>
      </div>
      <div class="input-group input-group-sm" style="flex-basis:0;">
        <label class="sTranslatable sModelBtn input-group-text cODEPrelimCodeButton">Prelim code</label>
      </div>
    </div>

    <!--- ODE table --->
    <div class="sModelBorderedPanel table-responsive" style="flex-grow: 1">
       {{tableHTML}}
    </div>

  <!--- ODE table footer --->
    <div class="m-1" style="flex-basis: 0;flex-grow: 0">
      <div class="d-flex flex-row">
      
        <div class="input-group input-group-sm me-1" style="flex-grow: 5">
          <span class="sTranslatable sModelBtn input-group-text p-1 pe-2">Solver</span>
          <select class="form-select" id="mEvolution_PageEditor_Method_{{pageHash}}">
          {{ solverOptions}}
          </select>
        </div>
      
        <div class="input-group input-group-sm me-1" style="flex-grow: 5">
          <span class="sTranslatable sModelBtn input-group-text p-1 pe-2">Tol</span>
          <input type="text" class="form-control form-control-sm ps-1" placeholder="Absolute tolerance" aria-label="Absolute tolerance"
              spellcheck="off" autocorrect="off" autocapitalize="none" autocomplete="off" 
              id="mEvolution_PageEditor_Tolerance_{{pageHash}}" {{absTolValue}}>
          <span class="input-group-text">
            <i class="sModelBtn bi bi-link col-12 cVariableChooser" 
                data-types="int|double" 
                data-field="#mEvolution_PageEditor_Tolerance_{{pageHash}}" 
                data-name="tolerance" 
                style="font-size: 1rem;">
            </i>
          </span>
        </div>
      
        <div class="input-group input-group-sm me-1" style="flex-basis: 0">
          <span class="input-group-text sODEParameters cODEParametersButton"><i class="sModelBtn bi bi-table" style="font-size: 1rem;"></i></span>
        </div>
        <div class="input-group input-group-sm" style="flex-basis:0;">
          <span class="sTranslatable sModelBtn cODEEventsButton input-group-text p-1 pe-2" id="mEvolution_PageEvents_{{pageHash}}">Events</span>
        </div>  
      
      </div>
    </div>
  </div>
</div>

`;
*//*
 * Copyright (C) 2021 Jesús Chacón, Francisco Esquembre and Félix J. Garcia 
 * This code is part of the Web EJS authoring and simulation tool
 */

/**
 * GUI tools
 * @module core
 */

/**
 * @class variablesPanel 
 * @implements WebEJS_TOOLS.TabbedPanel		
 * @constructor  
 */
WebEJS_GUI.variablesPanel = function(mMainPanelSelector) {
	const TABBED_PANEL = WebEJS_TOOLS.tabbedPanel();
	const TEXT_TOOLS = WebEJS_TOOLS.textTools();
	
  var self = {};
  var mTablePanel = WebEJS_TOOLS.tablePanel(self);

	// Implementation of TabbedPanel (begin)

	self.getMainPanelSelector	= function() { return mMainPanelSelector; }
	self.getKeyword	  = function() { return 'Variables'; }
	self.getPageName	= function() { return 'Var Table'; }
	
	self.getDefaultPageType = function() { return 'VARIABLE_EDITOR'; }

  // ----- optional functions for TabbedPanel
  
  self.disablePage = function(mPageHash,mDisabled) {
    if (mDisabled) mTablePanel.removeWarnings(mPageHash);
  }
  
	// Rest of the implementation of TabbedPanel at the end

	// ---------------------
	// read and write
	// ---------------------
		
	self.readObject = function(variablesInfo) {
		if (!('pages' in variablesInfo)) self.setNoPages();
		else {
	 		var pages = variablesInfo.pages;
			if (pages==null || pages.length<=0) self.setNoPages();
			else {
				$(mMainPanelSelector).html(TABBED_PANEL.panelHTML(self,pages));
				TABBED_PANEL.initPanel(self,pages);
        mTablePanel.processRowsToSet();
				checkVariables();
			}
		}
		return true;
	}

	self.getPageObject = function(mPageHash) {
		var page = TABBED_PANEL.getPageObject(self,mPageHash);
		page.PageComment	= $('#mVariablesPageComment_'+mPageHash).val();
		page.Variables	  = mTablePanel.getTableRows(mPageHash);
		return page;
	}

	self.saveObject = function() {
		return { 'pages' : TABBED_PANEL.getAllPagesObject(self) };
	}
	
	// ---------------------
	// Setters and getters
	// ---------------------

  function getAllVariables(addTR) {
    var variables = []; //mTablePanel.getAllTableRows(mMainPanelSelector);
    TABBED_PANEL.getAllPagesDivList(self).each(function() {
      if (!TABBED_PANEL.isPageDisabled(self,$(this))) {
        const pageHash = TABBED_PANEL.getPageDivHash($(this));
        variables.push(...mTablePanel.getTableRows(pageHash,addTR));
      }
    });
    return variables;
  }
  
	self.getVariablesOfType = function(desiredTypesArray) {
		var variables = getAllVariables(false); //mTablePanel.getAllTableRows(mMainPanelSelector);
    var list = [];
		for (var i=0; i<variables.length; i++) {
      var variable = variables[i];
      if (variable.Name.trim().length<=0) continue;
      var type = variable.Type;
      var dimension = variable.Dimension.trim();
      if (dimension.length>0) type +="[]";
			if (desiredTypesArray.includes(type)) {
				if (dimension.length>0 && dimension[0]!='[') dimension = '['+dimension+']';
				list.push({ name : variable.Name, type : variable.Type, dimension : dimension, comment : variable.Comment });
			} 
		}
		return list;
	} 

	function checkVariables() {
    var variables = getAllVariables(true); //mTablePanel.getAllTableRows(mMainPanelSelector);
		var list = [];
    for (var i=0; i<variables.length; i++) {
      var variable = variables[i];
      if (variable.Name.trim().length<=0) continue;
      list.push({ name : variable.Name, value : variable.Value, dimension : variable.Dimension, tr : variable['_tr_'] });
		}
		TEXT_TOOLS.checkCode(list);
		var resultOk = true;
		for (var i in list) {
			var variable = list[i];
			if (variable['run_ok']) variable['tr'].removeClass('bg-warning');
			else {
				variable['tr'].addClass('bg-warning');
				resultOk = false;
			}
		}
		return resultOk;
	} 

	// ---------------------------------------
	// TabbedPanel implementation (continued)
	// ---------------------------------------


  self.nonReportableChange = function(message) {
    console.log ("Model variable, non reportable change: "+message);
    sMainGUI.setChanged();
  }

  self.reportableChange = function(message) {
    console.log ("Model variable, reportable change: "+message);
    sMainGUI.setChanged();
    if (checkVariables()) { // report the server
      var variables = self.saveObject();
      var report = { 'panel' : 'model', 'action' : 'setVariables', 'pages' :  variables.pages };
      sMainGUI.reportPreview(report); 
    }
  }
  
	self.setNoPages = function() {
		$(mMainPanelSelector).html(
			'<button class="sModelBtn sPanelNoPageBtn h-100 col-12 active" style="flex-grow:1;">'+
				'<h5 class="sTranslatable">Click to create a page of variables<h5>'+
			'</button>');
		TABBED_PANEL.initPanel(self,null);
	}

  self.pageMainBuilder = function(mPageHash, mPage) {
    const varList = mPage ? mPage.Variables : [];
    return mTablePanel.getTableHTML(mPageHash,COLUMN_HEADERS,varList);
  }
      
  self.pageCommentBuilder = function(mHash, mPage) {
    return ''+ 
      '<div class="input-group input-group-sm" style="flex-grow: 1;">'+
        '<span class="sTranslatable sModelBtn input-group-text">Comment</span>'+
        '<input type="text" class="form-control cCommentField" id="mVariablesComment_'+mHash+'" disabled value=""/>'+
      '</div>'+
      '<div class="input-group input-group-sm" style="flex-grow: 1;">'+
        '<span class="sTranslatable sModelBtn input-group-text">Page comment</span>'+
        '<input type="text" class="sPageCommentField form-control" id="mVariablesPageComment_'+mHash+'"'+
          ' placeholder="Page comment" aria-label="Page comment"'+
          (mPage && mPage.PageComment ? ' value="'+ mPage.PageComment+'"' :'') +  '>' + 
      '</div>';
  }

  self.pageInitialization = function(mPageDiv, mPageObject) {
    const pageHash = TABBED_PANEL.getPageDivHash(mPageDiv);
    
    mTablePanel.tableInitialization(pageHash);
    
    $('#mVariablesComment_'+pageHash).on('change', (event)=>{
      var rowHash = parseInt($(event.target).data('row_hash'));
      if (isNaN(rowHash)) return;
      const tdArray = mTablePanel.findRowTDArrayByHash(pageHash,rowHash);
      if (tdArray) mTablePanel.setText(tdArray,sCOMMENT,$(event.target).val());
      self.nonReportableChange('Variable comment changed');
    }); 
    
    mPageDiv.find('.sPageCommentField').on("change", ()=>{ 
      self.nonReportableChange("Page comment changed"); 
    });
  }

  // ---------------------------------------
  // TablePanel implementation 
  // ---------------------------------------
 
	self.tableRowInitialization = function(pageHash, variableHash, variableTr) {
		// Action for the type menu in each row
		variableTr.find('.cTypeMenuItem').on("click", (event)=>{ 
			const tdArray = variableTr.children();
			mTablePanel.setText(tdArray,sTYPE,$(event.target).data('type'));
			const variable = self.getTableRowObject(tdArray);
			self.reportableChange("Changed type of Variable "+variable.Name);
		});

		variableTr.find('input').on("change", (event)=>{
			if ($(event.target).attr('type')=='checkbox') return;
      const tdArray = variableTr.children();
      const variable = self.getTableRowObject(tdArray);
      self.reportableChange("Changed variable "+variable.Name);
			if (variableTr.is(':last-child')) mTablePanel.appendEmptyRow(pageHash);
		});

		variableTr.find('input').on("focus", (event)=>{
			const field = $('#mVariablesComment_'+pageHash);
			field.attr('disabled', false);
			field.data('row_hash',variableHash); // save for setVariableComment
			field.val(mTablePanel.getText(variableTr.children(),sCOMMENT));
			mTablePanel.highlightRows(pageHash, variableHash);
		});
	}

  const VariableMenuHTML = 
    '<div class="dropdown" data-target="type">'+
      '<button '+
        'class="btn btn-link text-decoration-none dropdown-toggle typeMenuButton" '+
        'style="padding:0px 5px 0px 0px; border:0px; "'+
        'type="button" '+
        'id="VarTableTypeMenuButton_#{label}" '+
        'data-bs-toggle="dropdown" '+
        'aria-expanded="false">'+
      '</button>'+
      '<ul class="dropdown-menu"  '+
        'aria-labelledby="VarTableTypeMenuButton_#{label}">'+
        '<li class="dropdown-item cTypeMenuItem" data-type="boolean">boolean</li>'+
        '<li class="dropdown-item cTypeMenuItem" data-type="int">int</li>'+
        '<li class="dropdown-item cTypeMenuItem" data-type="double">double</li>'+
        '<li class="dropdown-item cTypeMenuItem" data-type="String">String</li>'+
        '<li class="dropdown-item cTypeMenuItem" data-type="Object">Object</li>'+
      '</ul>'+
    '</div>';
    
  const COLUMN_HEADERS = [ 
    { name : 'Name' }, 
    { name : 'Initial Value'}, 
    { name : ''}, 
    { name : 'Type'}, 
    { name : 'Dimension'} 
  ];

  self.getTableEmptyRow = function() { 
    return { 'Name' : '', 'Value' : '', 'Type'  : 'double', 'Dimension' : '', 'Comment' : '', 'Domain' : ''};
  }
  
  self.getTableRowHTML = function(pageHash,rowHash,rowID) {
    return ''+
      '<td><input id="'+rowID+'Name"   type="text" class="col-12"'+sMainNoAutocorrect+'/></td>'+
      '<td><input id="'+rowID+'Value"  type="text" class="col-12"'+sMainNoAutocorrect+'/></td>'+
      '<td>'+VariableMenuHTML.replace( /#\{label\}/g, pageHash+'_'+rowHash)+'</td>'+
      '<td><input id="'+rowID+'Type"   type="text" class="col-12 cTypeColumn"'+sMainNoAutocorrect+'/></td>'+
      '<td><input id="'+rowID+'Dimension"  type="text" class="col-12"'+sMainNoAutocorrect+'/></td>'+
      '<td hidden><input id="'+rowID+'Comment" type="text" /></td>'+
      '<td hidden><input id="'+rowID+'Domain" type="text" /></td>';
  }
  
  self.setTableRow = function(pageHash,rowID,variable) {
    $('#'+rowID+'Name').val(variable.Name);
    $('#'+rowID+'Value').val(variable.Value);
    $('#'+rowID+'Type').val(variable.Type);
    $('#'+rowID+'Dimension').val(variable.Dimension);
    $('#'+rowID+'Comment').val(variable.Comment);
    $('#'+rowID+'Domain').val(variable.Domain);
  }

  self.rowRemoved = function(pageHash, rowHash) {
    const field = $('#mVariablesComment_'+pageHash);
    if (field.data('row_hash')==rowHash) {
      field.data('row_hash',null);
      field.attr('disabled', true);
      field.val('');
    }
  }
  
  const sSELECTOR=0; // Thsi one is added by mTablePanel
  const sNAME=1;
  const sVALUE=2;
  //const sTYPE_MENU=3;
  const sTYPE=4;
  const sDIMENSION=5;
  const sCOMMENT=6;
  const sDOMAIN=7;


      
  self.getTableRowObject = function(tdArray) {
    return {
      'Name'      : mTablePanel.getText(tdArray,sNAME),
      'Value'     : mTablePanel.getText(tdArray,sVALUE),
      'Type'      : mTablePanel.getText(tdArray,sTYPE),
      'Dimension' : mTablePanel.getText(tdArray,sDIMENSION),
      'Comment'   : mTablePanel.getText(tdArray,sCOMMENT),
      'Domain'    : mTablePanel.getText(tdArray,sDOMAIN)
    };  
  }
  				
	return self;
}/*
 * Copyright (C) 2021 Jesús Chacón, Francisco Esquembre and Félix J. Garcia 
 * This code is part of the Web EJS authoring and simulation tool
 */

/**
 * GUI forms
 * @module core
 */

/**
	* Creates a form to ask for a new name
 */
WebEJS_GUI.optionsSimulationPanel = function() {
	var self = {};
 
	//var mModal = new bootstrap.Modal(document.getElementById('sMainSimulationOptionsModal'))
	// $('#mSimulationOptionsEditorSaveButton').click(function() { mModal.hide();});

	var mPanel = null;
	var mOptions = null;

	/**
	 * returns if the dialog is finally visible
	 */
	self.toggle = function() {
		//mModal.show();
		sMainHideTooltips();
		if (mPanel) {
			mPanel.close();
			sMainGUI.setSimulationOptionsRadio(false);
			/*
			displayValues(mOptions);
			mPanel.resize({
			  width: Math.min(window.innerWidth*0.7,600),
			 	height: Math.min(window.innerHeight*0.6,800)
			}); 
			mPanel.reposition();
			mPanel.front();
			*/
			return false; 
		}
		// Create and show the jsPanel
		const options = {
      content : _GUI_FRAGMENT,
      /*
	    contentAjax: {
	        //url: '/static/fragments/SimulationOptions.html',
	        done: function (xhr, panel) {
            	panel.contentRemove();
           		panel.content.append(jsPanel.strToHtml(xhr.responseText));
							displayValues(mOptions);
							$('#mSimulationOptionsEditorDoneButton').click(function() { mPanel.close(); });
						sMainRefreshTooltips();
	        }
	    },
      */
	    onbeforeclose: function(panel) {
				collectValues();
				mPanel = null;
				return true;
	    },
			onclosed: function(panel, closedByUser) {
				mPanel = null;
				sMainGUI.setSimulationOptionsRadio(false);
			},
			footerToolbar: 
				'<button type="button" id="mSimulationOptionsEditorDoneButton" class="sTranslatable btn btn-primary float-left">Done</button>',
			callback : function(panel) {
        displayValues(mOptions);
        $('#mSimulationOptionsEditorDoneButton').click(function() { mPanel.close(); 
        }
      );
     sMainRefreshTooltips();
}
		};
		mPanel = WebEJS_TOOLS.createJSPanel(sMainResources.getString("Simulation options"), options);
		sMainGUI.setSimulationOptionsRadio(true);
	}
	
	// ----------------------------
	// Read/Save object
	// ----------------------------
		
	var mAuthors = [];
	var mAuthorsHash = 0;
	var mLogos = [];
	var mLogosHash = 0;
	
	// The information received is saved and changed ONLY where displayed.
	// If it contains information not acesible here, it will be returned untouched
	self.readObject = function(informationReceived) {
		if (!('PreviewFullModel' in informationReceived)) informationReceived['PreviewFullModel'] = "false";
		mAuthors = [];
		mAuthorsHash = 0;
		const authors = informationReceived['Author'];
		if (authors && authors.length>0) {
			authorsLogo = informationReceived['AuthorLogo'];
			for (var i=0; i<authors.length; i++) {
				var logo = ( authorsLogo && i<authorsLogo.length ) ? authorsLogo[i] : '';
				mAuthorsHash++;
				mAuthors.push({ 'name' : authors[i], 'logo' : logo, 'hash' : mAuthorsHash });
			}
		}
		mLogos = [];
		mLogosHash = 0;
		const logos = informationReceived['Logo'];
		if (logos) {
			for (var i=0; i<logos.length; i++) {
				mLogosHash++;
				mLogos.push({ 'logo' : logos[i], 'hash' : mLogosHash });
			}
		}		
		mOptions = informationReceived;
		if (mPanel) displayValues(mOptions);
		$('#sPreviewFullModel').prop("checked", (mOptions['PreviewFullModel']=="true"));

	}

	// The information received is saved and changed ONLY where displayed.
	// If it contains information not acesible here, it will be returned untouched
	self.saveObject = function() {
		if (mPanel) collectValues();
		return mOptions;
	}

	self.getDetectedFiles = function() {
		if (mPanel) collectValues();
		var detectedFiles = [];
		detectedFiles.push(...mOptions['AuthorLogo']);
		detectedFiles.push(...mOptions['Logo']);
		const css = mOptions['CSSFile'].trim();		
		if (css.length>0) detectedFiles.push(css);
		return detectedFiles;
	}

	self.getTitle = function() {
		if (mPanel) return $('#mSimulationOptionsTitle').val();
		return mOptions['Title'];
	}

	// ----------------------------
	// Consulting
	// ----------------------------
	
	self.useDeltaForODEs = function() {
		if (mPanel) return $('#mSimulationOptionsEditorUseDelta').is(":checked");
		return mOptions['UseDeltaForODE']=="true";
	}

	self.previewFullModel = function() {
		return $('#sPreviewFullModel').is(":checked");
		/*
		if (mPanel) return $('#mSimulationOptionsEditorFullModel').is(":checked");
		return mOptions['PreviewFullModel']=="true";
		*/
	}

	self.updateDetectedFiles = function() {
		var detectedFiles = sMainGUI.getDetectedFiles();
		const uniqueFiles = [...new Set(detectedFiles)]
		detectedFiles = []; 
		for (var i=0; i<uniqueFiles.length; i++) {
			const file = uniqueFiles[i].trim();
			if (file.length<=0) continue;
			if (file.startsWith('/') || file.startsWith('\"/')) continue;
			if (file.startsWith('%')) continue;
			detectedFiles.push(file);
		}
		const sorted = detectedFiles.sort();
		if (mPanel) displayDetectedFiles(sorted);
		else mOptions['DetectedFiles'] = sorted;
		return sorted;
	}

	self.addToDetectedFiles = function(filepath) {
		var found = false;
		console.log("Checking detected file : "+filepath);
		if (!filepath.startsWith('./')) filepath = './'+filepath;
		console.log("Actually file : "+filepath);
		$("#mSimulationOptionsDetectedFiles > option").each(function() {
			//console.log("- comparing to  : "+this.text);
			
    	if (this.text==filepath) { 
				//console.log("---- FOUND");
				found = true; 
				return false; 
			}
		});
		if (!found) {
			const option = $('<option>', { text: filepath });
			$('#mSimulationOptionsDetectedFiles').append(option);
			option.attr('selected', true);
		}
	}

	self.getRequiredFiles = function() {
		var requiredFiles = self.updateDetectedFiles();
		if (mPanel) {
			$("#mSimulationOptionsUserFiles > option").each(function() {
	    	requiredFiles.push(this.text);
			});
		}
		else requiredFiles.push(...mOptions['AuxiliaryFiles'])
		const uniqueFiles = [...new Set(requiredFiles)]
		const sorted = uniqueFiles.sort();
		return sorted;
	}
	
	// ----------------------------
	// Display options
	// ----------------------------

	function findIndexByHash(hash,array) {
		for (var i=0; i<array.length; i++) {
			if (entry = array[i]['hash'] == hash) return i;
		}
		return -1;
	}

	function rebuildGallery(selector,array, width, height) {
		var html = '';
		for (var i=0; i<array.length; i++) {
			const hash = array[i]['hash'];
			var logo = array[i]['logo'];
			if (logo.length<=0) logo = sMainGUI.getSystemIconURL("question-square.svg");
			else logo = sMainGUI.getURLpathFor(logo);
			html +=
				'<button class="p-1 btn btn-outline-secondary btn-link text-decoration-none"'+
									' data-bs-toggle="tooltip" data-bs-placement="bottom" '+
									' title="'+sMainResources.getString('Click to choose a '+width+' x '+height+' PNG file)')+'">'+
					'<img width="'+width+'" height="'+height+'" class="d-inline-block align-bottom;" src="'+logo+'" data-hash="'+hash+'" >'+
				'</button>';
		}
		$(selector).html(html);
		sMainRefreshTooltips();
	}	

	function displayDetectedFiles(files) {
			//console.log ("Updating detected files to");
			//console.log(files);
			var html = '';
			for (var i=0; i<files.length; i++) {
				const filepath = files[i].trim();
				html += '<option>'+filepath+'</option>';			
			}
			$("#mSimulationOptionsDetectedFiles").html(html);
		}

	function displayValues(simInfo) {
		$('#mSimulationOptionsTitle').val(simInfo['Title']);
		
		{ // Authors and author logo
			var html = '';
			for (var i=0; i<mAuthors.length; i++) {
				const name = mAuthors[i]['name'].trim();
				html += '<option value="'+mAuthors[i]['hash']+'">'+name+'</option>';			
			}
			$('#mSimulationOptionsAuthor').html(html);
			rebuildGallery('#mSimulationOptionsAuthorLogoGallery',mAuthors,50,50);
			
			$('#mSimulationOptionsAuthorLogoGallery').on('click','img',function() {
				const imgTag = $(this);
				const hash = $(this).data('hash');
				WebEJS_TOOLS.selectFile(['png','gif', 'jpg', 'jpeg'], 
					function(path,urlPath) { 
						const index = findIndexByHash(hash,mAuthors);
						if (index<0) { alert ("Author hash not found: "+hash); return; }
						mAuthors[index]['logo'] = path;
						imgTag.attr('src', urlPath); 
					},
					true, // Check existence
					null // No helper div
				);
			});		
			$('#mSimulationOptionsAuthorAdd').click((event)=>{
				const name = prompt(sMainResources.getString("Author name:"), "");
				if (name==null || name.trim().length<=0) return;
				mAuthorsHash++;
				mAuthors.push({ 'name' : name, 'logo' : '', 'hash' : mAuthorsHash });
				$('#mSimulationOptionsAuthor').append($('<option>', { value: mAuthorsHash, text: name }));
				$('#mSimulationOptionsAuthor option[value="'+mAuthorsHash+'"]').attr('selected', true);
				rebuildGallery('#mSimulationOptionsAuthorLogoGallery',mAuthors,50,50);
			});
			$('#mSimulationOptionsAuthorEdit').click((event)=>{
				const option = $('#mSimulationOptionsAuthor option:selected');
				var hash = option.val();
				const index = findIndexByHash(hash,mAuthors);
				if (index<0) { alert ("Author hash not found: "+hash); return; }
				const name = prompt(sMainResources.getString("Author name:"), mAuthors[index]['name']);
				if (name==null || name.trim().length<=0) return;
				mAuthors[index]['name'] = name;
				option.val(name);
				option.text(name);
			});
			$('#mSimulationOptionsAuthorDelete').click((event)=>{
				const option = $('#mSimulationOptionsAuthor option:selected');
				var hash = option.val();
				const index = findIndexByHash(hash,mAuthors);
				if (index<0) { alert ("Author hash not found: "+hash); return; }
   			mAuthors.splice(index, 1);
				option.remove();
				rebuildGallery('#mSimulationOptionsAuthorLogoGallery',mAuthors,50,50);
			});
		}

		$('#mSimulationOptionsCopyright').val(simInfo['Copyright']);
		$('#mSimulationOptionsKeywords').val(simInfo['Keywords']);
		$('#mSimulationOptionsLevel').val(simInfo['Level']);
		$('#mSimulationOptionsLanguages').val(simInfo['Language']);
		$('#mSimulationOptionsAbstract').val(simInfo['Abstract']);
		
		{ // simulation logo
			var html = '';
			for (var i=0; i<mLogos.length; i++) {
				const logo = mLogos[i]['logo'].trim();
				html += '<option value="'+mLogos[i]['hash']+'">'+logo+'</option>';			
			}
			$('#mSimulationOptionsLogo').html(html);
			rebuildGallery('#mSimulationOptionsLogoGallery',mLogos,320,180);
				
			$('#mSimulationOptionsLogoGallery').on('click','img',function() {
				const imgTag = $(this);
				const hash = $(this).data('hash');
				WebEJS_TOOLS.selectFile(['png','gif', 'jpg', 'jpeg'], 
					function(path,urlPath) { 
						const index = findIndexByHash(hash,mLogos);
						if (index<0) { alert ("Logo hash not found: "+hash); return; }
						mLogos[index]['logo'] = path;
						$('#mSimulationOptionsLogo option[value="'+hash+'"]').text(path);
						imgTag.attr('src', urlPath); 
					},
					true, // Check existence
					null // No helper div
				);
			});		

			$('#mSimulationOptionsLogoAdd').click((event)=>{
				WebEJS_TOOLS.selectFile(['png','gif', 'jpg', 'jpeg'], 
					function(path,urlPath) { 
						mLogosHash++;
						mLogos.push({ 'logo' : path, 'hash' : mLogosHash });
						$('#mSimulationOptionsLogo').append($('<option>', { value: mLogosHash, text: path }));
						$('#mSimulationOptionsLogo option[value="'+mLogosHash+'"]').attr('selected', true);
						rebuildGallery('#mSimulationOptionsLogoGallery',mLogos,320,180);
					},
					true, // Check existence
					null // No helper div
				);
			});
			$('#mSimulationOptionsLogoDelete').click((event)=>{
				const option = $('#mSimulationOptionsLogo option:selected');
				var hash = option.val();
				const index = findIndexByHash(hash,mLogos);
				if (index<0) { alert ("Logo hash not found: "+hash); return; }
  			if (index > -1) mLogos.splice(index, 1);
				option.remove();
				rebuildGallery('#mSimulationOptionsLogoGallery',mLogos,320,180);
			});
		}		
		
		$('#mSimulationOptionsEditorMustPause').prop("checked", (simInfo['RunAlways']=="false"));
		
		$('#mSimulationOptionsModelTab').val(simInfo['ModelTab']);
		$('#mSimulationOptionsModelTabTitle').val(simInfo['ModelTabTitle']);
		$('#mSimulationOptionsModelName').val(simInfo['ModelName']);
		$('#mSimulationOptionsFixedNavigationBar').prop("checked", (simInfo['FixedNavigationBar']=="false"));

		$('#mSimulationOptionsCSS').val(simInfo['CSSFile']);
		$('#mSimulationOptionsCSSEdit').click((event)=>{
				WebEJS_TOOLS.selectFile(['css'], 
					function(path,urlPath) { 
						$('#mSimulationOptionsCSS').val(path);
					},
					true, // Check existence
					null // No helper div
				);
			});
			$('#mSimulationOptionsCSSDelete').click((event)=>{
				$('#mSimulationOptionsCSS').val('');
			});

			var check = true;
			if ('IncludeSource' in simInfo) check = (simInfo['IncludeSource']!="false");
			$('#mSimulationOptionsIncludeSource').prop("checked", check);

			check = true;
			if ('IncludeLibrary' in simInfo) check = (simInfo['IncludeLibrary']!="false");
			$('#mSimulationOptionsIncludeLibrary').prop("checked", check);

			check = false;
			if ('SaveInXMLFormat' in simInfo) check = (simInfo['SaveInXMLFormat']=="true");
			$('#mSimulationOptionsSaveAsXML').prop("checked", check);
			
			check = false;
			if ('UglifyJS' in simInfo) includeCheck = (simInfo['UglifyJS']=="true");
			$('#mSimulationOptionsUglifyJS').prop("checked", includeCheck);
			
		{
			const files = simInfo['AuxiliaryFiles'];
			var html = '';
			for (var i=0; i<files.length; i++) {
				const filepath = files[i].trim();
				html += '<option>'+filepath+'</option>';			
			}
			$("#mSimulationOptionsUserFiles").html(html);
			$('#mSimulationOptionsUserFilesAdd').click((event)=>{
				$('#mFileChooserModal').data("bs-target","#sMainSimulationOptionsModal")
					.data("bs-toggle","modal").data("bs-dismiss","modal");

				WebEJS_TOOLS.selectFile(null, 
					function(filepath) { 
						if (!filepath.startsWith('/')) {
							if (!filepath.startsWith('./')) filepath = './'+filepath;
						}
						const option = $('<option>', { text: filepath });
						$('#mSimulationOptionsUserFiles').append(option);
						option.attr('selected', true);
					}, 
					false, // Accept even if it it not already there
					null // No helper div
				);
			});
			$('#mSimulationOptionsUserFilesDelete').click((event)=>{
				$('#mSimulationOptionsUserFiles option:selected').remove();
			});

		}
		
		{
			displayDetectedFiles(simInfo['DetectedFiles']);
			$('#mSimulationOptionsDetectedFilesRefresh').click((event)=>{
				self.updateDetectedFiles();
			});
		}
		$('#mSimulationOptionsHtmlHead').val(simInfo['HTMLHead']);
		
		$('#mSimulationOptionsEditorFullModel').prop("checked", (simInfo['PreviewFullModel']=="true"));

		$('#mSimulationOptionsEditorParse').prop("checked", (simInfo['UseInterpreter']=="true"));
		$('#mSimulationOptionsEditorUseDelta').prop("checked", (simInfo['UseDeltaForODE']=="true"));
	}

	function collectValues() {
		mOptions['Title'] 		= $('#mSimulationOptionsTitle').val();
		
		mOptions['Author'] = [];
		mOptions['AuthorLogo'] = [];
		for (var i=0; i<mAuthors.length; i++) {
			mOptions['Author'].push(mAuthors[i]['name']);
			mOptions['AuthorLogo'].push(mAuthors[i]['logo']);
		}
				
		mOptions['Keywords']  = $('#mSimulationOptionsKeywords').val();
		mOptions['Abstract']  = $('#mSimulationOptionsAbstract').val();
		mOptions['Copyright'] = $('#mSimulationOptionsCopyright').val();
		mOptions['Level'] 		 = $('#mSimulationOptionsLevel').val();
		mOptions['Language']  = $('#mSimulationOptionsLanguages').val();

		mOptions['Logo'] = [];
		for (var i=0; i<mLogos.length; i++) mOptions['Logo'].push(mLogos[i]['logo']);


		mOptions['RunAlways'] 		= $('#mSimulationOptionsEditorMustPause').is(":checked") ? "false" : "true";
		mOptions['ModelTab'] 		  = $('#mSimulationOptionsModelTab').val();
		mOptions['ModelTabTitle'] = $('#mSimulationOptionsModelTabTitle').val();
		mOptions['ModelName']  		= $('#mSimulationOptionsModelName').val();
		mOptions['FixedNavigationBar'] = $('#mSimulationOptionsFixedNavigationBar').is(":checked") ? "false" : "true";

		mOptions['IncludeSource']   = $('#mSimulationOptionsIncludeSource').is(":checked") ? "true" : "false";
		mOptions['IncludeLibrary']  = $('#mSimulationOptionsIncludeLibrary').is(":checked") ? "true" : "false";
		mOptions['SaveInXMLFormat'] = $('#mSimulationOptionsSaveAsXML').is(":checked") ? "true" : "false";
		mOptions['UglifyJS']        = $('#mSimulationOptionsUglifyJS').is(":checked") ? "true" : "false";

		mOptions['CSSFile'] 			= $('#mSimulationOptionsCSS').val();
		mOptions['AuxiliaryFiles'] = [];
		$("#mSimulationOptionsUserFiles > option").each(function() {
    	mOptions['AuxiliaryFiles'].push(this.text);
		});
		mOptions['DetectedFiles'] = [];
		$("#mSimulationOptionsDetectedFiles > option").each(function() {
    	mOptions['DetectedFiles'].push(this.text);
		});
		mOptions['HTMLHead'] = $('#mSimulationOptionsHtmlHead').val();

		mOptions['PreviewFullModel'] = $('#mSimulationOptionsEditorFullModel').is(":checked") ? "true" : "false";
		mOptions['UseInterpreter'] = $('#mSimulationOptionsEditorParse').is(":checked") ? "true" : "false";
		mOptions['UseDeltaForODE'] = $('#mSimulationOptionsEditorUseDelta').is(":checked") ? "true" : "false";
	}	

  const _GUI_FRAGMENT = `
	<div class="sMainSimulationOptionsDialog dialog-sm">
				
				<!-- begin tab headers -->
				<ul class="nav nav-tabs" role="tablist">
			  	<li class="nav-item" role="presentation">
	     			<button class="sTranslatable nav-link active" id="mSimulationOptionsEditorMetadataTab" 
			 		  		data-bs-toggle="tab" data-bs-target="#mSimulationOptionsEditorMetadataDiv"  
	     			  	type="button" role="tab" aria-controls="mSimulationOptionsEditorMetadataDiv" aria-selected="true">
	     			  	Metadata
	     			 </button>
	    		</li>
			  	<li class="nav-item" role="presentation">
	     			<button class="sTranslatable nav-link " id="mSimulationOptionsEditorRunningTab" 
						 		data-bs-toggle="tab" data-bs-target="#mSimulationOptionsEditorRunningDiv"  
	   					 	type="button" role="tab" aria-controls="mSimulationOptionsEditorRunningDiv" aria-selected="false">
     					 Run options
	     			</button>
	    		</li>
			  	<li class="nav-item" role="presentation">
						<button class="sTranslatable nav-link" id="mSimulationOptionsEditorExportTab" 
								data-bs-toggle="tab" data-bs-target="#mSimulationOptionsEditorExportDiv"  
								type="button" role="tab" aria-controls="mSimulationOptionsEditorExportDiv" aria-selected="false">
							Export options
						</button>
				 </li>
				 <li class="nav-item" role="presentation">
	     			<button class="sTranslatable nav-link" id="mSimulationOptionsEditorEditTab" 
			 		  		data-bs-toggle="tab" data-bs-target="#mSimulationOptionsEditorEditDiv"  
	     			  	type="button" role="tab" aria-controls="mSimulationOptionsEditorEditDiv" aria-selected="false">
	     			  Edit options
	     			</button>
	    		</li>
				</ul> 
				<!-- end tab headers -->
	     			
				<!-- begin tab content -->
				<div class="tab-content">
			 		  	
			 		<!-- begin METADATA content -->
			 		<div class="tab-pane fade show active" id="mSimulationOptionsEditorMetadataDiv" 
			 			   role="tabpanel" aria-labelledby="mSimulationOptionsEditorMetadataTab">
			 			  			
						<div class="mt-2 input-group">
						  <span  id="mSimulationOptionsTitleLabel" class="sTranslatable input-group-text">Title</span>
  						<input id="mSimulationOptionsTitle" type="text" class="form-control" placeholder="Enter title here" 
  										aria-label="Title" aria-describedby="mSimulationOptionsTitleLabel">
						</div>

						<div class="mt-2 input-group">
						  <span class="sTranslatable input-group-text">Author</span>
					    <select id="mSimulationOptionsAuthor" class="form-select"></select>
						  <span id="mSimulationOptionsAuthorAdd" 		class="input-group-text"
						  			data-bs-toggle="tooltip" data-bs-placement="bottom" title="Add">
						  	<i class="bi bi-clipboard-plus" style="color: black;"></i>
						  </span>
						  <span id="mSimulationOptionsAuthorEdit" 	class="input-group-text"
						  			data-bs-toggle="tooltip" data-bs-placement="bottom" title="Edit">
						  	<i class="bi bi-clipboard-data" style="color: black;"></i>
						  </span>
						  <span id="mSimulationOptionsAuthorDelete" class="input-group-text"
						  			data-bs-toggle="tooltip" data-bs-placement="bottom" title="Delete">
						  	<i class="bi bi-clipboard-x" style="color: black;"></i>
						  </span>
						</div>

						<div class="mt-2">
							<span id="mSimulationOptionsAuthorLogoGallery" class="btn-group btn-group-sm" role="group" aria-label="AuthorLogoGallery">
							</span>
        		</div>

						<div class="mt-2 input-group">
						  <span  id="mSimulationOptionsKeywordsLabel" class="sTranslatable input-group-text">Keywords</span>
  						<input id="mSimulationOptionsKeywords" type="text" class="form-control" placeholder="Enter keywords here" 
  										aria-label="Keywords" aria-describedby="mSimulationOptionsKeywordsLabel">
						</div>
						        								
						<!-- div class="mt-2 input-group">
						  <span  id="mSimulationOptionsAbstractLabel" class="sTranslatable input-group-text">Abstract</span>
  						<input id="mSimulationOptionsAbstract" type="text" class="form-control" placeholder="Enter abstract here" 
  										aria-label="Abstract" aria-describedby="mSimulationOptionsAbstractLabel">
						</div -->

						<div class="mt-2 form-floating">
						  <textarea  id="mSimulationOptionsAbstract" class="form-control" placeholder="Enter abstract here"style="height: 100px"></textarea>
						  <label class="sTranslatable" for="mSimulationOptionsAbstract">Comments</label>
						</div>

						<div class="mt-2 input-group">
						  <span  id="mSimulationOptionsCopyrightLabel" class="sTranslatable input-group-text">Copyright</span>
  						<input id="mSimulationOptionsCopyright" type="text" class="form-control" placeholder="Enter copyright here" 
  										aria-label="Copyright" aria-describedby="mSimulationOptionsCopyrightLabel">
						</div>
        							

						<div class="mt-2 input-group">
						  <span  id="mSimulationOptionsLevelLabel" class="sTranslatable input-group-text">Level</span>
  						<input id="mSimulationOptionsLevel" type="text" class="form-control" placeholder="Enter level here" 
  										aria-label="Level" aria-describedby="mSimulationOptionsLevelLabel">
						</div>

						<div class="mt-2 input-group">
						  <span  id="mSimulationOptionsLanguagesLabel" class="sTranslatable input-group-text">Languages</span>
  						<input id="mSimulationOptionsLanguages" type="text" class="form-control" placeholder="Enter languages here" 
  										aria-label="Languages" aria-describedby="mSimulationOptionsLanguagesLabel">
						</div>

						<div class="mt-2 input-group">
						  <span class="sTranslatable input-group-text">Logo</span>
					    <select id="mSimulationOptionsLogo" class="form-select"></select>
						  <span id="mSimulationOptionsLogoAdd" 		class="input-group-text"
						  			data-bs-toggle="tooltip" data-bs-placement="bottom" title="Add">
						  	<i class="bi bi-clipboard-plus" style="color: black;"></i>
						  </span>
						  <span id="mSimulationOptionsLogoDelete" class="input-group-text"
						  			data-bs-toggle="tooltip" data-bs-placement="bottom" title="Delete">
						  	<i class="bi bi-clipboard-x" style="color: black;"></i>
						  </span>
						</div>

						<div class="mt-2">
							<span id="mSimulationOptionsLogoGallery" class="btn-group btn-group-sm" role="group" aria-label="SimulationLogoGallery">
							</span>
        		</div>

			 		</div>
			 		<!-- end METADATA content -->

					<!-- begging RUNNING content -->
					<div class="tab-pane fade show " id="mSimulationOptionsEditorRunningDiv" 
			 			  	role="tabpanel" aria-labelledby="mSimulationOptionsEditorRunningTab">
			 			  	
						<div class="form-check mt-2 mx-3">
							<input class="form-check-input" type="checkbox" value="" checked 
								 name="mSimulationOptionsEditorMustPause" id="mSimulationOptionsEditorMustPause">
							<label class="sTranslatable form-check-label" for="mSimulationOptionsEditorMustPause">
								The simulation must pause if the page looses focus
							</label>
				    </div>			 			  	

						<hr>

						<div class="mt-2 input-group">
						  <span  id="mSimulationOptionsModelTabLabel" class="sTranslatable input-group-text">Simulation Tab</span>
  						<input id="mSimulationOptionsModelTab" type="text" class="form-control" placeholder="Enter tab number here" 
  										aria-label="ModelTab" aria-describedby="mSimulationOptionsModelTabLabel">
						</div>

						<div class="mt-2 input-group">
						  <span  id="mSimulationOptionsModelTabTitleLabel" class="sTranslatable input-group-text">Simulation Tab Title</span>
  						<input id="mSimulationOptionsModelTabTitle" type="text" class="form-control" placeholder="Enter tab title here" 
  										aria-label="ModelTabTitle" aria-describedby="mSimulationOptionsModelTabTitleLabel">
						</div>

						<div class="mt-2 input-group">
						  <span  id="mSimulationOptionsModelNameLabel" class="sTranslatable input-group-text">Simulation Name</span>
  						<input id="mSimulationOptionsModelName" type="text" class="form-control" placeholder="Enter simulation name here" 
  										aria-label="ModelName" aria-describedby="mSimulationOptionsModelNameLabel">
						</div>
												
						<div class="form-check mt-2 mx-3">
							<input class="form-check-input" type="checkbox" value="" checked 
								 name="mSimulationOptionsFixedNavigationBar" id="mSimulationOptionsFixedNavigationBar">
							<label class="sTranslatable form-check-label" for="mSimulationOptionsFixedNavigationBar">
								EJS Reader's navigation bar ignores double-clicks
							</label>
				    </div>			 			  	
						<hr>

						<div class="mt-2 input-group">
						  <span  id="mSimulationOptionsCSSLabel" class="sTranslatable input-group-text">CSS</span>
  						<input id="mSimulationOptionsCSS" type="text" class="form-control" readonly 
  										aria-label="Languages" aria-describedby="mSimulationOptionsCSSLabel">
						  <span id="mSimulationOptionsCSSEdit" 		class="input-group-text"
						  			data-bs-toggle="tooltip" data-bs-placement="bottom" title="Edit">
						  	<i class="bi bi-clipboard-data" style="color: black;"></i>
						  </span>
						  <span id="mSimulationOptionsCSSDelete" class="input-group-text"
						  			data-bs-toggle="tooltip" data-bs-placement="bottom" title="Delete">
						  	<i class="bi bi-clipboard-x" style="color: black;"></i>
						  </span>
						</div>

						<div class="mt-2 input-group">
						  <span class="sTranslatable input-group-text">User files</span>
					    <select id="mSimulationOptionsUserFiles" class="form-select"></select>
						  <span id="mSimulationOptionsUserFilesAdd" 		class="input-group-text"
        						data-bs-target="#mFileChooserModal" data-bs-toggle="modal" data-bs-dismiss="modal"
						  			data-bs-toggle="tooltip" data-bs-placement="bottom" title="Add">
						  	<i class="bi bi-clipboard-plus" style="color: black;"></i>
						  </span>
						  <span id="mSimulationOptionsUserFilesDelete" class="input-group-text"
						  			data-bs-toggle="tooltip" data-bs-placement="bottom" title="Delete">
						  	<i class="bi bi-clipboard-x" style="color: black;"></i>
						  </span>
						</div>
											 	
						<div class="mt-2 input-group">
						  <span class="sTranslatable input-group-text">Files required</span>
					    <select id="mSimulationOptionsDetectedFiles" class="form-select"></select>
						  <span id="mSimulationOptionsDetectedFilesRefresh" class="input-group-text"
						  			data-bs-toggle="tooltip" data-bs-placement="bottom" title="Refresh">
						  	<i class="bi bi-clipboard-data" style="color: black;"></i>
						  </span>
						</div>
						 
						<hr>

						<div class="mt-2 form-floating">
						  <textarea  id="mSimulationOptionsHtmlHead" class="form-control" placeholder="Enter html head here" style="height: 100px"></textarea>
						  <label class="sTranslatable" for="mSimulationOptionsHtmlHead">HTML head</label>
						</div>

			 		</div>
			 		<!-- end RUNNING content -->

					<!-- begin EXPORT content -->
					<div class="tab-pane fade show" id="mSimulationOptionsEditorExportDiv" role="tabpanel"
						aria-labelledby="mSimulationOptionsEditorExportTab">
					
						<div class="form-check mt-2 mx-3">
							<input class="form-check-input" type="checkbox" value="" checked 
								 name="mSimulationOptionsSaveAsXML" id="mSimulationOptionsSaveAsXML">
							<label class="sTranslatable form-check-label" for="mSimulationOptionsSaveAsXML">
								Save the source file in EJS 6 format rather than WebEJS format
							</label>
				    </div>			 			  	
					
						<div class="form-check mt-2 mx-3">
							<input class="form-check-input" type="checkbox" value="" checked 
								 name="mSimulationOptionsIncludeSource" id="mSimulationOptionsIncludeSource">
							<label class="sTranslatable form-check-label" for="mSimulationOptionsIncludeSource">
								Include the source file in the complete simulation ZIP
							</label>
				    </div>			 			  	

						<div class="form-check mt-2 mx-3">
							<input class="form-check-input" type="checkbox" value="" checked 
								 name="mSimulationOptionsIncludeLibrary" id="mSimulationOptionsIncludeLibrary">
							<label class="sTranslatable form-check-label" for="mSimulationOptionsIncludeLibrary">
								Include all EJS libraries when exporting the complete model's ZIP<br><br>
								<small>
									The model’s ZIP file will be smaller if the EJS libraries are excluded 
									because the EJS libraries will be downloaded from the Internet when the 
									model’s HTML page is run. This is fast and the files are cached in most 
									browsers. Include the EJS libraries if you intend to run the HTML page 
									without an internet connection.<br><br>
									Note that EJS 6 uses an XML file to describe the model whereas WebEJS uses a JSON file.
									New WebEJS options may not be available if the model is exported in EJS 6 format.

								</small>
							</label>
				    </div>			 			  	

						<!--div class="form-check mt-2 mx-3">
							<input class="form-check-input" type="checkbox" value="" name="mSimulationOptionsUglifyJS"
								id="mSimulationOptionsUglifyJS">
							<label class="sTranslatable form-check-label" for="mSimulationOptionsUglifyJS">
								Uglify the Javacript code in the generated model
							</label>
						</div-->
										
					</div>
					<!-- end EXPORT content -->
		 
				 	<!-- begin EDITION content -->
			 		<div class="tab-pane fade show" id="mSimulationOptionsEditorEditDiv" 
			 			   role="tabpanel" aria-labelledby="mSimulationOptionsEditorEditTab">

						<div class="form-check mt-2 mx-3">
							<input class="form-check-input" type="checkbox" value="" 
								 name="mSimulationOptionsEditorFullModel" id="mSimulationOptionsEditorFullModel">
							<label class="sTranslatable form-check-label" for="mSimulationOptionsEditorFullModel">
								Show full model in the preview area	on load						
							</label>							
				 		</div>	
				 		
						<div class="form-check mt-2 mx-3">
							<input class="form-check-input" type="checkbox" value="" 
								 name="mSimulationOptionsEditorParse" id="mSimulationOptionsEditorParse">
							<label class="sTranslatable form-check-label" for="mSimulationOptionsEditorParse">
								Parse custom method with an interpreter
							</label>							
				 		</div>	

						<div class="form-check mt-2 mx-3">
							<input class="form-check-input" type="checkbox" value="" 
								 name="mSimulationOptionsEditorUseDelta" id="mSimulationOptionsEditorUseDelta">
							<label class="sTranslatable form-check-label" for="mSimulationOptionsEditorUseDelta">
								Use &#916; for ODEs
							</label>							
				 		</div>			 	
				 		
			 		</div>			 	
				 	<!-- end EDITION content -->
	
				</div>
				<!-- end tab content -->
	
	</div>
  `;

  return self;
}/*
 * Copyright (C) 2021 Jesús Chacón, Francisco Esquembre and Félix J. Garcia 
 * This code is part of the Web EJS authoring and simulation tool
 */

/**
 * GUI tools
 * @module core
 */

var WebEJS_GUI = WebEJS_GUI || {};

/**
 * @class outputArea 
 * @constructor  
 */

WebEJS_GUI.outputArea = function() {
	var self = {};

	self.println = function(text){
		addLine('text-dark',text);
	}

  self.logLine = function(text){
    addLine('text-dark',text);
  }

  self.infoLine = function(text){
    addLine('text-primary',text);
  }

  self.warningLine = function(text){
    addLine('text-warning',text);
  }

  self.errorLine = function(text){
    addLine('text-danger',text);
  }

  function scroll(div) {	
	 div.scrollTop(div[0].scrollHeight - div[0].clientHeight);
	}


  function addLine(classStr, text) {
    const line = $('<p class="m-0 '+classStr+'"></p>');
    line.text(text);
    $('#sOutputTextarea').append(line);
    scroll($('#sOutputTextarea'));  
  }
  
	self.clear = function(){
		$('#sOutputTextarea').empty();
	}
	
/*
  self.println = function(text){
    $('#sOutputTextarea').text($('#sOutputTextarea').text()+text+"\n");
  }
  
  self.clear = function(){
    $('#sOutputTextarea').text('');
  }
  
*/	

	$('#sOutputClearButton').click(()=>{
		self.clear();
	}); 

	self.clearAndPrintln = function(text){
    self.clear();
    self.println(text);
	}

	//self.print ("1\n2\n3\n4\n5\n6\n7\n8\n9\n0\n1\n2\n3\n4\n5")
	return self;	
}

/*
 * Copyright (C) 2021 Jesús Chacón, Francisco Esquembre and Félix J. Garcia 
 * This code is part of the Web EJS authoring and simulation tool
 */

/**
 * GUI tools
 * @module core
 */

var WebEJS_GUI = WebEJS_GUI || {};

/**
 * @class previewArea 
 * @constructor  
 */

WebEJS_GUI.previewArea = function() {
	var self = {};

	const GENERATE_LOCALLY = true;

	function setSource(url) {
		$('#sPreviewFrame').attr('src', url);
		//$('#sPreviewFrame').attr('srcdoc', IFRAME_EXAMPLE);
	}

	function setHtmlCode(htmlCode) {
		$('#sPreviewFrame').attr('srcdoc', htmlCode);
	}

	function setTitle(title){
		const prefix = sMainSimulationOptions.previewFullModel() ? 'FULL MODEL' : 'PREVIEW'; 
		$('#sPreviewTitle').text(sLocaleFor(prefix)+": "+title);
	}
	
	self.clearPreview = function(title) {
		$('#sPreviewFrame').attr('src', sMainEjsAssetsFolder+'WebEJS/EmptyView/empty_view.html');
		$('#sPreviewTitle').text(title);
	}

	// -------------------------------------
	// Updating the preview from the server
	// -------------------------------------

	function onSuccessUpdate(result) {
		if (result=='OK') {
			sMainGUI.logLine(sLocaleFor("Preview updated OK"));
			setTitle(sMainGUI.getTitleForPreview());
		}
		else {
			sMainGUI.errorLine(sLocaleFor("Error updating preview"));
			sMainGUI.warningLine(sLocaleFor("This preview may not be correct"));
			setTitle(sLocaleFor("This preview may not be correct")); 						
		}
		setSource (sMainComm.getPreviewURL(sMainSimulationOptions.previewFullModel(),false));
	}

	function onErrorUpdate(result) {
		sMainGUI.errorLine(sLocaleFor("Error updating preview"));
		sMainGUI.warningLine(sLocaleFor("Comm error on update")+": "+result);
		setTitle(sLocaleFor("This preview may not be correct")); 						
		setSource (sMainComm.getPreviewURL(sMainSimulationOptions.previewFullModel(),false));
	}

	// ---------------------------------------
	// Updating and reporting to the preview
	// ---------------------------------------

	function mustCallServer() {
		if (GENERATE_LOCALLY) {
			const options = { 
				'useCDN' : true, 
				'separatePage' : false, 
				'fullModel' : sMainSimulationOptions.previewFullModel() 
			};
			setTitle(sMainGUI.getTitleForPreview());
			setHtmlCode(WebEJS_GEN.generate(options));
			return false;
		}		
		if (sMainGUI.isViewEmpty()) {
			//self.clearPreview(sLocaleFor("Your view is empty"));
			return true;
		}
		return true;
	}

	self.updatePreview = function() {
		if (mustCallServer()) sMainComm.updateSimulation(null,onSuccessUpdate, onErrorUpdate);
	}

	self.reportPreview = function(report) {
		if (mustCallServer()) sMainComm.sendActionReport(report, onSuccessUpdate, onErrorUpdate);
	}

	// ---------------------------------------
	// Running the simulation
	// ---------------------------------------

	self.runSimulation = function() {
		if (GENERATE_LOCALLY) {
      const options = { 
				'useCDN' : true, 
				'separatePage' : true, 
				'fullModel' : true 
			};
			window.open(URL.createObjectURL(new Blob([WebEJS_GEN.generate(options)], { type: "text/html" })))
		}
		else {	
			sMainComm.updateSimulation(null,
				result => {
					window.open(sMainComm.getPreviewURL(true,true),"_blank");
					sMainGUI.infoLine(sLocaleFor("Simulation should run in a separate tab")); 
					sMainGUI.infoLine(sLocaleFor("If not, please check if your browser blocks pop-up windows")); 
				},
				error => {
					sMainGUI.errorLine(sLocaleFor("Server error : "+error)); 
				});		
		}
	}

	// ----------------------------------
	// 
	// ----------------------------------

	return self;
	
}   

/*
 * Copyright (C) 2021 Jesús Chacón, Francisco Esquembre and Félix J. Garcia 
 * This code is part of the Web EJS authoring and simulation tool
 */

/**
 * WebEJS_GUI
 * @module core
 */

var WebEJS_GUI = WebEJS_GUI || {};

/**
 * WebEJS_GUI.tabbedPage
 * Base class (needs owewriting some methods) for a page for a WebEJS_GUI.tabbedPanel
 * @param title a String for the title of teh page in the tab
 */
WebEJS_GUI.tabbedPage = function(title) {
	var self = {};
	var mTitle = title;
	var mDiv = jQuery("<div/>", { style:"padding:0" });

	self.setTitle = function(new_title) { mTitle = new_title; }
	self.getTitle = function()          { return mTitle; }

	/**
	 * getDiv
	 * @returns the main div that host the elements with the actual information
	 */
	self.getDiv = function() { return mDiv; }	
	
	/**
	 * prepareToShow. Do anything requires before showing after hiding
	 */
	self.prepareToShow = function() {
	}

	/**
	 * saveObject
	 * @returns an object which allows saving the page information into a file 
	 */
	self.saveObject = function() {
		return { 'title' : title };
	}

	/**
	 * readObject
	 * @param saved an object which allows retrieving the page information 
	 * from a file, typically created previously with saveObject(). 
	 */
	self.readObject = function(saved) {
		mLabel = saved['title'];
	}

	return self;
}
	
/**
 * WebEJS_GUI.tabbedPanel
 * Base class (needs owewriting some methods) for a panel with tabs.
 * Each tab hosts a given pagem which is a 'subclass' of  WebEJS_GUI.tabbedPage
 */
/**
 * @class tabbedPannel 
 * @constructor  
 */
WebEJS_GUI.tabbedPanel = function(idString, classStr) {
	const mRes = WebEJS_RESOURCES.main();
	var self = {};
	
	const sTabTemplate = "<li class='sTabsLi'><a class='sTabsA' href='#{href}'>#{label}</a>"+
			"<span class='ui-icon ui-icon-close' role='presentation'>Remove Tab</span>"+
//			"<span class='ui-icon ui-icon-plus'  role='presentation'>Add Tab</span>"+
			"</li>";
	const sDeleteTemplate = "<p>"+
			"<span class='ui-icon ui-icon-alert' style='float:left; margin:12px 12px 20px 0;'></span>"+
			"#{message}</p>";

	const mId = idString+"-tabs";
	 
	var mCurrentTab = -1;
	var mTabCounter = 0;
	var mTabs;
	var mPages = {};
	
	var mMainPanel = jQuery("<div/>", { class: classStr+" sWorkPanel"});
	var mMainDiv   = jQuery("<div/>", { id:mId }).appendTo(mMainPanel);
	var mMainUL    = jQuery("<ul/>" , { class: " sTabList"}).appendTo(mMainDiv);
	var mAddDialogDiv    = jQuery("<div/>", { class : "sTabDialog", title:gettext("Create new page")});
	var mRemoveDialogDiv = jQuery("<div/>", { class : "sTabDialog", title:gettext("Delete page"),
		html: "<p><span class='ui-icon ui-icon-alert' style='float:left; margin:12px 12px 20px 0;'></span>"+
					gettext("This page will be permanently deleted")+". "+gettext("Are you sure?")+"</p>"});

	// --------------------------
	// Utilities
	// --------------------------
	
	function updateCurrentTab( event, ui ) {
		var active = mTabs.tabs( "option", "active" );
		if (typeof active === "number") mCurrentTab = active; 
		// console.log("Active is now "+mCurrentTab);
	}

	function removeTab(liItem) {
		var panelId = liItem.remove().attr( "aria-controls" );
		$( "#" + panelId ).remove();
		mPages["#" + panelId] = null;
		// console.log("Removed "+"#" + panelId+" : "+mPages["#" + panelId]);
		mTabs.tabs( "refresh" );
	}

	function addTabButtons() {
		// The adition button
		var addButton = jQuery("<button/>", { text:"+" , class: "sTabAdd"});
		mTabs.find( ".ui-tabs-nav" ).append(addButton);
		addButton.on( "click", function() {
			document.getElementById(mId+"-tab_title").value = (gettext("Page")+" "+(mTabCounter+1));
			mAddDialogDiv.dialog( "open" );
		});
/*
		var buttonLi2 = jQuery("<button/>", { text:"O" , class: "sTabAdd"});
		mTabs.find( ".ui-tabs-nav" ).append(buttonLi2);
		buttonLi2.on( "click", function() {
			savedObject = self.saveObject();
			console.log("Saved = "+savedObject);
			for (var i=0; i<savedObject.length; i++) {
				var entry = savedObject[i];
				console.log("Saved ["+i+"]= ");
				for (var key in entry)
					console.log (key+" : "+entry[key]);
			}

		});
			// The adition button
		var buttonLi3 = jQuery("<button/>", { text:"X" , class: "sTabAdd"});
		mTabs.find( ".ui-tabs-nav" ).append(buttonLi3);
		buttonLi3.on( "click", function() {
			self.readObject(savedObject);
		});
*/
	}
	
	function removeAllTabs() {
		mMainUL.empty();
		for (const key in mPages) {
			//console.log("Removing key : "+key);
			$( key ).remove();
		}
		mPages = {};
		addTabButtons();
		mCurrentTab = -1;
		mTabCounter = 0;
		mTabs.tabs( "refresh" );
	}
	
	function listTabs() {
	 $('> ul > li > a', "#"+mId).each(function () { 
			console.log("LI Child = "+$(this).text());
			console.log("LI Child id = "+$(this).attr("href"));
			var page = mPages[$(this).attr("href")];
			console.log (page.saveObject());
		});
	}
	
	function showRemoveDialog(pageLI, page) {
		mRemoveDialogDiv.attr ("title",page.getTitle());
		mRemoveDialogDiv.dialog({
			resizable: false, height: "auto", width: 400, modal: true,
			buttons: {
				"Delete" : function() {
					removeTab(pageLI);
					$( this ).dialog( "close" );
				},
				Cancel: function() {
					$( this ).dialog( "close" );
				}
			}
		});
	}

	function buildTabs() {
		mTabs = mMainDiv.tabs({ heightStyle: "fill", activate : updateCurrentTab });
		mTabs.find( ".ui-tabs-nav" ).sortable({ axis: "x", stop: function() {
				mTabs.tabs( "refresh" );
				updateCurrentTab();
			}
		});
		// Close icon: removing the tab on click
		mTabs.on( "click", "span.ui-icon-close", function() {
			var pageLI = $( this ).closest( "li" );
			showRemoveDialog(pageLI, mPages[pageLI.find("a").attr("href")])
		});
		
		mTabs.on( "keyup", function( event ) {
			if ( event.altKey && event.keyCode === $.ui.keyCode.BACKSPACE ) {
				var pageLI = $( this ).closest( "li" );
				showRemoveDialog(pageLI, mPages[pageLI.find("a").attr("href")])
			}
		});
	}
	

	// --------------------------
	// Dialog for creation of new tabs
	// --------------------------

	function fillDialog(dialogDiv) {
		var form = jQuery("<form/>").appendTo(dialogDiv);
		
		var fieldset = jQuery("<fieldset/>", { class:"ui-helper-reset"}).appendTo(form);
		
		jQuery("<label/>", { 
			for:mId+"-tab_title",
			text: gettext("Name")+" ",
			style: "margin-right: 10px"
			}).appendTo(fieldset);
			
		var nameField = jQuery("<input/>", { 
			type:"text",
			name:mId+"-tab_title",
			id:mId+"-tab_title",
			value:gettext("Page")+" "+mTabCounter,
			class:"ui-widget-content ui-corner-all"
			}).appendTo(fieldset);
	
		// Modal dialog init: custom buttons and a "close" callback resetting the form inside
		var dialog = dialogDiv.dialog({
			autoOpen: false,
			modal: true,
			buttons: {
				Add: function() {
					var title = nameField.val() || gettext("Page")+" "+(mTabCounter+1);
					self.createPage(title);
					$( this ).dialog( "close" );
				},
				Cancel: function() {
					$( this ).dialog( "close" );
				}
			},
			close: function() {
				form[ 0 ].reset();
			}
		});
		
		// AddTab form: calls addTab function on submit and closes the dialog
		var form = dialog.find( "form" ).on( "submit", function( event ) {
			var label = nameField.val() || gettext("Page")+" "+(mTabCounter+1);
			self.createPage(label);
			dialog.dialog( "close" );
			event.preventDefault();
		});
	}; // --- End of the dialog for creation of new tabs

	// --------------------------
	// Workpanel common API
	// --------------------------

	self.getMainPanel = function() {
		return mMainPanel;
	}
	
	self.prepareToShow = function() {
		//console.log("Active when showing  is "+mCurrentTab);
/*		buildTabs();
		$('> ul > li > a', "#"+mId).each(function () { 
			mPages[$(this).attr("href")].prepareToShow();
		});
		self.setActive(mCurrentTab);
		mTabs.tabs( "refresh" );
*/	}

	self.saveObject = function() {
		var objectArray = [];
		 $('> ul > li > a', "#"+mId).each(function () { 
				var page = mPages[$(this).attr("href")];
				objectArray.push(page.saveObject());
			});
		return objectArray;
	}

	self.readObject = function(saved) {
		removeAllTabs();
		for (var i=0; i<saved.length; i++) {
			var entry = saved[i];
			var page = self.createPage(entry['title']);
			page.readObject(entry);
		}
		self.setActive(0);
	}

	// --------------------------
	// Tabs API
	// --------------------------

	self.createPage = function(label) {
		alert("Subclasses of Tabs should overwrite the createPage() function!!!");
	}
	
	self.addTab = function (page) {
		var id = mId+"-" + (mTabCounter+1);
		var href = "#" + id;
		var li = $( sTabTemplate.replace( /#\{href\}/g, href )
														.replace( /#\{label\}/g, page.getTitle() ) );
	
		var contentDiv =  page.getDiv();
		mTabs.find( ".ui-tabs-nav" ).append( li );
		contentDiv.attr("id",id);
		contentDiv.addClass("sTabContent");
		mMainDiv.append(contentDiv)
		mTabs.tabs( "refresh" );
		mTabCounter++;
		mPages[href] = page;
		return id;
	}

	self.setActive = function (tabIndex) {
		mTabs.tabs("option", "active", tabIndex );
	}

	self.getActive = function () {
		return mTabs.tabs( "option", "active" );
	}
	
	//buildTabs();
	//addTabButtons();
	//fillDialog(mAddDialogDiv);
	
	return self;
}


/*
 * Copyright (C) 2021 Jesús Chacón, Francisco Esquembre and Félix J. Garcia 
 * This code is part of the Web EJS authoring and simulation tool
 */

/**
 * WebEJS_GUI
 * @module core
 */

var WebEJS_GUI = WebEJS_GUI || {};

/**
	mElementInfo : {'hash', 'name', 'type', 'properties' }
 */
WebEJS_GUI.viewPropertyEditor = function(mViewPanel, mViewTree, mElementInfo) {

  var self = {};
	const mId = "mViewPropertyEditor_"+ mElementInfo.hash>=0 ? mElementInfo.hash : "root_properties";

	var mPanel=null;
	var mSoftClosing = true;
	var mPropertyHash = 0;
	var mValuesToSet = [];

  // --------------------
  // Basic API
  // --------------------

	const mPreferredSize = {
		width: Math.min(window.innerWidth*0.9,1200),
		height: Math.min(window.innerHeight*0.9,1200)
	}; 

	self.show = function() {
		if (!mPanel) return;
		mPanel.resize(mPreferredSize); 
		mPanel.reposition();
		mPanel.front();
	}

	self.hide = function() {
		mSoftClosing = false;
		if (mPanel) mPanel.close(); 
	}
	
	{		
		const options = {
			content: getContentHtml(),
			onbeforeclose: function(panel) {
				if (mSoftClosing) mViewTree.clearPropertyEditor(mElementInfo.hash);
				return true;
	    },
			footerToolbar: 
				'<button type="button" id="'+mId+'Button" class="sTranslatable btn btn-primary float-left">Done</button>',
			callback : function(panel) {
				$('#'+mId+'Button').click(function() { mPanel.close(); });
				setAllValues();
				setInteraction();
				sMainRefreshTooltips();
				adjustLabelSizes();
				
			}
		};
		var title = sMainResources.getString("Properties for")+" "+mElementInfo.name;
		if (mElementInfo.type) title += " ("+mElementInfo.type+")";
		mPanel = WebEJS_TOOLS.createJSPanel(title, options, {  minimize: 'remove' }, mPreferredSize);
	}

	function setAllValues() {
		for (var i=0; i<mValuesToSet.length; i++) {
			var duple = mValuesToSet[i];
			$('#'+duple[0]).val(duple[1]);
		}
		mValuesToSet = [];
	}

  // --------------------
  // Creating HTML
  // --------------------

	function getDedicatedEditor(propertyTypesString, propertyModifiersString) {
		const typesList = mViewPanel.getPropertyTypesList(propertyTypesString);
		const modifiersList = mViewPanel.getPropertyModifiersList(propertyModifiersString);
		return WebEJS_GUI.viewPropertyTypeEditor(typesList, modifiersList);
	}
	
	function getOnePropertyLine(inputId, name, propertyDescription) {
		var colorTag = "";
		var editIcon = "bi-keyboard";
		var canBeLinked = true; 
		var linkIcon = "bi-link";
		var inputHtml = '';
		var dataTags = '';

		if (propertyDescription==null) {
			sMainGUI.println(sMainResources.getString("WARNING: property not recognized for elements of this type!")+
											 ": <"+name+"> ("+mElementInfo.type+")");
			colorTag = "text-secondary";
		}
		else {
			const propertyTypesString = mViewPanel.getPropertyTypesString(propertyDescription);
			const propertyModifiersString = mViewPanel.getPropertyModifiersString(propertyDescription);
			editIcon = getDedicatedEditor(propertyTypesString,propertyModifiersString) ? "bi-clipboard-data" : "bi-keyboard";
			canBeLinked = ! mViewPanel.hasPropertyModifier(propertyDescription,'CONSTANT');
			const isAction = mViewPanel.isPropertyOfType(propertyDescription,'Action');
			if ( isAction || mViewPanel.hasPropertyModifier(propertyDescription,'MULTILINE')) {
				linkIcon = "bi-gear";
				if (isAction) colorTag = "text-danger";
				inputHtml = '<textarea id="'+inputId+'"  class="cViewPropertyEditorInput form-control form-control-sm" rows="1" '+
						' aria-label="'+name+'" aria-describedby="'+mId+'Property_'+mPropertyHash+'"></textarea>';
			}
			else {
				inputHtml = '<input id="'+inputId+'" type="text" class="cViewPropertyEditorInput form-control form-control-sm" '+
				sMainNoAutocorrect+
				' aria-label="'+name+'" aria-describedby="'+mId+'Property_'+mPropertyHash+'">';
			}
			dataTags = 	' data-types="'+propertyTypesString +'" data-modifiers="'+propertyModifiersString+'" ';

		}
		return ''+
			'<div class="mb-0 input-group input-group-sm" data-name="'+name+'" '+dataTags+'>'+
				'<span id="'+mId+'Property_'+mPropertyHash+'" '+
				  'class="cViewPropertyEditorLabel sTranslatable input-group-text input-group-text-sm '+colorTag+'">'+
					sMainResources.getString(name)+
				'</span>'+
				inputHtml +
			  '<span class="cViewPropertyEditorEditIcon input-group-text input-group-text-sm">'+
			  	'<i class="bi '+editIcon+'" style="color: black;"></i>'+
			  '</span>'+
			  '<span class="cViewPropertyEditorLinkIcon input-group-text input-group-text-sm">'+
			  	'<i class="bi '+linkIcon+'" style="color: black;"'+ (canBeLinked ? '' : ' disabled ') +'></i>'+
			  '</span>'+
			'</div>';
	}

	function getColumnHtml(column,classProperties) {
		var html = '';
		for (var i=0; i<column.length; i++) {
			var line = column[i];
			if (line.startsWith("<LABEL")) {
				const label = line.substring(6,line.length-1);
				html += 
					'<div class="my-0 text-center">'+
						'<label class="my-0 form-label text-center fw-bold text-primary">'+
							sMainResources.getString(label)+
						'</label>'+
					'</div>';
			}
			else if (line=="<SEP>") {
				html += '<hr class="my-0">';
			}
			else { 
				mPropertyHash++;
				const value = mViewTree.getPropertyByName(line,mElementInfo.properties);
				const inputId = mId+'PropertyInput_'+mPropertyHash;
				if (value!=null) mValuesToSet.push([inputId, value]);
				html += getOnePropertyLine(inputId,line,mViewPanel.getPropertyDescription(line,classProperties));
			}
		}	
		return html;
	}

	function adjustLabelSizes() {
		$('#'+mId+'Contents .cViewPropertyEditorColumn').each(function(col, colDiv) {
			var maxWidth = 0; 
			$(colDiv).find('.cViewPropertyEditorLabel').each(function(index, label) {
				//console.log ("Width of label "+$(label).text() +' = '+$(label).width());
				maxWidth = Math.max(maxWidth,$(label).width());
			});
			//console.log("Max width = "+maxWidth);
			$(colDiv).find('.cViewPropertyEditorLabel').each(function(index, label) {
				$(label).width(maxWidth);
			});
		});
	}
	
	function getTabHtml(tab,classProperties) {
		var columnsHtml = '';
		for (var i=0; i<tab.columns.length; i++) {
			const column = tab.columns[i];
			columnsHtml += 
		    	'<div class="col cViewPropertyEditorColumn">'+
					getColumnHtml(column,classProperties)+ 
			    '</div>';
		}
		return ''+
			'<div class="container">'+
				'<div class="row">'+
				columnsHtml+
				'</div>'+
			'</div>';
	}
	
	function getContentHtml() {
		mPropertyHash = 0;
		mValuesToSet = [];
		const editionTabs  = mViewPanel.getElementClassEditionInfo(mElementInfo.type);
		const classProperties = mViewPanel.getElementClassProperties(mElementInfo.type,null); // All of them
		var headerHtml = '';
		var divsHtml = '';
		for (var tabIndex in editionTabs) {
			const tab = editionTabs[tabIndex];
			const activeTabTag = (tabIndex==0) ? " active" : "";
			const activeDivTag = (tabIndex==0) ? " show active" : "";
			headerHtml += 
				'<li class="nav-item" role="presentation">'+
					'<button class="sTranslatable nav-link'+activeTabTag+'" id="'+mId+'TabHeader_'+tabIndex+'"'+ 
			 			' data-bs-toggle="tab" data-bs-target="#'+mId+'TabDiv_'+tabIndex+'"'+
						' type="button" role="tab" aria-controls="'+mId+'TabDiv_'+tabIndex+'" aria-selected="true">'+
	     			  	sMainResources.getString(tab.label)+
	     			' </button>'+
				'</li>';
			divsHtml += 
				'<div class="tab-pane fade'+activeDivTag+'" id="'+mId+'TabDiv_'+tabIndex+'"'+ 
			 		' role="tabpanel" aria-labelledby="'+mId+'TabHeader_'+tabIndex+'">'+
					getTabHtml(tab,classProperties)+
				'</div>';
		}
		html =
			'<div>'+
				'<ul class="nav nav-tabs" role="tablist">'+
					headerHtml+
				'</ul>'+
				'<div class="tab-content" id="'+mId+'Contents">'+
					divsHtml+
				'</div>'+
			'</div>';
		return html;
	}	
	
  // -------------------------
  // Clicking on the buttons
  // -------------------------
  
  function showTypesAndDefault(propertyName) {
    const classProperties = mViewPanel.getElementClassProperties(mElementInfo.type,null); // All of them
    const propertyDescription = mViewPanel.getPropertyDescription(propertyName,classProperties);
    const propertyDefaultValue = mViewPanel.getPropertyDefaultValue(propertyDescription);
    const propertyTypesString = mViewPanel.getPropertyTypesString(propertyDescription).replaceAll('|',', ');
    const defaultHTML = propertyDefaultValue=='<none>' ? 
      '<span class="fw-bold text-primary">'+sLocaleFor("No particular default value")+'</span>' 
      :
      '<span class="fw-bold text-primary">'+sLocaleFor("Default value")+' = </span>'+
      '<span class="text-danger font-monospace">'+propertyDefaultValue+'</span>';
    const title =  sLocaleFor("Property")+ " "+propertyName+ ' ('+mElementInfo.type+')';
    const html =  '<hr>'+
                  '<p>'+
                    '<span class="fw-bold text-primary">'+sLocaleFor("Types accepted")+' : </span>'+
                    '<span class="text-danger font-monospace">'+propertyTypesString+'</span>'+
                  '</p>'+
                  '<p>'+defaultHTML+'</p>'+
                  '<hr>'+
                  '<a class="fw-bold text-success" href="'+mViewPanel.getWikiHelpPage(mElementInfo.type)+'" target="_blank">'+
                    sLocaleFor("Click for help on")+' '+mElementInfo.type +
                  '</a>';
    sMessageForm.showAllRaw(title,html);
  }
  	
	function getVariables(propertyTypesStr) {
		const desiredTypes = mViewPanel.getPropertyTypesList(propertyTypesStr);
		var varList = sMainGUI.getModel().getVariables().getVariablesOfType (desiredTypes);
		var options = [];
		if (desiredTypes.includes('boolean')) {
			options.push({ name : "_isPlaying", description : "Whether the simulation is playing" });
			options.push({ name : "_isPaused", description : "Whether the simulation is paused" });
			options.push({ name : "_isMobile", description : "Whether the simulation is running on a mobile device" });
		}
		for (var i=0; i<varList.length; i++) {
			const variable =varList[i];
			const description = '('+variable.type+variable.dimension+') : '+variable.comment;
			options.push({ name : variable.name, value : variable.name, description :  description, style : 'sModelBtn' });
  	 }
		var customMethods = sMainGUI.getModel().getCustomCode().getCustomMethods();
		for (var i=0; i<customMethods.length; i++) {
			const custom = customMethods[i];
			custom['style'] = "text-secondary";
			options.push(custom);
  	 }
		if (desiredTypes.includes('String')) {
			for (var i=0; i<options.length; i++) {
				var name = options[i].name;
				const index = name.indexOf('(');
	      if (index>=0) options[i]['value'] = "%"+name.substring(0, index)+"%";
	  	 }
		}
		return options;
	}
	
	function getActions() {
		var options = sMainGUI.getModel().getCustomCode().getCustomMethods();
		for (var i=0; i<options.length; i++) {
			const userAction =options[i];
			userAction['style'] = "sModelBtn";
  	 }
		options.push(...sMainGUI.getSystemInformation('model_methods'));
		options.push(...sMainGUI.getSystemInformation('view_methods'));
		options.push(...sMainGUI.getSystemInformation('tools_methods'));
		for (var i=0; i<options.length; i++) {
			var name = options[i].name;
			const index = name.indexOf('(');
	    if (index>=0) options[i]['value'] = "%"+name.substring(0, index)+"%";
  	}
		return options;
	}

	function setInteraction() {
		$('#'+mId+'Contents .cViewPropertyEditorInput').change((event)=>{
			const propertyName = $( event.target ).closest( ".input-group" ).data('name');
			const value = $( event.target ).val().trim();
			//console.log("Want to set the value of property:"+propertyName+ ': to value='+value);
			mViewTree.setPropertyByName(propertyName, value, mElementInfo.hash);
		});
		
		$('#'+mId+'Contents .cViewPropertyEditorEditIcon').click((event)=>{
			const inputGroup = $( event.target ).closest( ".input-group" );
			const propertyName = inputGroup.data('name');
			const propertyTypes = inputGroup.data('types');
			const propertyModifiers = inputGroup.data('modifiers');
			const inputElement = inputGroup.find(".cViewPropertyEditorInput").first();
			const value = inputElement ? inputElement.val().trim() : "";
			//console.log("Clicked on edit icon of property:"+propertyName+ " : types="+propertyTypes+ " : value="+value);
			const onSuccess = function(newValue) {
				if (newValue==value) return;
				mViewTree.setPropertyByName(propertyName, newValue, mElementInfo.hash);
				inputElement.val(newValue);
			};
			const dedicatedEditor = getDedicatedEditor(propertyTypes,propertyModifiers);
			if (dedicatedEditor) return dedicatedEditor("Edit property",propertyName,value,onSuccess);
			if (mViewPanel.isOfType(propertyTypes,'Action') ||  mViewPanel.hasModifier(propertyModifiers,'MULTILINE')) 
				return sInputForm.showArea("Edit property",propertyName,value,onSuccess,true);
			return sInputForm.show("Edit property",propertyName,value,onSuccess,true);
		});
		
		$('#'+mId+'Contents .cViewPropertyEditorLinkIcon').click((event)=>{
			const inputGroup = $( event.target ).closest( ".input-group" );
			const propertyName = inputGroup.data('name');
			const propertyTypes = inputGroup.data('types');
			const inputElement = inputGroup.find(".cViewPropertyEditorInput").first();
			const value = inputElement ? inputElement.val().trim() : "";
			//console.log("Clicked on edit icon of property:"+propertyName+ " : TYPES="+propertyTypes+ " : value="+value);
			const onSuccess = function(newValue) {
				if (newValue==value) return;
				mViewTree.setPropertyByName(propertyName, newValue, mElementInfo.hash);
				inputElement.val(newValue);
			};
			if (mViewPanel.isOfType(propertyTypes,'Action')) 
				sMainSelectChoiceForm.show("List of actions",getActions(),value,onSuccess, 'modal-lg');
			else 
				sMainSelectChoiceForm.show("List of suitable variables",getVariables(propertyTypes),value,onSuccess);
		});
		
    $('#'+mId+'Contents .cViewPropertyEditorLabel').click((event)=>{
      const inputGroup = $( event.target ).closest( ".input-group" );
      const propertyName = inputGroup.data('name');
      showTypesAndDefault(propertyName);
		});
	}


  return self;
}
/*
 * Copyright (C) 2021 Jesús Chacón, Francisco Esquembre and Félix J. Garcia 
 * This code is part of the Web EJS authoring and simulation tool
 */

/**
 * WebEJS_GUI
 * @module core
 */

var WebEJS_GUI = WebEJS_GUI || {};


/**
	mElementInfo : {'hash', 'name', 'type', 'properties' }
 */
WebEJS_GUI.viewPropertyTypeEditor = function(propertyTypeList, propertyModifiersList) {

	if (propertyTypeList.includes("Color") || propertyTypeList.includes("Color3D")) return function (title,propertyName,value,onSuccess) { 
		sMainEditorForColor.show(title,value,onSuccess);
	};

  if (propertyTypeList.includes("Font")) return function (title,propertyName,value,onSuccess) { 
    sMainEditorForFont.show(title,value,onSuccess);
  };

	if (propertyTypeList.includes("File")) return function (title,propertyName,value,onSuccess) {
		var helperHTML = null;
		if (propertyModifiersList.includes('BASE64_IMAGE')) {
			helperHTML = WebEJS_GUI.viewPropertyFileHelperHtml();
		}
		WebEJS_TOOLS.selectFile(['png','gif', 'jpg', 'jpeg'], 
			function(path,urlPath) { 
				const newValue = path.startsWith('"') ? path : '"'+path+'"';
				if (newValue!=value) { 
					onSuccess(newValue); 
					sMainSimulationOptions.updateDetectedFiles(); 
				}
			}, 
			true, // Check existence
			helperHTML); 
	}


	// ----------------------------------------------------
	// Let's find suitable options for the given types
	// ----------------------------------------------------
	var options = [];


	if (propertyTypeList.includes("boolean")) options.push(...[ 
		{ name : "true" , icon : '<i class="bi bi-check-circle"></i>' },
		{ name : "false", icon : '<i class="bi bi-x-circle"></i>' }
	]);

	// ----------------------------------------------------
	// Multiuse editors
	// ----------------------------------------------------

	function addOptions(prefix, itemArray) {
		for (var i=0; i<itemArray.length; i++) {
			const item = itemArray[i];
			var name = item, old_names=null;
			if (Array.isArray(item)) { name = item[0]; old_names = item[1]; }
			var option = { 
				name : '"'+name+'"', 
				icon : '<img class="d-inline-block align-bottom;" style="padding: 0 2px 0 2px;" '+
									'src="'+sMainGUI.getSystemIconURL('Editors/'+(prefix+"_"+name.toUpperCase()+".gif"))+'">'
			}
			if (old_names) option['old_names'] = '"'+old_names+'"';
			options.push(option);
		}
	}
	
	// Found in Elements_info or in HtmlViewResources.java
  if (propertyTypeList.includes("3DDecorationType")) addOptions("Decoration", [ "NONE", "AXES", "CUBE", "CENTERED_AXES"]); 
  if (propertyTypeList.includes("3DDraggable")) addOptions("3DDraggable", [ "NONE", "ANY", "AZIMUTH", "ALTITUDE"]); 
  if (propertyTypeList.includes("3DProjectionType")) addOptions("DisplayMode", [ "PLANAR_XY", "PLANAR_XZ", "PLANAR_YZ", "PERSPECTIVE_OFF", "PERSPECTIVE_ON"]); 
  if (propertyTypeList.includes("ArrowMark")) addOptions("ArrowStyle", ["NONE", "ANGLE", "CIRCLE", "RECTANGLE", "LINE", "CURVE", 
                                                                        "TRIANGLE", "DIAMOND", "WEDGE", "POINTED", "INVANGLE", "INVTRIANGLE"]); 
  if (propertyTypeList.includes("CursorShape")) addOptions("CursorShape", ["HORIZONTAL", "VERTICAL", "CROSSHAIR"]); 
  if (propertyTypeList.includes("GraphicsMode")) addOptions("GraphicsMode", ["SVG", "CANVAS"]); 
  if (propertyTypeList.includes("Interaction2D")) addOptions("Interaction2D", ["ENABLED_NONE", "ENABLED_ANY", "ENABLED_X", "ENABLED_Y", "ENABLED_NO_MOVE"]); 
  if (propertyTypeList.includes("MarkType")) addOptions("MarkerShape", ["ELLIPSE", "RECTANGLE", "AREA", "BAR"]); 
  if (propertyTypeList.includes("MeshDataType")) addOptions("MeshDataType", ["MESH_2D", "MESH_3D", "SCALAR_2D_FIELD", "SCALAR_3D_FIELD", "VECTOR_2D_FIELD", "VECTOR_3D_FIELD"]); 
  if (propertyTypeList.includes("Offset")) addOptions("JSArrowPosition", ["SOUTH_WEST", "CENTERED", "NORTH_EAST"]); 
  if (propertyTypeList.includes("Orientation")) addOptions("Orientation", ["HORIZONTAL", "VERTICAL"]); 
  if (propertyTypeList.includes("Position")) addOptions("ElementPosition", ["CENTERED", ["NORTH", "hor_centered|hor_centered_down"], ["SOUTH","hor_centered_up"], 
                                                                            ["EAST","ver_centered_left"], ["WEST","ver_centered|ver_centered_right"], 
                                                                            "NORTH_EAST", ["NORTH_WEST","upper_left"], "SOUTH_EAST", ["SOUTH_WEST","lower_left"] ]); 
	if (propertyTypeList.includes("ShapeType")) addOptions("MarkerShape", [ ["NONE","no_marker"], ["ELLIPSE","circle|filled_circle"], ["RECTANGLE","square|filled_square"], "ROUND_RECTANGLE", "WHEEL"]); 
  if (propertyTypeList.includes("TextAlign")) addOptions("Alignment", ["left", "center", "right", "justify"]); 
  if (propertyTypeList.includes("ScaleType")) addOptions("ScaleType", ["SCALE_NUM", "SCALE_LOG"]); 

  // Found in HtmlViewResources.java
  

	// ----------------------------------------------------
	// If there are options, then let the user choose one	
	// ----------------------------------------------------

	if (options.length>0) return function (title,propertyName,value,onSuccess) {
		sMainSelectChoiceForm.show(propertyName,options,value,onSuccess, null);
	}

	return null;
}

/*

dedicatedEditor("Edit property",propertyName,value,onSuccess);
onSuccess = function(newValue)

*/
WebEJS_GUI.viewPropertyFileHelperHtml = function() {

	function iconLine(icon) {
		if (icon.indexOf('.')<0) icon +='.gif';
		const value = '/org/opensourcephysics/resources/controls/images/'+icon;
    return '<img class="cFileChooserHelperImage p-0 d-inline-block align-bottom;" width="16" height="16"'+
						' src="'+sMainGUI.getSystemIconURL(value)+'"'+ 
							' data-value="'+value+'">';
	}
	
	const ICONS = [ 
		'play', 				'pause', 				'stop' , 
		'stepforward', 	'stepback', 		'continue',
		'reset', 				'initial', 			'reset1',
		'reset2',				'cycle', 				'clear',
		'forward',			'time', 				'notime',
		'close', 				'folder', 			'inspectfolder',
		'window', 			'inspect', 			'value',
		'hilite', 			'erase', 				'i_erase',
		'caution', 			'wrench', 			'wrench_monkey',
		'pdf', 					'power_on.png', 'power_off.png',
		'expand.png', 	'download.png', 'center',		
		'apple.png', 		'android.png'
		];
	const COLUMNS = 3;
	var col = 1;
	var html = '<div class="container m-0 p-0">'+
  							'<div class="row m-0 p-0">';
	for (var i=0; i<ICONS.length; i++) {
		html += 			'<div class="col m-0 p-0">'+iconLine(ICONS[i])+'</div>';
		if (col>=COLUMNS) {
			col = 1;
			html += 	'</div>';
			if ((i+1)<ICONS.length) 
				html += '<div class="row m-0 p-0">';
		} 
		else col++;
	}
	if (col>1) {
		for (; col<=COLUMNS; col++) 
			html += 		'<div class="col m-0 p-0"></div>';
		html += 		'</div>';
	}
	html +=			'</div>';
	return html;
}
/* 
 * Derivative work from bstreeview.js
 * Version: 1.2.1
 * Authors: Sami CHNITER <sami.chniter@gmail.com>
 * Copyright 2020
 * License: Apache License 2.0
 * Project: https://github.com/chniter/bstreeview
 * Project: https://github.com/nhmvienna/bs5treeview (bootstrap 5)
 * 
 * Derived by Francisco Esquembre for the sole use within WebEJS
 */

var WebEJS_GUI = WebEJS_GUI || {};

WebEJS_GUI.viewTree = function(mTreeViewHTMLElement, mViewPanel) {
  const ITEM_LIST_PREFIX = "sViewTree-item-";
  const ITEM_GROUP_PREFIX = "sViewTree-group-";
  const EXPAND_ICON_CLASS = 'bi bi-chevron-down';
  const COLLAPSE_ICON_CLASS = 'bi bi-chevron-right';
  const ITEM_ICON_CLASS = "bi bi-dash";
  const INDENT =  0.5;
  const PARENTS_MARGIN_LEFT = '0.25rem';
  const ROOT_TYPE = 'Root';

  function getLeftPadding(depth) {
    return depth>0 ? (INDENT + depth * INDENT).toString() + "rem" : PARENTS_MARGIN_LEFT;
  }
  
  var self = {};

  var mRootItem;
  var mRootProperties = {};
  var mHash = 0; // A unique identified for each node ever added to the tree 
  var mPropertiesByHash = {}; // keeps a dict of entries 'hash' : element 
	var mPropertyEditorsByHash = {}; // keeps a dict of entries 'hash' : see viewPropertyEditor
	var mCopiedList = []; // For Cut/Copy and Paste

  // --------------------
  // Reporting changes
  // --------------------
  
 	self.reportableTreeChange = function(message) {
		sMainGUI.setChanged();
		//console.log("Sending complete view to server: "+message);
		var view = mViewPanel.saveObject();
		var report = { 
				'panel' : 'view', 
				'action' : 'setView', 
				'pages' :  view.pages
			};
		sMainGUI.reportPreview(report); 
	}

 	self.reportablePropertyChange = function(hash, name, value) {
		self.reportableTreeChange("On behalf of element :"+name);
		/*
		sMainGUI.setChanged();
		const treeItem = findItemByHash(hash);
		console.log("Sending properties of element: "+getItemName(treeItem));
		console.log(mPropertiesByHash[hash]);
		var report = { 
				'panel' : 'view', 
				'action' : 'setProperty', 
				'element_name' :  getItemName(treeItem),
				'property_name'	: name,
				'property_value': value
			};
		sMainGUI.reportPreview(report); 
		*/
	}
	
  // --------------------
  // Basic API
  // --------------------
  	
  self.getRootProperties = function() { return mRootProperties; }

	self.isEmpty = function() {
    const children = $(mTreeViewHTMLElement).children('.list-group-item');
		return children.length<=1; // The one is the RootItem
	}
	
  self.getTree = function() {
    var itemList = [];
    $(mTreeViewHTMLElement).children('.list-group-item').each(function(index,treeItemStr) {
      const treeItem = $(treeItemStr);
      if (getItemHash(treeItem)<0) return true;
      recursivelyGetTree(itemList, treeItem);
    });
    return itemList;
  }
  
  /**
   * Adds to the itemList the given item and its children... in a recursive way
   */
    function recursivelyGetTree(itemList, treeItem) {
      const hash = getItemHash(treeItem);
      const name = getItemName(treeItem);
      const group = getItemGroup(treeItem);
      const properties = mPropertiesByHash[hash];
      var object = { 'Name' : name, 'Type' : getItemType(treeItem) };
      if (group)      object['Expanded']   = ""+group.hasClass("show");
      if (properties) object['Properties'] = properties;
      itemList.push(object); 
      if (group) {
        var children_list = []
        group.children('.list-group-item').each(function(index,treeItemStr) {
          recursivelyGetTree(children_list, $(treeItemStr));
        });
        object['Children'] = children_list;
      }
    }

  /**
   * Adds to the itemList the given item and its children... in a recursive way
   */
  function recursivelyGetItem(itemList, treeItem, parentStr) {
    const hash = getItemHash(treeItem);
    const name = getItemName(treeItem);
    const group = getItemGroup(treeItem);
    const properties = mPropertiesByHash[hash];
    var object = { 'Name' : name, 'Type' : getItemType(treeItem) };
    if (parentStr)  object['Parent']     = parentStr;
    if (group)      object['Expanded']   = ""+group.hasClass("show");
    if (properties) object['Properties'] = properties;
    itemList.push(object); 
    if (group) {        
      group.children('.list-group-item').each(function(index,treeItemStr) {
        recursivelyGetItem(itemList, $(treeItemStr), name);
      });
    }
  }

  // --------------------
  // Properties of elements
	// An element instance may set properties of the form
	// { name : "One of the supported property names of the element class", value : "A value" }
  // --------------------
 
	/**
	 * Returns the value of a property, if set, null otherwise
	 */
	self.getPropertyByName = function(name, properties) {
		if (!properties) return null;
		for (var i=0; i<properties.length; i++) {
			const prop =  properties[i];
			if (prop.name==name) return prop.value;
		}
		return null;
	}

	self.setPropertyByName = function(name, value, hash) {
		const isEmpty = value.length<=0;
		const properties = mPropertiesByHash[hash];
		if (!properties) {
			if (isEmpty) return properties;
			mPropertiesByHash[hash] = [{ name : name, value : value }];
			self.reportablePropertyChange(hash, name, value);
			return mPropertiesByHash[hash];
		};
		for (var i=0; i<properties.length; i++) {
			const prop =  properties[i];
			if (prop.name==name) { 
				if (isEmpty) properties.splice(i, 1);
				else prop.value=value;
				self.reportablePropertyChange(hash, name, value);
				return properties;
			}
		}
		if (isEmpty) return properties;
		properties.push({ name : name, value : value })
		self.reportablePropertyChange(hash, name, value);
		return properties;
	}

	/**
	 * Used to find all the uses of a given property in the tree
	 */
	self.getDetectedPropertiesOfType = function(desiredType) {
    var valuesList = [];
    $(mTreeViewHTMLElement).children('.list-group-item').each(function(index,treeItemStr) {
      const treeItem = $(treeItemStr);
      if (getItemHash(treeItem)<0) return true;
      recursivelyGetDetectedPropertiesOfType(valuesList, treeItem, desiredType);
    });
    return valuesList;
  }
	
  /**
   * Adds to the itemList the given item and its children... in a recursive way
   */
  function recursivelyGetDetectedPropertiesOfType(valuesList, treeItem, desiredType) {
    const hash = getItemHash(treeItem);
    const group = getItemGroup(treeItem);
    const properties = mPropertiesByHash[hash];
		if (properties && properties.length>0) {
			const classProps = mViewPanel.getElementClassProperties(getItemType(treeItem), desiredType);
			for (var i=0; i<classProps.length; i++) {
				const propertyDescription = classProps[i];
				var value = self.getPropertyByName(propertyDescription['name'],properties)
				if (value && value.trim().length>0) {
					value = value.trim();
					if (value.startsWith('"')) value = value.substring(1);
					if (value.endsWith('"')) value = value.substring(0,value.length-1);
					valuesList.push(value);
					
				}
			} 
		}
    if (group) {        
      group.children('.list-group-item').each(function(index,treeItemStr) {
        recursivelyGetDetectedPropertiesOfType(valuesList, $(treeItemStr), desiredType);
      });
    }
  }
 
  // --------------------
  // Creating the tree of elements
  // --------------------
 
  /**
   * @param elementTree: a tree of elements given as an array of elements 
   *  of the form { 'key' : value, ... }, where 'key'
   *  - 'Name' (String):  a unique name for the element
   *  - 'Type' (String):  a unique type, such as 'Button' 
   *  - 'Parent' (String): optional - if the element is child of another one: the name of the parent
   *  - 'Expanded' (Boolean): optional - only if the element is parent of others  
   */
  self.setTree = function(rootProperties, elementTree) {
    mHash = 0;
    mPropertiesByHash = {};
		for (var hash in mPropertyEditorsByHash) {
	    if (mPropertyEditorsByHash.hasOwnProperty(hash))           
        if (mPropertyEditorsByHash[hash]) mPropertyEditorsByHash[hash].hide();
    }
		mPropertyEditorsByHash = {};
    if (mRootItem==null) mRootItem = buildRootTreeItem();
    if (rootProperties) mRootProperties = rootProperties;

    $(mTreeViewHTMLElement).empty();
    mTreeViewHTMLElement.append(mRootItem);

    if (elementTree) for (var index=0; index<elementTree.length; index++) {
      var element = elementTree[index];
      // Backwards compatibility: change Element.Panel -> Panel
      var array = element['Type'].split('.');
      element['Type'] = array[array.length-1];
      addElementItem(mTreeViewHTMLElement,element,0);
    }
  }

  function addElementItem(parent, element, depth) {
    var treeItem = buildTreeItem(depth,element['Name'],element['Type']);
    parent.append(treeItem);
    // Keep for future use in this object   
    mPropertiesByHash[mHash] = element['Properties'];
    const childrenList = 'Children' in element ? element['Children'] : [];
    if (childrenList.length>0) {
      const expanded = ('Expanded' in element) && element['Expanded']=='true';
      const group = buildGroupForItem(treeItem, expanded);
      mHash++;
      depth++;
      for (var index=0; index<childrenList.length; index++) {
        addElementItem(group,childrenList[index],depth);
      }
    }
    else mHash++;
  }

  function pasteElementTree(targetTreeItem, elementTree) {
    var treeNodes = {};

    for (var index=0; index<elementTree.length; index++) {
      var element = elementTree[index];
      // Backwards compatibility: change Element.Panel -> Panel
      var array = element['Type'].split('.');
      element['Type'] = array[array.length-1];
      var uniqueName = getUniqueName (element['Name']);

      var parentNode = null;
      if ('Parent' in element) {
        parentNode = treeNodes[element['Parent']];
        if (!('group' in parentNode)) { // create the group and change the parent state icon the first time a child is added
          const parentElement = parentNode['element'];
          const expanded = ('Expanded' in parentElement) && parentElement['Expanded']=='true';
          parentNode['group'] = buildGroupForItem(parentNode['tree_item'], expanded);
        }
      }
      // Now create the tree item
      var treeItem;
      var depth;
      if (parentNode) {
        depth = parentNode['depth']+1;
        treeItem = buildTreeItem(depth,uniqueName,element['Type']);
        parentNode['group'].append(treeItem);
      }
      else if (isRootItem(targetTreeItem)) { 
        depth = 0;
        treeItem = buildTreeItem(0,uniqueName,element['Type']);
        mTreeViewHTMLElement.append(treeItem);
      }
      else {
        depth = getItemDepth(targetTreeItem)+1
        treeItem = buildTreeItem(depth,uniqueName,element['Type']);
        checkItemGroup(targetTreeItem).append(treeItem);
      }
      
      // Keep for later use in this function
      treeNodes[element['Name']] = { 'tree_item' : treeItem, 'element' : element, 'depth' : depth };
      // Keep for future use in this object
      if (element['Properties']) {
        mPropertiesByHash[mHash] = JSON.parse(JSON.stringify(element['Properties']));
      }
      // Update unique hash   
      mHash++;
    }
    treeNodes = {};
		self.reportableTreeChange("Paste subtree");
  }

  // ---------------------------------------
  // Create html for tree items and groups
  // ---------------------------------------
  
  function buildGroupForItem(parent, expanded) {
    const hash =  parent.data('hash');
    const html = 
      '<div role="group" class="list-group ps-2 collapse'+(expanded ? ' show' : '')+'" '+
        ' data-parent="'+ITEM_LIST_PREFIX + hash+'" '+
        ' id="'+ITEM_GROUP_PREFIX + hash+'">'+
      '</div>';
    const group = $(html);
    const iconClass = expanded ? EXPAND_ICON_CLASS : COLLAPSE_ICON_CLASS;
    parent.find('.state-icon').removeClass(ITEM_ICON_CLASS).addClass(iconClass);
    parent.append(group);
    return group;
  }
  
  function buildTreeItem(depth,name,type) {
    const leftPadding = getLeftPadding(depth);
    const icon = mViewPanel.getElementClassIconSRC(type);
    const html = 
      '<div role="treeitem" class="list-group-item py-0 border-0" style="padding-left:'+leftPadding+'" '+
        ' draggable="true" ondragstart="WebEJS_GUI.viewElements_dragFunction(event,\'element\')" data-drag_info="'+mHash+'" ' +
        ' id ="'+ITEM_LIST_PREFIX + mHash+'" data-type="'+type+'" data-hash="'+mHash+'" data-depth="'+depth+'" '+
        ' data-bs-target="#' + ITEM_GROUP_PREFIX + mHash +'" "aria-level="'+depth+'" >' +
        '<i class="state-icon '+ITEM_ICON_CLASS+'"></i>'+
        '<span class="dropdown">'+
          '<img class="item-icon dropdown" style="padding: 0 2px 0 2px;" src="'+icon+'" data-drag_info="'+mHash+'" '+
            ' id="mViewItemMenuIcon_'+mHash+'" type="button" data-bs-toggle="dropdown" aria-expanded="false">'+
          '</img>' +
          '<ul class="dropdown-menu py-0" aria-labelledby="mViewItemMenuIcon_'+mHash+'">'+
              '<li><span class="cViewMenuHeader dropdown-item-text py-0 fw-bold">Menu</span></li>'+
  
              '<li><hr class="dropdown-divider m-0"></li>'+
              '<li class="dropdown-item sTranslatable cViewMenuItem" data-action="Properties">Properties</li>'+
              '<li class="dropdown-item sTranslatable cViewMenuItem" data-action="Rename">Rename</li>'+
              '<li class="dropdown-item sTranslatable cViewMenuItem" data-action="Reparent">Reparent</li>'+
  
              '<li><hr class="dropdown-divider m-0"></li>'+
              '<li class="dropdown-item sTranslatable cViewMenuItem" data-action="MoveUp">Move up</li>'+
              '<li class="dropdown-item sTranslatable cViewMenuItem" data-action="MoveDown">Move down</li>'+
  
              '<li><hr class="dropdown-divider m-0"></li>'+
              '<li class="dropdown-item sTranslatable cViewMenuItem" data-action="Cut">Cut</li>'+
              '<li class="dropdown-item sTranslatable cViewMenuItem" data-action="Copy">Copy</li>'+
              '<li class="dropdown-item sTranslatable cViewMenuItem" data-action="Paste">Paste</li>'+
              '<li class="dropdown-item sTranslatable cViewMenuItem" data-action="Remove">Remove</li>'+
              '<li><hr class="dropdown-divider m-0"></li>'+
              '<li class="dropdown-item sTranslatable cViewMenuItem" data-action="AddCustom">Add to custom</li>'+
              '<li class="dropdown-item sTranslatable cViewMenuItem" data-action="Help">Help</li>'+
          '</ul>'+
        '</span>'+
        '<span class="sViewTreeElement">'+name+'</span>'+   
      '</div>';    
    return $(html); 
  }
  
  function buildRootTreeItem() {
    const icon = mViewPanel.getElementClassIconSRC(ROOT_TYPE);
    const html = 
      '<div role="treeitem" class="list-group-item fw-bold py-0 border-0" data-hash="-1" style="padding-left:'+PARENTS_MARGIN_LEFT+'" aria-level="0">'+
        '<span class="dropdown">'+
          '<img class="root-icon dropdown" style="padding: 0 2px 0 2px;" src="'+icon+'" '+
            ' id="mViewItemMenuIcon_'+mHash+'" type="button" data-bs-toggle="dropdown" aria-expanded="false">'+
          '</img>' +
          '<ul class="dropdown-menu" aria-labelledby="mViewItemMenuIcon_'+mHash+'">'+
              '<li><span class="sTranslatable dropdown-item-text">Menu for Simulation view</span></li>'+
              '<li><hr class="dropdown-divider"></li>'+
              '<li class="dropdown-item sTranslatable cViewMenuItem" data-action="Properties">Properties</li>'+
              '<li><hr class="dropdown-divider"></li>'+
              '<li class="dropdown-item sTranslatable cViewMenuItem" data-action="Paste">Paste</li>'+
              '<li><hr class="dropdown-divider"></li>'+
              '<li class="dropdown-item sTranslatable cViewMenuItem" data-action="Help">Help</li>'+
          '</ul>'+
        '</span>'+
        '<span class="sViewTreeElement">Simulation view</span>'+
      '</div>';
    return $(html);
  }

  // --------------------------
  // Check possible parenthood
  // --------------------------
  
  function wrongParentMessage (treeItem, childType) {
    var message = sMainResources.getString("WARNING")+": ";
    message += treeItem ? sMainResources.getString("Element")+' '+getItemName(treeItem) : 
                            sMainResources.getString("Root");
    message += ' ' + sMainResources.getString("does not take children of type")+' '+childType+"!";
    sMainGUI.println(message);
  }
  
  /**
   * Whether the given treeItem or its parent would accept a child of the given type
   * returns a dict of the form
   *  { 
   *   'accept' : true or false , 
   *   'parent'  (only if previous is true): Not me, but this (my) parent would accept it, or null 
   *  }
   */
  function checkAcceptance(treeItem, childType, checkParentToo) {
    const hash = treeItem.data('hash');
    if (hash<0) { // dropped on Root
      if (mViewPanel.parentAcceptsChild(ROOT_TYPE,childType)) {
        return { 'accept' : true, 'parent' : null };
      }
      wrongParentMessage (null, childType);
      return { 'accept' : false };
    }
    // Try the item as parent for the new element
    if (mViewPanel.parentAcceptsChild(getItemType(treeItem),childType)) {
      return { 'accept' : true, 'parent' : null };
    }
    if (checkParentToo) {
      // Try with the item's' parent as parent for the new element
      const parentTreeItem = getParentItem(treeItem);
      if (parentTreeItem) {
        if (mViewPanel.parentAcceptsChild(getItemType(parentTreeItem),childType)) {
          return { 'accept' : true, 'parent' : parentTreeItem }; 
        }
      }
    }
    wrongParentMessage(treeItem, childType);
    return { 'accept' : false };
  } 

  // ------------------------
  // Functions for item nodes
  // ------------------------

  function isRootItem(treeItem) {
    return getItemHash(treeItem)<0;
  }
  
  function getItemHash(treeItem) {
    return treeItem.data('hash');
  }
  
  function getItemDepth(treeItem) {
    return treeItem.data('depth');
  }

  function getItemName(treeItem) {
    return treeItem.find('.sViewTreeElement').first().text();
  }

  function getItemType(treeItem) {
    return treeItem.data('type');
  }
	
	function getItemInfo(treeItem) {
		const hash = getItemHash(treeItem);
		if (hash<0) return {
			'hash' : hash,
			'name' : sMainResources.getString("Simulation view"), 
			'type' : 'Root',
			'properties' : mRootProperties
		}
    else return { 
			'hash' : hash,
			'name' : getItemName(treeItem), 
			'type' : getItemType(treeItem),
			'properties' : mPropertiesByHash[hash]
		};
	}

  // Get the group
  function getItemGroup(treeItem) {
    const group = $(treeItem.data("bs-target"));
    if (group.length>0) return group.first();
    return null;
  }
    
  function getParentItem(treeItem) {
    const parentGroup = treeItem.closest('.list-group');
    return (parentGroup.length>0) ? $('#'+parentGroup.data('parent')) : null;
  }

  function setItemName(treeItem, name) {
    treeItem.find('.sViewTreeElement').first().text(name);
  }
  
  function setItemDepth(treeItem, depth) {
    treeItem.css("padding-left", getLeftPadding(depth));
    treeItem.data('depth',depth);
    const childGroup = getItemGroup(treeItem);
    if (childGroup) {
      childGroup.children('.list-group-item').each(function(index,childItemStr) {
        setItemDepth($(childItemStr), depth+1);
      });
    }
  }

  function removeItem(treeItem, checkParent) {
    const childGroup = getItemGroup(treeItem);
    const childParent = checkParent ? getParentItem(treeItem) : null;
    const hash = getItemHash(treeItem);
    delete mPropertiesByHash[hash];
		delete mPropertyEditorsByHash[hash];
    treeItem.remove();
    if (childGroup) {
      childGroup.children('.list-group-item').each(function(index,childItemStr) {
        removeItem($(childItemStr),false);
      });
      childGroup.remove();
    }
    if (childParent) checkEmptyGroup(childParent);
		self.reportableTreeChange("Delete element");
  }
    
  function findItemByName(name) {
    var itemFound = null;
    $(mTreeViewHTMLElement).find('.list-group-item').each(function(index,treeItemStr) {
      const treeItem = $(treeItemStr);
      const hash = getItemHash(treeItem);
      if (hash>=0) {
        //console.log ("Checking item: "+getItemName(treeItem));
        if (getItemName(treeItem)===name) { itemFound = treeItem; return false; }
      }
    });
    return itemFound;
  }

  function findItemByHash(hash) {
    const itemList = $('#'+ITEM_LIST_PREFIX + hash);
    if (itemList.length>0) return itemList.first();
    return null;
  }
  
  // Get the group and create it if it does not exist
  function checkItemGroup(treeItem) {
    const group = $(treeItem.data("bs-target"));
    if (group.length>0) return group.first();
    // Create the group
    return buildGroupForItem(treeItem, true)
  }
  
  function checkEmptyGroup(treeItem) {
    if (treeItem==null) return;
    var group = $(treeItem.data("bs-target"));
    if (group.length<=0) return; 
    group = group.first();
    if (group.children().length<=0) {
      treeItem.find('.state-icon').removeClass(EXPAND_ICON_CLASS).removeClass(COLLAPSE_ICON_CLASS).addClass(ITEM_ICON_CLASS);
      group.remove();
    }
  }

  // -------------------------
  // Moving around tree items
  // -------------------------
  
  function moveItem (treeItem, targetTreeItem) {
    const targetHash = targetTreeItem.data('hash');
    var htmlElement = mTreeViewHTMLElement;
    var depth = 0;
    if (!(targetHash<0)) { // target is NOT Root
      htmlElement = checkItemGroup(targetTreeItem);
      depth = getItemDepth(targetTreeItem)+1;
    }
    setItemDepth(treeItem, depth);
    htmlElement.append(treeItem);
    const treeGroup = getItemGroup(treeItem);
    if (treeGroup) htmlElement.append(treeGroup);
		self.reportableTreeChange("Moving");
    checkEmptyGroup(getParentItem(treeItem));
  }

  function moveOrReparent(childHash, targetTreeItem) {
    const childItem = findItemByHash(childHash);
    if (childItem==null) {
      sMainGUI.println("ERROR: item with hash "+childHash+" NOT FOUND!!!");
      return;
    }
    const childType = getItemType(childItem);
    const parentItem = getParentItem(childItem);

    const acceptDict = checkAcceptance(targetTreeItem, childType, true);
    if (!acceptDict['accept']) {
      sMessageForm.showWarning("Move error","Target does not accept children of this type!");      
      return;
    }
    if (acceptDict['parent']) {
      const targetParentTreeItem = acceptDict['parent'];
      if (targetParentTreeItem && targetParentTreeItem!=childItem) {
        setItemDepth(childItem, getItemDepth(targetTreeItem));
        childItem.insertBefore(targetTreeItem);
        const childGroup = getItemGroup(childItem);
        if (childGroup) childGroup.insertBefore(targetTreeItem);
				self.reportableTreeChange("Reparenting");
        return checkEmptyGroup(parentItem);
      }
    }
    else moveItem(childItem,targetTreeItem);
  }
  
  function reparentItem(childItem,parentName) {
    const parentItem = findItemByName(parentName);
    if (parentItem==null) {
      sMainGUI.println("ERROR: parent element not found!!! : "+parentName);
      return;
    }
    const childType = getItemType(childItem);
    const acceptDict = checkAcceptance(parentItem, childType, false);
    if (acceptDict['accept']) moveItem(childItem,parentItem);
    else {
      sMessageForm.showWarning("Reparent error","Target does not accept children of this type!");      
    }
  }

  function moveItemUp (treeItem) {
    var prev =  treeItem.prev();
    if (prev.length>0) {
      prev = prev.first();
      if (prev.hasClass('list-group')) prev = prev.prev().first();
      if (isRootItem(prev)) return;
      treeItem.insertBefore(prev);
      const treeGroup = getItemGroup(treeItem);
      if (treeGroup) treeGroup.insertAfter(treeItem);
			self.reportableTreeChange("Move Up");
    }
  }
  
  function moveItemDown (treeItem) {
    var next =  treeItem.next();
    const treeGroup = getItemGroup(treeItem);
    var next = (treeGroup) ? treeGroup.next() : treeItem.next();
    if (next.length>0) {
      next = next.first();
      const nextGroup = getItemGroup(next);
      if (nextGroup) next = nextGroup;
      treeItem.insertAfter(next);
      if (treeGroup) treeGroup.insertAfter(treeItem);
			self.reportableTreeChange("Move Down");
    }
  }

  function createElement(childType, targetTreeItem) {
    const acceptDict = checkAcceptance(targetTreeItem, childType, false); // COULD BE true!
    if (!acceptDict['accept']) {
      sMessageForm.showWarning("Creation error","Target does not accept children of this type!");      
      return;
    }
    if (acceptDict['parent']) addElement(childType,acceptDict['parent'],targetTreeItem);
    else addElement(childType,targetTreeItem,null);
  } 

  function pasteElementList(targetTreeItem, pasteTree) {
    if (pasteTree.length<=0) return;
    const acceptDict = checkAcceptance(targetTreeItem, pasteTree[0]['Type'], false); // COULD BE true!
    if (!acceptDict['accept']) {
      sMessageForm.showWarning("Paste/Drag error","Target does not accept children of this type!");      
      return;
    }
    if (acceptDict['parent']) pasteElementTree(acceptDict['parent'],pasteTree);
    else pasteElementTree(targetTreeItem,pasteTree);
  }
  
  function getUniqueName (name) {
    var counter = 1;
    var testName = name;
    while (findItemByName(testName)) {
      testName = name + '_'+(++counter);
    }
    return testName;
  }
  
  function createNewElement (name, type) {
    var properties =[];
    // if (parent) element['Parent'] = parent;
    const textProperty = mViewPanel.getElementClassTextProperty(type);
    if (textProperty) properties.push({ 'name' : textProperty, 'value' : '"'+name+'"' });
    const defaultProperties = mViewPanel.getElementClassDefaultProperties(type);
    for (var i=0; i<defaultProperties.length; i++) {
      const propDefault =  defaultProperties[i]; 
      properties.push({ name : propDefault.name, value : propDefault.value });
    }
    mPropertiesByHash[mHash] = properties;
    mHash++;
		self.reportableTreeChange("Create element");
  }
  
  function addElement(childType, parentTreeItem, sibblingTreeItem) {
    const tentativeName = getUniqueName(childType.charAt(0).toLowerCase() + childType.slice(1));
    const parentHash = getItemHash(parentTreeItem);
    if (parentHash<0) { // This is the root node
      sInputForm.show("Create new element", "Name",tentativeName, 
        function(name) {
          name = getUniqueName(name);
          mTreeViewHTMLElement.append(buildTreeItem(0,name,childType));
          createNewElement(name, childType);
        }
      );
      return;
    }
    sInputForm.show("Create new element", "Name",tentativeName, 
      function(name) {
        name = getUniqueName(name);
        const newItem = buildTreeItem(getItemDepth(parentTreeItem)+1,name,childType);
        if (sibblingTreeItem) newItem.insertBefore(sibblingTreeItem);
        else checkItemGroup(parentTreeItem).append(newItem);
        createNewElement(name, childType);
      }
    );
  }
  
  // ------------------
  // Interface actions
  // ------------------
 
  // Set main bstreeview class to element.
  $(mTreeViewHTMLElement).addClass('bstreeview'); 
  
  // --- Expanding/collapsing a parent node
  $(mTreeViewHTMLElement).on('click', '.state-icon', function (event) {
    var icon = $(event.currentTarget);
    if (icon.hasClass(ITEM_ICON_CLASS)) return;
    icon.toggleClass(EXPAND_ICON_CLASS).toggleClass(COLLAPSE_ICON_CLASS);
    const treeitem = $(event.currentTarget).closest('.list-group-item');
    // Toggle the data-bs-target. Issue with Bootstrap toggle and dynamic code
    $(treeitem.attr("data-bs-target")).collapse('toggle');
  });
  
  // --- double-clicking on an element
  $(mTreeViewHTMLElement).on('dblclick', '.sViewTreeElement', function (event) {
    const treeItem = $(event.currentTarget).closest('.list-group-item');
    showPropertyEditor(treeItem);          
  });
  
  // --- Dragging and dropping on an element
  
  $(mTreeViewHTMLElement).on('dragenter', '.sViewTreeElement', function (event) {
    event.preventDefault(); 
    $(event.target).parent().addClass('bg-info');
  });
  
  $(mTreeViewHTMLElement).on('dragover', '.sViewTreeElement', function (event) {
    event.preventDefault(); 
  });
  
  $(mTreeViewHTMLElement).on('dragleave', '.sViewTreeElement', function (event) {
    event.preventDefault(); 
    $(event.target).parent().removeClass('bg-info')
  });
  
  $(mTreeViewHTMLElement).on('drop', '.sViewTreeElement', function (event) {
    const info = event.originalEvent.dataTransfer.getData("text");
    const hashOrType = info.split(':')[1];
    if (hashOrType=='undefined') return;
    event.preventDefault();
    const treeItem = $(event.target).parent();
    treeItem.removeClass('bg-info')
    //console.log("Element "+ getItemName(treeItem)  +  " received: "+info);
    if (info.startsWith('EJS-element')) moveOrReparent(hashOrType, treeItem);
    else if (info.startsWith('EJS-palette')) {
			const elementType = hashOrType;
			if (elementType.startsWith("_custom_")) pasteElementList(treeItem,
				mViewPanel.getCodeForCustomElement(elementType));
			else createElement(elementType,treeItem);
		}
  });

	self.clearPropertyEditor = function (hash) {
		delete mPropertyEditorsByHash[hash]
	}

	function showPropertyEditor(treeItem) {
		const hash = getItemHash(treeItem);
		if (mPropertyEditorsByHash[hash]) mPropertyEditorsByHash[hash].show();
		else mPropertyEditorsByHash[hash] = WebEJS_GUI.viewPropertyEditor(mViewPanel, self, getItemInfo(treeItem));
	}

  // --- Menu actions
  
  function treeItemMenuAction(mMenuItem) {
    const treeItem = mMenuItem.closest('.list-group-item');
    const action = mMenuItem.data('action');
    //console.log("Action "+action + " for item: ");
    switch (action) {
      case "Properties" : showPropertyEditor(treeItem); break;
      case "Rename" :
        const originalName = getItemName(treeItem);
        sInputForm.show("Rename element","New name", originalName,
          function(name) {
            if (name===originalName) return;
            name = getUniqueName(name);
            setItemName(treeItem,name);
          }
        );
        break;
      case "Reparent" :
        sInputForm.show("Reparent element","New parent", "", 
          function(parentName) {
            reparentItem(treeItem,parentName);
          }
        );
        break;
      case "Remove" :
        sMainConfirmationForm.show(getItemName(treeItem),
          "This action cannot be undone. Do you really want to remove this element?",
          "Remove",
          function() { removeItem(treeItem,true); }
        );
        break;
      case "AddCustom" :
        mCopiedList = [];
        recursivelyGetItem(mCopiedList, treeItem, null);
        //console.log(mCopiedList);
        sCustomElementForm.show(
          function(name,base64Image) { 
						mViewPanel.addToCustomGroup(name, base64Image, getItemName(treeItem), mCopiedList); 
					});
        break;
      case "Copy" : 
      case "Cut"  :
        mCopiedList = [];
        recursivelyGetItem(mCopiedList, treeItem, null);
        //console.log(mCopiedList);
        if (action=="Cut") removeItem(treeItem,true);
        break;
      case "Paste"  : pasteElementList(treeItem,mCopiedList); break;
      case "MoveUp" : moveItemUp(treeItem); break;
      case "MoveDown" : moveItemDown(treeItem); break;
      case "Help"     : mViewPanel.showElementClassHelp(getItemType(treeItem)); break;
    }
  }

  // -------------------------
  // Final initialization
  // -------------------------
  
  $(mTreeViewHTMLElement).on("click",'.item-icon',(event)=>{
    const treeItem = $( event.target ).closest('.list-group-item');
    $( event.target ).parent().find('.cViewMenuHeader').text(sMainResources.getString("Menu for")+" "+getItemName(treeItem));
  });   

  $(mTreeViewHTMLElement).on("click",'.cViewMenuItem',(event)=>{
    treeItemMenuAction($( event.target ));
  });   

  return self;
}
/*
 * Copyright (C) 2021 Jesús Chacón, Francisco Esquembre and Félix J. Garcia 
 * This code is part of the Web EJS authoring and simulation tool
 */

/**
 * WebEJS_GUI
 * @module core
 */

var WebEJS_GUI = WebEJS_GUI || {};

WebEJS_GUI.viewElements_dragFunction = function(event,suffix) {
  //console.log("Drag saved: "+event.target.dataset.drag_info);
  event.dataTransfer.setData("text", "EJS-"+suffix+":"+event.target.dataset.drag_info);
}
  
/**
 * @class viewWorkpanel 
 * @constructor  
 */
WebEJS_GUI.viewWorkpanel = function() {
	var self = {};
		 
  const ELEMENTS_PER_ROW = 8;
  const MINIMUM_NUMBER_OF_ROWS = 2;
  
	const mViewHTMLTree = WebEJS_GUI.viewTree($('#sViewTree'),self);

  // To be initialized later, in BuildPalette
  var mViewElements, mElementClassnames, mElementsClassInfo;

	// --------------------------
	// Prepare GUI
	// --------------------------

  function createEmptyElementHTML () {
    return ''+
      '<div class="col px-1 py-1 cViewEmptyElement">'+
        '<img src="'+sMainGUI.getSystemIconURL("elements/EMPTY.gif")+'">'+
//        '</img>'+
      '</div>';      
    }

	// --------------------------
	// Custom elements
	// --------------------------

	var mCustomElements = [];
	
	self.getCodeForCustomElement = function(tag) {
		return mCustomElements[tag];
	}
	
	function fragmentToCode(fragmentCode) {
		const fragment = fragmentCode['HtmlViewFragment'];
		const parent = fragment['HtmlViewFragment.Parent'];
		const elements = fragment['HtmlViewFragment.Code']['HtmlView.Element'];
		var code = [];
		for (var i=0; i<elements.length; i++) {
		const el = elements[i];
		if (el['Parent']==parent) delete el['Parent'];
		if (el['Type'].startsWith("Elements.")) el['Type'] = el['Type'].substring(9);
		const propOld = el['Property'];
		const propNew = [];
		if (propOld) { 
			for (var j=0; j<propOld.length; j++) {
			const prop = propOld[j];
			propNew.push({'name' : prop['@name'],  'value' : prop['#text']});
			}
			delete el['Property'];
		}
		el['Properties'] = propNew;
		code.push(el);
		}
    return code;
  }

	function codeToFragment(parentName, code) { // Yeah, parentName is actually ignored
    var fragmentStr = 
			'<HtmlViewFragment>\n'+
				'<HtmlViewFragment.Parent>Simulation view</HtmlViewFragment.Parent>\n'+
				'<HtmlViewFragment.Code>\n';
    for (var i=0; i<code.length; i++) {
      const el = code[i];
			fragmentStr += 
					'  <HtmlView.Element>\n'+
						'    <Expanded>'+ (el['Expanded']=="true" ? 'true' : 'false')+'</Expanded>\n'+
						'    <Type>Elements.'+ el['Type']+'</Type>\n'+
						'    <Name><![CDATA['+ el['Name']+']]></Name>\n';
			if ('Parent' in el && el['Parent']) {
				fragmentStr += 
						'    <Parent><![CDATA['+ el['Parent']+']]></Parent>\n';
			}
			const allProperties = el['Properties'];
			for (var j=0; j<allProperties.length; j++) {
				const prop = allProperties[j];
				fragmentStr += 
						'    <Property name="'+prop['name']+'"><![CDATA['+prop['value']+']]></Property>\n';
			}						
			fragmentStr += 
					'  </HtmlView.Element>\n';
    }
		fragmentStr += 
				'</HtmlViewFragment.Code>\n'+
			'</HtmlViewFragment>\n';
    return fragmentStr;
  }

	self.addToCustomGroup = function(name, iconBase64, parentName, mCopiedList) {
		const html = createCustomElementHTML(name,iconBase64,mCopiedList,true);
		var emptyPlaces = $('#mPaletteGroup_Compound .cViewEmptyElement');
		if (emptyPlaces.length<=0) {
			alert("No places left");
		}
		$(emptyPlaces[0]).replaceWith(html);
		sMainRefreshTooltips();
		const element = { 'name' : name, 'icon' : iconBase64, 'code' : codeToFragment(parentName, mCopiedList)};
		sMainComm.addCustomElement(element);
	}

	function deleteUserCustomElement(elementType) {
		sMainComm.deleteCustomElement(elementType);
		const divs = $('#mPaletteGroup_Compound *[data-element_class="'+elementType+'"]');
		if (divs.length>0) {
			$(divs[0]).replaceWith(createEmptyElementHTML ());
		}
	}

	// --------------------------
	// Creating elements
	// --------------------------

	function createCustomElementHTML (elementType, iconBase64, code, isUser) {
		const tag = '_custom_'+(isUser ? "user_" : "system_")+elementType;
		mCustomElements[tag] = code;
		const index = elementType.indexOf('_');
		const classname = isUser ? "cViewUserElement" :"cViewElementOnPalette";
		const title = (index>0) ? elementType.substring(index+1) : elementType; // Allow for 01_MyFirstCustomElement... so that to order the elements
		return ''+
			'<div class="col px-1 py-1" style="user-select: none;" data-element_class="'+elementType+'">'+
				'<img class="'+classname+'" src="data:image/gif;base64,'+iconBase64+'" '+
          ' draggable="true" ondragstart="WebEJS_GUI.viewElements_dragFunction(event,\'palette\')" data-drag_info="'+tag+'"' +
					' data-element_type="'+elementType+'"' +
				  ' data-bs-toggle="tooltip" data-bs-placement="top" title="'+title+'"'+
				'>'+
				'</img>'+
			'</div>';
	}

	function createElementHTML (elementType, iconName, description) {
		return ''+
			'<div class="col px-1 py-1" style="user-select: none;" >'+
				'<img class="cViewElementOnPalette" src="'+iconName+'" '+
          ' draggable="true" ondragstart="WebEJS_GUI.viewElements_dragFunction(event,\'palette\')" data-drag_info="'+elementType+'"' +
				  (description ? ' data-bs-toggle="tooltip" data-bs-placement="top" title="'+description+'"' : '')+
				'>'+
				'</img>'+
			'</div>';
	}
	
	function createTabsHTML(panelCounter,tabs) {
		var activeStr = ' active ';
		var selectedStr = 'true';
		var counter = 0;
		var tabsHtml    = '<ul class="nav nav-pills justify-content-center" role="tablist" ">';	
		var contentHtml = '<div class="tab-content">';
		for (const [groupName, elementTypeList] of Object.entries(tabs)) {
			counter++;
			var id = 'mViewElements_'+panelCounter+'_'+counter;
			tabsHtml += 
        '<li class="nav-item" role="presentation">' +
    		  '<button class="nav-link py-0 px-2'+activeStr+'" '+
    			  ' id="'+id+'-tab" data-bs-toggle="tab" data-bs-target="#'+id+'" '+
						' type="button" role="tab" aria-controls="'+id+'" aria-selected="'+selectedStr+'"'+
						' data-bs-toggle="tooltip" data-bs-placement="top" title="'+groupName+'">'+
		        '<img src="'+sMainGUI.getSystemIconURL("groups/"+groupName+".gif")+'">'+
					'</button>'+
				'</li>';
				
			contentHtml += 
				'<div class="tab-pane fade show '+activeStr+'" id="'+id+'" role="tabpanel" aria-labelledby="'+id+'-tab">'+
					'<div class="mPaletteSubpanel container" '+
						(groupName=='Compound' ? 'id="mPaletteGroup_Compound"' : '')+
						'>'+
						'<div class="row m-0">';
      var rowCounter = 1;
      var colCounter = 0;
			if (groupName=='Compound') {
				for (var index = 0; index < elementTypeList.length; index++) {
	        		const compoundInfo = elementTypeList[index]; // { 'name': str, 'icon' : base64, 'xml' : xmlDesc }
					// JavaScript EJS stored fragments as XML
					contentHtml += createCustomElementHTML(compoundInfo['name'],compoundInfo['icon'],fragmentToCode(compoundInfo['fragment']), compoundInfo['is_user']=='true');
					colCounter++;
					
					if (colCounter%ELEMENTS_PER_ROW==0 && index<elementTypeList.length-1) {
						rowCounter++;
						colCounter = 0;
						contentHtml += // open new row
					  	'</div>'+
							'<div class="row m-0">';
					}
				}
			}
      else {
				for (var index = 0; index < elementTypeList.length; index++) {
	        const elementType = elementTypeList[index];
			    if (elementType=="EMPTY") contentHtml += createEmptyElementHTML();
					else contentHtml += createElementHTML(elementType,
																self.getElementClassIconSRC(elementType),
																getElementClassDescription(elementType));
					colCounter++;
					
					if (colCounter%ELEMENTS_PER_ROW==0 && index<elementTypeList.length-1) {
						rowCounter++;
						colCounter = 0;
						contentHtml += // open new row
					  	'</div>'+
							'<div class="row m-0">';
					}
				}
			}
			while (colCounter<ELEMENTS_PER_ROW) {
				contentHtml += createEmptyElementHTML();
				colCounter++;				
			} 
			contentHtml +=
						'</div>'; // close last row
						
			while (rowCounter<MINIMUM_NUMBER_OF_ROWS) {
				contentHtml += '<div class="row m-0">';
				if (groupName=='Compound') {
					for (var k=0; k<ELEMENTS_PER_ROW; k++) contentHtml += createEmptyElementHTML();
				}
				else contentHtml += createEmptyElementHTML();
				contentHtml += '</div>';
				rowCounter++;				
			} 
			contentHtml +=
					'</div>'+
				'</div>';
			activeStr = '';
			selectedStr = 'false';
		}
		tabsHtml += '</ul>';
		contentHtml += '</div>';
		return tabsHtml+contentHtml;
	}
	
  self.buildPalette = function(systemInformation) {
    mViewElements = systemInformation['view_elements'];
    mElementClassnames =  mViewElements['classnames'];
    mElementsClassInfo = systemInformation['view_elements_info'];
    var html = '';
    var counter = 0;
    for (const [subpanelName, tabs] of Object.entries(mViewElements['panels'])) {
      counter++;
			var id = "mViewPaletteRow_"+counter;
      html += 
        '<div class="accordion-item p-0">'+
          '<span class="accordion-header" id="'+id+'-header">'+
            '<button class="sViewBtn accordion-button py-1" type="button" data-bs-toggle="collapse" '+
              ' data-bs-target="#'+id+'" aria-expanded="true" aria-controls="'+id+'">'+
              subpanelName+
            '</button>'+
          '</span>'+
          '<div id="'+id+'" class="accordion-collapse collapse show" aria-labelledby="'+id+'-header">'+
            '<div class="mPaletteSubpanel accordion-body p-0">'+
							createTabsHTML(counter,tabs)+
            '</div>'+
          '</div>'+
        '</div>';
    }
    $('#sViewPaletteSubpanel').html(html);
  };

	// --------------------------
	// API
	// --------------------------

	self.saveObject = function() {
		return { 'Tree' : mViewHTMLTree.getTree(), 'RootProperties' : mViewHTMLTree.getRootProperties() };
	}

	self.readObject = function(saved) {
		var result = false;
		var rootProperties = []; 
		var tree = {};
		if ('view' in saved) {
			const view = saved['view'];
			if ('Tree' in view) { // Modern form
				tree = view['Tree'];
				rootProperties = view['RootProperties'];
				result = true;
			}
		}
		mViewHTMLTree.setTree(rootProperties,tree); 
		return result;					
	}
 
	self.getDetectedFiles = function() {
		var detectedFiles = [];
		detectedFiles.push(...mViewHTMLTree.getDetectedPropertiesOfType('File'));
		return detectedFiles;
	}

	self.viewIsEmpty = function() { return mViewHTMLTree.isEmpty(); }
	
  // -------------------------
  // Element information utils
	// Elemenst have a type (e.g. Button) and a classname (e.g. EJSS_Interface.button)
	// The classname gives us access to detailed information on the element class:
	// { 'icon', 'description', 'parent', 'accepts', 'properties', 'text', 'edition' }
  // -------------------------
  
  /**
   * Gets the CLASS of an element name
   * @param elementType: Such as Button, Panel,...
   * @returns someting like "EJSS_INTERFACE.button"
  */
  function getClassname(elementType) {
    return mElementClassnames[elementType];
  }

  /**
   * Gets the class information on an element CLASS 
   * @param classname: such as EJSS_INTERFACE.button
   * @returns A dict of the form { "description", "parent", "text", "accepts", "edition", "defaults", "properties" }
   */
  function getClassInfo(classname) {
    const array = classname.split('.');
    return mElementsClassInfo[array[0]][array[1]];
  }
 
  function getElementClassDescription(elementType) {
    const classInfo = getClassInfo(getClassname(elementType));
    if ('description' in  classInfo) return classInfo['description'];
    return sMainResources.getString(elementType+'_INFO');
  }

  self.getWikiHelpPage = function(elementType) {
	if (!elementType) return 'https://t.um.es/webejs';
    const prefix = "https://www.um.es/fem/EjsWiki/Main/HtmlView";
    if (elementType==="Poligon") elementType = "Polygon"; // Fix the error from Poligon to Polygon
    else if (elementType.startsWith("UserDefined.")) elementType = "UserDefined";
    return prefix+"Elements"+elementType;
  }
  
  self.showElementClassHelp = function(elementType) {
    window.open(self.getWikiHelpPage(elementType),"_blank");
  }

  self.getElementClassIconSRC = function(elementType) {
    const classInfo = getClassInfo(getClassname(elementType));
    if ('icon' in  classInfo) return classInfo['icon'];
    return sMainGUI.getSystemIconURL('elements/'+elementType+'.gif');
  }

  self.getElementClassTextProperty = function(elementType) {
    const classInfo = getClassInfo(getClassname(elementType));
    if ('text' in classInfo) return classInfo['text'];
    return null;
  }
  
	self.getElementClassEditionInfo = function(elementType) {
    var classInfo = getClassInfo(getClassname(elementType));
		return classInfo['edition'];
	}

  self.getElementClassDefaultProperties = function(elementType) {
    var list = [];
    var classname = getClassname(elementType);
    while (true) {
      const classInfo = getClassInfo(classname);
      if ('defaults' in classInfo) {
        const defaults = classInfo.defaults;
        for (var key in defaults) {
          if (defaults.hasOwnProperty(key)) {
            list.push( { name : key, value : defaults[key] } );
          }
        }
      }
      if ('parent' in classInfo) classname = classInfo['parent'];
      else return list;
    }
  }

	/**
	 * @param elementType (e.g. Button) 
	 * @return A list of the property description of the given type
	 * Each property description is of the form :
	 * { 'name', 'types', 'modifiers', 'default' }
	 */
	self.getElementClassProperties = function(elementType, propertyType) {
		var classname = getClassname(elementType);
		var list = [];
    while (true) {
      const classInfo = getClassInfo(classname);
			if ('properties' in classInfo) {
				const propertiesDesc = classInfo['properties'];
				if (propertyType) { // Add only those of the given type
					for (var i=0; i<propertiesDesc.length; i++) {
						const propertyDescription =  propertiesDesc[i];
						if (self.isPropertyOfType(propertyDescription,propertyType)) list.push(propertyDescription);
					}					
				}
				else list.push(...propertiesDesc); 
			}
      if ('parent' in classInfo) classname = classInfo['parent'];
      else return list;
    }
	}

  /**
   * Returns a list of all classes implemented by this classname.
   * That is, itself and all its ancestor classes
	 * @param: a classname (e.g. EJSS_INTERFACE.button)
   */
  function genealogy(classname) {
    var list = [];
    while (true) {
      list.push(classname);
      const classInfo = getClassInfo(classname);
      if ('parent' in classInfo) classname = classInfo['parent'];
      else return list;
    }
  }

  self.parentAcceptsChild = function(parentType, childType) {
    const parentGenealogy = genealogy(getClassname(parentType));
    const childGenealogy = genealogy(getClassname(childType));
    for (var i=0; i<parentGenealogy.length; i++) {
      const parentInfo = getClassInfo(parentGenealogy[i]);
      if ('accepts' in parentInfo) {
        const parentAcceptList = parentInfo['accepts'];
        for (var j=0; j<childGenealogy.length; j++) {
          for (var k=0; k<parentAcceptList.length; k++) {
            if (parentAcceptList[k]==childGenealogy[j]) return true;
          }
        }
      }
    }
    return false;
  }

  // -------------------------
  // Property information utils
	// { 'name', 'types', 'modifiers', 'default' }
  // -------------------------

	self.getPropertyDescription = function(propertyName, classProperties){
		for (var i=0; i<classProperties.length; i++) {
			var propertyDescription = classProperties[i];
			if (propertyName==propertyDescription.name) return propertyDescription;
		}
		return null;
	}

  self.getPropertyDefaultValue = function(propertyDescription) {
    return propertyDescription['default'];
  }

	self.getPropertyModifiersString = function(propertyDescription) {
    return propertyDescription['modifiers'];
	}

	self.getPropertyTypesString = function(propertyDescription) {
    return propertyDescription['types'];
	}
	
	self.getPropertyTypesList = function(propertyTypesString) {
    return propertyTypesString.split('|');
	}

	self.hasPropertyModifier = function(propertyDescription,modifier) {
    return propertyDescription['modifiers'].indexOf(modifier)>=0;
	}
	
	self.getPropertyModifiersList = function(propertyModifiersString) {
    return propertyModifiersString.split('|');
	}

	self.isPropertyOfType = function(propertyDescription,type) {
    return propertyDescription['types'].indexOf(type)>=0;
	}

	self.hasModifier = function(propertyModifiers,modifier) {
    return propertyModifiers.indexOf(modifier)>=0;
	}
	
	self.isOfType = function(propertyTypes,type) {
    return propertyTypes.indexOf(type)>=0;
	}

  // -------------------------
  // Final initialization
  // -------------------------
  
  // --- double-clicking on an element
  $('#sViewPaletteSubpanel').on('dblclick', '.cViewElementOnPalette', function (event) {
    self.showElementClassHelp($(event.currentTarget).data("drag_info"));
  });

  $('#sViewPaletteSubpanel').on('dblclick', '.cViewUserElement', function (event) {
    sMainConfirmationForm.show($(event.currentTarget).data("element_type"),
      "This element was created by the user and is not editable.<br>Do you want to delete it?",
      "Delete",
      function() { deleteUserCustomElement($(event.currentTarget).data("element_type")); }
		);
  });

  
	return self;
}


/*
 * Copyright (C) 2021 Jesús Chacón, Francisco Esquembre and Félix J. Garcia 
 * This code is part of the Web EJS authoring and simulation tool
 */

/**
 * GUI tools
 * @module core
 */

var WebEJS_RESOURCES = WebEJS_RESOURCES || {};

WebEJS_RESOURCES.sSingleton = null;

/**
 * String resources
 * @class stringResources 
 * @constructor  
 */
WebEJS_RESOURCES.main = function(locale) {
	if (WebEJS_RESOURCES.sSingleton!=null) return WebEJS_RESOURCES.sSingleton;
	
	var self = {};
	var mLocale = "en";
	var mStrings = null;

	const sStrings_es = {
		"Description" : "Descripción",
		"Model" : "Modelo",
		"View" : "Vista",
		"Preview" : "Previsualización",
		"Output" : "Salida",
		"D" : "D",
		"M" : "M",
		"V" : "V",
		"P" : "P",
		"O" : "S",

		"Clear output" : "Borrar salida",

		"Create a new simulation" : "Crear una simulación nueva",
		"Load a simulation from your device" : "Cargar una simulación desde su dispositivo",
		"Download a simulation from a digital library" : "Descargar una simulación desde una librería digital",
		//"Open a file in your workspace" : "Abrir un fichero de su espacio de trabajo",

		"Manage the simulation files" : "Organizar los archivos de la simulación",
		"Download ZIP with the sources" : "Descargar un ZIP con las fuentes de la simulación",
		"Download ZIP with the complete simulation" : "Descargar un ZIP con la simulación completa",

		"Search in the simulation" : "Buscar en la simulación",
		"Run the simulation" : "Ejecutar la simulación",
		
		"Translate the simulation" : "Traducir la simulación",
		"Run the simulation" : "Ejecutar la simulación",
		"Show WebEJS options" : "Mostrar las opciones de WebEJS",
		"Show info and help" : "Mostrar información y ayuda",
		
		"Variables" : "Variables",
		"Initialization" : "Inicialización",
		"Evolution" : "Evolución",
		"Fixed relations" : "Relaciones fijas",
		"Custom" : "Propio",
		"Elements" : "Elementos",

		"Name" : "Nombre",
		"Create new page" : "Crear una nueva página",
		"Page" : "Página",

		"Click to create a page of variables" : "Haga clic para crear una página de variables",
		"Click to create a page of initialization" : "Haga clic para crear una página de inicialización", 
		"Click to create a page of fixed relations" : "Haga clic para crear una página de relaciones fijas", 
		"Click to create a page of code" : "Haga clic para crear una página de código",
		"Click to create a page of ODEs" : "Haga clic para crear una página de EDO",
		"Click to create a page of custom code" : "Haga clic para crear una página de código propio", 
		
		"Frames<br>per second" : 	"Imágenes<br>por segundo",

    "Tree of elements" :  "Árbol de elementos",
    "Elements for the view" :  "Elementos para la vista"

	}

	/**
	 * Sets the locale
	 * @method setLocale
	 * @param locale a string with one of the available locales (e.g. "es"). If null, or non existing, the default will be used
	 */	
	self.setLocale = function(locale) {
		if (locale=="es") {
			mStrings = sStrings_es;
			mLocale = "es";
		}
		else {
			mStrings = null;
			mLocale = "en";
		}
		self.translateAll();
	}
	
	self.translateAll = function() {
		$(".sTranslatable").each(function(){
			$(this).text(self.getString($(this).data('original_string')));
		});
		$(".sTranslatableHTML").each(function(){
			$(this).html(self.getString($(this).data('original_string')));
		});
		$(".sTranslatableTitle").each(function(){
			$(this).prop('title',self.getString($(this).data('original_string')));
		});
		sMainRefreshTooltips();
	}
	
	self.prepareForTranslation = function(parentSelector) {
		$(parentSelector).find('.sTranslatable').each(function() {
			if (!$(this).data('original_string')) $(this).data('original_string',$(this).text());
		});
		$(parentSelector).find('.sTranslatableHTML').each(function() {
			if (!$(this).data('original_string')) $(this).data('original_string',$(this).html());
		});
		$(parentSelector).find('.sTranslatableTitle').each(function() {
			if (!$(this).data('original_string')) $(this).data('original_string',$(this).prop('title'));
		});
		self.translateAll();
	}

	self.updateTranslation = function(parentSelectorList) {
		for (var i=0; i<parentSelectorList.length; i++) {
			parentSelector = parentSelectorList[i];
			$(parentSelector).find('.sTranslatable').each(function() {
				$(this).data('original_string',$(this).text());
				$(this).text(self.getString($(this).data('original_string')));
			});
			$(parentSelector).find('.sTranslatableHTML').each(function() {
				$(this).data('original_string',$(this).html());
				$(this).html(self.getString($(this).data('original_string')));
			});
			$(parentSelector).find('.sTranslatableTitle').each(function() {
				$(this).data('original_string',$(this).prop('title'));
				$(this).prop('title',self.getString($(this).data('original_string')));
			});
		}
	}
		
	self.getLocale = function() {
		return mLocale;
	}

	/**
	 * Returns the locale for the keyword string
	 * @method getString
	 * @param keyword the keyword for the desired localized string. If not found, [?] will be prepended to the keyword, instead
	 */	
	self.getString = function(keyword) {
		if (mStrings==null) return keyword;
		if (keyword in mStrings) return mStrings[keyword];
		return "[?] " + keyword;
	}
	
	self.prepareForTranslation('#sMainBody');
	
	if (locale!=null) self.setLocale(locale);
	WebEJS_RESOURCES.sSingleton = self;
	
	return self;
	
}
/*
 * Copyright (C) 2023 Francisco Esquembre
 * 2023 08 This code is adapted from the IODA graphic data analysis tool
 * (of the same author)
 */

/**
 * GUI forms
 * @module core
 */

var WebEJS_GUI = WebEJS_GUI || {};

WebEJS_GUI.fileChooser_drag_prefix = '_webEJSFileChooserPath_:';

WebEJS_GUI.fileChooser_dragFunction = function(event) {
  event.dataTransfer.setData("text", WebEJS_GUI.fileChooser_drag_prefix+event.target.dataset.path);
}

/**
	* Creates a modal to serve as file manager
	* @param mFileServer The server that provides the files. This object must support the following commands:
	*		-  refreshUserFiles(listener) // listener(file_listing) is a function to call when the server sends the files 
	*	@param mModalSize optionally one of "fullscreen" (default), "lg", "xl"
	* @param mTranslate An optional function to translate texts 
	* In this class paths always are of the form '/folder/subfolder/file' or '/folder/subfolder/'
 */
WebEJS_GUI.fileChooser = function(mFileServer, mModalSize, mTranslator) {
	var self = {};
	var mModalID = "webEJSFileChooserModal";
	const mHomeLabel = "Simulation";

	{ // Initialize modal ID and mTranslate
		var counter = 1;
		while ($('#'+mModalID).length>0 && counter < 1000) {
			mModalID = "webEJSFileChooserModal"+(++counter);
		}
		//console.log ("WebEJS_GUI.fileChooser's modal ID = "+mModalID);
		
		if (! (['fullscreen','lg','xl'].includes(mModalSize)) ) mModalSize = 'fullscreen';
		
		var mTranslate    = function (text) { 
			return '(en) ' + text; 
		}
		var mTranslateAll = function (selector) {
			$(selector + ' .sTranslatable').each(function() { 
				var text = null;
				const original = $(this).data('_locale_original_text');
				if (original) $(this).text(mTranslate(original));
				else {
					const text = $(this).text();
					$(this).data('_locale_original_text',text);
					$(this).text(mTranslate(text)); 
				} 
			});
		}

		if (typeof mTranslator != 'undefined') {
			mTranslate = mTranslator.getString;
			mTranslateAll = mTranslator.translateAll;
		}
	}

  // --------------------
  // Modals
  // --------------------

	const MODAL_HEADER= `
		<div class="modal-header bg-light text-dark">
		<img src="`+sMainEjsLogo+`" height="40" class="me-2 d-inline-block align-bottom;">
		<h5 class="ps-2 sTranslatable text-primary modal-title">#{TITLE}</h5>
			<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
		</div>
		`;

	const MODAL_HTML = `
		<div id="#{ID}" 
					class="modal modal-dialog-scrollable fade" 
					data-bs-backdrop="static" data-bs-keyboard="false" tabindex="-1" aria-hidden="true">		
			<div class="modal-dialog modal-#{SIZE} modal-dialog-centered modal-dialog-scrollable">
				<div class="modal-content h-100">
					`  + MODAL_HEADER + `

					<div class="modal-body d-flex flex-row">
				
						<div id="mFileChooserHelper" class="col-2 m-0 p-0" style="flex-grow:1;">
						</div>
					
	
					<div class="h-100 col-10 d-flex flex-column" style="flex-grow:1;">
						<div class="bstreeview h-100 d-flex flex-column" style="flex-grow: 1"></div>
						<div class="border-top" style="flex-grow: 0; flex-basis: 0">
							<span class="flex flex-grow input-group input-group-sm mt-1">
								<nav aria-label="breadcrumb">
									<ol class="breadcrumb m-0"></ol>
								</nav>
							</span>
							<span class="filename_div flex flex-grow input-group input-group-sm mt-1">
								<span  class="sTranslatable input-group-text">Filename</span>
								<input type="text" class="filename_input flex flex-grow form-control"   
									placeholder="<Type in or click on an option>" aria-label="Filename"   
									value="">
							</span>
						</div>
					</div>
					</div>
		
					<div class="modal-footer">
			   			<button type="button" class="cancel_button sTranslatable btn btn-secondary me-auto" data-dismiss="modal">Close</button>
						<button type="button" class="upload_button sTranslatable btn btn-outline-secondary me-auto">Upload File</button>
						<button type="button" class="folder_button sTranslatable btn btn-outline-secondary me-auto">New Folder</button>
						<button type="button" class="ok_button btn btn-primary">Done</button>
					</div>
				</div>
			</div>
		</div>
	`;
	
	const NEW_FOLDER_MODAL_HTML = `
		<div id="#{ID}-new_folder_modal" class="modal fade"
			 data-bs-backdrop="static" data-bs-keyboard="false" tabindex="-1" aria-hidden="true">	
		
			<div class="modal-dialog modal-dialog-centered">
				<div class="modal-content">
				`  + MODAL_HEADER + `
				<div class="modal-body">
							<div class="input-group mb-3">
								<span  id="#{ID}-new_folder_label" class="sTranslatable input-group-text">Name</span>
								<input id="#{ID}-new_folder_name"  type="text" class="name_input form-control" 
									placeholder="Folder name here" aria-label="Folder name" aria-describedby="#{ID}-new_folder_label">
							</div>
					</div>
					<div class="modal-footer">
						<button type="button" class="sTranslatable btn btn-secondary me-auto" 
										data-bs-target="##{ID}" data-bs-toggle="modal">Cancel</button>
						<button type="button" class="ok_button sTranslatable btn btn-primary">Create</button>
					</div>
				</div>
			</div>
		</div>
	`;		

	const UPLOAD_MODAL_HTML = `
		<div id="#{ID}-upload_modal" class="modal fade"
			data-bs-backdrop="static" data-bs-keyboard="false" tabindex="-1" aria-hidden="true">	
		
			<div class="modal-dialog modal-dialog-centered">
				<div class="modal-content">
				`  + MODAL_HEADER + `
				<div class="modal-body">
						<div class="input-group mb-3">
							<span  id="#{ID}-upload_label" class="sTranslatable input-group-text">Name</span>
							<input id="#{ID}-upload_name"  type="text" class="name_input form-control" 
									placeholder="File name here" aria-label="File name" aria-describedby="#{ID}-upload_label">
						</div>
						<div class="input-group mb-3">
							<input  id="#{ID}-upload_input" class="form-control" type="file">
						</div>
					</div>
					<div class="modal-footer">
						<button type="button" class="sTranslatable btn btn-secondary me-auto" 
										data-bs-target="##{ID}" data-bs-toggle="modal">Cancel</button>
						<button type="button" class="ok_button sTranslatable btn btn-primary">Upload</button>
					</div>
				</div>
			</div>
		</div>
	`;	

	const RENAME_MODAL_HTML = `
	<div id="#{ID}-rename_modal" class="modal fade"
		 data-bs-backdrop="static" data-bs-keyboard="false" tabindex="-1" aria-hidden="true">	
	
		<div class="modal-dialog modal-dialog-centered">
			<div class="modal-content">
			`  + MODAL_HEADER + `
			<div class="modal-body">
						<div class="input-group mb-3">
							<span  id="#{ID}-rename_label" class="sTranslatable input-group-text">New name</span>
							<input id="#{ID}-rename_name"  type="text" class="name_input form-control" 
								placeholder="New name here" aria-label="Folder name" aria-describedby="#{ID}-rename_label">
						</div>
				</div>
				<div class="modal-footer">
					<button type="button" class="sTranslatable btn btn-secondary me-auto" data-bs-target="##{ID}" data-bs-toggle="modal">Cancel</button>
					<button type="button" class="ok_button sTranslatable btn btn-primary">Apply</button>
				</div>
			</div>
		</div>
	</div>
`;		
	$('body').append($( MODAL_HTML.replace( /#\{ID\}/g,   mModalID )
																.replace( /#\{TITLE\}/g,  'File Manager' )
															 	.replace( /#\{SIZE\}/g, mModalSize ) ) );
	$('body').append($(NEW_FOLDER_MODAL_HTML.replace( /#\{ID\}/g,   mModalID ).replace( /#\{TITLE\}/g,  'New Folder' ) ) );
	$('body').append($(    UPLOAD_MODAL_HTML.replace( /#\{ID\}/g,   mModalID ).replace( /#\{TITLE\}/g,  'Upload File' ) ) );
	$('body').append($(      RENAME_MODAL_HTML.replace( /#\{ID\}/g,   mModalID ).replace( /#\{TITLE\}/g,  'Rename' ) ) );

	const mModal       = new bootstrap.Modal(document.getElementById(mModalID));
	const mFolderModal = new bootstrap.Modal(document.getElementById(mModalID+'-new_folder_modal'));
	const mUploadModal = new bootstrap.Modal(document.getElementById(mModalID+'-upload_modal'));
	const mRenameModal   = new bootstrap.Modal(document.getElementById(mModalID+'-rename_modal'));

	['','-new_folder_modal','-upload_modal','-rename_modal'].forEach(function(entry) {
		$('#'+mModalID+entry).on('show.bs.modal', function (event) { mTranslateAll('#'+mModalID+entry); });
	});

	$('#'+mModalID).on('hide.bs.modal', function (event) {
		mExpandedList = [];
		$('#'+mModalID+ ' .'+EXPAND_ICON_CLASS).each(function() {
			const treeItem = $(this).closest('.list-group-item');
			mExpandedList.push(treeItem.data('path'));
		});
	});

	$("#mFileChooserHelper").on('click', '.cFileChooserHelperImage', function (event) {
		mModal.hide();
		const image = $(event.currentTarget);
		const path = image.data('value');
		if (mListener) mListener(path);
	});

	const mTreeDiv    = $('#'+mModalID+' .bstreeview');
	const mBreadCrumb = $('#'+mModalID+' .breadcrumb');

  // --------------------
  // Variables
  // --------------------

	const PURPOSE = {
		MANAGER : 0,
		READ : 1,
		WRITE : 2
	}
	
	var mTree = null; // Holds the tree of folders and files to display
	var mCurrentPath = '/';

	var mPurpose = PURPOSE.MANAGER;
	var mOriginalFilePath = '/';
	var mExtensions = null; // [string] Only files with an extension in this list will be clickable

	var mHash = 0;	
	var mCurrentItem = null;
	var mExpandedList = [];
	
	var mListener = null;

	// --------------------
  // API
  // --------------------

	/**
	 * Resets the file chooser to a null Tree
	 */
	self.reset = function() {
		mTree = null;
		mCurrentPath = '/';
		mCurrentItem = null;
		mHash = 0;
	}

	function _checkAndShow (helperHtml) {
		if (helperHtml) {
			$("#mFileChooserHelper").html(helperHtml);
			$("#mFileChooserHelper").removeClass('d-none');
		}
		else {
			$("#mFileChooserHelper").html('');
			$("#mFileChooserHelper").addClass('d-none');
		}

		if (mTree==null) mFileServer.refreshUserFiles(function(serverListing) { 
			mTree = { root_path : '/', root_entries : getTree(serverListing,'/') };
			_show(mCurrentPath); 
		});
		else _show(mCurrentPath);
	}

	/**
	 * Shows the file reader as a manager for the user to organize the files
	 */
	self.showManager = function() {
		mPurpose = PURPOSE.MANAGER;
		mExtensions = null;
		mListener = null;
		_checkAndShow(null);
	}
	
	self.showRead = function(extensions, listener, helperHtml) {
		mPurpose = PURPOSE.READ;
		mExtensions = extensions;
		mListener = listener;
		_checkAndShow(helperHtml);
	}
	
	self.showWrite = function(extensions, listener) {
		mPurpose = PURPOSE.WRITE;
		mExtensions = extensions;
		mListener = listener;
		_checkAndShow(null);
	}

	// --------------------------
  // Setting the tree of files
  // --------------------------

	/**
	 * 
	 * @param {*} filepath 
	 * @param {*} is_folder 
	 * @returns The folder (ending with '/') and name of a given filepath
	 */
	function parentAndName(filepath, is_folder) {
		if (filepath=='/' || filepath=="") return { parent : '/', name : '' };
		if (!filepath.startsWith('/')) filepath = '/' + filepath;
		if (is_folder && filepath.endsWith('/')) filepath = filepath.substring(0,filepath.length-1);
		const index = filepath.lastIndexOf('/');
		return { parent : filepath.substring(0,index+1) , name : filepath.substring(index+1) };
	}

	function panFolderPath(pan) {
		if (pan.name=='') return pan.parent;
		return pan.parent+pan.name+'/';
	}

	function panFilePath(pan) {
		return pan.parent+pan.name;
	}

function getTree(listing, parent_folder) {
	var entries = []; 
	for (var i=0; i<listing.length; i++) {
		var fileInfo = listing[i]; 
		const isFolder = (fileInfo.type=='DIRECTORY');
		const pan = parentAndName(fileInfo.path, isFolder);
		if (pan.parent!=parent_folder) continue;
		if (pan.name.startsWith('.')) continue; // Skip hidden files
		if (isFolder) entries.push({ name : pan.name, path : panFolderPath(pan), description : fileInfo.description, entries : getTree(listing,panFolderPath(pan))});
		else 					entries.push({ name : pan.name, path : panFilePath(pan),   description : fileInfo.description, url: fileInfo.url});
	}
	return entries;	
}

  // --------------------
  // Display the tree
  // --------------------

	/**
	 * filesTree is a tree of folders and files
	 * { root_path, root_entries: [ { name, path [,entries]} ... ] }
	 * @param initialFilepath the original file or folder of interest, 
	 * 		Can be of the form: '/', '/folder/' or '/folder/Filename.txt'.
	*/
	function _show(initialFilepath) {
		switch (mPurpose) {
			case PURPOSE.WRITE :
				$('#'+mModalID+' .filename_div').removeClass('d-none');
				$('#'+mModalID+' .ok_button').text(mTranslate('Save'));
				$('#'+mModalID+' .filename_input').attr('disabled', mExtensions==null );
				break;
			case PURPOSE.READ :
				$('#'+mModalID+' .filename_div').addClass('d-none');
				$('#'+mModalID+' .ok_button').text(mTranslate('Read'));
					break;
			default:
				$('#'+mModalID+' .filename_div').addClass('d-none');
				$('#'+mModalID+' .ok_button').text(mTranslate('Done'));
		}
		mCurrentItem = null;
		mOriginalFilePath = initialFilepath;
		const isFolder = initialFilepath.endsWith('/');
		const pan = parentAndName(initialFilepath,isFolder);
		if (isFolder) {
			if (!displayTree(panFolderPath(pan))) return;
			displayBreadCrumb(panFolderPath(pan));			
		}
		else {
			if (!displayTree(pan.parent+'/')) return;
			displayBreadCrumb(pan.parent+'/');			
			displayFilename(initialFilepath);
		}
		mModal.show();
	}

  // --------------------
  // Display functions
  // --------------------

  const ITEM_GROUP_PREFIX = mModalID+'-tree-group-';
  const EXPAND_ICON_CLASS = 'bi-chevron-down';
  const COLLAPSE_ICON_CLASS = 'bi-chevron-right';
  const ITEM_ICON_CLASS = "bi-dash";
  const FOLDER_ICON_CLASS = "bi-folder";
  const FILE_ICON_CLASS = "bi-file-check";
  const NON_FILE_ICON_CLASS = "bi-file";
  const INDENT =  0.5;
  const PARENTS_MARGIN_LEFT = '0.25rem';

  function getLeftPadding(depth) {
    return depth>0 ? (INDENT + depth * INDENT).toString() + "rem" : PARENTS_MARGIN_LEFT;
  }

	/**
	 * Removes leading and trailing '/'
	 * @param {*} path 
	 * @returns 
	 */
	function stripPath(path) {
		if (path.startsWith('/')) path = path.substring(1);
		if (path.endsWith('/'))   path = path.substring(0,path.length-1);
		return path;
	}

	function findFolderInEntries(folderName, entries) {
		for (var i=0; i<entries.length; i++) {
			const entry = entries[i];
			if ('entries' in entry) {
				if (folderName==entry.name) return entry;
			}
		}
		return null;
  }

	/**
	 * Splits the parent folder in folders and looks down the hierarchy to find the entries
	 * @param {*} parentFolder 
	 * @returns 
	 */
  function findEntriesInPath(parentFolder) {
		if (parentFolder=='/') return mTree.root_entries;
		const folderNames = stripPath(parentFolder).split('/');
		var entries = mTree.root_entries;
		for (var i=0; i<folderNames.length; i++) {
			const folderName = folderNames[i];
			const folder = findFolderInEntries(folderName,entries);
			if (folder==null) return [];
			entries = folder.entries;
		}
		return entries;
  }
	
  /**
   * Displays the tree... starting from the given folder
	 * @param parentFolder in the form of '/folder/subfolder/'
   */
  function displayTree(parentFolder) {
	  var entries = parentFolder ? findEntriesInPath(parentFolder) : mTree.root_entries;
    $(mTreeDiv).empty();
    var added=0;
		//added += addFileItem(mTreeDiv,{ name : '.', path : parentFolder , entries: []}, 0, mExtensions);

    for (var index=0; index<entries.length; index++) {
      var entry = entries[index];
			added += addFileItem(mTreeDiv,entry, 0, mExtensions);
    }
		if (added==0) 
			mTreeDiv.append($('<div class="m-3 text-secondary">'+mTranslate('(This folder is empty)')+'</div>'));
		mExpandedList = [];
		return true;
  }

  function addGroupForItem(parent,expanded) {
    const html = 
      '<div role="group" class="list-group ps-2 collapse'+(expanded ? ' show' : '')+'" '+
        ' id="'+ITEM_GROUP_PREFIX + mHash+'">'+
      '</div>';
    const group = $(html);
    parent.append(group);
		return group;
  }

	const ITEM_HTML = `
		<div role="treeitem" class="list-group-item py-0 border-0" style="padding-left: #{PADDING}" 
			draggable="true" ondragstart="WebEJS_GUI.fileChooser_dragFunction(event)" 
			data-path="#{PATH}" aria-level="#{DEPTH}" 
			#{EXTRA_INFO}
			>
			<i class="state-icon pe-1 bi #{BI_CLASS}"></i>
			<span class="#{CLASS_STR}">
				<span class="dropdown">
					<i class="item-icon dropdown me-1 bi #{ICON_CLASS}"
						id="#{ID}-MenuIcon_#{HASH}" type="button" data-bs-toggle="dropdown" aria-expanded="false">
					</i>
					<ul class="dropdown-menu py-0" aria-labelledby="#{ID}-MenuIcon_#{HASH}">
						<!--li><span class="cFileChooserMenuHeader sTranslatable dropdown-item-text py-0 fw-bold">Menu</span></li>

						<li><hr class="dropdown-divider m-0"></li-->
						<li class="dropdown-item sTranslatable  cFileChooserMenuItem" data-action="Rename">Rename</li>
						<li class="dropdown-item sTranslatable  cFileChooserMenuItem" data-action="Duplicate">Duplicate</li>
						#{FOLDER_OPTIONS}
						<li><hr class="dropdown-divider m-0"></li>
						<li class="dropdown-item sTranslatable  cFileChooserMenuItem" data-action="Delete">Delete</li>
					</ul>
				</span>
				<span class="cFileChooserName">
				#{NAME}
				</span>
			</span>
		</div>`;  

  /**
  * entry = { name, path, [entries] }
  */
  function addFileItem(parent,entry,depth, mExtensions) {
    const leftPadding = getLeftPadding(depth);
		const isFolder = 'entries' in entry;
		var added = 0;
		var html="";
		if (isFolder) {
			const iconStr  = mExpandedList.includes(entry.path) ? EXPAND_ICON_CLASS : COLLAPSE_ICON_CLASS;
			const folderOptions = `
				<li><hr class="dropdown-divider m-0"></li>
				<li class="dropdown-item sTranslatable  cFileChooserMenuItem" data-action="Upload">Upload File</li>
				<li class="dropdown-item sTranslatable  cFileChooserMenuItem" data-action="Subfolder">Create Subfolder</li>
			`;

			html = ITEM_HTML.replace( /#\{ID\}/g,   mModalID )
											.replace( /#\{PADDING\}/g, leftPadding ) 
											.replace( /#\{PATH\}/g, entry.path ) 
											.replace( /#\{DEPTH\}/g, depth ) 
											.replace( /#\{EXTRA_INFO\}/g, ' data-bs-target="#' + ITEM_GROUP_PREFIX + mHash +'" data-level="'+depth+'" ')
											.replace( /#\{BI_CLASS\}/g, iconStr ) 
											.replace( /#\{CLASS_STR\}/g, 'cFileChooserFolder' ) 
											.replace( /#\{ICON_CLASS\}/g, FOLDER_ICON_CLASS ) 
											.replace( /#\{FOLDER_OPTIONS\}/g, folderOptions ) 
											.replace( /#\{NAME\}/g, entry.name ) 
											;
/*    	html = 
	      '<div role="treeitem" class="list-group-item py-0 border-0" style="padding-left:'+leftPadding+'" '+
        		' draggable="true" ondragstart="WebEJS_GUI.fileChooser_dragFunction(event)" ' +
		    		' data-path="'+entry.path+'" aria-level="'+depth+'" '+
						' data-bs-target="#' + ITEM_GROUP_PREFIX + mHash +'" data-level="'+depth+'"  >' +
		    	'<i class="state-icon pe-1 bi '+ iconStr +'"></i>'+
	  	  	'<span class="'+classStr+'"><i class="me-1 bi '+ FOLDER_ICON_CLASS+'"></i><span class="cFileChooserName">'+entry.name+'</span></span>'+   
	      '</div>';    
*/
		}
		else {
			var isExtensionAccepted = true;
			if (mExtensions!=null) {
				const re = /(?:\.([^.]+))?$/;
				const ext = re.exec(entry.path)[1]; 
				isExtensionAccepted = ext && mExtensions.includes(ext);
			}
			const classStr = isExtensionAccepted ? 'cFileChooserElement' : 'text-muted';
			const iconStr  = isExtensionAccepted ? FILE_ICON_CLASS : NON_FILE_ICON_CLASS;
			html =	 ITEM_HTML.replace( /#\{ID\}/g,   mModalID )
												.replace( /#\{PADDING\}/g, leftPadding ) 
												.replace( /#\{PATH\}/g, entry.path ) 
												.replace( /#\{DEPTH\}/g, depth ) 
												.replace( /#\{EXTRA_INFO\}/g, ' ')
												.replace( /#\{BI_CLASS\}/g, ITEM_ICON_CLASS ) 
												.replace( /#\{CLASS_STR\}/g, classStr ) 
												.replace( /#\{ICON_CLASS\}/g, iconStr ) 
												.replace( /#\{FOLDER_OPTIONS\}/g, '' ) 
												.replace( /#\{NAME\}/g, entry.name ) 
												;
/*			html = 
	    	'<div role="treeitem" class="list-group-item py-0 border-0" style="padding-left:'+leftPadding+'" '+
						' draggable="true" ondragstart="WebEJS_GUI.fileChooser_dragFunction(event)" ' +
						' data-path="'+entry.path+'"  aria-level="'+depth+'" >'+
		    	'<i class="state-icon pe-1 bi '+ ITEM_ICON_CLASS +'"></i>'+
	  	  	'<span class="'+classStr+'"><i class="me-1 bi '+ iconStr+'"></i><span class="cFileChooserName">'+entry.name+'</span></span>'+   
	      '</div>';    
*/
			added++;
		}
    parent.append($(html));
		if (isFolder) {
			const group = addGroupForItem(parent,mExpandedList.includes(entry.path));
			added++;
			mHash++;
			depth++;
			const children = entry['entries'];
	    for (var index=0; index<children.length; index++) {
	      var child = children[index];
				added += addFileItem(group,child,depth, mExtensions);
	    }
		}
		return added;
  }

	function updateTree(displayFolder) {
		if (!displayFolder.startsWith('/')) displayFolder = '/'+displayFolder;
		if (!displayFolder.endsWith('/')) displayFolder += '/';

		mExpandedList = [];
		$('#'+mModalID+ ' .'+EXPAND_ICON_CLASS).each(function() {
			const treeItem = $(this).closest('.list-group-item');
			mExpandedList.push(treeItem.data('path'));
		});
		
    mFileServer.refreshUserFiles(
      serverListing => { 
				mTree = { root_path : '/', root_entries : getTree(serverListing,'/') };
        displayTree(displayFolder); 
        displayBreadCrumb(displayFolder);
      },
      "Could not refresh files tree!"); 
  }

	// -----------------------
  // Display the breadcrumb
  // -----------------------

	function displayBreadCrumb(path) {
		path = stripPath(path);

		mBreadCrumb.empty();
		const folderNames = path.split('/');
		if (path.length<=0 || folderNames.length<=0 ) {
			mBreadCrumb.append($(	'<li class="breadcrumb-item sTranslatable active" href="#" data-path="/">'+
														mHomeLabel+
													'</li>'));
			return;
		}
		mBreadCrumb.append($( '<li class="breadcrumb-item sTranslatable" href="#" data-path="/">'+
														'<a href="#" >'+ mHomeLabel +'</a>'+
                        	'</li>'));
		var entries = mTree.root_entries;
		for (var i=0; i<folderNames.length; i++) {
			const folderName = folderNames[i];
			const folder = findFolderInEntries(folderName,entries);
			if (folder==null) return;
			var folderHtml;
			if (i==folderNames.length-1) folderHtml = 
				'<li class="breadcrumb-item active" aria-current="page" data-path="'+folder.path+'">'+
					folder.name+
				'</li>';
			else folderHtml = 
				'<li class="breadcrumb-item" href="#" data-path="'+folder.path+'">'+
					'<a href="#">'+ folder.name + '</a>'+
				'</li>';
			mBreadCrumb.append($(folderHtml));
			entries = folder.entries;
		}
		/*
		mBreadCrumb.find('a').click(function(event) {
			event.stopPropagation();
			const path = $(event.currentTarget).closest('li').data('path');
			displayTree(path);
			displayBreadCrumb(path);
		});
		*/
	}

	$(mBreadCrumb).on('click', 'a', function (event) {
    const treeItem = $(event.currentTarget).closest('.list-group-item');
		event.stopPropagation();
		mCurrentPath = $(event.currentTarget).closest('li').data('path');
		displayTree(mCurrentPath);
		displayBreadCrumb(mCurrentPath);
	});

	function getBasePath() {
		var path = mBreadCrumb.find('li.active').data('path')
		if (!path.endsWith('/')) path += '/';
		return path;
	}

  // -------------------
  // Display the filename
  // -------------------

	function getItemName(item) {
		const path = item.data('path');
		const pan = parentAndName(path,path.endsWith('/'));
		return(pan.name);
	}

	// Displays the filename
	function displayFilename(path) {
		if (mPurpose!=PURPOSE.WRITE) return;
		const isFolder = (path.endsWith('/'));
		if (isFolder) {
			$('#mFileChooserFilename').val('');
			return;
		}
		const pan = parentAndName(path,isFolder);
		$('#'+mModalID+' .filename_input').val(pan.name);
	}
	
	// -------------------
	// Main modal actions
  // -------------------

	$('#'+mModalID+' .cancel_button').click(function() {
		mModal.hide();
	});
  
	function pathExistsInTree(filepath) {
		const is_folder = filepath.endsWith('/');
	  const pan = parentAndName(filepath,is_folder);
	  var entries = findEntriesInPath(pan.parent);
	  if (entries==null) return false;
		for (var i=0; i<entries.length; i++) {
			if (pan.name==entries[i].name) return true; 
		}
		return false;
	}

	function checkOverwrite(path) {
		if (pathExistsInTree(path)) 
			sMainConfirmationForm.showWarning(path, "Existing file will be overwriten","Overwrite",
				function () { if (mListener) mListener(path); },
				function () { mModal.show(); }
			)
		else if (mListener) mListener(path);
	}

	$('#'+mModalID+' .ok_button').click(function() {
		if (mPurpose==PURPOSE.WRITE) {
			const filename = $('#'+mModalID+' .filename_input').val().trim();
			if (filename.length<=0) return;
			mModal.hide();
			checkOverwrite(getBasePath()+filename);
		}
		else if (mPurpose==PURPOSE.READ) {
			if (!mCurrentItem) return;
			mModal.hide();
			if (mListener) mListener(mCurrentItem.data('path'));
		}
		else {
			mModal.hide();
		}
	});

	$('#'+mModalID+' .folder_button').click(function() {
		mNewFolderTargetPath = getBasePath();
		mModal.hide();
		mFolderModal.show();
	});

	$('#'+mModalID+' .upload_button').click(function() {
		mModal.hide();
		mUploadBasepath = mCurrentPath;
		mUploadModal.show();
	});

	$('#'+mModalID+' .filename_input').change(function() {
		const filename = $('#'+mModalID+' .filename_input').val().trim();
		if (filename.length<=0) return;
		mModal.hide();
		checkOverwrite(getBasePath()+filename);
	});

	// -------------------
	// Menu items actions
  // -------------------

  $('#'+mModalID).on("click",'.cFileChooserMenuItem',(event)=>{
    const treeItem = $( event.target ).closest('.list-group-item');
    const action   = $( event.target ).data('action');
		const path = treeItem.data('path');
    console.log("Action "+action + " for path: "+path);
    switch (action) {
      case "Rename" :
				mModal.hide();
				mRenameModal.show();
				break;
			case "Duplicate" : duplicateCurrentItem(); break;
			case "Delete"    : deleteCurrentItem();    break;
			case "Subfolder"    :
				mNewFolderTargetPath = treeItem.data('path');
				mModal.hide();
				mFolderModal.show();
				break;
			case "Upload"    :
				mModal.hide();
				mUploadBasePath = mCurrentItem.data('path');
				mUploadModal.show();
				break;
			}
	});  

	// Rename actions

	$('#'+mModalID+'-rename_modal').on('show.bs.modal', function (event) {
		const name = getItemName(mCurrentItem);
		$('#'+mModalID+'-rename_name').val(name);
	});

	$('#'+mModalID+'-rename_modal .name_input').change(function() {
		rename();
	});

	$('#'+mModalID+'-rename_modal .ok_button').click(function() {
		rename();
	});

	function rename() {
		const new_name = $('#'+mModalID+'-rename_name').val().trim();
		const old_name = getItemName(mCurrentItem);

		if (new_name.length>0 && new_name!=old_name) {
			if (new_name.indexOf('/')>=0) {
				mRenameModal.hide();
				sMessageForm.showWarning('Error',"Name can not contain '/' characters!", 
				new_name, function() { mRenameModal.show(); });
				return;
			}
			const path = mCurrentItem.data('path'); // getBasePath()+old_name;
			const pan = parentAndName(path,path.endsWith('/'));
			if ((pan.parent == '/') && (new_name.startsWith('_'))) {
				mFolderModal.hide();
				sMessageForm.showWarning('Error',"Names of files in the root can not begin with the '_' character!", 
				new_name, function() { mRenameModal.show(); });
				return;
			}

			const new_path = pan.parent+new_name;
			if (pathExistsInTree(new_path)) {
				mRenameModal.hide();
				sMessageForm.showWarning('Error',"Name is taken!", 
				new_path, function() { mRenameModal.show(); });
				return;
			}
			mFileServer.userFileCommand({ command : 'Rename', path : path, new_path : new_path },
				function() { 
					updateTree(mCurrentPath); 
				});
		}
		$('#'+mModalID+'-rename_name').val('');
		mRenameModal.hide();
		mModal.show();
	};


	function duplicateCurrentItem() {
		const path = mCurrentItem.data('path');
		if (path=='/') return;
		var new_path;
		if (path.endsWith('/')) { // duplicate a directory
			const pathStripped = path.substring(0,path.length-1);
			new_path = pathStripped + ' copy/';
			var counter = 1;
			while (pathExistsInTree(new_path) && counter<1000) {
				new_path = pathStripped + ' copy '+(++counter)+'/';
			}
		}
		else {
			new_path = path + ' copy';
			var counter = 1;
			while (pathExistsInTree(new_path) && counter<1000) {
				new_path = path + ' copy '+(++counter);
			}
		}
		mFileServer.userFileCommand({ command : 'Duplicate', path : path, new_path : new_path },
			function() { 
				updateTree(mCurrentPath); 
			});
	}

	function deleteCurrentItem() {
		const path = mCurrentItem.data('path');
		if (path=='/') return;
		mModal.hide();
		sMainConfirmationForm.showWarning(
			mTranslate("Delete"), 
			mTranslate("WARNING!!! This action CANNOT be undone!!!")+'<br>'+path,
			mTranslate("Delete"),
			function(){
				mFileServer.userFileCommand({ command : 'Delete', path : path },
					function() { 
						updateTree(mCurrentPath); 
						mModal.show();
					});
				},
			function() { mModal.show(); }
		);
	};

	// ---- Upload action

	var mUploadData = null;
	var mUploadBasepath = '/';

	$('#'+mModalID+'-upload_input').change(function(event){
		const file = event.target.files[0];
		/*
		if (file.type && !file.type.startsWith('text/')) {
			mUploadModal.hide();
			sMessageForm.showWarning('Error',"File is not a text file!", 
				'', function() { mUploadModal.show(); });
			return;
		}
		*/
		const filename = $('#'+mModalID+'-upload_name').val().trim();
		if (filename.length<=0) $('#'+mModalID+'-upload_name').val(file.name);

		const reader = new FileReader();
		reader.readAsBinaryString(file)
		reader.onload = function () {
			mUploadData = btoa(reader.result);
		};
	});

	$('#'+mModalID+'-upload_modal .ok_button').click(function() {
		if (mUploadData==null) {
			mUploadModal.hide();
			sMessageForm.showWarning('Error',"No upload file specified!", 
					'', function() { mUploadModal.show(); });
			return;
		}
		const filename = $('#'+mModalID+'-upload_name').val().trim();
		if (filename.length<=0) return;
		if (filename.indexOf('/') >= 0) {
			mUploadModal.hide();
			sMessageForm.showWarning('Error', "File name can not contain '/' characters!",
			filename, function () { mUploadModal.show(); });
			return;
		}
		if ((mUploadBasepath == '/') && (filename.startsWith('_'))) {
			mUploadModal.hide();
			sMessageForm.showWarning('Error',"Names of files in the root can not begin with the '_' character!", 
			filename, function() { mUploadModal.show(); });
			return;
		}

		//const fullPath = mCurrentItem.data('path') + filename;
		const fullPath = mUploadBasepath + filename;
		console.log("Want to upload file: " + fullPath);
		if (pathExistsInTree(fullPath)) {
			mUploadModal.hide();
			sMainConfirmationForm.showWarning(
				mTranslate("Upload"), 
				mTranslate("WARNING!!! Existing file will be overwriten!!!")+'<br>'+fullPath,
				mTranslate("Overwrite"),
				function () { uploadData(fullPath); },
				function () { mUploadModal.show(); });
		}
		else uploadData(fullPath);
	});

	function uploadData(path) {
		mFileServer.userFileCommand({ command : 'Upload', path : path, data : mUploadData },
			function() { 
				updateTree(mCurrentPath); 
			});
		$('#'+mModalID+'-upload_name').val('');
		$('#'+mModalID+'-upload_input').val('');
		mUploadData = null;
		mUploadModal.hide();
		mModal.show();
	}

	// ---- Subfolder actions

	var mNewFolderTargetPath = '/';

	$('#'+mModalID+'-new_folder_modal .ok_button').click(function() {
		const foldername = $('#'+mModalID+'-new_folder_name').val().trim();
		if (foldername.length>0) {
			if (foldername.indexOf('/')>=0) {
				mFolderModal.hide();
				sMessageForm.showWarning('Error',"Folder name can not contain '/' characters!", 
				foldername, function() { mFolderModal.show(); });
				return;
			}
			if ((mNewFolderTargetPath == '/') && (foldername.startsWith('_'))) {
				mFolderModal.hide();
				sMessageForm.showWarning('Error',"Names of root folders can not begin with the '_' character!", 
				foldername, function() { mFolderModal.show(); });
				return;
			}
			const fullPath = mNewFolderTargetPath+foldername;
			mFileServer.userFileCommand({ command : 'NewFolder', path : fullPath },
				function(params) { 
					updateTree(mCurrentPath); //params['final_path']); 
				});
		}
		$('#'+mModalID+'-new_folder_name').val('');
		mFolderModal.hide();
		mModal.show();
	});

	// --------------------
	// Drag and drop
	// --------------------

	  // --- Dragging and dropping on an element
  
		$('#'+mModalID).on('dragenter', '.list-group-item,.breadcrumb-item', function (event) {
			event.preventDefault(); 
			var target = $(event.currentTarget);
			console.log('Currenttarget:');
			console.log(target);
			console.log(target.attr('class'));
			if (!target.hasClass('breadcrumb-item')) {
				
			target = target.closest('.list-group-item');
			}
			if (target.data('path').endsWith('/')) target.addClass('bg-warning');
		});
		
		$('#'+mModalID).on('dragover', '.list-group-item,.breadcrumb-item', function (event) {
			event.preventDefault(); 
			var target = $(event.currentTarget);
			if (!target.hasClass('breadcrumb-item')) target = target.closest('.list-group-item');
			if (target.data('path').endsWith('/')) target.addClass('bg-warning');
		});
		
		$('#'+mModalID).on('dragleave', '.list-group-item,.breadcrumb-item', function (event) {
			event.preventDefault(); 
			var target = $(event.currentTarget);
			if (!target.hasClass('breadcrumb-item')) target = target.closest('.list-group-item');
			target.removeClass('bg-warning');
		});
		
		$('#'+mModalID).on('drop', '.list-group-item,.breadcrumb-item', function (event) {
			var info = event.originalEvent.dataTransfer.getData("text");
			if (!info.startsWith(WebEJS_GUI.fileChooser_drag_prefix)) return;
			info = info.substring(WebEJS_GUI.fileChooser_drag_prefix.length);
			event.preventDefault();
			var target = $(event.currentTarget);
			if (!target.hasClass('breadcrumb-item')) target = target.closest('.list-group-item');
			target.removeClass('bg-warning')
			const path = target.data('path');
			console.log("Element "+ path  +  " received: "+info);
			mFileServer.userFileCommand({ command : 'Move', path : info, folder : path },
				function() { 
					updateTree(mCurrentPath); 
				});
		});

	// -------------------
	// Treeitems actions
  // -------------------

	
	// --- Expanding/collapsing a parent node
	$(mTreeDiv).on('click', '.state-icon', function (event) {
	    var icon = $(event.currentTarget);
	    if (icon.hasClass(ITEM_ICON_CLASS)) return;
	    icon.toggleClass(EXPAND_ICON_CLASS).toggleClass(COLLAPSE_ICON_CLASS);
	    const treeItem = $(event.currentTarget).closest('.list-group-item');
	    // Toggle the data-bs-target. Issue with Bootstrap toggle and dynamic code
	    $(treeItem.attr("data-bs-target")).collapse('toggle');
	});
	  
	$(mTreeDiv).on('dblclick', '.cFileChooserFolder', function (event) {
		const folderItem = $(event.currentTarget);
		const icon = folderItem.closest('.state-icon');
	  icon.toggleClass(EXPAND_ICON_CLASS).toggleClass(COLLAPSE_ICON_CLASS);
		const treeItem = folderItem.closest('.list-group-item');
	  $(treeItem.attr("data-bs-target")).collapse('toggle');
		mCurrentPath = treeItem.data('path');
		displayTree(mCurrentPath);
		displayBreadCrumb(mCurrentPath);
		mCurrentItem = null;
		displayFilename('/'); // that is, empty it
  });

	  // --- clicking on an element
		$(mTreeDiv).on('click', '.cFileChooserFolder', function (event) {
			if (mPurpose!=PURPOSE.MANAGER) return;
			const folderItem = $(event.currentTarget).closest('.list-group-item');
			//const folderItem = $(event.currentTarget);
			if (mCurrentItem) mCurrentItem.removeClass('bg-info');
			mCurrentItem = folderItem;
			mCurrentItem.addClass('bg-info');
			const path = folderItem.data('path');
			displayFilename(path)
		});
	
  // --- clicking on an element
  $(mTreeDiv).on('click', '.cFileChooserElement', function (event) {
    const treeItem = $(event.currentTarget).closest('.list-group-item');
		if (mCurrentItem) mCurrentItem.removeClass('bg-info');
		mCurrentItem = treeItem;
		mCurrentItem.addClass('bg-info');
	  const path = treeItem.data('path');
		displayFilename(path)
  });

  // --- double-clicking on an element
  $(mTreeDiv).on('dblclick', '.cFileChooserElement', function (event) {
		if (mPurpose==PURPOSE.MANAGER) return;
		mModal.hide();
	  const treeItem = $(event.currentTarget).closest('.list-group-item');
	  const path = treeItem.data('path');
		if (mPurpose==PURPOSE.WRITE) checkOverwrite(path);
		else mListener(path);
  });

	return self;
}


	
	
	
	/*
 * Copyright (C) 2021 Francisco Esquembre
 * This code is part of the Web EJS authoring and simulation tool
 * 2023 08 This code is adapted from the IODA graphic data analysis tool
 * (of the same author)
 */

/**
 * GUI forms
 * @module core
 */
var WebEJS_GUI = WebEJS_GUI || {};

WebEJS_GUI.getTranslateAll = function(mTranslator) {
	if (typeof mTranslator != 'undefined') return mTranslator.translateAll;
	return function (selector) {
		$(selector + ' .sTranslatable').each(function() { 
			const original = $(this).data('_locale_original_text');
			if (original) $(this).text('(en) ' + original);
			else {
				const text = $(this).text();
				$(this).data('_locale_original_text',text);
				$(this).text('(en) ' +text); 
			} 
		});
	}
}

WebEJS_GUI.MODAL_TEMPLATE = `
<div id="#{ID}" class="modal fade"
	data-bs-backdrop="static" data-bs-keyboard="false" tabindex="-1" aria-hidden="true">	

<div class="modal-dialog modal-dialog-centered">
	<div class="modal-content">

	<div class="modal-header bg-light text-dark">
	   <img  src="#{LOGO}" height="40" class="me-2 d-inline-block align-bottom;">
	   <h5 class="ps-2 sTranslatable text-primary modal-title">#{TITLE}</h5>
	   <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
	</div>
	<div class="modal-body">
		#{BODY_HTML}
	</div>
		<div class="modal-footer">
		   <button type="button" class="sTranslatable btn btn-secondary me-auto" data-bs-target="##{ID}" data-bs-toggle="modal">Cancel</button>
		   #{FOOTER_HTML}
	   </div>
   </div>
</div>
</div>
`;

WebEJS_GUI.filenameForm = function(mTranslator) {
	var self = {};
	var mModalID = "webEJSFilenameFormModal";

	const mTranslateAll = WebEJS_GUI.getTranslateAll(mTranslator);

	const bodyHtml = `
		<div class="input-group mb-3">
			<span  id="#{ID}-label" class="sTranslatable input-group-text">Filename</span>
			<input id="#{ID}-name"  type="text" class="filename_input form-control" 
				placeholder="New name here" aria-label="Folder name" aria-describedby="#{ID}-label">
		</div>`
		.replace( /#\{ID\}/g,   mModalID );

	const footerHtml = `
		<button type="button" class="ok_button sTranslatable btn btn-primary">Download</button>
		`;

	var MODAL_HTML = WebEJS_GUI.MODAL_TEMPLATE
		.replace( /#\{ID\}/g,   mModalID )
		.replace( /#\{LOGO\}/g,   sMainEjsLogo )
		.replace( /#\{TITLE\}/g,  'Choose ZIP filename' )
		.replace( /#\{BODY_HTML\}/g,  bodyHtml )
		.replace( /#\{FOOTER_HTML\}/g,  footerHtml )
		;
	
	$('body').append($(MODAL_HTML) );
	const mModal   = new bootstrap.Modal(document.getElementById(mModalID));
	
	$('#'+mModalID).on('show.bs.modal', function (event) { mTranslateAll('#'+mModalID); });

  // --------------------
  // Variables
  // --------------------

	var mListener;

	$('#'+mModalID+' .cancel_button').click(function() {
		mModal.hide();
	});

	
	$('#'+mModalID+' .ok_button').click(function() {
		const filename = $('#'+mModalID+' .filename_input').val().trim();
		if ( filename == "" || filename == null) return;
		mModal.hide();
		if (mListener) mListener(filename);
	});

	
	self.show = function(filename, listener) {
		$('#'+mModalID+' .filename_input').val(filename);
		mListener = listener;
		mModal.show();
	}
	
	return self;
}
var WebEJS_GUI = WebEJS_GUI || {};

/**
* Creates a form to ask for a new name
*/
WebEJS_GUI.confirmationForm = function() {
	var self = {};
  
  const _HTML = `
  <div class="modal fade" id="mConfirmationFormModal" data-bs-backdrop="static" data-bs-keyboard="false" tabindex="-1" aria-hidden="true">
		
	<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
		
		<div class="modal-content">
      	
			<div class="modal-header bg-light text-dark">
    		<img id="mConfirmationFormLogo" height="40" class="me-2 d-inline-block align-bottom;">
      		<h5 id="mConfirmationFormTitle" class="sTranslatable text-primary modal-title">Confirmation</h5>
      		<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
    	</div>  


    	<!------------------  end modal header --------------->

			<div id="mConfirmationFormMessage" class="modal-body">
				<p>Do you really want to do this?</p>
			</div>
      	
    	<!------------------  end modal body --------------->
		
			<div class="modal-footer">
				<button type="button" id="mConfirmationFormCloseButton" class="btn btn-secondary me-auto">Oops! Please cancel</button>
				<button type="button" id="mConfirmationFormOkButton" 		class="btn btn-primary">Confirm</button>
			</div>

    	<!------------------  end modal footer --------------->

		</div>
		<!------------------  end modal content --------------->
		
	</div>	
	<!------------------  end modal-dialog --------------->

</div>
<!------------------  end modal --------------->
`;

  $( "body" ).append( $(_HTML) );
	var mModal = new bootstrap.Modal(document.getElementById('mConfirmationFormModal'))
  $('#mConfirmationFormLogo').attr("src",sMainEjsLogo);
	var mAcceptListener;
	var mRejectListener;
	var mAccepted = false;

	$("#mConfirmationFormModal").on("hidden.bs.modal", function () {
		if (mAccepted) mAcceptListener();
		else if (mRejectListener) mRejectListener();
	});
	
	$('#mConfirmationFormCloseButton').click(function() {
		mModal.hide();
	});
	
	$('#mConfirmationFormOkButton').click(function() {
		mAccepted = true;
		mModal.hide();
	});


	self.showWarning = function(title, questionStr, doItStr, onAccept, onReject) { // listener}, text, message, title) {
		const questionHtml = '<p>'+sMainResources.getString(questionStr)+'</p>';
		displayHtml(title, "text-danger", questionHtml, doItStr, onAccept, onReject);
	}

	self.show = function(title, questionStr, doItStr, onAccept, onReject) { // listener}, text, message, title) {
		const questionHtml = '<p>'+sMainResources.getString(questionStr)+'</p>';
		displayHtml(title, "text-primary", questionHtml, doItStr, onAccept, onReject);
	}

	self.showHtml = function(title, questionHtml, doItStr, onAccept, onReject) { // listener, text, message, title) {
		displayHtml(title, "text-primary", questionHtml, doItStr, onAccept, onReject);
	}

	function displayHtml(title, titleClass, questionHtml, doItStr, onAccept, onReject) { // listener, text, message, title) {
		$('#mConfirmationFormTitle').text(title);
		$('#mConfirmationFormTitle').removeClass(["text-primary","text-danger"]).addClass(titleClass);
		$('#mConfirmationFormMessage').html(questionHtml);
		$('#mConfirmationFormOkButton').text(sMainResources.getString(doItStr));
		mAcceptListener = onAccept;
		mRejectListener = onReject;
		mAccepted = false;
		mModal.show();
	}


	return self;
}var WebEJS_GUI = WebEJS_GUI || {};

/**
 * Creates a form to ask for a new name
*/
WebEJS_GUI.customElementForm = function() {
 var self = {};

 const _HTML = `
<div class="modal fade" id="mCustomElementFormModal" data-bs-backdrop="static" data-bs-keyboard="false" tabindex="-1" aria-hidden="true">
		
	<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
		
		<div class="modal-content">
      	
			<div class="modal-header bg-light text-dark">
    		<img id="mCustomElementFormLogo" height="40" class="me-2 d-inline-block align-bottom;">
      		<h5 class="sTranslatable text-primary modal-title">Add custom element</h5>
				</img>
      	<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
    	</div>  
    	<!------------------  end modal header --------------->

			<div class="modal-body">
				<div class="mb-2">
					<label id="mCustomElementFormNameLabel" for="mCustomElementFormNameValue" class="sTranslatable form-label form-label-sm">Name</label>
					<input type="text" class="form-control form-control-sm" name="mCustomElementFormNameValue" id="mCustomElementFormNameValue"
						placeholder="Enter name here" >
				</div>
	       <div class="input-group mb-3">
	         <label class="input-group-text sTranslatable" for="mCustomElementFormIconField" class="form-label">Click to choose a (24x24) icon</label>
	         <label class="input-group-text bg-white" id="mCustomElementFormIconButton">
	           <img id="mCustomElementFormIconImage" width="24" height="24">
	         </label>
         <input class="form-control d-none" accept="image/*"  id="mCustomElementFormIconField" type="file">
       </div>
			</div>
      	
    	<!------------------  end modal body --------------->
		
			<div class="modal-footer">
				<button type="button" id="mCustomElementFormCancelButton" class="sTranslatable btn btn-secondary me-auto" data-dismiss="modal">Cancel</button>
				<button type="button" id="mCustomElementFormOkButton" class="sTranslatable btn btn-primary float-left">OK</button>
			</div>

    	<!------------------  end modal footer --------------->

		</div>
		<!------------------  end modal content --------------->
		
	</div>	
	<!------------------  end modal-dialog --------------->

</div>
<!------------------  end modal --------------->
`

  $("body").append($(_HTML));

  var mModal = new bootstrap.Modal(document.getElementById('mCustomElementFormModal'))
  $('#mCustomElementFormLogo').attr("src", sMainEjsLogo);
  var mListener;

  $('#mCustomElementFormIconField').change(function (event) {
    $('#mCustomElementFormIconImage').attr("src", URL.createObjectURL(event.target.files[0]));
  });

  $('#mCustomElementFormCancelButton').click(function () {
    mModal.hide();
  });

  $('#mCustomElementFormOkButton').click(function () {
    var name = $('#mCustomElementFormNameValue').val().trim();
    if (name == "" || name == null) {
      alert("Name field is required!");
      return;
    }
    var icon = $('#mCustomElementFormIconField').val().trim();
    if (icon == "" || icon == null) {
      alert("An icon is required!");
      return;
    }
    mModal.hide();
    if (mListener) mListener(name, WebEJS_TOOLS.getBase64("mCustomElementFormIconImage"));
  });

  self.show = function (listener) {
    //$('#mCustomElementFormNameValue').val(name); 
    mListener = listener;
    mModal.show();
  }

  return self;
}
var WebEJS_GUI = WebEJS_GUI || {};

/**
	* Creates a form to ask for a new name
 */
WebEJS_GUI.inputForm = function() {
	var self = {};

  const _HTML = `
  <div class="modal fade" id="mInputFormModal" data-bs-backdrop="static" data-bs-keyboard="false" tabindex="-1" aria-hidden="true">
      
    <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
      
      <div class="modal-content">
          
        <div class="modal-header bg-light text-dark">
          <img id="mInputFormLogo" height="40" class="me-2 d-inline-block align-bottom;">
            <h5 id="mInputFormTitle" class="sTranslatable text-primary modal-title">Input</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>  
        <!------------------  end modal header --------------->
  
        <div class="modal-body">
          <div id="mInputFormInputDiv" class="mb-2">
            <label id="mInputFormInputLabel" for="mInputFormInput" class="sTranslatable form-label">Value</label>
            <input type="text" class="form-control" name="mInputFormInput" id="mInputFormInput"
              placeholder="Enter value here" >
          </div>
          <div id="mInputFormAreaDiv" class="mb-2 d-none">
            <label     id="mInputFormAreaLabel" for="mInputFormArea" class="sTranslatable form-label">Value</label>
            <textarea  id="mInputFormArea" name="mInputFormInput"    class="form-control" style="height: 100px"></textarea>
          </div>
        </div>
          
        <!------------------  end modal body --------------->
      
        <div class="modal-footer">
          <button type="button" id="mInputFormCancelButton" class="sTranslatable btn btn-secondary me-auto" data-dismiss="modal">Cancel</button>
          <button type="button" id="mInputFormOkButton" class="sTranslatable btn btn-primary float-left">OK</button>
        </div>
  
        <!------------------  end modal footer --------------->
  
      </div>
      <!------------------  end modal content --------------->
      
    </div>	
    <!------------------  end modal-dialog --------------->
  
  </div>
  <!------------------  end modal --------------->
  `;

  $( "body" ).append( $(_HTML) );  
  var mModal = new bootstrap.Modal(document.getElementById('mInputFormModal'));
  $('#mInputFormLogo').attr("src",sMainEjsLogo);
	var mValueField;
	var mListener;
	var returnEmptyValue=false;

	$('#mInputFormCancelButton').click(function() {
		mModal.hide();
	});

  $('#mInputFormInput').change(function() {
    mModal.hide();
    var value = $('#mInputFormInput').val().trim(); 
    if (!mAcceptEmptyValue) {
	    if ( value == "" || value == null) return;
    } 
    if (mListener) mListener(value);
  });
  
  $('#mInputFormArea').change(function() {
	  mModal.hide();
	  var value = $('#mInputFormArea').val().trim(); 
	  if (!mAcceptEmptyValue) {
		  if ( value == "" || value == null) return;
	  } 
	  if (mListener) mListener(value);
	});

	
	$('#mInputFormOkButton').click(function() {
		mModal.hide();
		var value = mValueField.val().trim(); 
	  if (!mAcceptEmptyValue) {
		  if ( value == "" || value == null) return;
	  } 
		if (mListener) mListener(value);
	});
	
	self.show = function(title, label, value, listener, acceptEmptyValue) {
    $('#mInputFormInputDiv').removeClass("d-none");
    $('#mInputFormAreaDiv').addClass("d-none");
    $('#mInputFormTitle').text(sMainResources.getString(title));
    $('#mInputFormInputLabel').text(sMainResources.getString(label));
    mValueField = $('#mInputFormInput');
    mValueField.val(value); 
		mListener = listener;
		mAcceptEmptyValue = acceptEmptyValue;
		mModal.show();
	}

	self.showArea = function(title, label, value, listener, acceptEmptyValue) {
	    $('#mInputFormInputDiv').addClass("d-none");
	    $('#mInputFormAreaDiv').removeClass("d-none");
	    $('#mInputFormTitle').text(sMainResources.getString(title));
	    $('#mInputFormAreaLabel').text(sMainResources.getString(label));
	    mValueField = $('#mInputFormArea');
	    mValueField.val(value); 
			mListener = listener;
			mAcceptEmptyValue = acceptEmptyValue;
			mModal.show();
		}

	return self;
}var WebEJS_GUI = WebEJS_GUI || {};

/**
 * Creates a form to ask for a new name
 */
WebEJS_GUI.messageForm = function() {
  var self = {};
  var mTemporalCanShow = true;
  var mIsVisible = false;
  var mListener = null;

  const _HTML = `
<div class="modal fade" id="mMessageFormModal" data-bs-backdrop="static" data-bs-keyboard="false" tabindex="-1" aria-hidden="true">
		
	<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
		
		<div class="modal-content">
      	
			<div class="modal-header bg-light text-dark">
    		<img id="mMessageFormLogo" height="40" class="me-2 d-inline-block align-bottom;">
      		<h5 id="mMessageFormTitle" class="text-primary modal-title">WebEJS Message</h5>
      	<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
    	</div>  
    	<!------------------  end modal header --------------->

			<div class="modal-body">
				<div class="mb-2">
		    	<div id="mMessageFormText" class="modal-body">
		      	<p>Message from WebEJS</p>
		    	</div>
				</div>
			</div>
      	
    	<!------------------  end modal body --------------->
		
			<div class="modal-footer">
				<button type="button" id="mMessageFormCloseButton" class="sTranslatable btn btn-primary float-left">Close</button>
			</div>

    	<!------------------  end modal footer --------------->

		</div>
		<!------------------  end modal content --------------->
		
	</div>	
	<!------------------  end modal-dialog --------------->

</div>
<!------------------  end modal --------------->
`;

  $( "body" ).append( $(_HTML) );
  var myModalEl = document.getElementById('mMessageFormModal');

  var mModal = new bootstrap.Modal(myModalEl);
  $('#mMessageFormLogo').attr("src",sMainEjsLogo);

  myModalEl.addEventListener('shown.bs.modal', function (event) {
    mIsVisible = true;
  });

  myModalEl.addEventListener('hidden.bs.modal', function (event) {
    mIsVisible = false;
	if (mListener) mListener();
	mListener = null;
	});
 
  $('#mMessageFormCloseButton').click(function() {
    mModal.hide();
  });


  self.hide = function() {
	 if (mIsVisible) mModal.hide();
   else window.setTimeout(function() { mModal.hide(); }, 500); 
  }

  self.show = function(title, firstLine, secondLine) {
 	displayText(title, "text-primary", sMainResources.getString(firstLine), sMainResources.getString(secondLine));
  }

  self.showTemporal = function(title, firstLine, secondLine) {
    displayText(title, "text-primary", firstLine, sMainResources.getString(secondLine));
  }

  self.showRaw = function(title, firstLine, secondLine) {
 	displayText(title, "text-primary", firstLine, sMainResources.getString(secondLine));
  }

  self.showAllRaw = function(title, html) {
    $('#mMessageFormTitle').text(title);
    $('#mMessageFormTitle').removeClass("text-danger").addClass("text-primary");
    $('#mMessageFormText').html(html);
    mModal.show();
  }

	self.showWarning = function(title, firstLine, secondLine, listener) {
		mListener = listener;
		displayText(title, "text-danger", sMainResources.getString(firstLine), sMainResources.getString(secondLine));
	}

	self.showWarningRaw = function(title, firstLine, secondLine) {
		displayText(title, "text-danger", firstLine, sMainResources.getString(secondLine));
	}

	self.showHTML = function(title, html) {
		displayHTML(title,"text-primary",html);
	}

	self.showWarningHTML = function(title, html) {
		displayHTML(title,"text-danger",html);
	}
	
	function displayText(title, titleClass, firstLine, secondLine) {
		var html = '<p>'+firstLine+'</p>';
		if (secondLine) html += '<p class="'+titleClass+'"><small>'+secondLine+'<small></p>';
		displayHTML(title,titleClass, html);
	}
	
	function displayHTML(title, titleClass, html) {
		$('#mMessageFormTitle').text(sMainResources.getString(title));
		$('#mMessageFormTitle').removeClass(["text-primary","text-danger"]).addClass(titleClass);
	  $('#mMessageFormText').html(html);
	  mModal.show();
	}

 return self;
}
var WebEJS_GUI = WebEJS_GUI || {};

/**
* Creates a form to ask for a new name
*/
WebEJS_GUI.responseForm = function() {
	var self = {};

  const _HTML = `
<div class="modal fade" id="mResponseFormModal" data-bs-backdrop="static" data-bs-keyboard="false" tabindex="-1" aria-hidden="true">
		
	<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
		
		<div class="modal-content">
      	
			<div class="modal-header bg-light text-dark">
    		<img id="mResponseFormLogo" height="40" class="me-2 d-inline-block align-bottom;">
      	<h5 id="mResponseFormTitle" class="sTranslatable text-primary modal-title">Response</h5>
      	<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
    	</div>  


    	<!------------------  end modal header --------------->

			<div id="mResponseFormMessage" class="modal-body">
				<p>Do you really want to do this?</p>
			</div>
      	
    	<!------------------  end modal body --------------->
		
			<div class="modal-footer">
				<button type="button" id="mResponseFormCloseButton" class="btn btn-secondary me-auto">Oops! Please cancel</button>
				<button type="button" id="mResponseFormOkButton" 		class="btn btn-primary">Confirm</button>
			</div>

    	<!------------------  end modal footer --------------->

		</div>
		<!------------------  end modal content --------------->
		
	</div>	
	<!------------------  end modal-dialog --------------->

</div>
<!------------------  end modal --------------->
`;

  $( "body" ).append( $(_HTML) );
	var mModal = new bootstrap.Modal(document.getElementById('mResponseFormModal'))
  $('#mResponseFormLogo').attr("src",sMainEjsLogo);
	var mAcceptListener;
	var mRejectListener;
	var mAccepted = false;

	$("#mResponseFormModal").on("hidden.bs.modal", function () {
		if (mAccepted) mAcceptListener();
		else if (mRejectListener) mRejectListener();
	});
	
	$('#mResponseFormCloseButton').click(function() {
		mModal.hide();
	});
	
	$('#mResponseFormOkButton').click(function() {
		mAccepted = true;
		mModal.hide();
	});
	
	self.show = function(title, response, doItStr, onAccept, onReject) { // listener}, text, message, title) {
		$('#mResponseFormTitle').text(title);
		$('#mResponseFormMessage').html(response);
		$('#mResponseFormOkButton').text(sMainResources.getString(doItStr));
		mAcceptListener = onAccept;
		mRejectListener = onReject;
		mAccepted = false;
		mModal.show();
	}
	
	return self;
}
var WebEJS_GUI = WebEJS_GUI || {};

/**
 * Offers a list of options of the form
				var options = [
					{ name : "_isPlaying()", value : "%_isPlaying%", description : "is playing" },
					{ name : "_isPaused()", value : "%_isPaused%", description : "is paused" }
				];
 * from which the user select its 'value' for inclusion in the editor.
 * If value is not present, the name is used, instead
 */
WebEJS_GUI.selectChoiceForm = function() {
	var self = {};
	const selectedClass = "border border-dark rounded";
	const selectedClassShort = "border";

  const _HTML = `
<div class="modal fade" id="mSelectChoiceFormModal" data-bs-backdrop="static" data-bs-keyboard="false" tabindex="-1" aria-hidden="true">
		
	<div id= "mSelectChoiceFormModalDiv" class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
		
		<div class="modal-content">
      	
			<div class="modal-header bg-light text-dark">
    		<img id="mSelectChoiceFormLogo" height="40" class="me-2 d-inline-block align-bottom;">
      		<h5 id="mSelectChoiceFormTitle" class="sTranslatable text-primary modal-title">Select one</h5>
      	<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
    	</div>  

    	<!------------------  end modal header --------------->

			<div class="modal-body">
				<div id="mSelectChoiceFormList" class="list-group">
				</div>
			</div>
      	
    	<!------------------  end modal body --------------->
	
			<div class="modal-footer">
				<span class="flex flex-grow input-group input-group-sm mt-1"> 
				  <span class="sTranslatable input-group-text">Value</span> 
					   <input id="mSelectChoiceFormValue"  type="text" class="flex flex-grow form-control"   
						 placeholder="<Type in or click on an option>" aria-label="Value"   
							spellcheck="off" autocorrect="off" autocapitalize="none" autocomplete="off" 
							value=""> 
					 <button id= "mSelectChoiceFormCancelButton" class="sTranslatable btn btn-outline-secondary me-auto" type="button">Cancel</button>
					 <button id= "mSelectChoiceFormOkButton"     class="sTranslatable btn btn-outline-primary "  type="button">OK</button> 
				 </span>

			</div>

    	<!------------------  end modal footer --------------->

		</div>
		<!------------------  end modal content --------------->
		
	</div>	
	<!------------------  end modal-dialog --------------->

</div>
<!------------------  end modal --------------->
`;

  $( "body" ).append( $(_HTML) );

	var mModal = new bootstrap.Modal(document.getElementById('mSelectChoiceFormModal'))
  $('#mSelectChoiceFormLogo').attr("src",sMainEjsLogo);

	var mCurrentChoice;
	var mListener;

	function getHtml(options, currentValue){
		var html = '';
    var strippedValue = currentValue;
    if (strippedValue.startsWith('"')) strippedValue = strippedValue.substring(1,strippedValue.length-1);
    if (options.length<=0) {
      html += '<div class="m-1 text-secondary">'+sLocaleFor('(No choices available)')+'</div>';
    }
		else for (var index=0; index<options.length; index++) {
			const option = options[index];
			const styleClass = ('style' in option) ? option.style : 'text-primary';
			if (!('value' in option)) option.value = option.name;
			var bgTag = '';
			if (option.value==currentValue) bgTag = selectedClass;
			else if ('old_names' in option && strippedValue.length>0) {
				if (option['old_names'].indexOf(strippedValue)>=0) bgTag = selectedClass;
			} 
			html += 
					'<button type="button" class="p-0 list-group-item list-group-item-action cSelectChoiceFormOptionChosen '+bgTag+'"'+
						' data-index="'+index+'" >'+
						(('icon' in option) ? option.icon : '') +
						'<span class="ps-1 cSelectChoiceFormOptionName '+styleClass+'"></span>'+
						(('description' in option) ? ' : '+ option.description : '')+
					'</button>';
		}			
		return html;
	}

	self.show = function(title, options, currentValue, listener, modalClass, disableInput)  {
		mListener = listener;
		
		$("#mSelectChoiceFormModalDiv").removeClass('modal-sm modal-lg modal-xl');
		if (modalClass) $("#mSelectChoiceFormModalDiv").addClass(modalClass);

		$('#mSelectChoiceFormTitle').text(sMainResources.getString(title));
		$('#mSelectChoiceFormList').html(getHtml(options,currentValue));
		$('#mSelectChoiceFormValue').val(currentValue);
		if (disableInput) $('#mSelectChoiceFormValue').attr('readonly', true);
		else $('#mSelectChoiceFormValue').attr('readonly', false);

		const selected = $('#mSelectChoiceFormList .'+selectedClassShort);
		if (selected.length>0) mCurrentChoice = selected.first();
		else mCurrentChoice = null;
		
		$('#mSelectChoiceFormModal .cSelectChoiceFormOptionChosen').click((event)=>{
			if (mCurrentChoice) mCurrentChoice.removeClass(selectedClass);
			mCurrentChoice = $( event.target ).closest('.cSelectChoiceFormOptionChosen');
			mCurrentChoice.addClass(selectedClass);
			var choice = options[mCurrentChoice.data('index')].value;
			$('#mSelectChoiceFormValue').val(choice);
		});		
		
		$('#mSelectChoiceFormModal .cSelectChoiceFormOptionChosen').dblclick((event)=>{
			mModal.hide();
			const index = $( event.target ).closest('.cSelectChoiceFormOptionChosen').data('index');
			mListener(options[index].value);
		});		

		$('#mSelectChoiceFormModal .cSelectChoiceFormOptionName').each(function() {
			const index = $( this ).closest('.cSelectChoiceFormOptionChosen').data('index');
		  $(this).text(options[index].name);
		});

		mModal.show(); 
	}

	$('#mSelectChoiceFormValue').change((event)=>{
		mModal.hide();
		mListener($('#mSelectChoiceFormValue').val().trim());
	});		

	$('#mSelectChoiceFormOkButton').click((event)=>{
		mModal.hide();
		mListener($('#mSelectChoiceFormValue').val().trim());
	});		
	
	$('#mSelectChoiceFormCancelButton').click((event)=>{
		mModal.hide();
	});		

	return self;
}
var WebEJS_GUI = WebEJS_GUI || {};

/**
 * Offfers a list of options of the form
 *		[{ 'name' : "_play()",  'description' : "Play the simulation"},...]
 * from which the user select its 'name' for inclusion in the editor
 */
WebEJS_GUI.selectCodeForm = function() {
	var self = {};

  const _HTML = `
<div class="modal fade" id="mSelectCodeFormModal" data-bs-backdrop="static" data-bs-keyboard="false" tabindex="-1" aria-hidden="true">
		
	<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
		
		<div class="modal-content">
      	
			<div class="modal-header bg-light text-dark">
    		<img id="mSelectCodeFormLogo" height="40" class="me-2 d-inline-block align-bottom;">
      		<h5 id="mSelectCodeFormTitle" class="sTranslatable text-primary modal-title">Select code</h5>
      	<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
    	</div>  

    	<!------------------  end modal header --------------->

			<div class="modal-body">
				<div id="mSelectCodeFormList" class="list-group">
				</div>
			</div>
      	
    	<!------------------  end modal body --------------->
	
			<div class="modal-footer">
				<span class="flex flex-grow input-group input-group-sm mt-1"> 
				  <span class="sTranslatable input-group-text">Method</span> 
					   <input id="mSelectCodeFormValue"  type="text" class="flex flex-grow form-control"   
						 placeholder="<Type in or click on a method>" aria-label="Variable"   
						 value=""> 
					 <button id= "mSelectCodeFormCancelButton" class="sTranslatable btn btn-outline-secondary me-auto" type="button">Cancel</button>
					 <button id= "mSelectCodeFormOkButton"     class="sTranslatable btn btn-outline-primary "  type="button">OK</button> 
				 </span>
			</div>

    	<!------------------  end modal footer --------------->

		</div>
		<!------------------  end modal content --------------->
		
	</div>	
	<!------------------  end modal-dialog --------------->

</div>
<!------------------  end modal --------------->
`;

  $( "body" ).append( $(_HTML) );
	var mModal = new bootstrap.Modal(document.getElementById('mSelectCodeFormModal'))
  $('#mSelectCodeFormLogo').attr("src",sMainEjsLogo);

	var mCodeEditor;
	var mTarget;
	
	$('#mSelectCodeFormOkButton').click((event)=>{
		mModal.hide();
		const value = $('#mSelectCodeFormValue').val().trim();
		if (value.length>0) {
			mCodeEditor.session.insert(mCodeEditor.getCursorPosition(), value);
			mTarget.reportableChange();
		}
	});		
	
	$('#mSelectCodeFormCancelButton').click((event)=>{
		mModal.hide();
	});		

	self.show = function(title, codeOptions, codeEditor, target) {
		mCodeEditor = codeEditor;
		mTarget = target;
		
		$('#mSelectCodeFormTitle').text(sMainResources.getString(title));
		$('#mSelectCodeFormValue').val("");
		
		var html = '';
		for (var i in codeOptions) {
			const option = codeOptions[i];
			html += 
					'<button type="button" class="p-0 list-group-item list-group-item-action cSelectCodeFormOptionChosen"'+
						' data-value="'+option.name+'" >'+
						'<span class="sModelBtn">'+option.name+'</span> : '+ option.description+
					'</button>';
		}			
		$('#mSelectCodeFormList').html(html);

		$('#mSelectCodeFormModal .cSelectCodeFormOptionChosen').click((event)=>{
			var value = $( event.target ).closest('.cSelectCodeFormOptionChosen').data('value');
			$('#mSelectCodeFormValue').val(value);
		});		
		$('#mSelectCodeFormModal .cSelectCodeFormOptionChosen').dblclick((event)=>{
			var value = $( event.target ).closest('.cSelectCodeFormOptionChosen').data('value');
			mCodeEditor.session.insert(mCodeEditor.getCursorPosition(), value);
			mTarget.reportableChange();
			mModal.hide();
		});		

		mModal.show(); 
	}

	return self;
}
var WebEJS_GUI = WebEJS_GUI || {};

/**
* Creates a form to ask for a new name
*/
WebEJS_GUI.YesNoCancelForm = function() {
  var self = {};

  const _HTML = `
<div class="modal fade" id="mYesNoCancelFormModal" data-bs-backdrop="static" data-bs-keyboard="false" tabindex="-1" aria-hidden="true">
		
	<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
		
		<div class="modal-content">
      	
			<div class="modal-header bg-light text-dark">
    		<img id="mYesNoCancelFormLogo" height="40" class="me-2 d-inline-block align-bottom;">
      		<h5 id="mYesNoCancelFormTitle" class="sTranslatable text-primary modal-title">Confirmation</h5>
      	<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
    	</div>  
    	<!------------------  end modal header --------------->

			<div class="modal-body">
				<div class="mb-2">
					<p id="mYesNoCancelFormLine1">Filename</p>
					<div id="mYesNoCancelFormLine2">Do you ...?</div>
				</div>
			</div>
      	
    	<!------------------  end modal body --------------->
		
			<div id="YesNoCancelFormFooter" class="modal-footer">
				<button type="button" class="sTranslatable btn btn-secondary me-auto" data-answer="CANCEL" data-dismiss="modal">Oops! Please cancel</button>
				<button type="button" class="sTranslatable btn btn-warning"   data-answer="NO" 		 data-dismiss="modal">No, thank you</button>
				<button type="button" class="sTranslatable btn btn-primary" 	data-answer="YES"		 data-dismiss="modal">Yes, please</button>
			</div>

    	<!------------------  end modal footer --------------->

		</div>
		<!------------------  end modal content --------------->
		
	</div>	
	<!------------------  end modal-dialog --------------->

</div>
<!------------------  end modal --------------->
`;

  $("body").append($(_HTML));
  var mModal = new bootstrap.Modal(document.getElementById('mYesNoCancelFormModal'))
  $('#mYesNoCancelFormLogo').attr("src", sMainEjsLogo);
  var mListener;

  $("#YesNoCancelFormFooter button").click((event) => {
    var answer = $(event.target).data('answer');
    mModal.hide();
    if (mListener) mListener(answer);
  });

  self.show = function (title, plainLine, translatableLine, listener) {
    if (title) $('#mYesNoCancelFormTitle').text(sMainResources.getString(title));
    if (plainLine) {
      $('#mYesNoCancelFormLine1').text(plainLine);
      $('#mYesNoCancelFormLine1').show();
    }
    else $('#mYesNoCancelFormLine1').hide();
    if (translatableLine) {
      $('#mYesNoCancelFormLine2').html(sMainResources.getString(translatableLine));
      $('#mYesNoCancelFormLine2').show();
    }
    else $('#mYesNoCancelFormLine2').hide();
    mListener = listener;
    mModal.show();
  }
  return self;
}
/*
 * Copyright (C) 2021 Jesús Chacón, Francisco Esquembre and Félix J. Garcia 
 * This code is part of the Web EJS authoring and simulation tool
 */

var WebEJS_TOOLS = WebEJS_TOOLS || {};

WebEJS_TOOLS.createJSPanel = function(title, options, controls, size, titleClass) {
	options ['config'] = {
	  theme : "bootstrap-light",
		headerLogo: sMainGUI.getWebEJSLogo(),
		headerTitle: '<h5 class="sTranslatable '+ (titleClass ? titleClass : 'text-primary')+' modal-title">'+sMainResources.getString(title)+'</h5>',
		headerControls: controls ? controls : { smallify: 'remove', minimize: 'remove' },
		position: { at : 'center', of : '#sMainWorkpanel' },
		borderRadius: '.3rem',
	  panelSize: size ? size : {
	  	width: Math.min(window.innerWidth*0.7,600),
	  	height: Math.min(window.innerHeight*0.6,800)
    }
	};
	const panel = jsPanel.create(options);
	//$('.jsPanel').addClass(["bg-light"]);
	$('.jsPanel-hdr').addClass(["p-1","bg-light"]);
	$('.jsPanel-content').addClass(["m-1", "p-2","bg-light",'border', "border-dark", "rounded"]);
	return panel;		
}

WebEJS_TOOLS.getBase64 = function(imageElementID) {
		var image = document.getElementById(imageElementID);
		if (image.naturalHeight<=0 || image.naturalWidth<=0) return '';
		var canvas = document.createElement('canvas');
		var ctx = canvas.getContext('2d');
		canvas.height = image.naturalHeight;
		canvas.width = image.naturalWidth;
		ctx.drawImage(image, 0, 0);

		// Unfortunately, we cannot keep the original image type, so all images will be converted to PNG
		// For this reason, we cannot get the original Base64 string
		var uri = canvas.toDataURL('image/png');
		var base64Image = uri.replace(/^data:image\/(png|jpg|jpeg);base64,/, '');		
		canvas.remove();
		return 	base64Image;	
	};

WebEJS_TOOLS.selectFile = function(extensions, onSuccess, checkExistence, helperHtml) {
	const fileListener = function(path) {
		if (!path.startsWith('/org/opensourcephysics')) {
			if (path.startsWith('/')) path = '.'+path; 
		}
		console.log("selected (relative) path = "+path);
		if (path.startsWith('/org/')) checkExistence = false; 
//		console.log("relative path = "+path);
		if (!checkExistence) { onSuccess(path); return; } 
		sMainComm.checkRequiredFile(path, onSuccess,
			function(path) {
				var html = 
					'<p>'+
						sMainResources.getString("The selected file is not included in your simulation list of <i>User files</i>:")+
					'</p>'+
					'<p class="text-danger">'+path+'</p>' +
					'<p>'+sMainResources.getString("Please, add it before using it.","User file error")+'</p>';
				sMessageForm.showWarningHTML('User File Error',html);
			}    
		); 
	} // end of listener
	sMainFileChooser.showRead(extensions, fileListener, helperHtml);
}
	var WebEJS_GUI = WebEJS_GUI || {};

WebEJS_GUI.libraryChooser = function() {
	const ITEM_LIST_PREFIX = "mLibraryChooserCollection-item-";
  const ITEM_GROUP_PREFIX = "mLibraryChooserCollection-group-";
  const EXPAND_ICON_CLASS = 'bi bi-chevron-down';
  const COLLAPSE_ICON_CLASS = 'bi bi-chevron-right';
  const ITEM_ICON_CLASS = "bi bi-dash";
  const FOLDER_ICON_CLASS = "bi bi-folder";
  const EJSS_ICON_CLASS = "bi bi-cloud-download";
  const PAGE_ICON_CLASS = "bi bi-file-richtext";
  const INDENT =  0.5;
  const PARENTS_MARGIN_LEFT = '0.25rem';

  function getLeftPadding(depth) {
    return depth>0 ? (INDENT + depth * INDENT).toString() + "rem" : PARENTS_MARGIN_LEFT;
  }
  
  var self = {};

  const _HTML = `
<div class="modal modal-dialog-scrollable fade" id="mLibraryChooserModal" data-bs-backdrop="static" data-bs-keyboard="false" tabindex="-1" aria-hidden="true">
		
	<div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
		
		<div class="modal-content">
      	
			<div class="modal-header bg-light text-dark">
    		<img id="mLibraryChooserLogo" height="40" class="me-2 d-inline-block align-bottom;">
      		<h5 class="sTranslatable text-primary modal-title">Library explorer</h5>
      	<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
    	</div>  
    	<!------------------  end modal header --------------->
      	
			<div class="modal-body  d-flex flex-row">
					<div id="mLibraryChooserCollection" class="bstreeview" style="flex-grow:1;">
					</div>
					<div id="mLibraryChooserHelper" class="border" style="flex-basis:0; flex-grow: 0; min-width: 50%;">
					</div>

			</div>
    	<!------------------  end modal body --------------->
		
			<div class="modal-footer">
				<span class="flex flex-grow input-group input-group-sm mt-1">
					<nav aria-label="breadcrumb">
  					<ol id="mLibraryChooserBreadCrumb" class="breadcrumb m-0">
  					</ol>
					</nav>
				</span>
				<span class="mb-2"> 
					<button type="button" id="mLibraryChooserCancelButton" class="sTranslatable btn btn-secondary me-auto" data-dismiss="modal">Cancel</button>
					<button type="button" id="mLibraryChooserOKButton" class="sTranslatable btn btn-primary float-left">Download</button>
				 </span>

			</div>
    	<!------------------  end modal footer --------------->

		</div>
		<!------------------  end modal content --------------->
		
	</div>	
	<!------------------  end modal-dialog --------------->

</div>
<!------------------  end modal --------------->
`;

  $( "body" ).append( $(_HTML) );
	var mModal = new bootstrap.Modal(document.getElementById('mLibraryChooserModal'));
  $('#mLibraryChooserLogo').attr("src",sMainEjsLogo);
	var mCollectionDiv = $('#mLibraryChooserCollection');
	var mCurrentItem = null;
	var mHash = 0;	
	var mDataByHash = {}; // keeps a dict of entries 'hash' : data 

	var mListener = null;

	self.show = function(listener) {
		WebEJS_TOOLS.getComPADRECollectionIndex(function(success, collection) { 
				console.log(collection);
				mListener = listener;
				mOriginalPath = null;
				_show(collection);
			});				
	}

	function _show(collection) {
		mCurrentItem = null;
		displayCollection(collection);
		sMainHideTooltips();
		mModal.show();
	}

  // --------------------
  // Display functions
  // --------------------

  function displayCollection(collection) {
    $(mCollectionDiv).empty();
    mHash = 0;
    mDataByHash = {};

    var groupNodes = {};
    var rootItem = null;
    for (var index=0; index<collection.length; index++) {
      var entry = collection[index];

      const parentStr = entry['parent'];
      const parentNode = (parentStr=="#") ? null : groupNodes[parentStr];
      const depth = parentNode ? parentNode['depth']+1 : 0;
      const target = ('target' in entry['data']) ?  entry['data']['target'] : "";
      var built = buildTreeItem(depth,entry['text'],entry['data']['type'],target, index==0);

      if (parentNode) parentNode['group'].append(built.tree_item);
      else mCollectionDiv.append(built.tree_item);
      
    	if ('group' in built) {
    		built.tree_item.parent().append(built.group); 
	      // Keep for later use in this function
	      groupNodes[entry['id']] = { 'group' : built.group, 'depth' : depth };
    	}
      // Keep for future use in this object  
      mDataByHash[mHash] = correctData(entry);
      if (index==0) {
    	  mDataByHash[mHash]['type'] = 'ROOT';
    	  rootItem = built.tree_item;
      }
      // Update unique hash   
      mHash++;
    }
    groupNodes = {};
	  if (rootItem) $('#mLibraryChooserHelper').html(getItemHtml(rootItem));
		$('#mLibraryChooserOKButton').prop('disabled', true)
  }

  function correctData(entry) {
  	const data = entry['data'];
    if (!('target' in data))   data['target']   = "";
    if (!('htmlPath' in data)) data['htmlPath'] = "";
    data['_name_'] = entry['text'];
    data['_id_'] = entry['id'];
    return data;
  }
  
  function addToCollection(hash, collection) {
	  	const parentItem = findGroupByHash(hash);
	  	var rootEntry = collection[0];
	  	const data = mDataByHash[hash];
	  	if (rootEntry['id']!=data['_id_']) {
	  		alert ("Error trying to expand ID:"+rootEntry['id']);
	  		return;
	  	}
	  	mDataByHash[hash] = correctData(rootEntry);
	  	findItemByHash(hash).children('.cLibraryChooserName').removeClass('text-danger');
	  	
	    var groupNodes = {};
	    groupNodes[rootEntry['id']] = { 'group' : findGroupByHash(hash), 'depth' : findDepthByHash(hash) };

	    for (var index=1; index<collection.length; index++) {
	      var entry = collection[index];

	      const parentStr = entry['parent'];
	      const parentNode = groupNodes[parentStr];
	      const depth = parentNode['depth']+1;
	      const target = ('target' in entry['data']) ?  entry['data']['target'] : "";
	      var built = buildTreeItem(depth,entry['text'],entry['data']['type'],target, index==0);

	      parentNode['group'].append(built.tree_item);
	      
	    	if ('group' in built) {
	    		built.tree_item.parent().append(built.group); 
		      // Keep for later use in this function
		      groupNodes[entry['id']] = { 'group' : built.group, 'depth' : depth };
	    	}
	      // Keep for future use in this object   
      	mDataByHash[mHash] = correctData(entry);
	      // Update unique hash   
	      mHash++;
	    }
	    groupNodes = {};
	  }
  
  function expandItem(treeItem) {
	  const hash = treeItem.data('hash');
		console.log("You selected folder :"+getItemName(treeItem));
	  const target = getItemTarget(treeItem);
	  if (target) {
			console.log("Expanding folder with target:"+target);
		  WebEJS_TOOLS.getComPADRECollection(target, getItemID(getParentItem(treeItem)), getItemID(treeItem), 
				function(success, collection) { 
					addToCollection(hash,collection);	
					console.log(collection);
					clearItemTarget(treeItem);
					showItemHtml(treeItem);
			});				
	  }
  }

  // --------------------
  // Items info
  // --------------------

  function getItemHash(treeItem) {
	    return treeItem.data('hash');
	}

	function findDepthByHash(hash) {
		const itemList = $('#'+ITEM_LIST_PREFIX + hash);
		if (itemList.length>0) return itemList.first().data('depth');
		return 0;
	}

	function findItemByHash(hash) {
		const itemList = $('#'+ITEM_LIST_PREFIX + hash);
		if (itemList.length>0) return itemList.first();
		return null;
	}

	function findGroupByHash(hash) {
		const itemList = $('#'+ITEM_GROUP_PREFIX + hash);
		if (itemList.length>0) return itemList.first();
		return null;
	}

	function findGroupByID(anID) {
		for (const hash of mDataByHash.entries()) {
			const data = mDataByHash[hash];
			if (data['_id_']==anID) return findItemByHash(hash);
		}
		return null;
	}

  function getItemData(treeItem) {
	    return mDataByHash[treeItem.data('hash')];;
	}
  
  function getItemID(treeItem) {
		const data = mDataByHash[treeItem.data('hash')];
		return data['_id_'];
	}

  function getItemName(treeItem) {
		const data = mDataByHash[treeItem.data('hash')];
		return data['_name_'];
	}

  function getItemType(treeItem) {
		const data = mDataByHash[treeItem.data('hash')];
		if (data['type'].trim().length>0) return data['type'].trim();
		return 'Unknown type';
	}

  function getItemTarget(treeItem) {
		const data = mDataByHash[treeItem.data('hash')];
		if (data['target'].trim().length>0) return data['target'];
		return null;
	}

  function clearItemTarget(treeItem) {
    const data = mDataByHash[treeItem.data('hash')];
    data['target'] = '';
  }
  
  function getItemDescription(treeItem) {
		const data = mDataByHash[treeItem.data('hash')];
		if (data['description'].trim().length>0) return data['description'];
		return null;
	}
  
  
  function getItemPath(treeItem) {
		const data = mDataByHash[treeItem.data('hash')];
		if (data['htmlPath'].trim().length>0) return data['htmlPath'];
		return null;
	}
  
  function buildGroupForItem(treeItem, expanded) {
	    const hash = getItemHash(treeItem);
	    const html = 
	      '<div role="group" class="list-group ps-2 collapse'+(expanded ? ' show' : '')+'" '+
	        ' data-parent="'+ITEM_LIST_PREFIX + hash+'" '+
	        ' id="'+ITEM_GROUP_PREFIX + hash+'">'+
	      '</div>';
	    const group = $(html);
	    const iconClass = expanded ? EXPAND_ICON_CLASS : COLLAPSE_ICON_CLASS;
	    treeItem.find('.state-icon').removeClass(ITEM_ICON_CLASS).addClass(iconClass);
	    return group;
	 }

  function buildTreeItem(depth,name,type, target, expanded) {
	    const leftPadding = getLeftPadding(depth);
	    const isFolder = (type=="Collection");
	    const isModel = (type=="EJS");
			const classStr = (isFolder && target.trim().length>0) ? 'text-danger' : isModel ? 'text-primary' : '';
	    const iconStr  = isFolder ? FOLDER_ICON_CLASS : isModel ? EJSS_ICON_CLASS : PAGE_ICON_CLASS;
	    const html = 
	      '<div role="treeitem" class="list-group-item py-0 border-0" style="padding-left:'+leftPadding+'" '+
	        ' id ="'+ITEM_LIST_PREFIX + mHash+'" data-hash="'+mHash+'" data-depth="'+depth+'" '+
	        ' data-bs-target="#' + ITEM_GROUP_PREFIX + mHash +'" "aria-level="'+depth+'" >' +
	        '<i class="state-icon '+ITEM_ICON_CLASS+'"></i>'+
	        '<span class="cLibraryChooserName '+classStr+'"><i class="me-1 '+ iconStr+'"></i>'+name+'</span>'+   
	      '</div>';
	    const treeItem = $(html); 
	    if (isFolder) return { 'tree_item' : treeItem , 'group' : buildGroupForItem(treeItem, expanded) };
	    return { 'tree_item' : treeItem }
	  }
  
  function getParentItem(treeItem) {
		const parentName = treeItem.parent().data('parent');
		return $('#'+parentName);
  }
  
	// ------------------
	// Helper display
	// ------------------

	function showItemHtml(treeItem) {
		const type = getItemType(treeItem);
		var html='';
		if (type!='Collection') {
			$('#mLibraryChooserHelper').removeClass('p-2');
			$('#mLibraryChooserHelper').html(getItemHtml(treeItem));
		}
		else {
			$('#mLibraryChooserHelper').addClass('p-2');
			$('#mLibraryChooserHelper').html(getFolderHtml(treeItem));
		}
	}

	function getItemHtml(treeItem) {
		const htmlPath = getItemPath(treeItem);
		if (htmlPath) return '<iframe	src="'+htmlPath+'" style="width:100%; height:100%;"></iframe>';
		const description = getItemDescription(treeItem);
		if (description) return '<div class="p-2">'+description+'<div>';
		return '<h5 class="p-1 text-danger">'+sLocaleFor("No information on this item")+'</h5>';
	}

	function getFolderHtml(treeItem) {
		var categories = [];
		var models = [];
		$(treeItem.data('bs-target')).children('.list-group-item').each(function() {
			const item = $(this);
			const type = getItemType(item);
			if (type=="Collection") categories.push(getItemName(item));
			else if (type=="EJS") models.push(getItemName(item));
		});
		const name = getItemName(treeItem);
		var html = '';
		if (categories.length>0) {
			html += '<h5 class="text-primary">'+sLocaleFor('Subcategories of ')+
							name+'</h5><ul class="mb-2">';
			for (var i=0; i<categories.length; i++) html += '<li>'+categories[i]+'</li>';
			html += '</ul>';
		}
		if (models.length>0) {
			html += '<h5 class="text-primary">'+sLocaleFor('Models in the ')+
								name+' '+sLocaleFor('category')+'</h5><ul class="mb-2">';
			for (var i=0; i<models.length; i++) html += '<li>'+models[i]+'</li>';
			html += '</ul>';
		}
		else if (getItemTarget(treeItem)) {
			html += '<h5 class="text-danger">'+
							sLocaleFor('Double-click this node to get the list of models in the ')+
							name+' '+sLocaleFor('category')+'</h5>';
		}
		return html;
	}

	// ------------------
	// Interface actions
  // ------------------

	$('#mLibraryChooserCancelButton').click(function() {
		mModal.hide();
	});
	
	$('#mLibraryChooserOKButton').click(function() {
		var path;
		if (!mCurrentItem) return;
		mModal.hide();
		const url = getItemTarget(mCurrentItem);
		console.log("url selected = "+url);
		mListener(getItemTarget(mCurrentItem),getItemName(mCurrentItem));
	});
	
	// --- Expanding/collapsing a parent node
	$(mCollectionDiv).on('click', '.state-icon', function (event) {
	    var icon = $(event.currentTarget);
	    if (icon.hasClass(ITEM_ICON_CLASS)) return;
	    icon.toggleClass(EXPAND_ICON_CLASS).toggleClass(COLLAPSE_ICON_CLASS);
	    const groupItem = $(event.currentTarget).closest('.list-group-item');
	    // Toggle the data-bs-target. Issue with Bootstrap toggle and dynamic code
	    $(groupItem.attr("data-bs-target")).collapse('toggle');
	});
	  
  // --- clicking on an element

  $(mCollectionDiv).on('click', '.cLibraryChooserName', function (event) {
    const treeItem = $(event.currentTarget).closest('.list-group-item');
		if (mCurrentItem) mCurrentItem.removeClass('bg-info');
		mCurrentItem = treeItem;
		mCurrentItem.addClass('bg-info');
		const type = getItemType(treeItem);
		$('#mLibraryChooserOKButton').prop('disabled', type!="EJS");
		showItemHtml(treeItem);
  });
  
  $(mCollectionDiv).on('dblclick', '.cLibraryChooserName', function (event) {
	  const treeItem = $(event.currentTarget).closest('.list-group-item');
		const type = getItemType(treeItem);
		console.log("You selected item "+getItemName(treeItem));
		if (type=='Collection') {
			expandItem(treeItem);
			const icon = $(event.currentTarget).siblings('.state-icon');
		  icon.addClass(EXPAND_ICON_CLASS).removeClass(COLLAPSE_ICON_CLASS);
		  const groupItem = $(event.currentTarget).closest('.list-group-item');
		  // Toggle the data-bs-target. Issue with Bootstrap toggle and dynamic code
		   $(groupItem.attr("data-bs-target")).collapse('show');
		}
		else if (type=="EJS") {
			mModal.hide();
			const url = getItemTarget(treeItem);
			console.log("url selected = "+url);
			mListener(getItemTarget(treeItem),getItemName(treeItem));
		}
		});

  /*
  $(mCollectionDiv).on('click', '.cLibraryChooserFile', function (event) {
    const treeItem = $(event.currentTarget).closest('.list-group-item');
		if (mCurrentItem) mCurrentItem.removeClass('bg-info');
		mCurrentItem = treeItem;
		mCurrentItem.addClass('bg-info');
		$('#mLibraryChooserOKButton').prop('disabled', false)
	  $('#mLibraryChooserHelper').html(getItemHtml(treeItem));
  });

  // --- clicking on a folder
  $(mCollectionDiv).on('click', '.cLibraryChooserFolder', function (event) {
  	const treeItem = $(event.currentTarget).closest('.list-group-item');
		if (mCurrentItem) mCurrentItem.removeClass('bg-info');
		mCurrentItem = treeItem;
		mCurrentItem.addClass('bg-info');
		$('#mLibraryChooserOKButton').prop('disabled', true)
  	$('#mLibraryChooserHelper').html(getFolderHtml(treeItem));
  });

  
  // --- double-clicking on an element
  $(mCollectionDiv).on('dblclick', '.cLibraryChooserFile', function (event) {
		mModal.hide();
	  const treeItem = $(event.currentTarget).closest('.list-group-item');
	  const hash = treeItem.data('hash');
		console.log("You selected file with hash:"+hash+ " : data =");
		const data = mDataByHash[hash];
		console.log(data);
		//mListener(path);
  });

  // --- double-clicking on an element
  $(mCollectionDiv).on('dblclick', '.cLibraryChooserFolder', function (event) {
	  const treeItem = $(event.currentTarget).closest('.list-group-item');
		expandItem(treeItem);
		//mListener(path);
  });
	*/
	
  // ------------------
  // Final start up
  // ------------------


  return self;
}
/*
 * Copyright (C) 2021 Jesús Chacón, Francisco Esquembre and Félix J. Garcia 
 * This code is part of the WebEJS authoring and simulation tool
 *
 * BASED ON PREVIOUS CODE:
 *
 * Copyright 2015 - Félix J. García
 * 
 * @author Félix J. García (fgarcia@um.es)
 */

/**
 * GUI tools
 * @module core
 */

var WebEJS_TOOLS = WebEJS_TOOLS || {};

WebEJS_TOOLS.LibraryComPADRE = {
	OSP_INFO_URL: "https://www.compadre.org/OSP/online_help/EjsDL/OSPCollection.html",
	EJS_SERVER_TREE_LOCAL: "osp.php?basename=tree",
	EJS_SERVER_TREE: "https://www.compadre.org/services/rest/osp_ejss.cfm?verb=Identify&OSPType=EJSS+Model",
	EJS_SERVER_RECORDS_LOCAL: "osp.php?basename=records",
	EJS_SERVER_RECORDS: "https://www.compadre.org/osp/services/REST/osp_ejss.cfm?OSPType=EJSS+Model",
	EJS_SERVER_SEARCH: "https://www.compadre.org/osp/services/REST/search_v1_02.cfm?verb=Search&OSPType=EJSS+Model&Skip=0&Max=30&q=",	  
	
	EJS_COLLECTION_NAME: "EJS OSP Collection",
	EJS_INFO_URL: "http://www.compadre.org/OSP/online_help/EjsDL/DLModels.html",
	TRACKER_SERVER_TREE: "http://www.compadre.org/osp/services/REST/osp_tracker.cfm?verb=Identify&OSPType=Tracker",
	TRACKER_SERVER_RECORDS: "http://www.compadre.org/osp/services/REST/osp_tracker.cfm?OSPType=Tracker",
	TRACKER_COLLECTION_NAME: "Tracker OSP Collection",
	TRACKER_INFO_URL: "http://www.cabrillo.edu/~dbrown/tracker/library/comPADRE_collection.html",
	PRIMARY_ONLY: "&OSPPrimary=Subject",
	GENERIC_COLLECTION_NAME: "AAPT-ComPADRE OSP Collection",
	ABOUT_OSP: "About OSP and AAPT-ComPADRE",

	Description_DoubleClick: "dblClick",
	Description_Author: "Author",
	Description_DownloadSize: "Download Size", 
	Description_InfoField: "Info"
}

WebEJS_TOOLS.LibraryResource = {
   	UNKNOWN_TYPE: "Unknown",
   	COLLECTION_TYPE: "Collection",
   	TRACKER_TYPE: "Tracker",
   	EJS_TYPE: "EJS",
   	VIDEO_TYPE: "Video",
   	HTML_TYPE: "HTML",
   	PDF_TYPE: "PDF"
}

/* 
 * WebEJS_TOOLS.libraryResource
 */
WebEJS_TOOLS.libraryResource = function(parentid, name) {
	var self = {};
	var htmlPath=""; // rel or abs path to html that describes this resource
	var basePath=""; // base path for target and/or info
	var description=""; 
	var target=""; // rel or abs path to target 
	var type=WebEJS_TOOLS.LibraryResource.UNKNOWN_TYPE;
  	var properties = {};
    var thumbnail;
    var id = parentid + "/" + name;

  /**
   * Gets the id of its parent.
   *
   * @return the parent id
   */
	self.getParent = function() {
		return parentid;
	}
	
  /**
   * Gets the name of this resource (never null).
   *
   * @return the name
   */
	self.getName = function() {
		return name;
	}

  /**
   * Gets the id of this resource (never null).
   *
   * @return the id
   */
	self.getId = function() {
		return id;
	}
		
  /**
   * Gets the base path.
   *
   * @return the base path
   */
	self.getBasePath = function() {
		return basePath;
	}
	
  /**
   * Sets the base path of this resource.
   * 
   * @param path the base path
   * @return true if changed
   */
	self.setBasePath = function(path) {
		path = (!path)? "": path.trim(); 
		if (path != basePath) {
			basePath = path;
			return true;
		}
		return false;
	}
	
  /**
   * Gets the target of this resource (file name or comPADRE command).
   *
   * @return the target
   */
	self.getTarget = function() {
		return target;
	}

	function endsWith(str, suffix) {
    	return str.indexOf(suffix, str.length - suffix.length) !== -1;
	}

  /**
   * Sets the target of this resource.
   * 
   * @param path the target path
   * @return true if changed
   */
	self.setTarget = function(path) {
		path = (!path)? "": path.trim(); 
		if (path != target) {
			thumbnail = null;
			target = path;
			path = path.toUpperCase();
			if (endsWith(path,".TRK")) 
				self.setType(WebEJS_TOOLS.LibraryResource.TRACKER_TYPE);
			else if (endsWith(path,".PDF")) 
				self.setType(WebEJS_TOOLS.LibraryResource.PDF_TYPE);
			else if (path.indexOf("EJS")>-1) { 
				self.setType(WebEJS_TOOLS.LibraryResource.EJS_TYPE);
			} else if (path == "") { 
				if (self.getHTMLPath() == null)
					self.setType(WebEJS_TOOLS.LibraryResource.UNKNOWN_TYPE);
				else
					self.setType(WebEJS_TOOLS.LibraryResource.HTML_TYPE);
			}
			return true;
		}
		return false;
	}
	
  /**
   * Gets the path to the html page displayed in the browser.
   *
   * @return the html path
   */
	self.getHTMLPath = function() {
		return htmlPath;
	}
	  	
  /**
   * Sets the html path of this resource.
   * 
   * @param path the html path
   * @return true if changed
   */
	self.setHTMLPath = function(path) {
		path = (!path)? "": path.trim();
		if (path != htmlPath) {
			htmlPath = path;
			if (!(self.addResource) // not collection 
					&& self.getTarget() == "") {
				if (path == "")	self.setType(WebEJS_TOOLS.LibraryResource.UNKNOWN_TYPE);
				else self.setType(WebEJS_TOOLS.LibraryResource.HTML_TYPE);
			}
			return true;
		}
		return false;
	}
	
  /**
   * Gets the description, which must be in html code.
   *
   * @return the description
   */
	self.getDescription = function() {
		return description;
	}
  	
  /**
   * Sets the description of this resource.
   * Note: the description must be in html code, since it is displayed
   * in the html pane of the LibraryTreePanel if the html path is empty.
   * 
   * @param desc the description in HTML code
   * @return true if changed
   */
	self.setDescription = function(desc) {
		desc = (!desc)? "": desc.trim();
		if (desc != description) {
			description = desc;
			return true;
		}
		return false;
	}
  	
  /**
   * Gets the type of resource.
   *
   * @return the one of the static constant types defined in this class
   */
	self.getType = function() {
		return type;
	}
  	
  /**
   * Sets the type of this resource.
   * The types are static constants defined in this class.
   * 
   * @param type the type
   * @return true if changed
   */
	self.setType = function(tp) {
		if (type != tp) {
			type = tp;
			return true;
		}
		return false;
	}
	
  /**
   * Sets an arbitrary property.
   * 
   * @param name the name of the property
   * @param value the value of the property
   */
	self.setProperty = function(name,value) {
		properties[name] = value;
	}
	
  /**
   * Gets a property value. May return null.
   * 
   * @param name the name of the property
   * @return the value of the property
   */
	self.getProperty = function(name) {
		return properties[name];
	}
			
  /**
   * Gets the thumbnail of this resource, if any.
   *
   * @return the thumbnail
   */
	self.getThumbnail = function() {
		return thumbnail;
	}

  /**
   * Gets the thumbnail of this resource, if any.
   *
   * @param imagePath the path to a thumbnail image
   */
	self.setThumbnail = function(imagePath) {
		thumbnail = imagePath;
	}

	/***
	 * To JSON
	 */	
	self.toJSON = function() {
		var json = {};
		json["id"] = id;
		json["parent"] = parentid;
		json["text"] = name;
		json["type"] = "file";		
		json["data"] = {};
		json["data"]["htmlPath"] = htmlPath;
		json["data"]["basePath"] = basePath;
		json["data"]["description"] = description; 
		json["data"]["target"] = target; 
		json["data"]["type"] = type;
		json["data"]["thumbnail"] = thumbnail;		
		return json;
	}

	return self;    
}

/* 
 * WebEJS_TOOLS.libraryCollection
 */
WebEJS_TOOLS.libraryCollection = function(parentid,name) {
	var self = WebEJS_TOOLS.libraryResource(parentid,name);	
  	var resources = {};      
    
  /**
   * Adds a resource to the end of this collection.
   *
   * @param resource the resource
   */
	self.addResource = function(resource) {
  		if (!resources[resource.getName()]) {
  			resources[resource.getName()] = resource;
  		}
  	}
    
  /**
   * Removes a resource from this collection.
   *
   * @param resource the resource to remove
   */
	self.removeResource = function(resource) {
  		if(resources[resource.getName()])
  			delete resources[resource.getName()];
  	}
  
  /**
   * Gets the array of resources in this collection.
   *
   * @return an array of resources
   */
	self.getResources = function() {
		return resources;
	}
	
	/***
	 * To JSON
	 */	
	self.toJSON = function() {
		var coljson = [];
		
		// collection root
		var json = {};
		json["id"] = self.getId();
		json["parent"] = self.getParent();
		json["text"] = self.getName();
		json["type"] = "folder";
		if(self.getName() === WebEJS_TOOLS.LibraryComPADRE.GENERIC_COLLECTION_NAME) 
			json["state"] = { opened: true, selected: true, disabled: false };			
		json["data"] = {};
		json["data"]["htmlPath"] = self.getHTMLPath();
		json["data"]["basePath"] = self.getBasePath();
		json["data"]["description"] = self.getDescription(); 
		json["data"]["target"] = self.getTarget(); 
		json["data"]["type"] = self.getType();
		json["data"]["thumbnail"] = self.getThumbnail();		
		coljson.push(json);
		
		// resources
		for(var i in resources) {
			var resource = resources[i];
			coljson = coljson.concat(resource.toJSON());			
		}
		
		return coljson;
	}
	
	self.setType(WebEJS_TOOLS.LibraryResource.COLLECTION_TYPE);
	return self;
}

/* 
 * WebEJS_TOOLS.libraryComPADRE
 */
WebEJS_TOOLS.libraryComPADRE = function() {
	var self = {};

	self.getNameFromId = function(id) {
		return id.substr(id.lastIndexOf("/")+1);
	}

	/**
	 * Loads a collection using a specified comPADRE search query.
	 * 
	 * @param collection the LibraryCollection to load
	 * @param query the search query
	 * @return true if successfully loaded
	 */
	self.load = function(collection, doc) {		
		var nodeList = doc.getElementsByTagName("Identify");
		var success = false;
		for (var i = 0; i < nodeList.length; i++) {
			success = loadSubtrees(collection, 
				nodeList.item(i).childNodes, "osp-subject", "") || success;
		}
		return success;
	}

	/**
	 * Loads a collection with subtree collections that meet the specified requirements.
	 * 
	 * @param collection the LibraryCollection to load
	 * @param nodeList a list of Nodes
	 * @param attributeType the desired attribute
	 * @param serviceParameter the desired service parameter
	 * @return true if at least one subtree collection was loaded
	 */
	function loadSubtrees(collection, nodeList, attributeType, serviceParameter) {
		var success = false;
		var dblClick = WebEJS_TOOLS.LibraryComPADRE.Description_DoubleClick;
		var parentId = collection.getId();
		for (var i = 0; i < nodeList.length; i++) {
			if (!(nodeList.item(i) instanceof Element))	continue;
			
			var node = nodeList.item(i);
			if (node.nodeName.toLowerCase() == "sub-tree-set" && attributeType == node.getAttribute("type")) { 
				var subTrees = getAllChildren(node, "sub-tree");
				if (subTrees.length > 0) { // node has subcategories
					var unclassifiedURL = null;
					for (var j = 0; j < subTrees.length; j++) {
						if (!(subTrees[j] instanceof Element))
							continue;
						var subtree =  subTrees[j];
						var name = subtree.getAttribute("name"); 
						var serviceParam = subtree.getAttribute("service-parameter"); 
						serviceParam = serviceParameter + "&" + getNonURIPath(serviceParam);
						if (name == "Unclassified") { // unclassified node is processed last and adds its records to the parent
							unclassifiedURL = serviceParam;
							continue;
						}
						var subCollection = WebEJS_TOOLS.libraryCollection(parentId,name);
						collection.addResource(subCollection);
						success = true;
						if (getAllChildren(subtree, "sub-tree-set").length == 0) { // has no subcategories
							var nodeName = "<h2>" + name + "</h2><blockquote>"; 
							subCollection.setDescription(nodeName + dblClick + "</blockquote>"); 
							subCollection.setTarget(serviceParam);
						} else
							loadSubtrees(subCollection,
									subtree.childNodes, attributeType + "-detail", serviceParam); 
					}
					if (unclassifiedURL != null) {
						collection.setTarget(unclassifiedURL);
					}
				}
			}
		}
		return success;
	}

	/**
	 * Get description for collection
	 * 
	 */
	self.getResources = function(collection, doc) {
		var success = false;
		var authorTitle = WebEJS_TOOLS.LibraryComPADRE.Description_Author; 
		var sizeTitle = WebEJS_TOOLS.LibraryComPADRE.Description_DownloadSize; 
		var infoFieldTitle = WebEJS_TOOLS.LibraryComPADRE.Description_InfoField; 

		// construct the complete tree path of the resource
		var parentList = ""; 
		var parentId = collection.getId();
		
		var list = doc.getElementsByTagName("record"); 
		for (var i = 0; i < list.length; i++) { // process nodes
			var node = list.item(i);
			// String ospType = getChildValue(node, "osp-type"); 
			var attachment = null;
			//if (ospType.startsWith("EJS")) { 
				attachment = getAttachment(node, "Source Code");       		
			//} else {
				//attachment = getAttachment(node, "EJSS Model"); 
			//	if (attachment == null) {
			//		attachment = getAttachment(node, "Supplemental"); 
			//	}
			//}
			// ignore node if there is no associated attachment
			if (attachment == null)
				continue;
			// get the node data
			var name = getChildValue(node, "title"); 
			var record = WebEJS_TOOLS.libraryResource(parentId,name);
			collection.addResource(record);
			var downloadURL = processURL(attachment[0]);
			record.setTarget(downloadURL);
			record.setProperty("download_filename", attachment[1]); 
			var type = getChildValue(node, "osp-type").toUpperCase(); 
			type = type.indexOf("EJS") === 0 ? WebEJS_TOOLS.LibraryResource.EJS_TYPE : 
					(type == "TRACKER") ? WebEJS_TOOLS.LibraryResource.TRACKER_TYPE : WebEJS_TOOLS.LibraryResource.UNKNOWN_TYPE; 
			record.setType(type);
			var description = getChildValue(node, "description"); 
			var infoURL = getChildValue(node, "information-url"); 
			var thumbnailURL = getChildValue(node, "thumbnail-url"); 
			var authors = "";
			var children = getAllChildren(getFirstChild(node, "contributors"), "contributor"); 
			for (var j in children) {
				var el = children[j];  
				if ("Author" == (el.getAttribute("role")))
					authors += getNodeValue(el) + ", "; 
			}
			if (endsWith(authors,", ")) 
				authors = authors.substring(0, authors.length - 2);
			// assemble the html description
			var buffer = [];
			buffer.push("<p align=\"center\"><img src=\"" + thumbnailURL + "\" alt=\"" + name + "\"></p>"); 
			buffer.push("<p><b>" + parentList + "</b></p>");
			buffer.push("<h2>" + name + "</h2>");  
			if (authors.length > 0)
				buffer.push("<p><b>" + authorTitle + ":</b> " + authors + "</p>");
			if(description) buffer.push("<p>" + description.replace(/\n([ \t]*\n)+/g, "</p><p>").replace("\n", "<br />") + "</p>");
			buffer.push("<p><b>" + infoFieldTitle + "</b><br><a href=\"" + infoURL + "\" target=\"_blank\">" + infoURL + "</a></p>");  
			buffer.push("<p><b>" + sizeTitle + "</b> " + attachment[2] + " bytes</p>");  
			record.setDescription(buffer.join(""));
			success = true;
		}

		return success;
	}

	/**
	 * Returns data for a downloadable DOM Node attachment.
	 * 
	 * @param node the DOM Node
	 * @param attachmentType the attachment type
	 * @return String[] {URL, filename, size in Bytes}, or null if no attachment found
	 */
	function getAttachment(node, attachmentType) {
		var id = getChildValue(node, "file-identifier"); 
		var childList = node.childNodes;
		var attachment = null;
		for (var i = 0, n = childList.length; i < n; i++) {
			var child = childList.item(i);
			if (!child.nodeName.toLowerCase() == "attached-document")continue; 
			var fileTypeNode = getFirstChild(child, "file-type"); 
			if (fileTypeNode != null
					&& attachmentType == getNodeValue(fileTypeNode)) {				
				var urlNode = getFirstChild(child, "download-url"); 
				if (urlNode != null) { // found downloadable attachment
					// keep first attachment or (preferred) attachment with the
					// same id as the node
					if (attachment == null
							|| id == getChildValue(child, "file-identifier")) { 
						var attachmentURL = getNodeValue(urlNode);
						var fileNode =  getFirstChild(child,
								"file-name"); 
						if (fileNode != null) {
							attachment = [attachmentURL,
									getNodeValue(fileNode),
									fileNode.getAttribute("file-size") ]; 
						} else
							attachment = [attachmentURL, null, null];
					}
				}
			}
		}
		return attachment;
	}

	/**
	 * Returns the first child node with the given name.
	 * 
	 * @param parent the parent Node
	 * @param name the child name
	 * @return the first child Node found, or null if none
	 */
	function getFirstChild(parent, name) {
		var childList = parent.childNodes;
		for (var i = 0, n = childList.length; i < n; i++) {
			var child = childList.item(i);
			if (child.nodeName.toLowerCase() == name.toLowerCase())
				return child;
		}
		return null;
	}

	/**
	 * Returns all child nodes with the given name.
	 * 
	 * @param parent the parent Node
	 * @param name the name
	 * @return a list of Nodes (may be empty)
	 */
	function getAllChildren(parent, name) {
		var list = [];
		var childrenList = parent.childNodes;
		for (var i = 0, n = childrenList.length; i < n; i++) {
			var child = childrenList.item(i);
			if (child.nodeName.toLowerCase() == name.toLowerCase())
				list.push(child);
		}
		return list;
	}

	/**
	 * Gets the value of a Node.
	 * 
	 * @param node the Node
	 * @return the value
	 */
	function getNodeValue(node) {
		for (var child = node.childNodes[0]; child != null; child = child
				.getNextSibling()) {
			if (child.nodeType == Node.TEXT_NODE)
				return child.nodeValue;
		}
		return null;
	}

	/**
	 * Gets the value of the first child node with a given name.
	 * 
	 * @param parent the parent Node
	 * @param name the name of the child
	 * @return the value of the first child found, or null if none
	 */
	function getChildValue(parent, name) {
		var node = getFirstChild(parent, name);
		if (node != null)
			return getNodeValue(node);
		return null;
	}

	/**
	 * Replaces "&amp" with "&" in HTML code.
	 * 
	 * @param url the HTML code
	 * @return the clean URL string
	 */
	function processURL(url) {
		var processed = [];
		var index = url.indexOf("&amp;"); 
		while (index >= 0) {
			processed.push(url.subSequence(0, index + 1));
			url = url.substring(index + 5);
			index = url.indexOf("&amp;"); 
		}
		processed.push(url);
		return processed.toString();
	}

	/**
	 * Returns a descriptive name for a given ComPADRE path (query).
	 * 
	 * @param path the query string
	 * @return the name of the collection
	 */
	function getCollectionName(path) {
		if (path.indexOf(WebEJS_TOOLS.LibraryComPADRE.EJS_SERVER_TREE) === 0)
			return WebEJS_TOOLS.LibraryComPADRE.EJS_COLLECTION_NAME;
		if (path.indexOf(WebEJS_TOOLS.LibraryComPADRE.TRACKER_SERVER_TREE) === 0)
			return WebEJS_TOOLS.LibraryComPADRE.TRACKER_COLLECTION_NAME;
		return WebEJS_TOOLS.LibraryComPADRE.GENERIC_COLLECTION_NAME;
	}

	/**
	 * Returns the LibraryCollection for a given ComPADRE path (query).
	 * 
	 * @param path the query string
	 * @return the collection
	 */
	self.getCollection = function(parent, path, doc) {
		var name = getCollectionName(path);
		var primarySubjectOnly = path.indexOf(WebEJS_TOOLS.LibraryComPADRE.PRIMARY_ONLY) > -1;
		var collection = WebEJS_TOOLS.libraryCollection(parent, name);
		if (name == WebEJS_TOOLS.LibraryComPADRE.EJS_COLLECTION_NAME) {
			collection.setHTMLPath(WebEJS_TOOLS.LibraryComPADRE.EJS_INFO_URL);
		} else if (name == WebEJS_TOOLS.LibraryComPADRE.TRACKER_COLLECTION_NAME) {
			collection.setHTMLPath(WebEJS_TOOLS.LibraryComPADRE.TRACKER_INFO_URL);
		}
		var aboutOSP = WebEJS_TOOLS.libraryResource(collection.getId(),WebEJS_TOOLS.LibraryComPADRE.ABOUT_OSP);
		aboutOSP.setHTMLPath(WebEJS_TOOLS.LibraryComPADRE.OSP_INFO_URL);
		collection.addResource(aboutOSP);
		
		self.load(collection, doc);
		var base = WebEJS_TOOLS.LibraryComPADRE.EJS_SERVER_RECORDS;
		if (name == WebEJS_TOOLS.LibraryComPADRE.TRACKER_COLLECTION_NAME) {
			base = WebEJS_TOOLS.LibraryComPADRE.TRACKER_SERVER_RECORDS;
		}
		if (primarySubjectOnly)
			base += WebEJS_TOOLS.LibraryComPADRE.PRIMARY_ONLY;
		collection.setBasePath(base);
		return collection;
	}

	/**
	 * Returns the collection path for an EJS or tracker tree.
	 * 
	 * @param path the ComPADRE query string
	 * @param primarySubjectOnly true to limit results to their primary subject
	 * @return the corrected ComPADRE query string
	 */
	function getCollectionPath(path, primarySubjectOnly) {
		var isPrimary = path.endsWith(PRIMARY_ONLY);
		if (isPrimary && primarySubjectOnly)
			return path;
		if (!isPrimary && !primarySubjectOnly)
			return path;
		if (!isPrimary && primarySubjectOnly)
			return path + PRIMARY_ONLY;
		return path.substring(0, path.length() - PRIMARY_ONLY.length());
	}

	function endsWith(str, suffix) {
    	return str.indexOf(suffix, str.length - suffix.length) !== -1;
	}

	/**
	 * Determines if a query path limits results to the primary subject only.
	 * 
	 * @param path the path
	 * @return true if path contains a primary-subject-only flag
	 */
	function isPrimarySubjectOnly(path) {
		return path.indexOf(PRIMARY_ONLY) > -1;
	}

	function getNonURIPath(uriPath) {
		if (uriPath == null)
			return null;
		var path = uriPath;
		// String path = XML.forwardSlash(uriPath.trim());
		// remove file protocol, if any
		if (path.indexOf("file:") === 0) { 
			path = path.substring(5);
		}
		// remove all but one leading slash
		while (path.indexOf("//") === 0) { 
			path = path.substring(1);
		}
		// remove last leading slash if drive is specified
		if (path.indexOf("/") === 0 && path.indexOf(":") > -1) {
			path = path.substring(1);
		}
		// replace "%20" with space
		var j = path.indexOf("%20"); 
		while (j > -1) {
			var s = path.substring(0, j);
			path = s + " " + path.substring(j + 3); 
			j = path.indexOf("%20"); 
		}
		// // replace "%26" with "&"
		//	    j = path.indexOf("%26");                           
		// while(j>-1) {
		// String s = path.substring(0, j);
		//	      path = s+"&"+path.substring(j+3);                
		//	      j = path.indexOf("%26");                         
		// }
		return path;
	}

	return self;
}();

WebEJS_TOOLS.getComPADRECollectionIndex = function(listener) {
	return WebEJS_TOOLS.getComPADRECollection(null,null,null,listener);
}
/*
 * Manage the download of the library from url
 */
WebEJS_TOOLS.getComPADRECollection = function(url, parentID, nodeID, listener) {
	const isroot = (parentID == null);
	if (url) url = WebEJS_TOOLS.LibraryComPADRE.EJS_SERVER_RECORDS + url;
	else {
		url = WebEJS_TOOLS.LibraryComPADRE.EJS_SERVER_TREE + WebEJS_TOOLS.LibraryComPADRE.PRIMARY_ONLY;
		parentID = '#';
	}
    // connection
	$.ajax({
		type: 'POST', 
		url: url,
		headers: { "Content-type":"application/x-www-form-urlencoded" },
		dataType: 'xml',
		processData: false,
		success : xml_data => {
    	console.log("Received:");
			console.log(xml_data); 
	    if (isroot) { // get collections
	    	// add elements into treeBuilder
		    var library = WebEJS_TOOLS.libraryComPADRE.getCollection(parentID, url, xml_data);	
				listener(true,library.toJSON());		    		
	    } 
			else { // get resources
		  	// add elements into treeBuilder
		    var nodeName = WebEJS_TOOLS.libraryComPADRE.getNameFromId(nodeID);
		    var collection = WebEJS_TOOLS.libraryCollection(parentID,nodeName);
		    const success = WebEJS_TOOLS.libraryComPADRE.getResources(collection, xml_data);
		    listener(success,collection.toJSON());
			}
		},
			error : error => { 
	    	console.log("No XML content in OSP connection!");
				console.log(error); 
			}
		});

	return;

}    


var WebEJS_GUI = WebEJS_GUI || {};

/**
 * Offers a list of colors
 */
WebEJS_GUI.editorForColor = function() {
	const TOOLS = WebEJS_TOOLS.textTools(); 
	var self = {};

  const _HTML = `
<div class="modal fade" id="mEditorForColorModal" data-bs-backdrop="static" data-bs-keyboard="false" tabindex="-1" aria-hidden="true">
		
	<div id= "mEditorForColorModalDiv" class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
		
		<div class="modal-content">
      	
			<div class="modal-header bg-light text-dark">
    		<img id="mEditorForColorLogo" height="40" class="me-2 d-inline-block align-bottom;">
      		<h5 id="mEditorForColorTitle" class="sTranslatable text-primary modal-title">Select color</h5>
      	<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
    	</div>  

    	<!------------------  end modal header --------------->

			<div class="modal-body">
        <div id="mEditorForColorList" class="container">
          <div class="row">
            <div class="col cEditorForColorOne me-1 mb-1 p-0" style="background: BLACK; width:36px; height:36px;" data-value="Black"></div>
            <div class="col cEditorForColorOne me-1 mb-1 p-0" style="background: DARKGRAY; width:36px; height:36px;" data-value="DarkGray"></div>
            <div class="col cEditorForColorOne me-1 mb-1 p-0" style="background: GRAY; width:36px; height:36px;" data-value="Gray"></div>
            <div class="col cEditorForColorOne me-1 mb-1 p-0" style="background: LIGHTGRAY; width:36px; height:36px;" data-value="LightGray"></div>
            <div class="col cEditorForColorOne me-1 mb-1 p-0 border" style="background: WHITE; width:36px; height:36px;" data-value="White"></div>
            <div class="col cEditorForColorOne me-1 mb-1 p-0" style="background: BLUE; width:36px; height:36px;" data-value="Blue"></div>
            <div class="col cEditorForColorOne me-1 mb-1 p-0" style="background: CYAN; width:36px; height:36px;" data-value="Cyan"></div>
          </div>
          <div class="row">
            <div class="col cEditorForColorOne me-1 mb-1 p-0" style="background: GREEN; width:36px; height:36px;" data-value="Green"></div>
            <div class="col cEditorForColorOne me-1 mb-1 p-0" style="background: MAGENTA; width:36px; height:36px;" data-value="Magenta"></div>
            <div class="col cEditorForColorOne me-1 mb-1 p-0" style="background: RED; width:36px; height:36px;" data-value="Red"></div>
            <div class="col cEditorForColorOne me-1 mb-1 p-0" style="background: PINK; width:36px; height:36px;" data-value="Pink"></div>
            <div class="col cEditorForColorOne me-1 mb-1 p-0" style="background: ORANGE; width:36px; height:36px;" data-value="Orange"></div>
            <div class="col cEditorForColorOne me-1 mb-1 p-0" style="background: YELLOW; width:36px; height:36px;" data-value="Yellow"></div>
            <div class="col cEditorForColorOne me-1 mb-1 p-0" style="background: rgb(200,220,208); width:36px; height:36px;" data-value="rgb(200,220,208)"></div>
          </div>
        </div>
			
				<div class="mt-2 input-group">
					<span  id="mEditorForColorInputLabel" class="sTranslatable input-group-text">Or click to choose a color &rarr;</span>
 					<input type="color" id="mEditorForColorInput" class="form-control" style="height:40px;"
 									aria-label="Title" aria-describedby="mEditorForColorInputLabel">
				</div>
			</div>
      	
    	<!------------------  end modal body --------------->
	
			<div class="modal-footer">
				<span class="flex flex-grow input-group input-group-sm mt-1"> 
				  <span class="sTranslatable input-group-text">Value</span> 
					   <input id="mEditorForColorValue"  type="text" class="flex flex-grow form-control"   
						 placeholder="<Type in or click on an option>" aria-label="Value"   
						 value=""> 
					 <button id= "mEditorForColorCancelButton" class="sTranslatable btn btn-outline-secondary" type="button">Cancel</button>
					 <button id= "mEditorForColorOkButton"     class="sTranslatable btn btn-outline-primary "  type="button">OK</button> 
				 </span>

			</div>

    	<!------------------  end modal footer --------------->

		</div>
		<!------------------  end modal content --------------->
		
	</div>	
	<!------------------  end modal-dialog --------------->

</div>
<!------------------  end modal --------------->
`;

  $( "body" ).append( $(_HTML) );
	var mModal = new bootstrap.Modal(document.getElementById('mEditorForColorModal'))
  $('#mEditorForColorLogo').attr("src",sMainEjsLogo);

	var mListener;

	self.show = function(title, currentValue, listener)  {
		mListener = listener;

		$('#mEditorForColorTitle').text(sMainResources.getString(title));
		currentValue = TOOLS.removeQuotes(currentValue);
		if (currentValue.trim().length>0) {
			$('#mEditorForColorInput').val(currentValue)
			$('#mEditorForColorValue').val(TOOLS.addQuotes(currentValue));
		}
		mModal.show(); 
	}

	$('#mEditorForColorInput').change((event)=>{
		var choice = $('#mEditorForColorInput').val();
		$('#mEditorForColorValue').val(TOOLS.addQuotes(choice));
	});

  $('#mEditorForColorList .cEditorForColorOne').click((event)=>{
    var choice = $( event.target ).data('value');
    $('#mEditorForColorValue').val(TOOLS.addQuotes(choice));
  });

  $('#mEditorForColorList .cEditorForColorOne').dblclick((event)=>{
    mModal.hide();
    var choice = $( event.target ).data('value');
    mListener(TOOLS.addQuotes(choice));
  }); 
    
	$('#mEditorForColorValue').change((event)=>{
		mModal.hide();
		mListener($('#mEditorForColorValue').val().trim());
	});		

	$('#mEditorForColorOkButton').click((event)=>{
		mModal.hide();
		mListener($('#mEditorForColorValue').val().trim());
	});		
	
	$('#mEditorForColorCancelButton').click((event)=>{
		mModal.hide();
	});		

	return self;
}
var WebEJS_GUI = WebEJS_GUI || {};

/**
 * Offers a list of safe fonts: https://www.w3schools.com/cssref/css_fonts_fallbacks.asp
 */
WebEJS_GUI.editorForFont = function() {
	const TOOLS = WebEJS_TOOLS.textTools(); 
	var self = {};

  const _HTML = `
<div class="modal fade" id="mEditorForFontModal" data-bs-backdrop="static" data-bs-keyboard="false" tabindex="-1" aria-hidden="true">
		
	<div id= "mEditorForFontModalDiv" class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
		
		<div class="modal-content">
      	
			<div class="modal-header bg-light text-dark">
    		<img id="mEditorForFontLogo" height="40" class="me-2 d-inline-block align-bottom;">
      		<h5 id="mEditorForFontTitle" class="sTranslatable text-primary modal-title">Select font</h5>
      	<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
    	</div>  

    	<!------------------  end modal header --------------->

			<div class="modal-body">

        <div class="mt-2 input-group">
          <span class="sTranslatable input-group-text">Family</span>
          <select id="mEditorForFontFamily" class="form-select">
            <option selected>"Times New Roman", Times, serif</option>
            <option>Georgia, serif</option>
            <option>Garamond, serif</option>
            <option>Arial, Helvetica, sans-serif</option>
            <option>Tahoma, Verdana, sans-serif</option>
            <option>"Trebuchet MS", Helvetica, sans-serif</option>
            <option>Geneva, Verdana, sans-serif</option>
            <option>"Courier New", Courier, monospace</option>
            <option>"Brush Script MT", cursive</option>
            <option>Copperplate, Papyrus, fantasy</option>
          </select>
        </div>
        <div class="mt-2 input-group">
          <span class="sTranslatable input-group-text">Style</span>
          <select id="mEditorForFontStyle" class="form-select">
            <option selected value="normal normal">Plain</option>
            <option value="normal bold">Bold</option>
            <option value="italic normal">Italic</option>
            <option value="italic bold">Bold+Italic</option>
          </select>
        </div>
        
        <div class="mt-2 input-group">
          <span class="sTranslatable input-group-text">Size</span>
          <select id="mEditorForFontSize" class="form-select">
            <option selected value="default">Default</option>
            <option value="pixels">pixels:</option>
            <option value="xx-small">xx small</option>
            <option value="x-small">x small</option>
            <option value="small">small</option>
            <option value="medium">medium</option>
            <option value="large">large</option>
            <option value="x-large">x large</option>
            <option value="xx-large">xx large</option>
            <option value="smaller">smaller</option>
            <option value="larger">larger</option>
          </select>
          <input id="mEditorForFontSizeInput" type="text" class="form-control d-none" value="10"
                placeholder="Enter pixel size" >
        </div>

        <!-- div id="mEditorForFontSizePixels" class="mt-2 input-group">
          <span class="sTranslatable input-group-text">Pixels</span>
          <input id="mEditorForFontSizePixelsSlider" class="input-range"  type="range"  step="1" value="10" min="6" max="49">
        </div-->
			
        <div class="sTranslatable mt-2">Demo</div>
				<div class="border border-dark p-1" id="mEditorForFontDemo">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. 
            Phasellus imperdiet, nulla et dictum interdum, nisi lorem 
            egestas odio, vitae scelerisque enim ligula venenatis dolor.
        </div>
        
			</div>
      	
    	<!------------------  end modal body --------------->
	
			<div class="modal-footer">
				<span class="flex flex-grow input-group input-group-sm mt-1"> 
				  <span class="sTranslatable input-group-text">Value</span> 
					   <input id="mEditorForFontValue"  type="text" class="flex flex-grow form-control"   
						 placeholder="<Type in or click on an option>" aria-label="Value"   
						 value=""> 
					 <button id= "mEditorForFontCancelButton" class="sTranslatable btn btn-outline-secondary" type="button">Cancel</button>
					 <button id= "mEditorForFontOkButton"     class="sTranslatable btn btn-outline-primary "  type="button">OK</button> 
				 </span>

			</div>
		</div>
	</div>	
</div>
<!------------------  end modal --------------->
`;

  $( "body" ).append( $(_HTML) );
	var mModal = new bootstrap.Modal(document.getElementById('mEditorForFontModal'))
  $('#mEditorForFontLogo').attr("src",sMainEjsLogo);

	var mListener;

	self.show = function(title, currentValue, listener)  {
		mListener = listener;

		$('#mEditorForFontTitle').text(sMainResources.getString(title));
		currentValue = TOOLS.removeQuotes(currentValue);
		if (currentValue.trim().length>0) {
			$('#mEditorForFontInput').val(currentValue)
			$('#mEditorForFontValue').val(TOOLS.addQuotes(currentValue));
		}
		mModal.show(); 
	}

  // Listeners
  
  $('#mEditorForFontFamily').change((event)=>{
    const family = $('#mEditorForFontFamily option:selected').text();
    $('#mEditorForFontDemo').css("font-family",family);
    updateValue();
  });

  $('#mEditorForFontStyle').change((event)=>{
    const style = $('#mEditorForFontStyle option:selected').val();
    var keys = style.split(' ');
    $('#mEditorForFontDemo').css("font-style",keys[0]);
    $('#mEditorForFontDemo').css("font-weight",keys[1]);
    updateValue();
  });

  $('#mEditorForFontSize').change((event)=>{
    const size = $('#mEditorForFontSize option:selected').val();
    if (size=="pixels") {
      $('#mEditorForFontSizeInput').removeClass('d-none');
      var pixelSize = $('#mEditorForFontSizeInput').val();
      if (pixelSize.trim().length==0) $('#mEditorForFontDemo').css("font-size",'');
      else $('#mEditorForFontDemo').css("font-size",pixelSize.trim()+'px');
      updateValue();
      return;
    }
    $('#mEditorForFontSizeInput').addClass('d-none');
    if (size=="default") $('#mEditorForFontDemo').css("font-size",'');
    else $('#mEditorForFontDemo').css("font-size",size);
    updateValue();
  });

  function updateValue() {
    const family = $('#mEditorForFontFamily option:selected').text();
    const style = $('#mEditorForFontStyle option:selected').val();
    var sizeStr = 'medium';
    const size = $('#mEditorForFontSize option:selected').val();
    if (size=="pixels") {
      var pixelSize = $('#mEditorForFontSizeInput').val();
      if (pixelSize.trim().length==0) sizeStr = pixelSize+'px';
    }
    else sizeStr = size;
    const value = style +' ' + sizeStr + ' ' + TOOLS.scapeQuotes(family);
		$('#mEditorForFontValue').val(TOOLS.addQuotes(value));
  }

  $('#mEditorForFontSizeInput').change((event)=>{
      var pixelSize = $('#mEditorForFontSizeInput').val();
      if (pixelSize.trim().length==0) $('#mEditorForFontDemo').css("font-size",'');
      else $('#mEditorForFontDemo').css("font-size",pixelSize.trim()+'px');
      updateValue();
  });   


	$('#mEditorForFontValue').change((event)=>{
		mModal.hide();
		mListener($('#mEditorForFontValue').val().trim());
	});		

	$('#mEditorForFontOkButton').click((event)=>{
		mModal.hide();
		mListener($('#mEditorForFontValue').val().trim());
	});		
	
	$('#mEditorForFontCancelButton').click((event)=>{
		mModal.hide();
	});		

	return self;
}
/*
 * Copyright (C) 2021 Jesús Chacón, Francisco Esquembre and Félix J. Garcia 
 * This code is part of the Web EJS authoring and simulation tool
 */

/**
 * GUI tools
 * @module core
 */

var WebEJS_TOOLS = WebEJS_TOOLS || {};

WebEJS_TOOLS.sTabbedPanelSingleton = null;

/*
	Provides functionality to a TabbedPanel object. 
	TabbedPanel(s) must implement:
		- getMainPanelSelector();
 		- getKeyword();
 		- getPageName();
		
		- getDefaultPageType()
		
		- isPageSecondType(mPageDiv) 	// Optional for panels with two types of pages: forces the next two
		- getSecondType() 			// Optional for panels with two types of pages
		- getSecondTypeLabel()	// Optional for panels with two types of pages

		- reportableChange(mMessage) // Optional for panel which need to report changes at the tabs level

		- setNoPages(); 
		- pageMainBuilder(mPageHash, mPage);
		- pageCommentBuilder(mPageHash, mPage); // Optional
		
		- pageInitialization(mPageDiv, mPages)
		- disablePage(mPageHash, mDisabled) // Optional for pages which need internal disabling
		- pageDeleted(mPageDiv) // Optional for pages which need internal deleting
		
		- getPageObject(mPageHash)
		
	*/
WebEJS_TOOLS.tabbedPanel = function() {
	if (WebEJS_TOOLS.sTabbedPanelSingleton!=null) return WebEJS_TOOLS.sTabbedPanelSingleton;
	
	var self = {};
	
	// ------------------------
	// Tab system and actions
	// ------------------------
	
	// This is required for flex working fine with tabs!!!
	/**
	 * Switches to one of the tabbed pages (and hiodes the others)
	 */
	function switchPage(mMainPanelSelector,activeHash) {
		$(mMainPanelSelector+' .cPageDiv').each(function () {
			if (activeHash<0) activeHash = $(this).data('hash');
			if ($(this).data('hash')==activeHash) $(this).removeClass('d-none');
			else $(this).addClass('d-none');
		});
		$(mMainPanelSelector+' .sPageEditButton').each(function () {
			if ($(this).closest('.cPageTabButton').data('hash')==activeHash) $(this).removeClass('d-none');
			else $(this).addClass('d-none');
		});
	}

	/**
	 * Initializes the tab button to switch the page
	 */
	function initTabButton(mTabButton,mMainPanelSelector) {
		if (mTabButton.hasClass('cPageMenuItem')) return;
		if (mTabButton.closest('.cPageTabButton').find(".sPageEditButton").first().hasClass('d-none')) {
			var activeHash = mTabButton.closest('.cPageTabButton').data('hash');
			switchPage(mMainPanelSelector,activeHash);
		}
	}

	function pageMenuItemAction(mMenuItem,mTabbedPanel) {
		const pageHash = mMenuItem.closest('.cPageTabButton').data('hash');
		const action = mMenuItem.data('action')
		const pageType = mMenuItem.data('type'); // addition and optional info
		pageMenuAction(mTabbedPanel,action,pageHash,pageType);
	}
	
	/**
	 * Initializes a panel after reading several pages
	 */
	self.initPanel = function(mTabbedPanel, mPages) {
		const mainPanelSelector = mTabbedPanel.getMainPanelSelector();
		
		if (mPages==null || mPages.length<=0) {
			$(mainPanelSelector+' .sPanelNoPageBtn').on("click",(event)=>{
				const pageType = $( event.target ).closest('.sPanelNoPageBtn').data('type');
				pageMenuAction(mTabbedPanel,'PageNew',-1,pageType); 
			});
			return;
		}
		// Specific mainPanel page initialization
		$(mainPanelSelector+' .cPageDiv').each(function(){
			mTabbedPanel.pageInitialization($(this),self.findUserPage($(this),mPages));
		})
		// Tabs initialization
		$(mainPanelSelector+' .cPageTabButton').on("click",(event)=>{
			initTabButton($( event.target ),mainPanelSelector);
		});
		$(mainPanelSelector+' .cPageMenuItem').on("click",(event)=>{
			pageMenuItemAction($( event.target ),mTabbedPanel);
		});		
		
		$(mainPanelSelector+' .cPageTabButton').each(function(){
			const hash = $(this).data('hash');
			//if ((page.Active=='true')!=self.isPageDisabled(mTabbedPanel,pageDiv)) enableDisablePage(mTabbedPanel,hash);
			//if (page.Active=='false') enableDisablePage(mTabbedPanel,hash);
			setDivDisabled(mTabbedPanel, hash,!$(this).data('active'))
			setQualifiedName($(this))
		})

		// Show the first page
		switchPage(mainPanelSelector,-1);
	}
	
	// ---------------------------------
	// HTMl for panels, tabs, and pages 
	// ---------------------------------
	
	function oneTabLi(mTabbedPanel, mHash, mPage, mTags) {
		const keyword = mTabbedPanel.getKeyword();
		return ''+ 
			'<li class="nav-item" role="presentation">'+
				'<button class="cPageTabButton nav-link '+mTags.active+'" type="button" '+ // befor it included +mTags.disabled
					' role="tab" data-bs-toggle="tab" '+
					' data-hash='+mHash+
					' data-name="'+mPage.Name+'"'+
					' data-active='+mPage.Active+
					' data-internal='+mPage.Internal+
					' data-type="'+mPage.Type+'"'+
					' id="m'+keyword+'PageTab_'+mHash+'" '+
					' data-bs-target="#m'+keyword+'Page_'+mHash+'" '+
					' aria-controls="m'+keyword+'Page_'+mHash+'" '+
					' aria-selected="'+mTags.aria+'">'+
					'<span class="dropdown">'+
					  '<i class="sPageEditButton dropdown bi bi-file-code '+mTags.display+'" '+
							' id="m'+keyword+'PageTabIcon_'+mHash+'" type="button" data-bs-toggle="dropdown" aria-expanded="false">'+
						'</i>' +
						'<ul class="dropdown-menu" aria-labelledby="m'+keyword+'PageTabIcon_'+mHash+'">'+
								'<li class="dropdown-item sTranslatable cPageMenuItem" data-action="PageNew"  data-type="'+mTabbedPanel.getDefaultPageType()+'" >Create a new page</li>'+
								(mTabbedPanel.isPageSecondType ?
								'<li class="dropdown-item sTranslatable cPageMenuItem" data-action="PageNew"  data-type="'+mTabbedPanel.getSecondType()+'">'+
									mTabbedPanel.getSecondTypeLabel()+
								'</li>'
								: '' 
								)+
								//'<li class="dropdown-item sTranslatable cPageMenuItem" data-action="PageCopy"  >Copy this page</li>'+
								//'<li class="dropdown-item sTranslatable cPageMenuItem" data-action="PageLeft"  >Move this page to the left</li>'+
								//'<li class="dropdown-item sTranslatable cPageMenuItem" data-action="PageLeft"  >Move this page to the right</li>'+
								//'<li class="dropdown-item sTranslatable cPageMenuItem" data-action="PageRename">Rename this page</li>'+
								'<li class="dropdown-item sTranslatable cPageMenuItem" data-action="PageEdit">Rename/Move this page</li>'+
								'<li><hr class="dropdown-divider"></li>'+
								
								(mTabbedPanel.getDefaultPageType()=='DESCRIPTION_EDITOR' ? 
									'<li class="dropdown-item sTranslatable cPageMenuItem" data-action="PageToggleInternal">Tag/Untag as Internal</li>' : '')+

								'<li class="dropdown-item sTranslatable cPageMenuItem" data-action="PageToggle">Enable/Disable this page</li>'+
								'<li class="dropdown-item sTranslatable cPageMenuItem" data-action="PageDelete">Remove this page</li>'+
						'</ul>'+
					'</span>'+
					'<span class="cPageTabButtonLabel">'+mPage.Name+'</span>'+
				'</button>'+
			'</li>';
	}
	
	function onePageDiv(mTabbedPanel, mHash, mPage, mType, mActiveTag) {
		const keyword = mTabbedPanel.getKeyword();
		var commentHTML = mTabbedPanel.pageCommentBuilder ?
			'<div class="sCommentPanel d-flex flex-column" style="flex-basis:0;flex-grow: 0">'+
				mTabbedPanel.pageCommentBuilder(mHash,mPage)+
			'</div>' :
			'';
		return ''+ 
		'<div class="cPageDiv tab-pane fade col-12 h-100 d-flex flex-column '+mActiveTag+'" role="tabpanel" '+
				' data-hash='+mHash+
				' id="m'+keyword+'Page_'+mHash+'" '+
				' aria-labelledby="m'+keyword+'PageTab_'+mHash+'">'+
			'<div class="sModelBorderedPanel tabContent d-flex flex-column" style="flex-grow:1">'+
				mTabbedPanel.pageMainBuilder(mHash, mPage, mType)+ // Type is an option, only available for Description and Evolution 
			'</div>'+
			commentHTML +
		'</div>';
	}

	/**
	 * Creates the HTML for all pages at once.
	 * Adds a field to each page with the unique id, or hash, of the page in the GUI
	 */
	self.panelHTML = function(mTabbedPanel, mPages) {
		var html = 
			'<ul class="cPageTabs nav nav-pills justify-content-center" role="tablist" style="flex-grow:0; flex-basis:0;">';
		if (mPages) for (var index in mPages) {
			var page = mPages[index];
			var tags = (index==0 ?  
				{'active' : ' active ', 'display': ''					, 'aria' : 'true' } :
				{'active' : ''				, 'display': ' d-none '	, 'aria' : 'false'});
			//tags['disabled'] = page['Active']=="true" ? '' : 'disabled';
			const hash = (index*1+1);
			mPages[index]['gui_hash'] = hash;
			html += oneTabLi(mTabbedPanel,hash,page,tags);
		}
		html += 
			'</ul>'+
			'<div class="cAllPagesDivs tab-content d-flex flex-column" style="flex-grow:1;">';
		if (mPages) for (var index in mPages) {
			const activeTag   = index==0 ? ' show active ' : 'd-none';
			const hash = (index*1+1);
			html += onePageDiv(mTabbedPanel, hash, mPages[index], mPages[index].Type, activeTag);
		}
		html +=
			'</div>';
		return html;
	}

	// ------------------------
	// Page utilities
	// ------------------------

	self.getAllPagesDetectedFiles = function(mTabbedPanel) {
		var pages = [];
		var pageHashes = self.getAllPagesHashList(mTabbedPanel);
		for (var index in pageHashes) {
			var hash = pageHashes[index];
			pages.push(...mTabbedPanel.getPageDetectedFiles(hash));
		}
		return pages;
	}
	
	self.getAllPagesObject = function(mTabbedPanel) {
		var pages = [];
		var pageHashes = self.getAllPagesHashList(mTabbedPanel);
		for (var index in pageHashes) {
			var hash = pageHashes[index];
			pages.push(mTabbedPanel.getPageObject(hash));
		}
		return pages;
	}
	
	self.getAllPagesHashList = function(mTabbedPanel) {
		var hashArray = [];
		$(mTabbedPanel.getMainPanelSelector()+' .cPageTabButton').each(function(){
			hashArray.push($(this).data('hash'));
		});
		return hashArray;
	}

	self.getAllPagesDivList = function(mTabbedPanel) {
		return $(mTabbedPanel.getMainPanelSelector()+' .cPageDiv');
	}

  self.getPagesCount = function(mTabbedPanel) {
    return $(mTabbedPanel.getMainPanelSelector()+' .cPageDiv').length;
  }

	self.getDivPageByHash = function(mTabbedPanel, mHash) {
		var found = null;
		$(mTabbedPanel.getMainPanelSelector()+' .cPageDiv').each(function() {
			const hash = $(this).data('hash')
			if (hash==mHash) { found = $(this); return false; } // will exit the each() loop
		})
		return found;	
	}

	self.getPageDivNameByHash = function(mTabbedPanel, mPageHash) { 
		var found = 'Unnamed';
		$(mTabbedPanel.getMainPanelSelector()+' .cPageTabButton').each(function() {
			const hash = $(this).data('hash')
			if (hash==mPageHash) { found = $(this).data('name'); return false; } // will exit the each() loop
		})
		return found;
	}

	function setPageDivNameByHash(mTabbedPanel, mPageHash, mName) { 
		$(mTabbedPanel.getMainPanelSelector()+' .cPageTabButton').each(function() {
			const hash = $(this).data('hash')
			if (hash==mPageHash) {
				$(this).data('name', mName); 
				setQualifiedName($(this));
				return false; 
			} // will exit the each() loop
		})
	}
	
	self.getPageDivName = function(mTabbedPanel, mPageDiv) { 
		return self.getPageDivNameByHash(mTabbedPanel, self.getPageDivHash(mPageDiv));
	}
	
	self.getPageDivHash = function(mPageDiv) {
		return mPageDiv.data('hash');
	}

	function findUserPageByHash(mPages,mHash) {
		for (var index in mPages) {
			if (mPages[index]['gui_hash']==mHash) return mPages[index];
		}
		return null;
	}

	self.findUserPage = function(mPageDiv,mPages) {
		return findUserPageByHash(mPages,self.getPageDivHash(mPageDiv));
	}

	function getTabButton(mTabbedPanel,mPageHash) {
		const buttons = $(mTabbedPanel.getMainPanelSelector()+' .cPageTabButton');
		var found = null;
		buttons.each(function() {
			if ($(this).data('hash')==mPageHash) { found = $(this); return false; }
		});
		return found;
	}

	function getTabLi(mTabbedPanel,mPageHash) {
		const button = getTabButton(mTabbedPanel,mPageHash);
		if (button) return button.closest('li');
		return null;
	}
	
	self.getPageObject = function(mTabbedPanel, mPageHash) {
		const button = getTabButton(mTabbedPanel,mPageHash);
		const pageDiv = self.getDivPageByHash(mTabbedPanel,mPageHash);
		return { 
			'Name' : button.data('name'), 
			'Active' : button.data('active') ? "true": "false",
		    //'Active' : self.isPageDisabled(mTabbedPanel,pageDiv) ? "true": "false",
//      'Disabled' : self.isPageDisabled(mTabbedPanel,self.getDivPageByHash(mTabbedPanel,mPageHash)) ? "true": "false",
			'Internal' : button.data('internal') ? "true": "false",
			'Type' : button.data('type')
		};
	} 
	
	// ------------------------
	// Init an ACE editor
	// ------------------------

	/**
	 * Used by panels to initialize an ACE editor with code
	 */
	self.initializeCodeEditor = function(aceElementID, initialCode, onBlur, onChange) {
		var editor = ace.edit(aceElementID);
		editor.setTheme("ace/theme/xcode");
		editor.session.setMode("ace/mode/javascript");
		editor.resize();
		editor.on ("blur", onBlur);
		editor.setValue(initialCode,-1);
		editor.clearSelection();
		//editor.on ("change", onChange);
		return editor;
	}

	// ------------------------
	// Menu actions
	// ------------------------
	
	self.isPageDisabled = function(mTabbedPanel,mPageDiv) {
	  //const button = mPageDiv.find(".sPageEditButton").first();
	  //return button.data('active');
      return mPageDiv.attr('disabled');
	}

	function setQualifiedName(button) {
		var label = button.data('name');
		if (button.data('internal')) label += ' (I)'
		if (!button.data('active')) label += ' (D)'
		const labelSpan = button.children('.cPageTabButtonLabel').first();
		labelSpan.text(label);
	}

	function tagUntagInternalPage(mTabbedPanel,mPageHash) {
		$(mTabbedPanel.getMainPanelSelector()+' .cPageTabButton').each(function() {
			if ($(this).data('hash')==mPageHash) {
				if ($(this).data('internal')) $(this).data('internal',false);
				else $(this).data('internal',true);
				setQualifiedName($(this));
				return false;
			}
		})
		if (mTabbedPanel.reportableChange) mTabbedPanel.reportableChange('page tagged/untagged internal');
	}

	function setDivDisabled(mTabbedPanel,mPageHash,disabled) {
		const pageDiv = self.getDivPageByHash(mTabbedPanel,mPageHash);
		pageDiv.attr('disabled', disabled);
		pageDiv.find('*').attr('disabled', disabled);
		if (mTabbedPanel.disablePage) mTabbedPanel.disablePage(mPageHash,disabled);
	}
	
	function enableDisablePage(mTabbedPanel,mPageHash) {
		const button = getTabButton(mTabbedPanel,mPageHash);
		var active = !button.data('active');
		button.data('active',active);
		setDivDisabled(mTabbedPanel,mPageHash, !active);
		setQualifiedName(button);
		if (mTabbedPanel.reportableChange) mTabbedPanel.reportableChange('page enabled/disabled');
	}
	
	function createPageListener(mTabbedPanel, mOptions) {
		const relObjHash = mOptions['relative_hash']; 
		const relTab = relObjHash>=0 ? getTabLi(mTabbedPanel,relObjHash) : null;
		var newLi, newDiv;
		const copyPage = mOptions['copy_hash']>=0 ? mTabbedPanel.getPageObject(mOptions['copy_hash']) : null;
		const emptyPage = { 'Name' : mOptions.name, 'Active' : true, 'Internal' : "false", 'Type' : mOptions.type } 
		if (relTab==null) {
			const tags = {'disabled' : '', 'active' : ' active show ',  'display': ''	, 'aria' : 'true' };
			newLi  = $(oneTabLi(mTabbedPanel,mOptions.hash,emptyPage,tags));
			newDiv = $(onePageDiv(mTabbedPanel, mOptions.hash, null, mOptions.type, ' show active '));
			$(mTabbedPanel.getMainPanelSelector()).html(self.panelHTML(mTabbedPanel,null));
			$(mTabbedPanel.getMainPanelSelector()+' .cPageTabs').append(newLi);
		}
		else {
			const tags = {'disabled' : '', 'active' : '', 'display': ' d-none ', 'aria' : 'false' };
			newLi  = $(oneTabLi(mTabbedPanel,mOptions.hash,emptyPage,tags));
			newDiv = $(onePageDiv(mTabbedPanel, mOptions.hash, copyPage, mOptions.type, 'd-none'));
			if (mOptions['relative_position']=='before') newLi.insertBefore(relTab);
			else newLi.insertAfter(relTab); 				
		}
		$(mTabbedPanel.getMainPanelSelector()+' .cAllPagesDivs').append(newDiv);

		mTabbedPanel.pageInitialization(newDiv,copyPage);
		newLi.on("click",' .cPageTabButton',(event)=>{
			initTabButton($( event.target ),mTabbedPanel.getMainPanelSelector());
		});
		newLi.on("click",' .cPageMenuItem',(event)=>{
			pageMenuItemAction($( event.target ),mTabbedPanel);
		});

		newLi.find('.cPageTabButton').trigger('click');	
		sMainGUI.setChanged();	
	}


	function editPageListener(mTabbedPanel, mOptions) {
		setPageDivNameByHash(mTabbedPanel, mOptions['hash'], mOptions['name']);

		if (mOptions['relative_position']!='as_is') {
			const li = getTabLi(mTabbedPanel,mOptions['hash']);
			const relTab = getTabLi(mTabbedPanel,mOptions['relative_hash']);
			if (mOptions['relative_position']=='before') li.insertBefore(relTab);
			else li.insertAfter(relTab);
			if (mTabbedPanel.reportableChange) mTabbedPanel.reportableChange('page relocated');
		}
	} 

	function deletePageListener(mTabbedPanel, mPageHash) {
		const li = getTabLi(mTabbedPanel,mPageHash);
		const div = self.getDivPageByHash(mTabbedPanel,mPageHash);
		const liIndex = li.index();
		const liCount = $(mTabbedPanel.getMainPanelSelector()+' .cAllPagesDivs').children().length;
		var liToSelect = null;
		if (liCount>1) liToSelect = (liIndex>0 ? li.prev() : li.next());
		if (mTabbedPanel.pageDeleted) mTabbedPanel.pageDeleted(div);
		li.remove();
		div.remove();
		if (liToSelect) liToSelect.find('.cPageTabButton').trigger('click');
		else mTabbedPanel.setNoPages();
		if (mTabbedPanel.reportableChange) mTabbedPanel.reportableChange('page deleted');
	}

	// ------------------------
	// Menu options
	// ------------------------
		
	function getFreeHash(mTabbedPanel) {
		var maxHash = 0;
		$(mTabbedPanel.getMainPanelSelector()+' .cPageTabButton').each(function() {
			maxHash = Math.max(maxHash,$(this).data('hash'));
		});
		return maxHash+1;
	}

	// Different menu actions on the tabbed pages	
	function pageMenuAction(mTabbedPanel, mAction, mPageHash, mPageType) {
		switch (mAction) {
			case "PageNew" : 
				pageForm(mTabbedPanel,mPageHash, createPageListener, { 'type' : mPageType, 'edition' : false });
				break;
			case "PageEdit" : 
				pageForm(mTabbedPanel,mPageHash, editPageListener, { 'edition' : true });
				break;
			case 'PageDelete':
				sMainConfirmationForm.show(self.getPageDivNameByHash(mTabbedPanel, mPageHash),
					"Do you really want to delete this page?",
					"Delete",
					function() { deletePageListener(mTabbedPanel,mPageHash);}
				);
			break;
			case "PageToggle" : 
				enableDisablePage(mTabbedPanel,mPageHash);
				break;
			case "PageToggleInternal" : 
				tagUntagInternalPage(mTabbedPanel,mPageHash);
				break;
		}
	}

	function locationHTML(mPagesTabButtons, mPageHash, mIsEdition) {
		if (mPagesTabButtons.length==0) return '';
		if (mIsEdition && mPagesTabButtons.length==1) return '';
		var html = ''+
			'<div class="mb-3">'+
				'<label class="form-label">'+sMainResources.getString("Place it")+'</label>'+
				'<div class="input-group-text" id="mMainPageModalLocation">'+
			(mIsEdition ? 
			  	'<span class="form-check form-check-inline">'+
			  		'<input class="form-check-input" type="radio" checked '+
			 			  ' name="mMainPageModalLocationOptions" id="mMainPageModalLocationAsIs" value="as_is">'+
			  		'<label class="form-check-label" for="mMainPageModalLocationAsIs">'+sMainResources.getString("As is")+'</label>'+
			  	'</span>'			
			: '')+
			  	'<span class="form-check form-check-inline">'+
			  		'<input class="form-check-input" type="radio" '+
			 			  ' name="mMainPageModalLocationOptions" id="mMainPageModalLocationBefore" value="before">'+
			  		'<label class="form-check-label" for="mMainPageModalLocationBefore">'+sMainResources.getString("Before")+'</label>'+
			  	'</span>'+
			  	'<span class="form-check form-check-inline">'+
			  		'<input class="form-check-input" type="radio" '+ (mIsEdition ? '' : ' checked ')+
			 			  ' name="mMainPageModalLocationOptions" id="mMainPageModalLocationAfter" value="after">'+
			  		'<label class="form-check-label" for="mMainPageModalLocationAfter">'+sMainResources.getString("After")+'</label>'+
			  	'</span>'+
		  		'<select class="form-select" id="mMainPageModalLocationList">';
		var notDone = true;
		mPagesTabButtons.each(function() {
			const hash = $(this).data('hash');
			if (!mIsEdition) 
				html += '<option value="'+hash+'"'+(hash==mPageHash ? ' selected':'')+'>'+$(this).data('name')+'</option>';			
			else if (hash!=mPageHash) {
				html += '<option value="'+hash+'"'+(notDone ? ' selected':'')+'>'+$(this).data('name')+'</option>';
				notDone = false;
			}			
		});
		html += ''+
					'</select>'+
				'</div>'+
			'</div>';
		return html;
	}
	
	function pageForm (mTabbedPanel, mPageHash, mListener, mOptions) {
		const pagesTabButtons = $(mTabbedPanel.getMainPanelSelector()+' .cPageTabButton');
		const pageDiv = self.getDivPageByHash(mTabbedPanel,mPageHash);
		const newPageHash = (mOptions['edition'] ? -1 : getFreeHash(mTabbedPanel));

		var duplicateHtml = '';
		var addDuplication = pageDiv && !mOptions['edition'];
		if (addDuplication) {
			if (mTabbedPanel.isPageSecondType) {
				const isSecondType = mOptions['type']==mTabbedPanel.getSecondType();
				addDuplication = (isSecondType == mTabbedPanel.isPageSecondType(pageDiv));
			}
			if (addDuplication) duplicateHtml = ''+
				'<div class="form-check mb-3">'+
				  '<input class="form-check-input" type="checkbox" value="" '+
				 		' name="mMainPageModalCopy" id="mMainPageModalCopy">'+
				  '<label class="form-check-label" for="mMainPageModalCopy">'+sMainResources.getString("Copy existing page")+'</label>'+
				'</div>'
		}
		
		/*
		const editionHtml = mOptions['edition'] ?
			'<div class="input-group mb-3">'+
				'<button type="button" class="w-100 btn btn-danger" data-action="Delete">'+sMainResources.getString("Delete element")+'</button>'+
			'</div>'
			: '';
		*/
		const basicHtml =
			'<div class="input-group mb-3 mt-3">'+
				'<span class="input-group-text" id="mMainPageModalNameLabel">'+sMainResources.getString("Name")+'</span>'+
				'<input type="text" class="form-control" id="mMainPageModalNameField" '+
				(mOptions['edition'] ? 
					'value="'+self.getPageDivNameByHash(mTabbedPanel, mPageHash)+'" ' :
					'value="'+sMainResources.getString(mTabbedPanel.getPageName()) + ' '+newPageHash+'" ')+
					'placeholder="Page name here" aria-label="Page name" aria-describedby="mMainPageModalNameLabel">'+
			'</div>'+
			duplicateHtml+
			locationHTML(pagesTabButtons, mPageHash, mOptions['edition'])
			//+ editionHtml
			;
			
		const modalHtml =   
			'<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable ">'+
				'<div class="modal-content">'+
					'<div class="modal-header bg-light text-dark">'+
						sMainGUI.getWebEJSLogoImg()+
						'<h5 class="text-primary modal-title">'+ sMainResources.getString(mOptions['edition'] ? 'Edit page' :'Create page')+'</h5>'+
						'<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>'+
					'</div>'+
					'<div class="modal-body">'+
						basicHtml +
					'</div>'+
					'<div class="modal-footer">'+
						'<button type="button" class="btn btn-secondary me-auto" data-action="Close">'+sMainResources.getString("Cancel")+'</button>'+
						'<button type="button" class="btn btn-primary"   data-action="Apply">'+sMainResources.getString("OK")+'</button>'+
					'</div>'+
				'</div>'+
			'</div>';
			 
		$('#mMainPageModal').html(modalHtml);
	  var modal = new bootstrap.Modal(document.getElementById('mMainPageModal'));

	  $('#mMainPageModal .modal-content button').click(function(event) {
			const action = event.currentTarget.dataset.action;
			if (!action) return;
			switch(action) {
				case 'Close' : 
					modal.hide(); 
					break;
					
				case 'Apply' : 
					modal.hide(); 
					mOptions['name'] = $('#mMainPageModalNameField').val();
									
					var locationChecked = $('input[name=mMainPageModalLocationOptions]:checked');
					mOptions['relative_position'] = (locationChecked.length>0) ?  locationChecked.val() : 'as_is';
					
					if (pagesTabButtons.length>0) 
					  mOptions['relative_hash'] = $('#mMainPageModalLocationList option:selected').val();
					else 
						mOptions['relative_hash'] = -1;
		
					mOptions['hash'] = mOptions['edition'] ? mPageHash : newPageHash;
					if (addDuplication) mOptions['copy_hash'] = $('#mMainPageModalCopy').is(":checked") ? mPageHash : -1;
					else mOptions['copy_hash'] = -1;
					mListener(mTabbedPanel,mOptions);
					break;
				default : 
					modal.hide();
					break;
			}
		});	
		modal.show();
	}

	// ------------------------
	// That's it'
	// ------------------------
		
	WebEJS_TOOLS.sTabbedPanelSingleton = self;
	return self;
};

/*
 * Copyright (C) 2021 Jesús Chacón, Francisco Esquembre and Félix J. Garcia 
 * This code is part of the Web EJS authoring and simulation tool
 */

/**
 * GUI tools
 * @module core
 */

var WebEJS_TOOLS = WebEJS_TOOLS || {};

/*
	Provides functionality to a Table object. 
	Table(s) must implement:
	  - getKeyword()
	  
	  - setRow(rowID,rowObject);
	  - getRowObject(rowElement)
	  
	*/
WebEJS_TOOLS.tablePanel = function(mTableParent) {	
	var self = {};
  var mRowHash = 0;
  var mRowsClipboard = [];
  
	// -------------------------------------------
	// Fill the newly created tables 
	// (so that it respects the inverted commas)
	// -------------------------------------------

  var mRowsToSet = [];
  
  self.processRowsToSet = function() {
    for (var i=0; i<mRowsToSet.length; i++) {
      var array = mRowsToSet[i];
      mTableParent.setTableRow(array[0],array[1],array[2]);
    }
    mRowsToSet = [];
  }
  
  // -------------------------------------
  // Return the HTML to create the table
  // -------------------------------------

  function getHeaderHTML(baseID, columnHeaders) {
    var html =
      '<thead class="table-primary">'+
        '<tr>'+
          '<th scope="col">'+
            '<div class="dropdown">'+
              '<button type="button" class="btn btn-link text-decoration-none dropdown-toggle" '+
                'id="'+baseID+'_MenuButton" '+
                'style="padding:0px 5px 0px 0px; border:0px; " data-bs-toggle="dropdown"aria-expanded="false">'+
              '</button>'+
              '<ul class="dropdown-menu cTablePanelMenu" data-target="variables" '+
                'aria-labelledby="'+baseID+'_MenuButton">'+
                '<li class="dropdown-item sTranslatable cTablePanelMenuItem" data-action="InsertBefore">Insert before</li>'+
                '<li class="dropdown-item sTranslatable cTablePanelMenuItem" data-action="InsertAfter" >Insert after</li>'+
                '<li class="dropdown-item sTranslatable cTablePanelMenuItem" data-action="MoveUp"      >Move up</li>'+
                '<li class="dropdown-item sTranslatable cTablePanelMenuItem" data-action="MoveDown"    >Move down</li>'+
                '<li><hr class="dropdown-divider"></li>'+
                '<li class="dropdown-item sTranslatable cTablePanelMenuItem" data-action="Cut"         >Cut</li>'+
                '<li class="dropdown-item sTranslatable cTablePanelMenuItem" data-action="Copy"        >Copy</li>'+
                '<li class="dropdown-item sTranslatable cTablePanelMenuItem" data-action="Paste"       >Paste</li>'+
              '</ul>'+
            '</div>'+
          '</th>';
    for (var i=0; i<columnHeaders.length; i++) {
      const header = columnHeaders[i];
      if ("class" in header) {
        html += '<th class="sTranslatable '+header['class']+'" scope="col">'+header['name']+'</th>';
      }
      else html += '<th class="sTranslatable" scope="col">'+header['name']+'</th>';
    }
    html +=         
        '</tr>'+
      '</thead>';
    return html; 
  }

  function rowHTML(pageHash, row) {
    mRowHash++;
    const rowID = getBaseID(pageHash)+'_Row_'+mRowHash;
    mRowsToSet.push([ pageHash, rowID, row ]);
    var html = 
      '<tr class="cTableTr" data-hash="'+mRowHash+'">'+
        '<td><input type="checkbox"/></td>'+
          mTableParent.getTableRowHTML(pageHash,mRowHash,rowID)+
      '</tr>';
    return html;
  }

  function getBaseID(pageHash) {
    return "m"+mTableParent.getKeyword()+"_Table_"+pageHash;
  }  
  
  function getBody(pageHash) {
    return $('#'+getBaseID(pageHash)+'_Body');
  }

  self.getRows = function(pageHash) {
    return $('#'+getBaseID(pageHash)+'_Body .cTableTr');
  }
  
  function getRowHash(rowTr) {
    return rowTr.data('hash');
  }
  
  self.getTableHTML = function (pageHash, columnHeaders,rowList) {
    const baseID = getBaseID(pageHash);
    if (rowList.length==0) rowList.push(mTableParent.getTableEmptyRow());
    var html = 
      '<table id="'+baseID+'" class="table table-sm small">'+
        getHeaderHTML(baseID, columnHeaders)+
        '<tbody id="'+baseID+'_Body">';
    for (var i=0; i<rowList.length; i++) html += rowHTML(pageHash,rowList[i]);
    html +=
        '</tbody>'+
      '</table>';
    return html;
  }
  
  self.getTableRows = function(pageHash, addTR) {
    var rows = [];
    self.getRows(pageHash).each(function() {
      const tdArray = $(this).children();
      var row = mTableParent.getTableRowObject(tdArray);
      if (addTR) row['_tr_'] = $(this);
      rows.push(row);
    });
    return rows;
  }

  const sSELECTOR = 0;
  
  function getSelectedRows(pageHash) {
    var selection = [];
    self.getRows(pageHash).each(function() {
      const tdArray = $(this).children();
      if (tdArray[sSELECTOR].firstChild.checked) selection.push($(this).index());
    });
    return selection;
  }

  self.getText = function (tdArray, column) {
    return tdArray[column].firstChild.value;
  }

  self.setText = function(tdArray, column, value) {
    return tdArray[column].firstChild.value = value;
  }
  
  // ---------------------
  // variables menu
  // ---------------------

  self.findRowTDArrayByHash = function(pageHash, rowHash) {
    var found = null;
    self.getRows(pageHash).each(function() {
      if ($(this).data('hash')==rowHash) { found = $(this).children(); return false; }
    });
    return found;
  }

  self.highlightRows = function(pageHash, rowHash) {
    self.getRows(pageHash).each(function() {
      if ($(this).data('hash')==rowHash) $(this).css('background','lightGrey')
      else $(this).css('background','white')
    });
  }

    self.removeWarnings = function(pageHash) {
    self.getRows(pageHash).removeClass('bg-warning');
  }
    
  self.tableInitialization = function(pageHash) {
    self.getRows(pageHash).each(function() { 
      mTableParent.tableRowInitialization(pageHash, getRowHash($(this)), $(this));
    });

    $('#'+getBaseID(pageHash)).find('.cTablePanelMenuItem').on("click", (event)=>{
      rowMenuAction(pageHash, $(event.target).data('action'), getSelectedRows(pageHash));
    });
    self.processRowsToSet();
  }
  
  function rowMenuAction(pageHash, action, selection) {
    console.log("Action "+action+ " on page "+pageHash+". Selection = ");
    console.log (selection);
    switch (action) {
      case "InsertBefore":
        var position = 0; 
        if (selection.length>0) position = selection[0];
        insertRow(pageHash,position,true);
        break;
      case "InsertAfter":
        var position = -1; 
        if (selection.length>0) position = selection[selection.length-1];
        insertRow(pageHash,position,false);
        break;
      case "MoveUp":
        moveRows(pageHash, selection, true);
        break;
      case "MoveDown":
        moveRows(pageHash, selection, false);
        break;
      case "Cut":
        copyRows(pageHash,selection,true);
        break;
      case "Copy":
        copyRows(pageHash,selection,false);
        break;
      case "Paste":
        pasteRows(pageHash,selection);
        break;
    }
  }

  // ---------------------
  // Menu actions
  // ---------------------

  self.appendEmptyRow = function(pageHash) {
    const rowData = mTableParent.getTableEmptyRow();
    const row = $(rowHTML(pageHash, rowData));
    getBody(pageHash).append(row);
    self.processRowsToSet();
    mTableParent.tableRowInitialization(pageHash, mRowHash, row);
  }
  
  function insertRow(pageHash, position, before) {
    const rowData = mTableParent.getTableEmptyRow();
    const tableBody = getBody(pageHash); 
    
    var row = $(rowHTML(pageHash, rowData));
    if (tableBody.children().length<=0) tableBody.append(row);
    else {
      const rows = self.getRows(pageHash);
      if (before) row.insertBefore(rows.eq(position));
      else if (position>=0) row.insertAfter(rows.eq(position));
      else tableBody.append(row);
    }
    self.processRowsToSet();
    mTableParent.tableRowInitialization(pageHash, mRowHash, row);
    mTableParent.nonReportableChange("Empty row added");
  }

  function moveRows(pageHash, selection, up) {
    var prevRow=null;
    const rows = self.getRows(pageHash);
    if (up) {
      rows.each(function() {
        if (selection.includes($(this).index())) {
          if (prevRow!=null) $(this).insertBefore(prevRow);
        }
        else prevRow = $(this);
      }); 
    }
    else {
      $(rows.get().reverse()).each(function() {
        if (selection.includes($(this).index())) {
          if (prevRow!=null) $(this).insertAfter(prevRow);
        }
        else prevRow = $(this);
      }); 
    }
    mTableParent.reportableChange("Raw orders changed in page "+pageHash);
  }
  
  function copyRows(pageHash, selection, andDelete) {
    mRowsClipboard = [];
    var deleteList = [];
    self.getRows(pageHash).each(function() {
      if (selection.includes($(this).index())) {
        mRowsClipboard.push(mTableParent.getTableRowObject($(this).children()));
        if (andDelete) deleteList.push($(this));
      }
    });
    if (deleteList.length>0) removeRowList(pageHash,deleteList)
  }

  function removeRowList(pageHash, rowList) {
    for (var i=0; i<rowList.length; i++) {
      const row = rowList[i];
      if (mTableParent.rowRemoved) mTableParent.rowRemoved(pageHash,row.data('hash'));
      row.remove();
    }
    mTableParent.reportableChange("Rows removed in page "+pageHash);
  }
  
  function pasteRows(pageHash, selection) {
    if (mRowsClipboard.length<=0) return;
    var lastRow=null;
    self.getRows(pageHash).each(function() {
      if (selection.includes($(this).index())) lastRow = $(this);
    });
    if (lastRow==null) {
      const tableBody = getBody(pageHash); 
      for (var i=0; i<mRowsClipboard.length; i++) {
        var row = $(rowHTML(pageHash, mRowsClipboard[i]));
        tableBody.append(row);  
        mTableParent.tableRowInitialization(pageHash, mRowHash, row);
      }
    }
    else {
      for (var i=0; i<mRowsClipboard.length; i++) {
        var row = $(rowHTML(pageHash, mRowsClipboard[i]));
        row.insertAfter(lastRow);
        mTableParent.tableRowInitialization(pageHash, mRowHash, row);
        lastRow = row;
      }
    } 
    self.processRowsToSet();
    mTableParent.reportableChange("Rows pasted in page "+pageHash);
  }

	return self;
};

/*
 * Copyright (C) 2021 Jesús Chacón, Francisco Esquembre and Félix J. Garcia 
 * This code is part of the Web EJS authoring and simulation tool
 */

/**
 * GUI tools
 * @module coresssss
 */

var WebEJS_TOOLS = WebEJS_TOOLS || {};

WebEJS_TOOLS.sTextSingleton = null;

WebEJS_TOOLS.textTools = function() {
	if (WebEJS_TOOLS.sTextSingleton!=null) return WebEJS_TOOLS.sTextSingleton;

	var self = {};

	self.removeQuotes = function (aString) {
		while (aString.startsWith('"')) aString = aString.substring(1); 	
		while (aString.endsWith('"')) 	aString = aString.substring(0,aString.length-1);
		return aString; 	
	}

	self.addQuotes = function (aString) {
		if (!aString.startsWith('"')) aString = '"'+aString; 	
		if (!aString.endsWith('"')) 	aString += '"';
		return aString; 	
	}
	
	self.scapeQuotes = function (aString) {
    return aString.replaceAll('"','\\"');
  }
  
	self.getCustomMethods = function(pageName, code) {
		var list = [];
		const ast = esprima.parseScript(code);
		console.log(ast);
		if (!ast.body) return list;
		for (var i in ast.body) {
			var entry = ast.body[i];
			if (entry.type=="FunctionDeclaration") {
				var params = "";
				for (var j in entry.params) {
					const param = entry.params[j];
					params += (", "+param.name);
				}
				if (params.startsWith(',')) params = params.substring(1).trim();
				const name = entry.id.name +'('+params+')';
				const description = '// ' +sMainResources.getString("Declared in page") +' '+pageName;
				list.push({'name' : name, 'description' : description });
			}
		}
		return list;
	}
	
	function getCode(variable) { 
    var name = variable.name.trim();
    var value = variable.value.trim();
    if (name.length>0) { // look for repeated declarations
      var index = name.indexOf('[');
      if (index>0) { // It is an array
        just_name = name.substring(0,index);
        if (value.length<=0) return just_name + ' = []'; //+'; alert("'+variable.name+'")';
        name_end = name.substring(index+1);
        index = name_end.indexOf(']');
        if (index<=0) return '{ __i=0; '+ just_name + ' = []; ' + just_name+'[__i] = '+value+ ' }';
        var indexStr = name_end.substring(0,index).trim();
        if (indexStr.length<=0) return '{ __i=0; '+ just_name + ' = []; ' + just_name+'[__i] = '+value+ ' }';
        const finalStr = '{ '+indexStr+'=0; '+ just_name + ' = []; ' + just_name+'['+indexStr+'] = '+value+ ' }';
        return finalStr;
      }
      // Not an array 
      if (value.length>0) return name + ' = '+value; //+'; alert("'+variable.name+'")';
    	return name + ' = undefined';
		}
		if (value.length>0) return value;
		return "";
	}
	
	function checkOneLine(interpreter, variable, code) {
		try {
			interpreter.appendCode(code);
			interpreter.run();
			return true;
		}
		catch (exc) {
      sMainGUI.println ("INTERPRETER ERROR IN "+variable.name+" = "+variable.value+" : "+exc.message);
			return false;
		}
	} 

	const mIsMobile = (navigator===undefined) ? false : navigator.userAgent.match(/iPhone|iPad|iPod|Android|BlackBerry|Opera Mini|IEMobile/i);
	
	self.checkCode = function(variableArray) {
		/*
		var initFunc = function(interpreter, globalObject) {
      var wrapper = function alert(text) {
        return console.log(text);
      };
      interpreter.setProperty(globalObject, 'alert',
          interpreter.createNativeFunction(wrapper));
    };
		var interpreter = new Interpreter('_i=0;', initFunc); // for use in arrays
		*/
		var interpreter = new Interpreter('_i=0;'); // for use in arrays
		interpreter.appendCode("_isPlaying = false;");
		interpreter.appendCode("_isPaused = true;");
		interpreter.appendCode("_isEPub = false;");
		interpreter.appendCode("_isMobile = "+mIsMobile);
		for (var i in variableArray) {
			const variable = variableArray[i];
      try {
        var name = variable.name.trim();
  			if (name.length>0) { // look for repeated declarations
  			  var index = name.indexOf('[');
  			  if (index>0) name = name.substring(0,index);
  				interpreter.appendCode("typeof "+name+ ' === "undefined"')	;
  				interpreter.run();
  				if (interpreter.value==false) {
  					variable['run_ok'] = false;
  					continue;
  				}
  			}
  			const code = getCode(variable);
  			variable['run_ok'] = code.length>0 ? checkOneLine(interpreter,variable,code) : true;
      }
      catch (exc) {      
        variable['run_ok'] = false;
      }
		}
		return variableArray;
	}

	// ------------------------
	// That's it'
	// ------------------------
		
	WebEJS_TOOLS.sTextSingleton = self;
	return self;
};