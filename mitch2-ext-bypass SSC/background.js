'use strict';
//print and count all the reqs and resps, get_sensitive_req,post_sensitive_req.yy


var visitingURLObj;

var phase                        = 0;        // see from line 284 for the various phases
var sensitive_requests           = [];       // this will be alice's first run,before replay
var collected_sensitive_requests = 0;
var collected_total_request      = 0;
var collected_get_requests=0;
var collected_post_requests=0;
var collected_get_sensitive_requests=0;
var collected_post_sensitive_requests=0;
var post_sensitive_requests=[];
var get_sensitive_requests=[];
var post_variant_requests=[];


//var alice1_requests              = [];
//var unauth_requests              = [];
var null_collector               = [];       // FIXME: just a sink
//var candidates                   = [];       // final CSRFs candidates
var active_collector;
active_collector = sensitive_requests;
var a=false;
var original_url=[];
var variant_url=[];
var classifier = new RandomForestClassifier();

// Extracts the parameters from a query string (for GET requests)
function parseParams (p) {
   var res = {};
   for (var k of p.keys())
      res[k] = p.getAll(k);
   return res;
}

// Ignores some requests which are certainly not HTTP and requests to third-parties
function goodUrl (u,s) {
   var isGood = true;
   if (!u.protocol.startsWith('http'))
      isGood = false;

   if (u.pathname.endsWith('/chrome/newtab'))
      isGood = false;

   //since our apps running on the localhost, so the domain and the host always equal "localhost" yy
   var tokens = s.hostname.split('.');
   /*var domain = tokens[tokens.length-2]; */
   var domain=tokens;
   if (!u.host.includes(domain))
      isGood = false;
   return isGood;
}

// Checks the number and the names of all the parameters of HTTP requests a,b
function sameParams (a,b) {
   var flag = true;
   var keysA = Object.keys(a);
   var keysB = Object.keys(b);

   if (keysA.length != keysB.length)
      flag = false;
   else {
      keysA.forEach (function (k) {
         if (!keysB.includes(k))
            flag = false;
      });
   }

   return flag;
}

function compareReq(a,b) {
   return a.method == b.method && a.url == b.url && sameParams(a.params,b.params);
}
// don't compare method,since in the reply phrase, compare get and post
function compareReq1(a,b){
   return a.url == b.url && sameParams(a.params,b.params);

}

function isKnown1 (r,gs) {
   var flag = false;
   gs.forEach (function (g) {
      if (compareReq1(g,r))
         flag = true;
   });
   // console.log("COMPARISON RESULTED IN: " + flag);
   return flag;
}

// Checks whether the request r is already in gs (up to sameParams)
function isKnown (r,gs) {
   var flag = false;

   gs.forEach (function (g) {
      // console.log("COMPARING");
      // console.log(g);
      // console.log(r);
      if (compareReq(g,r))
         flag = true;
   });
   // console.log("COMPARISON RESULTED IN: " + flag);
   return flag;
}

