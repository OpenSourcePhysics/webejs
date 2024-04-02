var EJSS_INPUT_OUTPUT = EJSS_INPUT_OUTPUT || {};

EJSS_INPUT_OUTPUT.websocket = function (serviceUrl, fixedUrl, processInputFunction) {
  var self = {};
  
  var mWebsocket;
  var mMustWait = 30;
  var mOpenTry = 0;  
  var mConnected = false;
  var mShouldReconnect = true;
  
  self.isConnected = function() {
  	return mConnected;
  };

  self.setWaitTime = function(seconds) { mMustWait = seconds; }

  /**
   * Start a WS client listening to the given WS server 
   * @param {String} url The url of the WS server
   */
  self.start = function(url) {
    try {
      mWebsocket = new WebSocket(url);
      console.log('Connecting... (readyState ' + mWebsocket.readyState + ') to '+url);
      mWebsocket.onopen = function(message) {
        mOpenTry = 0;
        mConnected = true;
    	mShouldReconnect = true;
    	if (self.onConnectionOpened) self.onConnectionOpened(message);
    	console.log("Openhd Event: " + message.type + " - Message: " + message.data);
      };
      mWebsocket.onclose = function(evt) {
        mConnected = false;
        if (self.onConnectionClosed) self.onConnectionClosed(evt);
        if (mShouldReconnect) {
      	  if (mMustWait<=0 || mOpenTry < mMustWait) {
      		window.setTimeout(function(){ self.start(url); }, 1000); // try to connect again in 1000 mseg
      		mOpenTry++;
      	  }
        }
        console.log("Connection closed: " + evt.type + " - Message: " + evt.data);
      };
      mWebsocket.onerror = function(evt) {
        mConnected = false;
        console.log("Error Event: " + evt.type + " - Message: " + evt.data);
      };
      mWebsocket.onmessage = function(evt) {
        processInputFunction(evt.data);
      };
    } 
    catch(exception) {
      console.log(exception);
    }
  };

  /**
   * Call a service that (optionally) starts a WS server and returns the url. 
   * Then, start a WS client listening to that url. 
   * @param {String} url The url of the service that will start the WS server
   */
  self.startFromService= function(url) {
  	if (mConnected) return;
    // run server model first
    var xmlhttp = new XMLHttpRequest();
    // send command to start the service and get the socket url
    xmlhttp.open("GET", url, true);

    xmlhttp.onreadystatechange = function() {
      if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
        var response = JSON.parse(xmlhttp.responseText);
        console.log("Server responded with service available at : "+response.webserver);
        self.start(response.webserver);
      }
      else console.log("WARNING: Service provider did not respond!:"+url);
    };
    xmlhttp.send();
  };

  self.stop = function() {
    try { 
      mShouldReconnect = false;
      mWebsocket.close(); 
      mConnected = false;
    } 
    catch(exception) {
      console.log(exception);
    }
  };

  self.sendMessage = function (message) {
	if (!mConnected) return false;
    mWebsocket.send(message);
    return true;
  };
  
  // ---------------------------------------
  // Utility functions
  //---------------------------------------

  function startsWith(fullStr, str) {
      return (fullStr.match("^"+str)==str);
   }

  // ---------------------------------------
  // Final start up
  //---------------------------------------
  
  // backwards compatibility
  if (serviceUrl.length>0) self.startFromService(serviceUrl);
  else if (fixedUrl.length>0) {
	  if (startsWith(fixedUrl.toLowerCase(),"ws://")) self.start(fixedUrl);
	  else self.start("ws://"+fixedUrl);
  }

  return self;

};

