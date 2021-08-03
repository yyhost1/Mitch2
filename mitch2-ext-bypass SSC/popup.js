'use strict';

function finished_Alice1(e,w) {
	browser.runtime.getBackgroundPage().then( function (bp) {
		bp.finished_Alice1();
		document.getElementById('message').innerHTML = "please log out alice";
		document.getElementById('main_button').value = "I logged out, continue....";
		document.getElementById('main_button').removeEventListener('click',function (e) { finished_Alice1();});
		document.getElementById('main_button').addEventListener('click', function (e) { logged_out_Alice1();});

	});
	
}

function logged_out_Alice1(e,w) {
	browser.runtime.getBackgroundPage().then( function (bp) {
		bp.logged_out_Alice1();
		document.getElementById('message').innerHTML = "ok, all should have been done";
		document.getElementById('main_button').value='draw a conclusion';
		document.getElementById('main_button').removeEventListener('click',function (e) {logged_out_Alice1();});
		document.getElementById('main_button').addEventListener('click', function (e) {make_conclusions();});
	});
}
function make_conclusions() {
    browser.runtime.getBackgroundPage().then( function (bp) {
		bp.make_conclusions();
		window.close();
	});
}

// getting the background page to access the data array
browser.runtime.getBackgroundPage().then( function (bkg) {

	if (bkg.phase == 0) {
		//modify by yy to show all the count information, just need to login alice and get these request,
		document.getElementById('sensitive_requests').innerHTML = bkg.collected_sensitive_requests;
		document.getElementById('total_requests').innerHTML = bkg.collected_total_request;
		document.getElementById('collected_get_sensitive_requests').innerHTML = bkg.collected_get_sensitive_requests;
		document.getElementById('collected_post_sensitive_requests').innerHTML = bkg.collected_post_sensitive_requests;
		document.getElementById('collected_get_requests').innerHTML = bkg.collected_get_requests;
		document.getElementById('collected_post_requests').innerHTML = bkg.collected_post_requests;
		document.getElementById('main_button').addEventListener('click', function (e) { finished_Alice1(); });
	} else if (bkg.phase == 1) {
		document.getElementById('message').innerHTML = "please log out alice";
		document.getElementById('main_button').value = "I logged out, continue....";
		document.getElementById('main_button').addEventListener('click', function (e) { logged_out_Alice1();});
	}else if (bkg.phase == 2) {
		document.getElementById('message').innerHTML = "ok, all should have been done";
		document.getElementById('main_button').value = "draw conclusion.....";
		document.getElementById('main_button').addEventListener('click', function (e) { make_conclusions();});
	} else {
		document.getElementById('message').innerHTML = "thank you for playing";
		document.getElementById('main_button').remove();
	}
	
});