// Builds a list of sensitive HTTP requests, real time
chrome.webRequest.onBeforeRequest.addListener (function (details) {
   var urlObj = new URL(details.url);
   if (details.type == "main_frame") {
      visitingURLObj = new URL(details.url);
   }

   if (goodUrl(urlObj, visitingURLObj)) {

      var method = details.method;   
      
      var urlClean = urlObj.protocol + "//" + urlObj.hostname + urlObj.pathname;//get and post method have the same params
      var req = {'method': method, 'url': urlClean, 'params': {}, 'reqId': details.requestId, 'response' : {}};

      req['response']['body'] = "";

      var filter = browser.webRequest.filterResponseData(details.requestId);

      var decoder = new TextDecoder();

      filter.onstart = event => {
          console.log("starting " + req['url'] + " [ " + filter.status + " ] ");
      }

      filter.ondata = event => {
         req['response']['body'] = req['response']['body'] + decoder.decode(event.data);
         if (filter.status != "uninitialized" && event.data && event.data.byteLength > 0) {
            filter.write(event.data);
         }
      }

      filter.onerror = event => {
         console.log("!!! error on " + req.url + " -- " + filter.error)
      }

      filter.onstop = event => {
         filter.disconnect();
      }

      var params = new URLSearchParams(urlObj.search);
      req['params'] = parseParams(params);
      console.log('the navigation req:');//besides 'GET'and 'POST' to find other kinds of reqs
      console.log(req);

      if (method == "POST") {
         if (details.requestBody != null) {
               var postBody;
               if (details.requestBody.formData) {
                  postBody = details.requestBody.formData;
               } else {
                  var rawPostData      = new Uint8Array(details.requestBody.raw[0].bytes);
                   //console.log("got rawPostData:\n" + rawPostData);
                  // console.log("****************")
                  var encodedPostData  = String.fromCharCode.apply(null, rawPostData);
                   console.log("got encodedPostData:\n" + encodedPostData);
                   console.log("****************")
                  
                  postBody = parseParams(new URLSearchParams('?' + decodeURIComponent(encodedPostData)));
               }
         
               for (var k of Object.keys(postBody)) {
                  req['params'][k] = postBody[k];
               }
         }
         collected_post_requests++;//yy

      }else if(method=="GET"){
         collected_get_requests++;
      }
      // a==false to show it's the original request, true means it's the second request(replay);
      if (a==false && isSensitive(req) && !isKnown(req,active_collector)) {
         active_collector.push(req);
         console.log("sensitive request added:,the sensitive request is: ");
         console.log(req);
         //push all sensitive requests' url
         original_url.push(req['url']);

         collected_sensitive_requests++;
         // count sensitive get and post requests
         if(req.method=='GET'){
            collected_get_sensitive_requests++;
            get_sensitive_requests.push(req);//for get sensitive request, just need to print out, don't need to change
         }else if(req.method=='POST'){
            collected_post_sensitive_requests++;
            post_sensitive_requests.push(req);
         }
      }
      //req of replay_request, add to active_collector
      if (a==true && !isKnown1(req,active_collector) ){
         for(let senreq of sensitive_requests){
            if (req['url']== senreq['url']&& sameParams(req.params,senreq.params)){
               active_collector.push(req);
               //break;
            }
         }
      }
      collected_total_request++;
   }
}, {urls: ["<all_urls>"], types: ["main_frame", "xmlhttprequest", "sub_frame","other"]}, ["requestBody","blocking"]);

// this is needed to get response statuses and headers, which are used in
// comparison evaluation
chrome.webRequest.onResponseStarted.addListener (function (details) {
   var reqId = details.requestId;
   active_collector.forEach( function (el) {
      if (el.reqId == reqId) {
         el.response.status = details.statusCode;
         if (details.responseHeaders) {
            el.response.headers = {};
            details.responseHeaders.forEach( function (h) {
               el.response.headers[h.name] = h.value;
            });
         }
      }
   });

},  {urls: ["<all_urls>"], types: ["main_frame", "xmlhttprequest", "sub_frame","other"]} ,["responseHeaders"]);

//only replay the post request,post request convert to get request and check if they are similar
function replay_post_sensitive(collector){
   a=true;
   collector.forEach (function (r) {
      const async = true;
      let rp =[];
      rp['method']='GET';
      var paramString = [];
         for (var k of Object.keys(r['params'])) {
         //console.log(">|> paramString is: " + paramString);
             paramString.push(k + "=" + encodeURI(r['params'][k]));
             //rp.searchParams.set(k, encodeURI(rp['params'][k]));
         }
         paramString=paramString.join("&");
         rp['url']=r['url']+"?"+paramString;
         //console.log('the variants url is:');
         //console.log(rp['url']);
         variant_url.push(rp['url']);

     let xhr = new XMLHttpRequest();
     xhr.open(rp['method'],rp['url'],async);
     xhr.send();
     xhr.onreadystatechange = (e) => {
      //console.log("xhr.status:"+xhr.status); don't print
     }
});
}
/*
1.log in alice
2.finished alice,collect all sensitive request
3.convert post reqs to 'get'
4.replay 'get' req
5.compare the responses of original post and the 'get'
* */

function finished_Alice1() {
   console.log("the original request of Alice collect finished, preparing replay the POST request...");
   active_collector=null_collector;
   /*console.log('finished_alice1, sensitive requests should be include all get and post request, k3: ');
  for(let k3 of sensitive_requests){
      console.log(k3);
   }*/
   replay_post_sensitive(post_sensitive_requests);
   active_collector=post_variant_requests;//collect the response of variant request and compare them
   phase = 1;
}
function logged_out_Alice1() {
   a=false;
   active_collector=null_collector;
   console.log("Alice logged out, compare and draw a conclusion");
   phase = 2;
}

