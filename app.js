const SEARCHURL = "https://duckduckgo.com/?q=%s";
const SCHEMES = ["http://","https://","ftp://"];
const CLEAR_TIMEOUT = 3 * 60 * 1000; // after 3 minutes hidden, we clear the tabs

window.addEventListener("unload", ClearPrivateData, true);

var visibilityTimeout;
document.addEventListener("visibilitychange", () => {
   clearTimeout(visibilityTimeout);
   if (document.hidden) {
     visibilityTimeout = setTimeout(KillAllTabsAndClearPrivateData, 1000 * 10);
   }
}, true);

window.addEventListener('DOMContentLoaded', function() {
  document.querySelector("#button-killtab").onclick = KillVisibleBrowser;
  var request = navigator.mozApps.getSelf();
  request.onsuccess = function() {
    request.result.clearBrowserData();
    document.querySelector("#button-addtab").onclick = () => BuildBrowser(null, true);
  };
});

var gCount = 0;
function BuildBrowser(url, visible) {
  var currentUrl = "";
  var uuid = gCount++;

  var tabbrowser = document.createElement("div");
  tabbrowser.className = "tabbrowser";
  tabbrowser.id = "tabbrowser-" + uuid;
  tabbrowser.dataset.uuid = uuid;
  
  var tab = document.createElement("button");
  tab.className = "button-tab";
  tab.onclick = () => SelectBrowser(uuid);
  tab.id = "button-tab-" + uuid;
  tab.dataset.uuid = uuid;
  document.querySelector("#tabs").appendChild(tab);
  tab.scrollIntoView();
    
  var iframe = document.createElement("iframe");
  iframe.setAttribute("mozbrowser", "true");
  iframe.setAttribute("remote", "true");
  iframe.setAttribute("mozasyncpanzoom", "true");
  iframe.setAttribute("mozallowfullscreen", "true");

  if (url) {
    iframe.setAttribute("src", url);
  }
  
  var urlbar = document.createElement("div");
  urlbar.className = "urlbar";
  
  var buttonBack = document.createElement("button");
  buttonBack.className = "button-history button-back fa fa-arrow-left";
  buttonBack.onclick = () => iframe.goBack();

  var buttonForward = document.createElement("button");
  buttonForward.className = "button-history button-forward fa fa-arrow-right";
  buttonForward.onclick = () => iframe.goForward();
  
  var inputUrl = document.createElement("input");
  inputUrl.type = "url";
  inputUrl.placeholder = ""
  inputUrl.className = "input-url";
  
  inputUrl.onfocus = () => {
    inputUrl.value = currentUrl;
    inputUrl.setSelectionRange(0, inputUrl.value.length);
    urlbar.classList.add("focus");
  }
  inputUrl.onblur = () => {
    urlbar.classList.remove("focus");
  }
  inputUrl.onchange = ProcessURL;
  
  var buttonGo = document.createElement("button");
  buttonGo.className = "button-go fa fa-arrow-right";
  buttonGo.onclick = ProcessURL;
  
  var buttonStop = document.createElement("button");
  buttonStop.className = "button-stop fa fa-times";
  buttonStop.onclick = () => iframe.stop();

  var buttonReload = document.createElement("button");
  buttonReload.className = "button-reload fa fa-rotate-right";
  buttonReload.onclick = () => iframe.reload();

  tabbrowser.appendChild(urlbar);
  urlbar.appendChild(buttonBack);
  urlbar.appendChild(buttonForward);
  urlbar.appendChild(inputUrl);
  urlbar.appendChild(buttonGo);
  urlbar.appendChild(buttonStop);
  urlbar.appendChild(buttonReload);
  
  tabbrowser.appendChild(iframe);
    
  document.querySelector("#deck").appendChild(tabbrowser);
  
  iframe.addEventListener('mozbrowserloadstart', function () {
    urlbar.classList.add("loading");
    urlbar.classList.remove("loaded");
  });

  iframe.addEventListener('mozbrowserloadend', function () {
    urlbar.classList.add("loaded");
    urlbar.classList.remove("loading");
  });

  iframe.addEventListener('mozbrowsererror', function (event) {
    urlbar.classList.remove("loaded");
    urlbar.classList.remove("loading");
    alert("Loading error: " + event.detail);
  });
  
  
  iframe.addEventListener("mozbrowsericonchange", function(event) {
    tab.style.backgroundImage = "url(" + event.detail.href + ")";
  });

  iframe.addEventListener('mozbrowserlocationchange', function (event) {
    buttonBack.blur();
    buttonForward.blur();
    if (event.detail != "about:blank") {
      currentUrl = event.detail;
    } else {
      currentUrl = "";
    }
    var backReq = iframe.getCanGoBack();
    backReq.onsuccess = () => {
      if (backReq.result) {
        urlbar.classList.add("canGoBack");
      } else {
        urlbar.classList.remove("canGoBack");
      }
    }
    var fwdReq = iframe.getCanGoForward();
    fwdReq.onsuccess = (req) => {
      if (fwdReq.result) {
        urlbar.classList.add("canGoForward");
      } else {
        urlbar.classList.remove("canGoForward");
      }
    }
  });
  
  iframe.addEventListener("mozbrowsertitlechange", (event) => {
    inputUrl.value = event.detail || currentUrl;
  });
  
  iframe.addEventListener("mozbrowserclose", (event) => {
    KillBrowser(uuid)
  });
  
  
  iframe.addEventListener("mozbrowsercontextmenu", function(event) {
    event.preventDefault();
    for (node of event.detail.systemTargets) {
      if (node.nodeName == "A") {
        BuildBrowser(node.data.uri, false);
      }
    }
  });
  
  function ProcessURL() {
    var url;
    var v = inputUrl.value;
    inputUrl.blur();
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
    iframe.src = url;
  }
  
  if (visible) {
    SelectBrowser(uuid);
  }
  HideKillButtonIfNeeded();
}

