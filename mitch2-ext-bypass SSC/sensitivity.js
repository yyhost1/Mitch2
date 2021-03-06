'use strict';
//this function is to judge if a request is sensitive request.

function countParams(req) {
   return Object.keys(req['params']).length;
}

function countBools(req) {
   var numBools = 0;

   for (var p of Object.keys(req['params'])) {
      if (req['params'][p] == 'true' ||
               req['params'][p] == 'false' || 
               req['params'][p] == '1' || 
               req['params'][p] == '0') {
            numBools++; 
         }
   }

   return numBools;
}

function countIds(req) {
   var numOfIds = 0;
   var re = RegExp('^[0-9]{14}|[0-9\-a-fA-F]{20,}$');

   for (var p of Object.keys(req['params'])) {
      if (re.test(req['params'][p]))
         numOfIds++; 
   }

   return numOfIds;
}

function countBlobs(req) {
   var numOfBlobs = 0;
   var re = RegExp('^[^\s]{20,}$');

   for (var p of Object.keys(req['params'])) {
      if (re.test(req['params'][p]))
         numOfBlobs++; 
   }

   return numOfBlobs;
}
//count the lengh of req --yy
function getReqLen(req) {
   var l=0;

   for (var p of Object.keys(req['params'])) {
      l = l + p.length + String(req['params'][p]).length;
   }
   return l;
}

function isInPath(req,needle) {
   var tkns = req['url'].split('/');
   for (var i = 2;i<tkns.length;i++) {
      if (tkns[i].toLocaleLowerCase().includes(needle.toLocaleLowerCase())) {
         return 1;
      }
   }
   return 0;
}

function isInParams(req,needle) {
   for (var p of Object.keys(req['params'])) {
      if (p.toLocaleLowerCase().includes(needle.toLocaleLowerCase())) {
         return 1;
      }
   }
   return 0;
}

//judge if a request is sensitive just test this method
function isSensitive(req) {
   var featureVector = [];

   if (req['method'].toLocaleUpperCase == 'PUT' || 
         req['method'].toLocaleUpperCase == 'DELETE')
      return true;

   if (req['method'].toLocaleUpperCase == 'OPTIONS')
      return false;

   // numOfParams
   featureVector.push(countParams(req));
   // numOfBools
   featureVector.push(countBools(req));
   // numOfIds
   featureVector.push(countIds(req));
   // numOfBlobs
   featureVector.push(countBlobs(req));
   // reqLen
   featureVector.push(getReqLen(req));

   var keywords = ['create','add','set','delete','update','remove', 
   'friend', 'setting','password','token','change','action', 
   'pay','login','logout', 'post','comment','follow','subscribe','sign','view'];
   
   keywords.forEach(function (k) {
      featureVector.push(isInPath(req,k));
      featureVector.push(isInParams(req,k));
   });

   var methods = ['PUT','DELETE','POST','GET','OPTIONS'];

   methods.forEach(function (m) {
      featureVector.push((req['method'].toLocaleUpperCase() == m)?1:0);
      //count the number of get and post:yy


   });
   // console.log('featurevector: ');
   // console.log(featureVector); //yy the csv file's featurevector,array[52] lengh:52? what does this means?

   var sensitive = classifier.predict(featureVector); //return 0 or 1,sensitive is 1 yy test
   //console.log('sensitive:');
   //console.log(sensitive);
   return sensitive;
}