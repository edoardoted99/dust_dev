!function(e,t,n,r){var o="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:"undefined"!=typeof window?window:"undefined"!=typeof global?global:{},a="function"==typeof o.parcelRequire&&o.parcelRequire,i="undefined"!=typeof module&&"function"==typeof module.require&&module.require.bind(module);function s(n,r){if(!t[n]){if(!e[n]){var o="function"==typeof parcelRequire&&parcelRequire;if(!r&&o)return o(n,!0);if(a)return a(n,!0);if(i&&"string"==typeof n)return i(n);var c=new Error("Cannot find module '"+n+"'");throw c.code="MODULE_NOT_FOUND",c}l.resolve=function(t){return e[n][1][t]||t},l.cache={};var u=t[n]=new s.Module(n);e[n][0].call(u.exports,l,u,u.exports,this)}return t[n].exports;function l(e){return s(l.resolve(e))}}s.isParcelRequire=!0,s.Module=function(e){this.id=e,this.bundle=s,this.exports={}},s.modules=e,s.cache=t,s.parent=a,s.register=function(t,n){e[t]=[function(e,t){t.exports=n},{}]},o.parcelRequire=s;for(var c=0;c<n.length;c++)s(n[c]);if(n.length){var u=s(n[n.length-1]);"object"==typeof exports&&"undefined"!=typeof module?module.exports=u:"function"==typeof define&&define.amd&&define((function(){return u}))}}({"454276cfdd114a4d8c6a4ea507eddc3e":[function(e,t,n){"use strict";var r=e("@babel/runtime/helpers/interopRequireDefault");Object.defineProperty(n,"__esModule",{value:!0}),n.default=void 0;var o=r(e("@babel/runtime/helpers/slicedToArray")),a=r(e("react")),i=r(e("lodash")),s=e("mobx"),c=e("mobx-react"),u=e("semantic-ui-react"),l=r(e("./samp.js"));(0,s.configure)({enforceActions:"observed"});var p=(0,c.observer)((function(e){var t=a.default.useState(!1),n=(0,o.default)(t,2),r=n[0],s=n[1],c=a.default.useRef(new l.default.samp.Connector("Sender"));a.default.useEffect((function(){var e,t=c.current.onHubAvailability((function(e){return s(e)}),2e3);return e=t,function(){e&&clearInterval(e)}}),[]);var p=function(e,t){var n=window.location,r=n.protocol+"//"+n.hostname+":"+n.port+"/app/products/"+function(e){for(var t=e+"=",n=decodeURIComponent(document.cookie).split(";"),r=0;r<n.length;r++){for(var o=n[r];" "==o.charAt(0);)o=o.substring(1);if(0==o.indexOf(t))return o.substring(t.length,o.length)}return""}("session_id")+"/"+t;c.current.runWithConnection((function(e){var n=new l.default.samp.Message("image.load.fits",{url:r,name:t});e.notifyAll([n])}),(function(){alert("Error connecting to SAMP")}))},f={"XNICER map":{text:"XNICER map",filename:"ext_map.fits",color:"blue"},"XNICER inverse variance":{text:"XNICER ivar",filename:"ext_ivar.fits",color:"red"},"XNICEST map":{text:"NICER map",filename:"xext_map.fits",color:"violet"},"XNICEST inverse variance":{text:"NICER ivar",filename:"xext_ivar.fits",color:"pink"},"Star density":{text:"Density",filename:"density.fits",color:"grey"}},d={scale:"log"};return a.default.createElement("div",null,i.default.map(e.products,(function(e){return a.default.createElement("span",{key:e},a.default.createElement(u.Button.Group,null,a.default.createElement(u.Button,{animated:"vertical",color:f[e].color,href:"/app/download?filename="+f[e].filename},a.default.createElement(u.Button.Content,{hidden:!0,content:"Download"}),a.default.createElement(u.Button.Content,{visible:!0,content:f[e].text})),a.default.createElement(u.Button,{color:f[e].color,basic:!0,icon:{name:"eye"},onClick:function(){JS9.Load("/app/download?filename="+f[e].filename,d)}}),a.default.createElement(u.Button,{color:f[e].color,basic:!0,icon:{name:"feed",className:"faa-flash"},disabled:!r,onClick:function(t){return p(0,f[e].filename)}}))," ")})))}));n.default=p},{"@babel/runtime/helpers/interopRequireDefault":"beac7a8bc05e3108fe09f48d4fc35ffb","@babel/runtime/helpers/slicedToArray":"3c8d25f152a9482ec9e4b4ad4cc61366",react:"80167699844891757ea7b41558fa2f98",lodash:"012a08e08a6fc4cf4272cd3bacd0a9f1",mobx:"2dd5acea532e30abe05409fa719b389b","mobx-react":"db904ebbb3a827b70d3cf52338d4f90e","semantic-ui-react":"f6921994ca98797f357b01d4f215358f","./samp.js":"f5b7ea2e8f20a7998780a8ea01f4d205"}],f5b7ea2e8f20a7998780a8ea01f4d205:[function(e,t,n){"use strict";var r=e("@babel/runtime/helpers/interopRequireDefault")(e("@babel/runtime/helpers/typeof")),o=function(){var e=function(e){if("string"==typeof e)return"string";if(e instanceof Array)return"list";if(e instanceof Object&&null!==e)return"map";throw new Error("Not legal SAMP object type: "+e)},n=function(e,t){var n,r,o=e.childNodes,a=[];for(r=0;r<o.length;r++)if(1===(n=o[r]).nodeType){if(t&&n.tagName!==t)throw new Error("Child <"+o[r].tagName+"> of <"+e.tagName+"> is not a <"+t+">");a.push(n)}return a},a=function(e,t){var r=n(e,t);if(1===r.length)return r[0];throw new Error("No sole child of <"+e.tagName+">")},i=function(e){var t,n,r="";for(t=0;t<e.childNodes.length;t++){if(1===(n=e.childNodes[t]).nodeType)throw new Error("Element found in text content");3!==n.nodeType&&4!==n.nodeType||(r+=n.nodeValue)}return r},s={escapeXml:function(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")},checkParams:function(t,n){var r;for(r=0;r<n.length;r++)if("string"!==n[r]&&"list"!==n[r]&&"map"!==n[r])throw new Error("Unknown type "+n[r]+" in check list");var o=t.length,a=[],i=!0;for(r=0;r<o;r++)a.push(e(t[r]));for(i=i&&n.length===o,r=0;i&&r<o;r++)i=i&&n[r]===a[r];if(!i)throw new Error("Param type list mismatch: ["+n+"] != ["+a+"]")},valueToXml:function t(n,r){var o,a;r=r||"";var i=e(n);if("string"===i)return r+"<value><string>"+s.escapeXml(n)+"</string></value>";if("list"===i){for((a=[]).push(r+"<value>",r+"  <array>",r+"    <data>"),o=0;o<n.length;o++)a.push(t(n[o],r+"      "));return a.push(r+"    </data>",r+"  </array>",r+"</value>"),a.join("\n")}if("map"===i){for(o in(a=[]).push(r+"<value>"),a.push(r+"  <struct>"),n)a.push(r+"    <member>"),a.push(r+"      <name>"+s.escapeXml(o)+"</name>"),a.push(t(n[o],r+"      ")),a.push(r+"    </member>");return a.push(r+"  </struct>"),a.push(r+"</value>"),a.join("\n")}throw new Error("bad type")},xmlToValue:function e(t,r){var o,s,c,u,l=n(t);if(0===l.length)return i(t);if(1===l.length){if("string"===(u=(c=l[0]).tagName))return i(c);if("array"===u){var p=n(a(c,"data"),"value"),f=[];for(o=0;o<p.length;o++)f.push(e(p[o],r));return f}if("struct"===u){var d,h,m,g=n(c,"member"),v={};for(o=0;o<g.length;o++){for(d=void 0,h=void 0,s=0;s<g[o].childNodes.length;s++)1==(m=g[o].childNodes[s]).nodeType&&("name"===m.tagName?d=i(m):"value"===m.tagName&&(h=e(m,r)));if(void 0===d||void 0===h)throw new Error("No <name> and/or <value> in <member>?");v[d]=h}return v}if(!r||"int"!==u&&"i4"!==u)throw new Error("Non SAMP-friendly value content: <"+u+">");return i(c)}throw new Error("Bad XML-RPC <value> content - multiple elements")},decodeParams:function(e){var t,r=n(e,"param"),o=[];for(t=0;t<r.length;t++)o.push(s.xmlToValue(a(r[t],"value")));return o},decodeFault:function(e){var t=s.xmlToValue(a(e,"value"),!0);return new s.Fault(t.faultString,t.faultCode)},decodeResponse:function(e){var t=e.documentElement;if("methodResponse"!==t.tagName)throw new Error("Response element is not <methodResponse>");var n=a(t);if("fault"===n.tagName)return s.decodeFault(n);if("params"===n.tagName)return s.decodeParams(n)[0];throw new Error("Bad XML-RPC response - unknown element <"+n.tagName+">")},Fault:function(e,t){this.faultString=e,this.faultCode=t}};s.Fault.prototype.toString=function(){return"XML-RPC Fault ("+this.faultCode+"): "+this.faultString};var c=function(e,t){this.methodName=e,this.params=t||[]};c.prototype.toString=function(){return this.methodName+"("+(e=this.params,("undefined"==typeof JSON?"...":JSON.stringify(e))+")");var e},c.prototype.addParam=function(e){return this.params.push(e),this},c.prototype.addParams=function(e){var t;for(t=0;t<e.length;t++)this.params.push(e[t]);return this},c.prototype.checkParams=function(e){s.checkParams(this.params,e)},c.prototype.toXml=function(){var e=[];e.push("<?xml version='1.0'?>","<methodCall>","  <methodName>"+this.methodName+"</methodName>","  <params>");for(var t=0;t<this.params.length;t++)e.push("    <param>",s.valueToXml(this.params[t],"      "),"    </param>");return e.push("  </params>","</methodCall>"),e.join("\n")};var u=function(e){this.endpoint=e||"http://localhost:21012/"};u.createXHR=function(){var e=function(e){var t;this.xhr=e,e.onreadystatechange=(t=this,function(){4===e.readyState&&(t.completed||200==+e.status&&(t.completed=!0,t.responseText=e.responseText,t.responseXML=e.responseXML,t.onload&&t.onload()))}),e.onerror=function(e){return function(t){e.completed||(e.completed=!0,e.onerror&&(t?t.toString=function(){return"No hub?"}:t="No hub?",e.onerror(t)))}}(this),e.ontimeout=function(e){return function(t){e.completed||(e.completed=!0,e.onerror&&e.onerror("timeout"))}}(this)};e.prototype.open=function(e,t){this.xhr.open(e,t)},e.prototype.send=function(e){this.xhr.send(e)},e.prototype.abort=function(){this.xhr.abort()},e.prototype.setContentType=function(e){"setRequestHeader"in this.xhr&&this.xhr.setRequestHeader("Content-Type",e)};var t=function(e){var t;this.xdr=e,e.onload=(t=this,function(){var n;if(t.responseText=e.responseText,"text/xml"===e.contentType||"application/xml"===e.contentType||/\/x-/.test(e.contentType))try{var r=new ActiveXObject("Microsoft.XMLDOM");r.loadXML(e.responseText),t.responseXML=r}catch(n){t.responseXML=n}t.onload&&t.onload()}),e.onerror=function(e){return function(t){e.onerror&&e.onerror(t)}}(this),e.ontimeout=function(e){return function(t){e.onerror&&e.onerror(t)}}(this)};if(t.prototype.open=function(e,t){this.xdr.open(e,t)},t.prototype.send=function(e){this.xdr.send(e)},t.prototype.abort=function(){this.xdr.abort()},t.prototype.setContentType=function(e){},"undefined"!=typeof XMLHttpRequest){var n=new XMLHttpRequest;if("withCredentials"in n)return new e(n)}if("undefined"!=typeof XDomainRequest)return new t(new XDomainRequest);if(void 0!==flensed.flXHR)return new e(new flensed.flXHR({instancePooling:!0}));throw new Error("no cross-origin mechanism available")},u.prototype.execute=function(e,t,n){!function(r){var o,a;try{(o=u.createXHR()).open("POST",r.endpoint),o.setContentType("text/xml")}catch(a){throw n(a),a}o.onload=function(){var e,r,a=o.responseXML;if(a){try{e=s.decodeResponse(a)}catch(r){return void(n&&n(r))}e instanceof s.Fault?n&&n(e):t&&t(e)}else n&&n("no XML response")},o.onerror=function(e){e?e.toString=function(){return"No hub?"}:e="No hub",n&&n(e)},o.send(e.toXml())}(this)};var l=function(e){if(this.regInfo=e,this.privateKey=e["samp.private-key"],"string"===!(0,r.default)(this.privateKey))throw new Error("Bad registration object");this.xClient=new u};!function(){var e,t={call:["string","string","map"],callAll:["string","map"],callAndWait:["string","map","string"],declareMetadata:["map"],declareSubscriptions:["map"],getMetadata:["string"],getRegisteredClients:[],getSubscribedClients:["string"],getSubscriptions:["string"],notify:["string","map"],notifyAll:["map"],ping:[],reply:["string","map"]};for(e in t)!function(e,t){l.prototype[e]=function(n,r,o){var a,i=(a=this,function(){a.close()});o=o||i,s.checkParams(n,t);var u=new c("samp.webhub."+e);return u.addParam(this.privateKey),u.addParams(n),this.xClient.execute(u,r,o)}}(e,t[e])}(),l.prototype.unregister=function(){if(this.callbackRequest)try{this.callbackRequest.abort()}catch(e){}var e=new c("samp.webhub.unregister");e.addParam(this.privateKey);try{this.xClient.execute(e)}catch(e){}delete this.regInfo,delete this.privateKey},l.prototype.close=function(){if(!this.closed){this.closed=!0;try{this.regInfo&&this.unregister()}catch(e){}if(this.onclose){oc=this.onclose,delete this.onclose;try{oc()}catch(e){}}}},l.prototype.setCallable=function(t,n){if(this.callbackRequest)try{this.callbackRequest.abort()}catch(e){}finally{delete this.callbackRequest}if(t||this.regInfo){var r=new c("samp.webhub.allowReverseCallbacks");r.addParam(this.privateKey),r.addParam(t?"1":"0");var o,a,i,s,u,l,p=(o=this,function(){o.close()});t?(s=function(n){if("list"==e(n)){var r,o,a,i,s;for(r=0;r<n.length;r++)try{o=n[r],a=void 0,i=void 0,s=void 0,a=o["samp.methodName"],i=o["samp.params"],s=void 0,"receiveNotification"===a?s=t.receiveNotification:"receiveCall"===a?s=t.receiveCall:"receiveResponse"===a&&(s=t.receiveResponse),s&&s.apply(t,i)}catch(e){}l()}else u(new Error("pullCallbacks result not List"))},u=function(e){(new Date).getTime()-i<1e3?a.close():l()},l=function(){if(a.regInfo){var e=new c("samp.webhub.pullCallbacks");e.addParam(a.privateKey),e.addParam("600"),i=(new Date).getTime(),a.callbackRequest=a.xClient.execute(e,s,u)}},(a=this).xClient.execute(r,(function(){l(),n()}),p)):this.xClient.execute(r,n,p)}},l.prototype.translateUrl=function(e){return(this.regInfo["samp.url-translator"]||"")+e},l.Action=function(e,t,n){this.actName=e,this.actArgs=t,this.resultKey=n};var p=function(e){this.callHandler={},this.replyHandler={}};p.prototype.init=function(e){},p.prototype.receiveNotification=function(e,t){var n=t["samp.mtype"],r=!1;if(n in this.callHandler){try{this.callHandler[n](e,t,!1)}catch(e){}r=!0}return r},p.prototype.receiveCall=function(e,t,n){var r,o,a=n["samp.mtype"],i=!1;if(a in this.callHandler)try{r={"samp.status":"samp.ok","samp.result":this.callHandler[a](e,n,!0)||{}},i=!0}catch(o){r={"samp.status":"samp.error","samp.error":{"samp.errortxt":o.toString()}}}else r={"samp.status":"samp.warning","samp.result":{},"samp.error":{"samp.errortxt":"no action"}};return this.connection.reply([t,r]),i},p.prototype.receiveResponse=function(e,t,n){var r=!1;if(t in this.replyHandler)try{this.replyHandler[t](e,t,n),r=!0}catch(e){}return r},p.prototype.calculateSubscriptions=function(){var e,t={};for(e in this.callHandler)t[e]={};return t};var f=function(){var e=this;this.ids={},this.metas={},this.subs={},this.replyHandler={},this.callHandler={"samp.hub.event.shutdown":function(t,n){e.connection.close()},"samp.hub.disconnect":function(t,n){e.connection.close()},"samp.hub.event.register":function(t,n){var r=n["samp.params"].id;e.ids[r]=!0,e.changed(r,"register",null)},"samp.hub.event.unregister":function(t,n){var r=n["samp.params"].id;delete e.ids[r],delete e.metas[r],delete e.subs[r],e.changed(r,"unregister",null)},"samp.hub.event.metadata":function(t,n){var r=n["samp.params"].id,o=n["samp.params"].metadata;e.metas[r]=o,e.changed(r,"meta",o)},"samp.hub.event.subscriptions":function(t,n){var r=n["samp.params"].id,o=n["samp.params"].subscriptions;e.subs[r]=o,e.changed(r,"subs",o)}}};(f.prototype=function(e){function t(){}return t.prototype=e,new t}(p.prototype)).changed=function(e,t,n){this.onchange&&this.onchange(e,t,n)},f.prototype.init=function(e){var t=this;this.connection=e;var n=function(n,r,o,a){e[o]([n],(function(e){a[n]=e,t.changed(n,r,e)}))};e.getRegisteredClients([],(function(e){var r,o;for(t.ids={},r=0;r<e.length;r++)o=e[r],t.ids[o]=!0,n(o,"meta","getMetadata",t.metas),n(o,"subs","getSubscriptions",t.subs);t.changed(null,"ids",null)}))},f.prototype.getName=function(e){var t=this.metas[e];return t&&t["samp.name"]?t["samp.name"]:"["+e+"]"};var d=function(e,t,n,r){this.name=e,this.meta=t,this.callableClient=n,this.subs=r,this.regTextNodes=[],this.whenRegs=[],this.whenUnregs=[],this.connection=void 0,this.onreg=void 0,this.onunreg=void 0},h=function(e,t){var n,r,o=e.regTextNodes;for(n=0;n<o.length;n++)(r=o[n]).innerHTML="",r.appendChild(document.createTextNode(t))};d.prototype.setConnection=function(e){var t=this;if(this.connection&&(this.connection.close(),this.onunreg))try{this.onunreg()}catch(e){}if(this.connection=e,e&&(e.onclose=function(){if(t.connection=null,t.onunreg)try{t.onunreg()}catch(e){}t.update()},this.meta&&e.declareMetadata([this.meta]),this.callableClient&&(this.callableClient.init&&this.callableClient.init(e),e.setCallable(this.callableClient,(function(){e.declareSubscriptions([t.subs])}))),this.onreg))try{this.onreg(e)}catch(e){}this.update()},d.prototype.register=function(){var e=this;m(this.name,(function(t){e.setConnection(t),h(e,t?"Yes":"No")}),(function(t){h(e,"no ("+t.toString()+")")}))},d.prototype.unregister=function(){this.connection&&(this.connection.unregister([]),this.setConnection(null))},d.prototype.createRegButtons=function(){var e=this,t=document.createElement("button");t.setAttribute("type","button"),t.appendChild(document.createTextNode("Register")),t.onclick=function(){e.register()},this.whenUnregs.push(t);var n=document.createElement("button");n.setAttribute("type","button"),n.appendChild(document.createTextNode("Unregister")),n.onclick=function(){e.unregister()},this.whenRegs.push(n);var r=document.createElement("span");this.regTextNodes.push(r);var o=document.createDocumentFragment();o.appendChild(t),o.appendChild(document.createTextNode(" ")),o.appendChild(n);var a=document.createElement("span");return a.innerHTML=" <strong>Registered: </strong>",o.appendChild(a),o.appendChild(r),this.update(),o},d.prototype.update=function(){var e,t=!!this.connection,n=t?this.whenRegs:this.whenUnregs,r=t?this.whenUnregs:this.whenRegs;for(e=0;e<n.length;e++)n[e].removeAttribute("disabled");for(e=0;e<r.length;e++)r[e].setAttribute("disabled","disabled");h(this,"No")},d.prototype.runWithConnection=function(e,t){var n=this,r=function(t){n.setConnection(t),e(t)},o=function(e){n.setConnection(void 0),t(e)};this.connection?this.connection.getRegisteredClients([],(function(t){e(n.connection)}),(function(e){m(this.name,r,o)})):m(this.name,r,o)},d.prototype.onHubAvailability=function(e,t){return o.ping(e),setInterval((function(){o.ping(e)}),t)};var m=function(e,t,n){var r=new u,o=new c("samp.webhub.register"),a={"samp.name":e};o.addParam(a),o.checkParams(["map"]);r.execute(o,(function(e){var r,o;try{r=new l(e)}catch(o){return void n(o)}t(r)}),n)},g={};return g.XmlRpcRequest=c,g.XmlRpcClient=u,g.Message=function(e,t){this["samp.mtype"]=e,this["samp.params"]=t},g.TYPE_STRING="string",g.TYPE_LIST="list",g.TYPE_MAP="map",g.register=m,g.ping=function(e){var t=new u,n=new c("samp.webhub.ping");t.execute(n,(function(t){e(!0)}),(function(t){e(!1)}))},g.isSubscribed=function(e,t){var n,r=function(e,t){if(e==t)return!0;if("*"===e)return!0;var r,o=/^(.*)\.\*$/.exec(n);return!(!o||(r=o[1])!==t.substring(0,r.length))};for(n in e)if(r(n,t))return!0;return!1},g.Connector=d,g.Connection=l,g.CallableClient=p,g.ClientTracker=f,t.exports.samp=g,g}()},{"@babel/runtime/helpers/interopRequireDefault":"beac7a8bc05e3108fe09f48d4fc35ffb","@babel/runtime/helpers/typeof":"5ac734bb79a04b7f6388db4ae4e75eaf"}]},{},[]);
//# sourceMappingURL=DownloadProducts.c8530f97.js.map