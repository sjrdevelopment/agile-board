define(['jquery', 'backbone', 'tasksCollection'], function($, Backbone, TasksCollection) {
	var tasks;

	var storyModel = Backbone.Model.extend({

		initialize: function() {
			//this.urlRoot = '/stories/' + this.get('id');
			this.urlRoot = 'v1/stories';
			this.idAttribute = 'id';
		},

		validate: function(attrs, options) {
		    debugger;
		}

		/*

		// Eg implememntation: 
		
		onChange:  function() {
			this.save({feature:'stubert'}, {patch:true})
		}

		*/
	});

    return storyModel;
});