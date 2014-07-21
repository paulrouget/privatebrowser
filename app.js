const SEARCHURL = "https://duckduckgo.com/?q=%s";
const SCHEMES = ["http://","https://","ftp://"];
const CLEAR_TIMEOUT = 3 * 60 * 1000; // after 3 minutes hidden, we clear the tabs

const BROWSER_EVENTS = [
  "mozbrowserloadstart",
  "mozbrowserloadend",
  "mozbrowsericonchange",
  "mozbrowserlocationchange",
  "historychanged",
  "historychanged",
  "mozbrowsertitlechange",
  "longpress"
];

var gBrowserCount = 0;

var gPrivateMode = false;

var UI = {
  init: function() {
    DecorateWithEventEmitter(this);

    this.setupInputURL();
    this.setupHistoryButtons();
    this.setupNavigationButtons();

    if (gPrivateMode) {
      this.clearBrowserData(function() {
        this.selectBrowser(this.buildBrowser());
      });
    } else {
      this.selectBrowser(this.buildBrowser());
    }
  },

  clearBrowserData: function(callback) {
    // FIXME: is it called?
    var request = navigator.mozApps.getSelf();
    request.onsuccess = function() {
      request.result.clearBrowserData();
      if (callback) {
        callback();
      }
    };
  },

  uninit: function() {
    if (gPrivateMode) {
      this.clearBrowserData();
    }
  },

  onVisibilityChange: function() {
    clearTimeout(this._visibilityTimeout);
    if (gPrivateMode && document.hidden) {
      this._visibilityTimeout = setTimeout(this.killAllTabsAndClearPrivateData, CLEAR_TIMEOUT);
    }
  },

  killAllTabsAndClearPrivateData: function() {
    this.clearBrowserData(function() {
      for (var b of this.browsers) {
        b.destroy();
      }
    });
  },

  onActivityRequestfunction: function(event) {
    var option = event.source;
    var url = option.data.url;
    this.selectBrowser(this.buildBrowser(url));
  },

  browsers: new Set(),
  buildBrowser: function(url, userInput) {
    var browser = new Browser(url, userInput);
    this.browsers.add(browser);
    return browser;
  },

  selectBrowser: function(browser) {
    if (this.currentBrowser) {
      this.currentBrowser.hide();
      this.currentBrowser.removeAllListeners();
    }
    if (browser) {
      for (var e of BROWSER_EVENTS) {
        browser.on(e, this.handleEvent);
      }
      browser.show();
    }

    this.currentBrowser = browser;
    this.updateURLBar()
  },

  /*
    "mozbrowserloadstart",
    "mozbrowserloadend",
    "mozbrowsericonchange",
    "mozbrowserlocationchange",
    "historychanged",
    "mozbrowsertitlechange",
    "longpress"
  */
  handleEvent: function(event) {
    switch (event) {
      case "historychanged":
      case "mozbrowserloadstart":
      case "mozbrowserloadend":
      case "mozbrowsertitlechange":
      case "mozbrowserlocationchange":
        this.updateURLBar();
        break;
      case "longpress":
        this.buildBrowser(this.currentBrowser.longPressLink);
      default:
        break;
    }
  },

  killBrowser: function(browser) {
    this.browsers.delete(browser);
    if (browser == this.currentBrowser) {
      this.currentBrowser = null;
    }
    browser.destroy();
  },

  updateURLBar: function() {
    var urlbar = document.querySelector("#urlbar");
    var input = document.querySelector("#input-url");

    var isFocused = urlbar.classList.contains("focus");

    if (!this.currentBrowser) {
      urlbar.classList.remove("canGoBack");
      urlbar.classList.remove("canGoForward");
      urlbar.classList.remove("loading");
      if (!isFocused) {
        input.value = "";
      }
      return;
    }

    if (this.currentBrowser.canGoBack()) {
      urlbar.classList.add("canGoBack");
    } else {
      urlbar.classList.remove("canGoBack");
    }

    if (this.currentBrowser.canGoForward()) {
      urlbar.classList.add("canGoForward");
    } else {
      urlbar.classList.remove("canGoForward");
    }

    if (this.currentBrowser.isLoading()) {
      urlbar.classList.add("loading");
    } else {
      urlbar.classList.remove("loading");
    }

    if (!isFocused) {
      input.value = this.currentBrowser.prettyTitle;
    }
  },

  setupInputURL: function() {
    var input = document.querySelector("#input-url");
    var urlbar = document.querySelector("#urlbar");
    input.value = "";
    input.onfocus = function() {
      if (UI.currentBrowser) {
        input.value = UI.currentBrowser.userInput;
      }
      input.setSelectionRange(0, input.value.length);
      urlbar.classList.add("focus");
    };
    input.onblur = function() {
      urlbar.classList.remove("focus");
    };
    input.onchange = UI.processInput;
  },

  processInput: function() {
    var input = document.querySelector("#input-url");
    var v = input.value;

    input.blur();

    setTimeout(function() {
      var url;
      if ((v.search(/\s/) > -1) || (v.search(/\./) == -1)) {
        url = SEARCHURL.replace("%s", encodeURI(v));
      } else {
        for (var s of SCHEMES) {
          if (v.search(s) == 0) {
            url = v;
            break;
          }
        }
        if (!url) {
          url = "http://" + v;
        }
      }
      if (UI.currentBrowser) {
        UI.currentBrowser.newURL(url, v);
      } else {
        var browser = UI.buildBrowser(url, v);
        UI.selectBrowser(browser);
      }
    }, 0);
  },

  setupHistoryButtons: function() {
    var back = document.querySelector("#button-back");
    var fwd = document.querySelector("#button-forward");
    back.onclick = function() {
      if (UI.currentBrowser) {
        UI.currentBrowser.iframe.goBack();
      }
    }
    fwd.onclick = function() {
      if (UI.currentBrowser) {
        UI.currentBrowser.iframe.goForward();
      }
    }
  },

  setupNavigationButtons: function() {
    var go = document.querySelector("#button-go");
    var stop = document.querySelector("#button-stop");
    var reload = document.querySelector("#button-reload");
    var addtab = document.querySelector("#button-addtab");

    go.onclick = UI.processInput;
    stop.onclick = function() {
      if (UI.currentBrowser) {
        UI.currentBrowser.iframe.stop();
      }
    }
    reload.onclick = function() {
      if (UI.currentBrowser) {
        UI.currentBrowser.iframe.reload();
      }
    }
    addtab.onclick = function() {
      var browser = UI.buildBrowser();
      UI.selectBrowser(browser);
    }
  },
}

