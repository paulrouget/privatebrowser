const SEARCHURL = "https://duckduckgo.com/?q=%s";
const SCHEMES = ["http://","https://","ftp://"];

window.addEventListener('DOMContentLoaded', function() {
  BuildBrowser();
});


function BuildBrowser() {
  var currentUrl = "";
  
  var tabbrowser = document.createElement("div");
  tabbrowser.className = "tabbrowser";
  
  var iframe = document.createElement("iframe");
  iframe.setAttribute("mozbrowser", "true");
  iframe.setAttribute("remote", "true");
  
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
  
  tabbrowser.setAttribute("visible", "true")
  
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
  
  function ProcessURL() {
    var url;
    var v = inputUrl.value;
    inputUrl.blur();
    if ((v.search(/\s/) > -1) || (v.search(".") == -1)) {
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
}