'use strict';
// show all the count infos
chrome.runtime.sendMessage({greeting: "get_results"}, function(response) {
	document.getElementById('message').innerHTML = response;
});