// if they are the same request->success
function make_conclusions() {
   console.log("Making conclusions");
   console.log('----finally, all post sensitive requests k is-----: ');
   console.log(post_sensitive_requests);
   console.log('=====finally, all post variant requests p is=====:');
   console.log(post_variant_requests);
   console.log('#######finally, all get sensitive requests g is#######:');
   console.log(get_sensitive_requests);
   console.log('******finally, all sensitive request are:*****');
   console.log(sensitive_requests);

   console.log('$$$$$the original url of all sensitive requests  are:$$$$');
   console.log(original_url);
   console.log('~~~~~the variants url of all get variants are:~~~~~');
   console.log(variant_url);

  let candidates= checkResp(post_sensitive_requests,post_variant_requests);//find the postsensitive and variant which with the same response
   console.log("check if the post variant requests were handle correctly,variable in candidates  are:");
   console.log(candidates);

   let results_url = browser.runtime.getURL("results.html");//yy, original:chrome.extension.getURL, get the full url of the file"results.html"
   chrome.tabs.create({"url":results_url, "active":true});
   phase = 3;
}
//compare these two requests
function isSameReq(base,test) {
   if (base['url'] != test['url'])
      return false;

   for (let k of Object.keys(base['params'])) {
      if (!(k in test['params']))
         return false;
   }

   for (let p of Object.keys(test['params'])) {
      if (!(p in base['params']))
         return false;
   }

   return true;
}

function compare_sensitive_requests(runA,runB) {// ra in post sensitive request and rb in post variant requests

   let results = [];
   for (let rA of runA) {
      let found = false;
      //console.log('ra:');
      //console.log(rA);
      for (let rB of runB) {
         //console.log('rb: ');
         //console.log(rB);
         if (isSameReq(rA,rB)) {
            found = true;
            results.push(compare_requests(rA,rB));
         }
      }

      if (!found)
         console.log("!!! could not find " + rA['url'] + " in runB");
   }
   console.log('the results of compare sensitives requests:');
   console.log(results);
   return results;
}
function isHTML(s) {
   if(s==null ||s['headers']==null){
      console.log('running');
      return false;
   }
   if (s['body'].toLowerCase().includes("</html>"))
      return true;

   if ('Content-Type' in s['headers'] && s['headers']['Content-Type'].includes("text/html"))
      return true;

   return false;
}