function KillVisibleBrowser() {
  var browser = document.querySelector(".tabbrowser.visible");
  if (browser) {
    KillBrowser(browser.dataset.uuid);
  }
}

var timeouts = {};

function KillBrowser(uuid) {
  clearTimeout(timeouts[uuid]);
  
  var browser = document.getElementById("tabbrowser-" + uuid);
  if (browser) {
    var nextUuid;
    if (browser.nextSibling) {
      nextUuid = browser.nextSibling.dataset.uuid;
    } else if (browser.previousSibling) {
      nextUuid = browser.previousSibling.dataset.uuid;
    }

    browser.remove();
    document.getElementById("button-tab-" + uuid).remove();
    HideKillButtonIfNeeded();
    if (nextUuid) {
      SelectBrowser(nextUuid);
    }
  }
}

function SelectBrowser(uuid) {

  // Clear previous selection
  var previousBrowser = document.querySelector(".tabbrowser.visible");
  if (previousBrowser) {
    var previousUuid = previousBrowser.dataset.uuid;
    previousBrowser.classList.remove("visible");
    clearTimeout(timeouts[previousUuid]);
    timeouts[previousUuid] = setTimeout(() => {
      previousBrowser.querySelector("iframe").setVisible(false);
      timeouts[previousUuid] = null;
    });
  }
  var previousTab = document.querySelector(".button-tab.visible");
  if (previousTab) {
    previousTab.classList.remove("visible");
  }
  
  // Set new browser
  var browser = document.getElementById("tabbrowser-" + uuid);
  if (browser) {
    browser.classList.add("visible");
    
    clearTimeout(timeouts[uuid]);
    timeouts[uuid] = setTimeout(() => {
      browser.querySelector("iframe").setVisible(true);
      timeouts[uuid] = null;
    });
  }
  var tab = document.getElementById("button-tab-" + uuid);
  if (tab) {
    tab.classList.add("visible");
  }
}

function HideKillButtonIfNeeded() {
  var killButton = document.querySelector("#button-killtab");
  if (document.querySelectorAll(".tabbrowser").length == 0) {
    killButton.setAttribute("hidden", "true");
  } else {
    killButton.removeAttribute("hidden");
  }
}

function ClearPrivateData() {
  var request = navigator.mozApps.getSelf();
  request.onsuccess = function() {
    request.result.clearBrowserData();
  };
}

function KillAllTabsAndClearPrivateData() {
  document.querySelector("#tabs").innerHTML = "";
  document.querySelector("#deck").innerHTML = "";
  ClearPrivateData();
  HideKillButtonIfNeeded();
}
