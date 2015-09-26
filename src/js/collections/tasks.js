define(['jquery', 'backbone', 'taskModel'], function($, Backbone, Task) {
	//var api = 'http://localhost:3000/v1/stories',
	//	Stories;

	var Tasks = Backbone.Collection.extend({

	  // Reference to this collection's model.
	  "model": Task,

	  "initialize": function(models, options) {
	  	this.url = 'http://localhost:3000/v1/tasks';


	  },
	  //"url": api,
/*
	  "parse": function(response) {
	    return response;
	  }
*/
	});

  return Tasks;
});