for (var f in UI) {
  if (typeof UI[f] == "function") {
    UI[f] = UI[f].bind(UI);
  }
}

function Browser(url, userInput) {
  DecorateWithEventEmitter(this);
  this.buildDOM();
  this.setupListeners();
  if (url) {
    this.newURL(url, userInput);
  }
}

Browser.prototype = {

  buildDOM: function() {
    var iframe = document.createElement("iframe");
    iframe.setAttribute("mozbrowser", "true");
    iframe.setAttribute("remote", "true");
    iframe.setAttribute("mozasyncpanzoom", "true");
    iframe.setAttribute("mozallowfullscreen", "true");
    document.querySelector("#deck").appendChild(iframe);

    var tab = document.createElement("button");
    tab.className = "button-tab";
    var self = this;
    tab.onclick = function() { UI.selectBrowser(self) }
    document.querySelector("#tabs").appendChild(tab);

    this.iframe = iframe;
    this.tab = tab;
  },

  destroy: function() {
    this.iframe.remove();
    this.tab.remove();
    this.iframe = null;
    this.tab = null;
  },

  canGoBack: function() {
    return this._canGoBack;
  },

  canGoForward: function() {
    return this._canGoForward;
  },

  isLoading: function() {
    return this._loading;
  },

  get title() {
    return this._title;
  },

  get location() {
    return this._location;
  },

  get prettyTitle() {
    var title = this._title;
    var location = this._location == "about:blank" ? "" : this._location;
    var userInput = this._userInput;

    return title || location || userInput || "";
  },

  get longPressLink() {
    return this._longpressLink;
  },

  get favicon() {
    return this._favicon;
  },

  get userInput() {
    return this._userInput || "";
  },

  newURL: function(url, userInput) {
    this._title = null;
    this._location = url;
    this._userInput = userInput;
    this.iframe.src = url;
  },

  hide: function() {
    var self = this;
    clearTimeout(this._visibilityTimeout);
    this._visibilityTimeout = setTimeout(function() {
      // self.iframe.setVisible(false);
    });
    this.iframe.classList.remove("selected");
    this.tab.classList.remove("selected");
  },

  show: function() {
    var self = this;
    clearTimeout(this._visibilityTimeout);
    this._visibilityTimeout = setTimeout(function() {
      // self.iframe.setVisible(true);
    }, 0);
    this.iframe.classList.add("selected");
    this.tab.classList.add("selected");
  },

  setupListeners: function() {
    var self = this;
    var iframe = this.iframe;
    iframe.addEventListener("mozbrowserloadstart", function () {
      self._title = null;
      self._loading = true;
      self.emit("mozbrowserloadstart");
      self.tab.classList.add("loading");
    });

    iframe.addEventListener("mozbrowserloadend", function () {
      self.tab.classList.remove("loading");
      self._loading = false;
      self.emit("mozbrowserloadend");
      if (self.location && self.location != "about:blank") {
        var s = 36 * window.devicePixelRatio;
        console.log("req");
        self.iframe.getScreenshot(s,s).onsuccess = function(e) {
          console.log("done");
          var objectURL = URL.createObjectURL(e.target.result);
          console.log("more");
          self.tab.style.backgroundImage = 'url(' + objectURL + ')';
          // FIXME: revoke
        }
      }
    });

    iframe.addEventListener('mozbrowsererror', function (event) {
      // FIXME
    });

    iframe.addEventListener("mozbrowsericonchange", function (event) {
      self._favicon = event.detail.href;
      self.emit("mozbrowsericonchange");
    });

    iframe.addEventListener("mozbrowserlocationchange", function (event) {
      self._title = null;
      self._location = event.detail;
      self.emit("mozbrowserlocationchange");
      var backReq = iframe.getCanGoBack();
      backReq.onsuccess = () => {
        self._canGoBack = backReq.result;
        self.emit("historychanged");
      }
      var fwdReq = iframe.getCanGoForward();
      fwdReq.onsuccess = (req) => {
        self._canGoBack = backReq.result;
        self.emit("historychanged");
      }
    });

    iframe.addEventListener("mozbrowsertitlechange", function (event) {
      self._title = event.detail;
      self.emit("mozbrowsertitlechange");
    });

    iframe.addEventListener("mozbrowserclose", function (event) {
      UI.killBrowser(self);
    });

    iframe.addEventListener("mozbrowsercontextmenu", function (event) {
      event.preventDefault();
      for (node of event.detail.systemTargets) {
        if (node.data && node.data.uri) {
          self._longpressLink = node.data.uri;
          self.emit("longpress");
          break;
        }
      }
    });

    iframe.addEventListener("mozbrowseropenwindow", function (event) {
      // FIXME
    });
  },
}

function DecorateWithEventEmitter(instance) {
  var ee = new EventEmitter();
  instance.on = ee.on.bind(ee);
  instance.off = ee.off.bind(ee);
  instance.once = ee.once.bind(ee);
  instance.emit = ee.emit.bind(ee);
  instance.removeAllListeners = ee.removeAllListeners.bind(ee);
}

function nextTick(callback) {
  setTimeout(callback, 0);
}

window.addEventListener("DOMContentLoaded", UI.init, true);
window.addEventListener("unload", UI.uninit, true);
document.addEventListener("visibilitychange", UI.onVisibilityChange, true);
navigator.mozSetMessageHandler("activity", UI.onActivityRequestfunction);