function isJSON(s) {
   try {
      let j = JSON.parse(s['body']);
      if (Number.isInteger(j))
         return false;
   } catch (e) {
      return false;
   }
   return true;
}
function hasSameJSONSchema(a,b) {
   let sA = getSchema(a);
   let sB = getSchema(b);
   /*
   console.log('sa scheme');
   console.log(sA);
   console.log('sb scheme');
   console.log(sB);*/

   let ret = isSameSchema(sA,sB);
   return ret;
}
function isSameSchema(sA,sB) {
   for (let k of Object.keys(sA)) {
      if (!(k in sB)) {
         return false;
      } else {
         if (isDict(sA[k]) && isDict(sB[k]) && !isSameSchema(sA[k],sB[k])) {
            return false;
         } else if (sA[k] != sB[k]) {
            return false;
         }
      }
   }

   return true;
}
/* FIXME: this function is not complete, for example it is wrong on regexps */
function isDict(v) {
    typeof v==='object' && v!==null && !(v instanceof Array) && !(v instanceof Date);
}
function compare_requests(rA,rB) {
   let result = {
      'url': rA['url'],
      'params': rA['params'],
      'overall': 'same',// test yy
      'method': {},
      'status': {},
      'body': {'ans': 'same'}
   };

   // checking status
   let statusA = rA['response']['status'];
   let statusB = rB['response']['status'];

   if (statusA == statusB) {
      result['status']['ans'] = 'same';
   } else {
      result['status']['ans'] = 'different';
      result['overall']       = 'different';
   }

   result['status']['valueA'] = statusA;
   result['status']['valueB'] = statusB;

   // checking body type
   if (isHTML(rA['response'])) {
      result['body']['typeA'] = 'html';
   } else if (isJSON(rA['response'])) {
      result['body']['typeA'] = 'json';
   } else {
      result['body']['typeA'] = 'plaintext';
   }

   if (isHTML(rB['response'])) {
      result['body']['typeB'] = 'html';
   } else if (isJSON(rB['response'])) {
      result['body']['typeB'] = 'json';
   } else {
      result['body']['typeB'] = 'plaintext';
   }

   let min_length = Math.min(rA['response']['body'].length,rB['response']['body'].length);//compare the response body yy
   let max_length = Math.max(rA['response']['body'].length,rB['response']['body'].length);

   result['body']['ratio'] = (min_length + 1) / (1.0 * max_length + 1);// ratio>0.99 same, else: different.
   //console.log("the ratio of result: ");
   //console.log(result['body']['ratio']);

   if (result['body']['typeA'] == 'JSON' && result['body']['typeB'] == 'JSON') {
      var json_a = JSON.parse(rA['response']['body']);
      var json_b = JSON.parse(rB['response']['body']);

      if (hasSameJSONSchema(json_a,json_b)) {
         result['body']['ans'] = 'same';
      } else {
         result['body']['ans']   = 'different';
         result['overall']       = 'different';
      }
   } else if (result['body']['typeA'] == 'html' && result['body']['typeB'] == 'html') {
      if (result['body']['ratio'] < 0.99) {
         result['body']['ans'] = 'different';
         result['overall'] = 'different';
      }
   } else if (result['body']['typeA'] == 'plaintext' && result['body']['typeB'] == 'plaintext') {
      if (rA['response']['body'] != rB['response']['body']) {
         result['body']['ans']   = 'different';
         result['overall']       = 'different';
      }
   } else {
      if (result['body']['typeA'] != result['body']['typeB']) {
         result['body']['ans']   = 'different';
         result['overall']       = 'different';
      }
   }

   result['body']['valueA'] = rA['response']['body'];
   result['body']['valueB'] = rB['response']['body'];

   return result;
}
//post_sensitive_requests & variant_requests
function checkResp(alice,alice1) {
   console.log(">>> comparing traces...");
   var alice_vs_alice1  = compare_sensitive_requests(alice,alice1);
   var candidates = [];
   console.log(">>> comparisons analysis:");
   console.log(" >> confirming sensitivity");
   for (let r of alice_vs_alice1) {
      console.log("  checking " + r['url']);
      console.log('overall:'+r['overall'] );
      if (r['overall'] == 'different') {//different
         console.log(" requests dissimilar");
         //candidates.push(r);
      }else{
         console.log("requests similar,added");//if similar, indicate they have the same response, the variant was handle correctly
         candidates.push(r);// store post(original one is same with the variant) in candidates
      }

   }

   var resulting_candidates = [];
   console.log(" >> confirming handle correctly");
   for (let c of candidates) {
      console.log("   checking " + c['url']);
      let r_ava1 = findRequest(c,alice_vs_alice1);

      if (r_ava1['overall'] == 'different')
         continue;
      resulting_candidates.push(c);//only add the same one
   }

   return resulting_candidates;
}
function findRequest(needle, haystack) {
   for (let r of haystack) {
      if (isSameReq(needle,r))
         return r;
   }
   console.log("!!! no matching endpoint found for " + needle['url']);
   return false;
}

function tellresps(alice,alice1) {
   var output = "<ol>";
   output = output + "<li>comparing traces...</li>";
   var alice_vs_alice1  = compare_sensitive_requests(alice,alice1);
   var candidates = [];

   output = output + "<li>comparisons analisys:<ol>";
   output = output + "<li>confirming sensitivity:<ul>";
   for (let r of alice_vs_alice1) {
      output = output + "<li>checking " + r['url'] + "...";
      if (r['overall'] == 'same') {
         output = output + "candidate added";
         candidates.push(r);
      }
      output = output + "</li>";
   }
   output = output + "</ul></li>"
   var resulting_candidates = [];
   output = output + "<li>confirming handle correctly:<ul>";
   for (let c of candidates) {
      output = output + "<li>checking " + c['url'] + "</li>";
      let r_ava1 = findRequest(c,alice_vs_alice1);
      if (r_ava1['overall'] == 'same')
         resulting_candidates.push(c);
      //continue;

   }
   output = output + "</ul></ol></li>";
   output = output + "<li>the following sensitive post URLs may be similar to variants (check console output for more details):<ul>";
   console.log('resulting_candidates is:');
   console.log(resulting_candidates);
   for (let pc of resulting_candidates) {
      output = output + "<li>" + pc['url'] +"</li>";
   }
   output = output + "</ul></li></ol>";

   return output;
}
//we should check if the result is right
chrome.runtime.onMessage.addListener( function(request, sender, sendResponse) {
   if (request.greeting == "get_results")
      sendResponse(tellresps(post_sensitive_requests,post_variant_requests));

});