define(['jquery', 'backbone', 'storyModel'], function($, Backbone, Story) {
	// var api = 'http://randomword.setgetgo.com/get.php',
	var api = 'http://localhost:3000/v1/stories',
		Stories;

	Stories = Backbone.Collection.extend({

	  // Reference to this collection's model.
	  "model": Story,

	  "url": api,

	  /*"parse": function(response) {

	    return response;
	  }*/

	});

  return Stories;
});